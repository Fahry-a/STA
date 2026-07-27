#!/usr/bin/env node

/**
 * STA Endpoint Test Script
 * Tests all API endpoints with various input cases.
 *
 * Usage:
 *   node scripts/test-endpoints.mjs                         # test localhost:8787
 *   node scripts/test-endpoints.mjs https://sta.oryn.my.id  # test production
 *   API_KEY=xxx node scripts/test-endpoints.mjs             # test admin endpoints
 */

const BASE_URL = process.argv[2] || "http://localhost:8787";
const API_KEY = process.env.API_KEY || "";

// ─── Helpers ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const results = [];

async function fetchWithTimeout(resource, options = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), options.timeout || 8000);
  try {
    const res = await fetch(resource, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function request(method, path, body, headers = {}) {
  const url = `${BASE_URL}${path}`;
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    redirect: "manual",
  };
  if (body) opts.body = JSON.stringify(body);

  let res;
  try {
    res = await fetchWithTimeout(url, opts);
  } catch (e) {
    return { status: 0, json: null, headers: {}, error: e.message };
  }

  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, headers: Object.fromEntries(res.headers) };
}

function assert(label, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  \u2705 ${label}`);
  } else {
    failed++;
    console.log(`  \u274c ${label}${detail ? ` \u2014 ${detail}` : ""}`);
    results.push({ label, detail });
  }
}

function section(name) {
  console.log(`\n${"\u2500".repeat(60)}`);
  console.log(`  ${name}`);
  console.log(`${"\u2500".repeat(60)}`);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

async function testDeepl() {
  section("POST /deepl \u2014 DeepL Translation");

  // Basic translation
  let r = await request("POST", "/deepl", { text: "Hello, world!", target_lang: "DE" });
  assert("Basic translation returns 200", r.status === 200, `got ${r.status}`);
  assert("Response has data", typeof r.json?.data === "string" && r.json.data.length > 0);
  assert("Response has id", typeof r.json?.id === "number");
  assert("Response has source_lang", typeof r.json?.source_lang === "string");
  assert("Response has target_lang", typeof r.json?.target_lang === "string");
  assert("Response target_lang matches", r.json?.target_lang === "DE");

  // Auto-detect source language
  r = await request("POST", "/deepl", { text: "Bonjour le monde", target_lang: "EN" });
  assert("Auto-detect source language (200)", r.status === 200);

  // Explicit source language
  r = await request("POST", "/deepl", { text: "Hallo Welt", source_lang: "DE", target_lang: "EN" });
  assert("Explicit source_lang (200)", r.status === 200);
  assert("source_lang is DE", r.json?.source_lang === "DE");

  // source_lang=auto explicitly
  r = await request("POST", "/deepl", { text: "Ciao mondo", source_lang: "auto", target_lang: "EN" });
  assert("source_lang=auto explicit (200)", r.status === 200);

  // Text with special characters
  r = await request("POST", "/deepl", { text: "Caf\u00e9 R\u00e9sum\u00e9 \u00e0 la carte", target_lang: "EN" });
  assert("Special characters (200)", r.status === 200, `got ${r.status}`);

  // Text with unicode (Chinese)
  r = await request("POST", "/deepl", { text: "\u4f60\u597d\u4e16\u754c", target_lang: "EN" });
  assert("Unicode text (200)", r.status === 200, `got ${r.status}`);

  // Text with newlines
  r = await request("POST", "/deepl", { text: "Hello\nWorld\nTest", target_lang: "DE" });
  assert("Multiline text (200)", r.status === 200, `got ${r.status}`);

  // Empty text \u2192 400
  r = await request("POST", "/deepl", { text: "", target_lang: "EN" });
  assert("Empty text returns 400", r.status === 400);

  // Missing text \u2192 400
  r = await request("POST", "/deepl", { target_lang: "EN" });
  assert("Missing text returns 400", r.status === 400);

  // Text too long \u2192 413
  r = await request("POST", "/deepl", { text: "x".repeat(5001), target_lang: "EN" });
  assert("Oversized text returns 413", r.status === 413);

  // Missing target_lang \u2014 defaults to "en"
  r = await request("POST", "/deepl", { text: "Hello" });
  assert("Missing target_lang defaults to EN (200)", r.status === 200);
  assert("target_lang is EN", r.json?.target_lang === "EN");

  // Invalid JSON body \u2192 400
  r = await fetchWithTimeout(`${BASE_URL}/deepl`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "not json" });
  assert("Invalid JSON returns 400", r.status === 400);

  // GET method hint
  r = await request("GET", "/deepl");
  assert("GET /deepl returns hint message", r.status === 200 && typeof r.json === "string");
}

async function testGoogle() {
  section("POST /google \u2014 Google Translate");

  let r = await request("POST", "/google", { text: "Hello, world!", target_lang: "JA" });
  assert("Basic translation returns 200", r.status === 200, `got ${r.status}`);
  assert("Response has data", typeof r.json?.data === "string" && r.json.data.length > 0);
  assert("Response has target_lang", r.json?.target_lang === "JA");

  // Auto-detect
  r = await request("POST", "/google", { text: "Bonjour", target_lang: "EN" });
  assert("Auto-detect source language (200)", r.status === 200);

  // source_lang=auto
  r = await request("POST", "/google", { text: "Hola", source_lang: "auto", target_lang: "EN" });
  assert("source_lang=auto (200)", r.status === 200);

  // Special characters
  r = await request("POST", "/google", { text: "Caf\u00e9 \u00e0 la mode", target_lang: "EN" });
  assert("Special characters (200)", r.status === 200);

  // Newlines in text
  r = await request("POST", "/google", { text: "Hello\nWorld", target_lang: "DE" });
  assert("Multiline text (200)", r.status === 200);

  // Empty text \u2192 400
  r = await request("POST", "/google", { text: "", target_lang: "EN" });
  assert("Empty text returns 400", r.status === 400);

  // Missing target_lang \u2014 defaults to "en"
  r = await request("POST", "/google", { text: "Hello" });
  assert("Missing target_lang defaults to EN (200)", r.status === 200);

  // Text too long \u2192 413
  r = await request("POST", "/google", { text: "x".repeat(5001), target_lang: "EN" });
  assert("Oversized text returns 413", r.status === 413);

  // GET hint
  r = await request("GET", "/google");
  assert("GET /google returns hint message", r.status === 200);
}

async function testV2Translate() {
  section("POST /v2/translate \u2014 V2 Batch Translation");

  // APR=true (default)
  let r = await request("POST", "/v2/translate", {
    text: ["Hello", "World", "Goodbye"],
    target_lang: "DE",
  });
  assert("APR=true default \u2192 200", r.status === 200, `got ${r.status}`);
  assert("apr field is true", r.json?.apr === true);
  assert("data is array with 3 items", Array.isArray(r.json?.data) && r.json.data.length === 3);
  assert("Each item has success field", r.json?.data?.every(d => typeof d.success === "boolean"));
  assert("Each item has index field", r.json?.data?.every(d => typeof d.index === "number"));
  assert("Each item has text field", r.json?.data?.every(d => typeof d.text === "string"));

  // APR=true explicit
  r = await request("POST", "/v2/translate", {
    text: ["Hello", "World"],
    APR: true,
    target_lang: "JA",
  });
  assert("APR=true explicit \u2192 apr:true", r.json?.apr === true);

  // APR=false (combined)
  r = await request("POST", "/v2/translate", {
    text: ["Hello", "World"],
    APR: false,
    target_lang: "JA",
  });
  assert("APR=false \u2192 apr:false", r.json?.apr === false, `got apr=${r.json?.apr}`);

  // APR="false" (string sentinel \u2014 the bug we fixed)
  r = await request("POST", "/v2/translate", {
    text: ["Hello", "World"],
    APR: "false",
    target_lang: "JA",
  });
  assert('APR="false" string \u2192 apr:false', r.json?.apr === false, `got apr=${r.json?.apr}`);

  // APR="true" (string sentinel)
  r = await request("POST", "/v2/translate", {
    text: ["Hello", "World"],
    APR: "true",
    target_lang: "JA",
  });
  assert('APR="true" string \u2192 apr:true', r.json?.apr === true, `got apr=${r.json?.apr}`);

  // Single item array
  r = await request("POST", "/v2/translate", {
    text: ["Hello"],
    target_lang: "FR",
  });
  assert("Single item array \u2192 200", r.status === 200);
  assert("data has 1 item", r.json?.data?.length === 1);

  // Mixed language items (all same source_lang)
  r = await request("POST", "/v2/translate", {
    text: ["Hello", "World", "Test"],
    source_lang: "en",
    target_lang: "DE",
  });
  assert("Explicit source_lang (200)", r.status === 200);

  // Empty array \u2192 400
  r = await request("POST", "/v2/translate", { text: [], target_lang: "EN" });
  assert("Empty text array returns 400", r.status === 400);

  // Missing text \u2192 400
  r = await request("POST", "/v2/translate", { target_lang: "EN" });
  assert("Missing text returns 400", r.status === 400);

  // Too many items \u2192 400
  r = await request("POST", "/v2/translate", { text: Array(11).fill("test"), target_lang: "EN" });
  assert("11 items returns 400", r.status === 400);

  // Missing target_lang \u2192 400
  r = await request("POST", "/v2/translate", { text: ["Hello"] });
  assert("Missing target_lang returns 400", r.status === 400);

  // Text too long in APR mode \u2192 400
  r = await request("POST", "/v2/translate", {
    text: ["x".repeat(5001)],
    APR: true,
    target_lang: "EN",
  });
  assert("Oversized text in APR=true returns 400", r.status === 400);

  // GET method hint
  r = await request("GET", "/v2/translate");
  assert("GET /v2/translate redirects", r.status === 302 || r.status === 200, `got ${r.status}`);
}

async function testTranslate() {
  section("POST /translate \u2014 Legacy Endpoint");

  let r = await request("POST", "/translate", { text: "Hello", target_lang: "DE" });
  assert("Basic translation returns 200", r.status === 200);

  r = await request("GET", "/translate");
  assert("GET /translate returns hint", r.status === 200);
}

async function testDebug() {
  section("POST /debug \u2014 Debug Endpoint");

  // Without DEBUG_MODE, should return 404
  let r = await request("POST", "/debug", { text: "Hello", target_lang: "EN" });
  assert("Returns 404 when DEBUG_MODE is false", r.status === 404);
}

async function testHealth() {
  section("Health Endpoints");

  // GET /health (requires admin API key)
  const healthHeaders = API_KEY ? { "X-API-Key": API_KEY } : {};
  let r = await request("GET", "/health", null, healthHeaders);
  if (API_KEY) {
    assert("GET /health returns 200 or 503", r.status === 200 || r.status === 503);
    assert("Response has status field", ["healthy", "degraded", "unhealthy"].includes(r.json?.status));
    assert("Response has timestamp", typeof r.json?.timestamp === "string");
    assert("Response has version", typeof r.json?.version === "string");
    assert("Response has checks object", typeof r.json?.checks === "object");
  } else {
    assert("GET /health without API key returns 401", r.status === 401);
  }

  // GET /health/live (no auth required \u2014 load balancer probe)
  r = await request("GET", "/health/live");
  assert("GET /health/live returns 200", r.status === 200);
  assert("Response has status: alive", r.json?.status === "alive");
  assert("Response has timestamp", typeof r.json?.timestamp === "string");

  // GET /health/ready (requires admin API key)
  r = await request("GET", "/health/ready", null, healthHeaders);
  if (API_KEY) {
    assert("GET /health/ready returns 200 or 503", r.status === 200 || r.status === 503);
    assert("Response has ready field", typeof r.json?.ready === "boolean");
    assert("Response has status field", typeof r.json?.status === "string");
  } else {
    assert("GET /health/ready without API key returns 401", r.status === 401);
  }
}

async function testMetrics() {
  section("GET /metrics \u2014 Metrics (Admin)");

  // Without API key \u2192 401
  let r = await request("GET", "/metrics");
  assert("No API key \u2192 401", r.status === 401);

  // With wrong API key \u2192 401
  r = await request("GET", "/metrics", null, { "X-API-Key": "wrong-key" });
  assert("Wrong API key \u2192 401", r.status === 401);

  // With empty API key header \u2192 401
  r = await request("GET", "/metrics", null, { "X-API-Key": "" });
  assert("Empty API key \u2192 401", r.status === 401);

  // With API key \u2192 200 (if API_KEY is set)
  if (API_KEY) {
    r = await request("GET", "/metrics", null, { "X-API-Key": API_KEY });
    assert("Valid API key \u2192 200", r.status === 200);
    assert("Response has code: 200", r.json?.code === 200);
    assert("Response has data.performance", typeof r.json?.data?.performance === "object" || r.json?.data?.performance === null);
    assert("Response has data.proxy", typeof r.json?.data?.proxy === "object");
    assert("Response has data.cache", typeof r.json?.data?.cache === "object");
  } else {
    console.log("  \u23ed\ufe0f  Skipping authenticated test (set API_KEY env var)");
  }
}

async function testAdminWarmCache() {
  section("POST /admin/warm-cache \u2014 Cache Warming (Admin)");

  let r = await request("POST", "/admin/warm-cache");
  assert("No API key \u2192 401", r.status === 401);

  if (API_KEY) {
    r = await request("POST", "/admin/warm-cache", null, { "X-API-Key": API_KEY });
    assert("Valid API key \u2192 200", r.status === 200, `got ${r.status}`);
    if (r.status === 200) {
      assert("Response has warmed count", typeof r.json?.data?.warmed === "number");
      assert("Response has failed count", typeof r.json?.data?.failed === "number");
    }
  } else {
    console.log("  \u23ed\ufe0f  Skipping authenticated test (set API_KEY env var)");
  }
}

async function testAdminCacheStatus() {
  section("GET /admin/cache-status \u2014 Cache Status (Admin)");

  let r = await request("GET", "/admin/cache-status");
  assert("No API key \u2192 401", r.status === 401);

  if (API_KEY) {
    r = await request("GET", "/admin/cache-status", null, { "X-API-Key": API_KEY });
    assert("Valid API key \u2192 200", r.status === 200);
    assert("Response has totalPopular", typeof r.json?.data?.totalPopular === "number");
  } else {
    console.log("  \u23ed\ufe0f  Skipping authenticated test (set API_KEY env var)");
  }
}

async function testContentType() {
  section("Content-Type Validation");

  // Missing Content-Type \u2192 415
  let r = await fetchWithTimeout(`${BASE_URL}/deepl`, {
    method: "POST",
    body: JSON.stringify({ text: "Hello", target_lang: "EN" }),
  });
  assert("Missing Content-Type \u2192 415", r.status === 415, `got ${r.status}`);

  // Wrong Content-Type \u2192 415
  r = await fetchWithTimeout(`${BASE_URL}/deepl`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "Hello",
  });
  assert("Wrong Content-Type \u2192 415", r.status === 415, `got ${r.status}`);
}

async function testSecurityHeaders() {
  section("Security Headers");

  let r = await request("GET", "/health/live");
  assert("X-Content-Type-Options: nosniff", r.headers["x-content-type-options"] === "nosniff");
  assert("X-Frame-Options: DENY", r.headers["x-frame-options"] === "DENY");
  assert("Referrer-Policy present", typeof r.headers["referrer-policy"] === "string");
  assert("Content-Security-Policy present", typeof r.headers["content-security-policy"] === "string");
  assert("Permissions-Policy present", typeof r.headers["permissions-policy"] === "string");
}

async function testCatchAll() {
  section("Catch-all Redirect");

  let r = await request("GET", "/nonexistent-path");
  assert("Unknown path returns 302 or 200", r.status === 302 || r.status === 200, `got ${r.status}`);
}

async function testRateLimiting() {
  section("Rate Limiting (burst test)");

  try {
    // Fire 5 rapid requests \u2014 should complete without crash
    const promises = Array.from({ length: 5 }, (_, i) =>
      request("POST", "/deepl", { text: `Test burst ${i}`, target_lang: "EN" })
    );
    const responses = await Promise.all(promises);
    const allCompleted = responses.every(r => [200, 429].includes(r.status));
    assert("5 rapid requests complete without crash", allCompleted);
    const succeeded = responses.filter(r => r.status === 200).length;
    const rateLimited = responses.filter(r => r.status === 429).length;
    console.log(`  \ud83d\udcca ${succeeded} succeeded, ${rateLimited} rate-limited`);
  } catch {
    console.log("  \u23ed\ufe0f  Skipped (network timeout on burst test)");
  }
}

async function testCORS() {
  section("CORS Headers");

  // CORS preflight — Access-Control-Allow-Origin is set on OPTIONS responses
  let r = await fetchWithTimeout(`${BASE_URL}/deepl`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://example.com",
      "Access-Control-Request-Method": "POST",
    },
  });
  assert("OPTIONS preflight returns 200", r.status === 200);
  assert("Access-Control-Allow-Origin: *", r.headers.get("access-control-allow-origin") === "*");
  assert("Access-Control-Allow-Methods present", typeof r.headers.get("access-control-allow-methods") === "string");
  assert("Access-Control-Allow-Headers present", typeof r.headers.get("access-control-allow-headers") === "string");
  assert("Access-Control-Max-Age present", typeof r.headers.get("access-control-max-age") === "string");
}

async function testLanguageValidation() {
  section("Language Code Validation");

  // Invalid target_lang
  let r = await request("POST", "/deepl", { text: "Hello", target_lang: "invalid" });
  assert("Invalid target_lang returns 400", r.status === 400, `got ${r.status}`);

  // Invalid source_lang
  r = await request("POST", "/deepl", { text: "Hello", source_lang: "invalid", target_lang: "EN" });
  assert("Invalid source_lang returns 400", r.status === 400);

  // target_lang=auto \u2192 400
  r = await request("POST", "/deepl", { text: "Hello", target_lang: "auto" });
  assert("target_lang=auto returns 400", r.status === 400);
}

// \u2500\u2500\u2500 Main \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

async function main() {
  console.log(`\n\ud83e\uddea STA Endpoint Tests`);
  console.log(`   Target: ${BASE_URL}`);
  console.log(`   API Key: ${API_KEY ? "(set)" : "(not set \u2014 admin tests skipped)"}`);

  await testDeepl();
  await testGoogle();
  await testV2Translate();
  await testTranslate();
  await testDebug();
  await testHealth();
  await testMetrics();
  await testAdminWarmCache();
  await testAdminCacheStatus();
  await testContentType();
  await testSecurityHeaders();
  await testCORS();
  await testLanguageValidation();
  await testCatchAll();
  await testRateLimiting();

  console.log(`\n${"\u2550".repeat(60)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`${"\u2550".repeat(60)}\n`);

  if (failed > 0) {
    console.log("Failed tests:");
    results.forEach(r => console.log(`  \u274c ${r.label}${r.detail ? ` \u2014 ${r.detail}` : ""}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
