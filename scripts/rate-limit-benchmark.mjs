#!/usr/bin/env node
/**
 * Rate-limit benchmark: legacy DeepL JSON-RPC (www2.deepl.com/jsonrpc)
 * vs oneshot endpoint (oneshot-free.www.deepl.com/v1/translate) used by DLX.
 *
 * Single-file, zero-dependency Node.js script. Uses global fetch (Node >= 18).
 *
 * Methodology
 * ------------
 * - Fires a configurable number of requests against each endpoint in parallel
 *   at a configurable concurrency level.
 * - Records status codes, latencies (ms), and error messages.
 * - Prints a per-endpoint summary: success rate (2xx), 429 count, other-error count,
 *   p50/p95/p99 latency, requests/sec observed.
 *
 * Usage
 * -----
 *   node scripts/rate-limit-benchmark.mjs
 *   ITERATIONS=100 CONCURRENCY=20 node scripts/rate-limit-benchmark.mjs
 *   TEXT="Hello world" TARGET_LANG=JA node scripts/rate-limit-benchmark.mjs
 *
 * Notes
 * -----
 * - This script hits DeepL directly. Use respectfully, keep ITERATIONS modest.
 * - oneshot endpoint requires `Authorization: None` header and a Chrome-style
 *   `Origin: chrome-extension://...` header (mimics the official DeepL extension).
 * - JSON-RPC endpoint requires obfuscated timestamp based on the count of letter
 *   "i" (DeepL's quirky anti-bot trick) and an alternating "method" spacing.
 * - Both implementations here mirror what DeepLX (Cloudflare variant) and DLX (Go)
 *   actually send, so the comparison is apples-to-apples at the protocol level.
 */

// ---------------------------------------------------------------------------
// Config (env-overridable)
// ---------------------------------------------------------------------------
const ITERATIONS = Number(process.env.ITERATIONS ?? 40);
const CONCURRENCY = Number(process.env.CONCURRENCY ?? 10);
const TEXT = process.env.TEXT ?? "The quick brown fox jumps over the lazy dog. Translation testing. Hello world.";
const SOURCE_LANG = (process.env.SOURCE_LANG ?? "EN").toUpperCase(); // "" or "auto" => autodetect
const TARGET_LANG = (process.env.TARGET_LANG ?? "DE").toUpperCase(); // oneshot needs BCP-47-ish form
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 20000);
const VERBOSE = process.env.VERBOSE === "1" || process.env.VERBOSE === "true";

// ---------------------------------------------------------------------------
// Constants (mirror the real implementations)
// ---------------------------------------------------------------------------
const JSONRPC_URL = "https://www2.deepl.com/jsonrpc";
const ONESHOT_URL = "https://oneshot-free.www.deepl.com/v1/translate";
const CHROME_EXT_ID = "cofdbpoegempjloogbagkncekinflcnj";
const CHROME_MAJOR = "120";
const EXT_VERSION = "1.86.0";

// DLX's ID-based instance UUID (RFC 4122 v4). Stable per process run.
const INSTANCE_ID = makeInstanceID();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

function pct(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

function nowMs() { return performance.now(); }

/** RFC 4122 v4 UUID, like DLX's newInstanceID() in Go. */
function makeInstanceID() {
  const b = new Uint8Array(16);
  globalThis.crypto.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** DeepL's letter-"i" obfuscation trick for JSON-RPC timestamp. Mirrors DeepLX getTimestamp(). */
function countLetterI(t) { return (t.match(/i/g) || []).length; }
function deeplTimestamp(text) {
  const ts = Date.now();
  const mod = countLetterI(text) + 1;
  if (mod <= 0 || mod > 1000) return ts;
  const modified = ts - (ts % mod) + mod;
  return (modified > 0 && modified <= Number.MAX_SAFE_INTEGER) ? modified : ts;
}

function deeplRequestId() {
  const ts = Date.now();
  const rnd = Math.floor(Math.random() * 1_000_000);
  return Math.floor((ts % 100_000_000) + (rnd % 100_000_000));
}

/** Maps an uppercase caller code (e.g. "DE", "EN", "ZH") to the lowercase BCP-47-ish
 *  form DLX/oneshot expects. Mirrors DLX's targetLangMap.
 */
const TARGET_LANG_MAP = {
  "AR": "ar", "BG": "bg", "CS": "cs", "DA": "da", "DE": "de", "EL": "el",
  "EN-GB": "en-GB", "EN-US": "en-US",
  "ES": "es", "ES-419": "es-419", "ET": "et", "FI": "fi", "FR": "fr",
  "HE": "he", "HU": "hu", "ID": "id", "IT": "it", "JA": "ja", "KO": "ko",
  "LT": "lt", "LV": "lv", "NB": "nb", "NL": "nl", "PL": "pl",
  "PT-BR": "pt-BR", "PT-PT": "pt-PT",
  "RO": "ro", "RU": "ru", "SK": "sk", "SL": "sl", "SV": "sv",
  "TR": "tr", "UK": "uk", "VI": "vi",
  "ZH": "zh-Hans", "ZH-HANS": "zh-Hans", "ZH-HANT": "zh-Hant",
  "EN": "en-US", "PT": "pt-BR",
};

function resolveTargetLang(code) {
  if (!code || code.toLowerCase() === "auto") {
    throw new Error("target_lang cannot be empty / auto for oneshot");
  }
  const v = TARGET_LANG_MAP[code.toUpperCase()];
  if (!v) throw new Error(`unsupported target_lang "${code}"`);
  return v;
}

function normalizeJsonrpcLang(code) {
  if (!code || code.toLowerCase() === "auto") return "auto";
  return code.toUpperCase();
}

async function fetchWithTimeout(url, opts, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = nowMs();
  try {
    const res = await fetch(url, { ...opts, signal: controller.signal });
    const elapsed = nowMs() - t0;
    let bodyText = "";
    try { bodyText = await res.text(); } catch { /* ignore */ }
    return { ok: res.ok, status: res.status, elapsed, body: bodyText.slice(0, 500) };
  } catch (err) {
    const elapsed = nowMs() - t0;
    const aborted = err?.name === "AbortError";
    return {
      ok: false,
      status: aborted ? 408 : 0,
      elapsed,
      body: aborted ? "timeout" : (err?.message || String(err)),
    };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Request builders
// ---------------------------------------------------------------------------

/** Build a www2.deepl.com/jsonrpc (LMT_handle_texts) body — mirrors DeepLX buildRequestBody. */
function buildJsonrpcBody(text, srcLang, tgtLang) {
  const id = deeplRequestId();
  const req = {
    jsonrpc: "2.0",
    method: "LMT_handle_texts",
    id,
    params: {
      texts: [{ text, requestAlternatives: 0 }],
      timestamp: deeplTimestamp(text),
      splitting: "newlines",
      lang: {
        source_lang_user_selected: normalizeJsonrpcLang(srcLang),
        target_lang: normalizeJsonrpcLang(tgtLang),
      },
    },
  };
  let s = JSON.stringify(req);
  // DeepL's quirky method-spacing alternate format
  if ((id + 5) % 29 === 0 || (id + 3) % 13 === 0) {
    s = s.replace('"method":"', '"method" : "');
  } else {
    s = s.replace('"method":"', '"method": "');
  }
  return s;
}

/** Build a oneshot-free.www.deepl.com/v1/translate body — mirrors DLX oneshotRequest. */
function buildOneshotBody(text, srcLang, tgtLang) {
  const resolvedTarget = resolveTargetLang(tgtLang);
  const resolvedSource =
    !srcLang || srcLang.toLowerCase() === "auto" ? "" : (TARGET_LANG_MAP[srcLang.toUpperCase()] || srcLang.toLowerCase());
  const payload = {
    text: [text],
    target_lang: resolvedTarget,
    usage_type: "Translate",
    app_information: {
      os: "brex_macOS",
      os_version: `brex_chrome_${CHROME_MAJOR}.0.0.0`,
      app_version: EXT_VERSION,
      app_build: "chrome_web_store",
      instance_id: INSTANCE_ID,
    },
  };
  if (resolvedSource) payload.source_lang = resolvedSource;
  return JSON.stringify(payload);
}

// ---------------------------------------------------------------------------
// Response parsing (best-effort — we mainly care about status code)
// ---------------------------------------------------------------------------

function parseJsonrpcSuccess(body) {
  try {
    const j = JSON.parse(body);
    if (j?.error) return { ok: false, text: null, message: JSON.stringify(j.error) };
    const t = j?.result?.texts?.[0]?.text;
    return { ok: !!t, text: t ?? null, message: t ? null : "missing texts[0].text" };
  } catch (e) { return { ok: false, text: null, message: `parse: ${e.message}` }; }
}

function parseOneshotSuccess(body) {
  try {
    const j = JSON.parse(body);
    if (j?.errors) return { ok: false, text: null, message: JSON.stringify(j.errors) };
    const t = j?.translations?.[0]?.text;
    return { ok: !!t, text: t ?? null, message: t ? null : "missing translations[0].text" };
  } catch (e) { return { ok: false, text: null, message: `parse: ${e.message}` }; }
}

// ---------------------------------------------------------------------------
// Sender
// ---------------------------------------------------------------------------

async function sendJsonrpc(text, srcLang, tgtLang) {
  const body = buildJsonrpcBody(text, srcLang, tgtLang);
  const res = await fetchWithTimeout(JSONRPC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      "Origin": "https://www.deepl.com",
      "Referer": "https://www.deepl.com/",
      "Connection": "keep-alive",
      "Sec-Fetch-Dest": "empty",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-site",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    body,
  }, TIMEOUT_MS);
  const parsed = parseJsonrpcSuccess(res.body);
  return {
    endpoint: "jsonrpc",
    status: res.status,
    ok: res.ok && parsed.ok,
    elapsed: res.elapsed,
    rateLimited: res.status === 429,
    serverError: res.status >= 500,
    clientError: res.status >= 400 && res.status < 500 && res.status !== 429,
    message: parsed.message || res.body,
    translated: parsed.text,
  };
}

async function sendOneshot(text, srcLang, tgtLang) {
  const body = buildOneshotBody(text, srcLang, tgtLang);
  const res = await fetchWithTimeout(ONESHOT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "*/*",
      "Authorization": "None",
      "Origin": `chrome-extension://${CHROME_EXT_ID}`,
      "Sec-Fetch-Site": "cross-site",
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Dest": "empty",
      "Accept-Encoding": "gzip, deflate, br",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
    body,
  }, TIMEOUT_MS);
  const parsed = parseOneshotSuccess(res.body);
  return {
    endpoint: "oneshot",
    status: res.status,
    ok: res.ok && parsed.ok,
    elapsed: res.elapsed,
    rateLimited: res.status === 429,
    serverError: res.status >= 500,
    clientError: res.status >= 400 && res.status < 500 && res.status !== 429,
    message: parsed.message || res.body,
    translated: parsed.text,
  };
}

// ---------------------------------------------------------------------------
// Concurrency-controlled runner
// ---------------------------------------------------------------------------

async function runOne(name, sender, iterations, concurrency, text, srcLang, tgtLang) {
  const results = [];
  const inflight = [];
  let started = 0;
  const t0 = nowMs();

  async function worker() {
    while (started < iterations) {
      const idx = started++;
      const r = await sender(text, srcLang, tgtLang);
      r.index = idx;
      results.push(r);
      if (VERBOSE) {
        const flag = r.ok ? "OK" : r.rateLimited ? "429" : `ERR${r.status}`;
        console.log(`  ${name}#${idx}: ${flag} (${Math.round(r.elapsed)}ms)${r.translated ? ` => "${String(r.translated).slice(0, 60)}..."` : ""}`);
      }
    }
  }

  for (let i = 0; i < concurrency; i++) inflight.push(worker());
  await Promise.all(inflight);

  const wallTimeSec = (nowMs() - t0) / 1000;
  return { name, results, wallTimeSec };
}

function summarize({ name, results, wallTimeSec }) {
  const n = results.length;
  const ok = results.filter((r) => r.ok).length;
  const rl = results.filter((r) => r.rateLimited).length;
  const srv = results.filter((r) => r.serverError).length;
  const cli = results.filter((r) => r.clientError).length;
  const timeouts = results.filter((r) => r.status === 408).length;
  const lats = results.map((r) => r.elapsed).sort((a, b) => a - b);
  const rps = wallTimeSec > 0 ? (n / wallTimeSec) : 0;

  return {
    name,
    n,
    ok,
    rateLimited: rl,
    serverErrors: srv,
    clientErrors: cli,
    timeouts,
    successRate: n ? (ok / n) * 100 : 0,
    rateLimitRate: n ? (rl / n) * 100 : 0,
    p50: Math.round(pct(lats, 50)),
    p95: Math.round(pct(lats, 95)),
    p99: Math.round(pct(lats, 99)),
    rps: rps.toFixed(1),
    wallTimeSec: wallTimeSec.toFixed(2),
  };
}

function printSummary(s) {
  console.log(
    `\n=== ${s.name} ===
  requests total      : ${s.n}
  success (2xx+parse) : ${s.ok}  (${s.successRate.toFixed(1)}%)
  429 rate-limited     : ${s.rateLimited}  (${s.rateLimitRate.toFixed(1)}%)
  5xx server errors   : ${s.serverErrors}
  4xx client errors   : ${s.clientErrors}
  timeouts            : ${s.timeouts}
  latency p50/p95/p99 : ${s.p50}ms / ${s.p95}ms / ${s.p99}ms
  wall time           : ${s.wallTimeSec}s
  throughput          : ${s.rps} req/s`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(70));
  console.log("DeepL rate-limit benchmark: JSON-RPC vs oneshot");
  console.log("=".repeat(70));
  console.log(`iterations : ${ITERATIONS}`);
  console.log(`concurrency : ${CONCURRENCY}`);
  console.log(`text        : "${TEXT.slice(0, 60)}${TEXT.length > 60 ? "..." : ""}"  (${TEXT.length} chars)`);
  console.log(`source_lang : ${SOURCE_LANG}`);
  console.log(`target_lang : ${TARGET_LANG}`);
  console.log(`timeout     : ${TIMEOUT_MS}ms`);
  console.log(`instance_id : ${INSTANCE_ID}`);
  console.log("-".repeat(70));

  // Quick sanity single-shot first so we know both endpoints are reachable
  console.log("\n[1/3] Sanity: one request each (sequential)...");
  const s1 = await sendJsonrpc(TEXT, SOURCE_LANG, TARGET_LANG);
  console.log(`  jsonrpc  status=${s1.status} ${s1.ok ? "OK" : "FAIL"} (${Math.round(s1.elapsed)}ms)${s1.translated ? ` => ${JSON.stringify(s1.translated).slice(0, 80)}` : ""}${!s1.ok && s1.message ? ` | ${String(s1.message).slice(0, 160)}` : ""}`);

  const s2 = await sendOneshot(TEXT, SOURCE_LANG, TARGET_LANG);
  console.log(`  oneshot  status=${s2.status} ${s2.ok ? "OK" : "FAIL"} (${Math.round(s2.elapsed)}ms)${s2.translated ? ` => ${JSON.stringify(s2.translated).slice(0, 80)}` : ""}${!s2.ok && s2.message ? ` | ${String(s2.message).slice(0, 160)}` : ""}`);

  if (!s1.ok && !s2.ok) {
    console.log("\n⚠ Both endpoints failed sanity check. Either DeepL is blocking this IP already,");
    console.log("  or the test is being run from a data-center IP that DeepL has flagged.");
    console.log("  Abort? (Ctrl-C) or continuing anyway with the parallel load test...\n");
    await sleep(2000);
  }

  // Benchmark JSON-RPC
  console.log(`\n[2/3] Blast JSON-RPC: ${ITERATIONS} requests @ concurrency ${CONCURRENCY}...`);
  const jsonrpcRun = await runOne("JSON-RPC (www2.deepl.com/jsonrpc)", sendJsonrpc, ITERATIONS, CONCURRENCY, TEXT, SOURCE_LANG, TARGET_LANG);
  printSummary(summarize(jsonrpcRun));

  // Cooldown to make the test honest — let any IP-level 429 cool off
  console.log("\n  cooldown 8s between targets to avoid cross-contamination...");
  await sleep(8000);

  // Benchmark oneshot
  console.log(`\n[3/3] Blast oneshot: ${ITERATIONS} requests @ concurrency ${CONCURRENCY}...`);
  const oneshotRun = await runOne("oneshot (oneshot-free.www.deepl.com/v1/translate)", sendOneshot, ITERATIONS, CONCURRENCY, TEXT, SOURCE_LANG, TARGET_LANG);
  printSummary(summarize(oneshotRun));

  // Side-by-side
  const a = summarize(jsonrpcRun);
  const b = summarize(oneshotRun);
  console.log("\n" + "=".repeat(70));
  console.log("Side-by-side");
  console.log("=".repeat(70));
  console.log("metric                       jsonrpc              oneshot             delta");
  const rows = [
    ["success %", a.successRate.toFixed(1) + "%", b.successRate.toFixed(1) + "%", (b.successRate - a.successRate).toFixed(1) + "pp"],
    ["429 rate %", a.rateLimitRate.toFixed(1) + "%", b.rateLimitRate.toFixed(1) + "%", (b.rateLimitRate - a.rateLimitRate).toFixed(1) + "pp"],
    ["5xx errors", String(a.serverErrors), String(b.serverErrors), String(b.serverErrors - a.serverErrors)],
    ["timeouts", String(a.timeouts), String(b.timeouts), String(b.timeouts - a.timeouts)],
    ["p50 latency", a.p50 + "ms", b.p50 + "ms", (b.p50 - a.p50) + "ms"],
    ["p95 latency", a.p95 + "ms", b.p95 + "ms", (b.p95 - a.p95) + "ms"],
    ["throughput", a.rps + " req/s", b.rps + " req/s", "--"],
  ];
  for (const row of rows) {
    console.log(row[0].padEnd(28) + row[1].padEnd(21) + row[2].padEnd(20) + row[3]);
  }
  const winner = b.rateLimitRate < a.rateLimitRate && b.successRate > a.successRate
    ? "Oneshot wins (fewer 429s, higher success). Consistent with DLX's design rationale."
    : a.rateLimitRate < b.rateLimitRate && a.successRate > b.successRate
      ? "JSON-RPC wins. The legacy path is still working from this IP."
      : "Mixed result. Re-run from another IP or higher iterations.";
  console.log("\nVerdict: " + winner);
  console.log("\nNote: this IP-test measures *raw* endpoint behavior, not DLX/DeepLX app-layer");
  console.log("shields (cache, rate-limit, circuit breaker). For fair comparison, run from several");
  console.log("IPs (VPS + home + mobile) and report which endpoint trips first.");
}

main().catch((e) => {
  console.error("Fatal:", e?.stack || e);
  process.exit(1);
});
