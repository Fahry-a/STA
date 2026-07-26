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

async function request(method, path, body, headers = {}) {
  const url = `${BASE_URL}${path}`;
  const opts = {
    method,
    headers: { "Content-Type": "application/json", ...headers },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json, headers: Object.fromEntries(res.headers) };
}

function assert(label, condition, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    results.push({ label, detail });
  }
}

function section(name) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`  ${name}`);
  console.log(`${"─".repeat(60)}`);
}

// ─── Tests ──────────────────────────────────────────────────────────────────

async function testDeepl() {
  section("POST /deepl — DeepL Translation");

  // Basic translation
  let r = await request("POST", "/deepl", { text: "Hello, world!", target_lang: "DE" });
  assert("Basic translation returns 200", r.status === 200, `got ${r.status}`);
  assert("Response has data", typeof r.json?.data === "string" && r.json.data.length > 0);
  assert("Response has id", typeof r.json?.id === "number");
  assert("Response has source_lang", typeof r.json?.source_lang === "string");
  assert("Response has target_lang", typeof r.json?.target_lang === "string");

  // Auto-detect source language
  r = await request("POST", "/deepl", { text: "Bonjour le monde", target_lang: "EN" });
  assert("Auto-detect source language (200)", r.status === 200);

  // Explicit source language
  r = await request("POST", "/deepl", { text: "Hallo Welt", source_lang: "DE", target_lang: "EN" });
  assert("Explicit source_lang (200)", r.status === 200);

  // Empty text → 400
  r = await request("POST", "/deepl", { text: "", target_lang: "EN" });
  assert("Empty text returns 400", r.status === 400);

  // Missing text → 400
  r = await request("POST", "/deepl", { target_lang: "EN" });
  assert("Missing text returns 400", r.status === 400);

  // Text too long → 413
  r = await request("POST", "/deepl", { text: "x".repeat(5001), target_lang: "EN" });
  assert("Oversized text returns 413", r.status === 413);

  // Missing target_lang — defaults to "en"
  r = await request("POST", "/deepl", { text: "Hello" });
  assert("Missing target_lang defaults to EN (200)", r.status === 200);

  // Invalid JSON body → 400
  r = await request("POST", "/deepl", null);
  r = await fetch(`${BASE_URL}/deepl`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "not json" });
  assert("Invalid JSON returns 400", r.status === 400);

  // GET method hint
  r = await request("GET", "/deepl");
  assert("GET /deepl returns hint message", r.status === 200 && typeof r.json === "string");
}

async function testGoogle() {
  section("POST /google — Google Translate");

  let r = await request("POST", "/google", { text: "Hello, world!", target_lang: "JA" });
  assert("Basic translation returns 200", r.status === 200, `got ${r.status}`);
  assert("Response has data", typeof r.json?.data === "string" && r.json.data.length > 0);

  // Auto-detect
  r = await request("POST", "/google", { text: "Bonjour", target_lang: "EN" });
  assert("Auto-detect source language (200)", r.status === 200);

  // Empty text → 400
  r = await request("POST", "/google", { text: "", target_lang: "EN" });
  assert("Empty text returns 400", r.status === 400);

  // Missing target_lang — defaults to "en"
  r = await request("POST", "/google", { text: "Hello" });
  assert("Missing target_lang defaults to EN (200)", r.status === 200);

  // Text too long → 413
  r = await request("POST", "/google", { text: "x".repeat(5001), target_lang: "EN" });
  assert("Oversized text returns 413", r.status === 413);

  // GET hint
  r = await request("GET", "/google");
  assert("GET /google returns hint message", r.status === 200);
}

async function testV2Translate() {
  section("POST /v2/translate — V2 Batch Translation");

  // APR=true (default)
  let r = await request("POST", "/v2/translate", {
    text: ["Hello", "World", "Goodbye"],
    target_lang: "DE",
  });
  assert("APR=true default → 200", r.status === 200, `got ${r.status}`);
  assert("apr field is true", r.json?.apr === true);
  assert("data is array with 3 items", Array.isArray(r.json?.data) && r.json.data.length === 3);
  assert("Each item has success field", r.json?.data?.every(d => typeof d.success === "boolean"));
  assert("Each item has index field", r.json?.data?.every(d => typeof d.index === "number"));

  // APR=true explicit
  r = await request("POST", "/v2/translate", {
    text: ["Hello", "World"],
    APR: true,
    target_lang: "JA",
  });
  assert("APR=true explicit → apr:true", r.json?.apr === true);

  // APR=false (combined)
  r = await request("POST", "/v2/translate", {
    text: ["Hello", "World"],
    APR: false,
    target_lang: "JA",
  });
  assert("APR=false → apr:false", r.json?.apr === false, `got apr=${r.json?.apr}`);

  // APR="false" (string sentinel — the bug we fixed)
  r = await request("POST", "/v2/translate", {
    text: ["Hello", "World"],
    APR: "false",
    target_lang: "JA",
  });
  assert('APR="false" string → apr:false', r.json?.apr === false, `got apr=${r.json?.apr}`);

  // APR="true" (string sentinel)
  r = await request("POST", "/v2/translate", {
    text: ["Hello", "World"],
    APR: "true",
    target_lang: "JA",
  });
  assert('APR="true" string → apr:true', r.json?.apr === true, `got apr=${r.json?.apr}`);

  // Empty array → 400
  r = await request("POST", "/v2/translate", { text: [], target_lang: "EN" });
  assert("Empty text array returns 400", r.status === 400);

  // Missing text → 400
  r = await request("POST", "/v2/translate", { target_lang: "EN" });
  assert("Missing text returns 400", r.status === 400);

  // Too many items → 400
  r = await request("POST", "/v2/translate", { text: Array(11).fill("test"), target_lang: "EN" });
  assert("11 items returns 400", r.status === 400);

  // Missing target_lang → 400
  r = await request("POST", "/v2/translate", { text: ["Hello"] });
  assert("Missing target_lang returns 400", r.status === 400);

  // Text too long in APR mode → 400
  r = await request("POST", "/v2/translate", {
    text: ["x".repeat(5001)],
    APR: true,
    target_lang: "EN",
  });
  assert("Oversized text in APR=true returns 400", r.status === 400);

  // GET method hint (via catch-all)
  r = await request("GET", "/v2/translate");
  assert("GET /v2/translate redirects", r.status === 302 || r.status === 200);
}

async function testTranslate() {
  section("POST /translate — Legacy Endpoint");

  let r = await request("POST", "/translate", { text: "Hello", target_lang: "DE" });
  assert("Basic translation returns 200", r.status === 200);

  r = await request("GET", "/translate");
  assert("GET /translate returns hint", r.status === 200);
}

async function testDebug() {
  section("POST /debug — Debug Endpoint");

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
  } else {
    assert("GET /health without API key returns 401", r.status === 401);
  }

  // GET /health/live (no auth required — load balancer probe)
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
  section("GET /metrics — Metrics (Admin)");

  // Without API key → 401
  let r = await request("GET", "/metrics");
  assert("No API key → 401", r.status === 401);

  // With wrong API key → 401
  r = await request("GET", "/metrics", null, { "X-API-Key": "wrong-key" });
  assert("Wrong API key → 401", r.status === 401);

  // With API key → 200 (if API_KEY is set)
  if (API_KEY) {
    r = await request("GET", "/metrics", null, { "X-API-Key": API_KEY });
    assert("Valid API key → 200", r.status === 200);
    assert("Response has code: 200", r.json?.code === 200);
  } else {
    console.log("  ⏭️  Skipping authenticated test (set API_KEY env var)");
  }
}

async function testAdminWarmCache() {
  section("POST /admin/warm-cache — Cache Warming (Admin)");

  let r = await request("POST", "/admin/warm-cache");
  assert("No API key → 401", r.status === 401);

  if (API_KEY) {
    r = await request("POST", "/admin/warm-cache", null, { "X-API-Key": API_KEY });
    assert("Valid API key → 200", r.status === 200);
    assert("Response has warmed count", typeof r.json?.data?.warmed === "number");
  } else {
    console.log("  ⏭️  Skipping authenticated test (set API_KEY env var)");
  }
}

async function testAdminCacheStatus() {
  section("GET /admin/cache-status — Cache Status (Admin)");

  let r = await request("GET", "/admin/cache-status");
  assert("No API key → 401", r.status === 401);

  if (API_KEY) {
    r = await request("GET", "/admin/cache-status", null, { "X-API-Key": API_KEY });
    assert("Valid API key → 200", r.status === 200);
  } else {
    console.log("  ⏭️  Skipping authenticated test (set API_KEY env var)");
  }
}

async function testContentType() {
  section("Content-Type Validation");

  // Missing Content-Type → 415
  let r = await fetch(`${BASE_URL}/deepl`, {
    method: "POST",
    body: JSON.stringify({ text: "Hello", target_lang: "EN" }),
  });
  assert("Missing Content-Type → 415", r.status === 415, `got ${r.status}`);

  // Wrong Content-Type → 415
  r = await fetch(`${BASE_URL}/deepl`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: "Hello",
  });
  assert("Wrong Content-Type → 415", r.status === 415, `got ${r.status}`);
}

async function testSecurityHeaders() {
  section("Security Headers");

  let r = await request("GET", "/health");
  assert("X-Content-Type-Options: nosniff", r.headers["x-content-type-options"] === "nosniff");
  assert("X-Frame-Options: DENY", r.headers["x-frame-options"] === "DENY");
  assert("X-XSS-Protection present", typeof r.headers["x-xss-protection"] === "string");
  assert("Referrer-Policy present", typeof r.headers["referrer-policy"] === "string");
  assert("Content-Security-Policy present", typeof r.headers["content-security-policy"] === "string");
}

async function testCatchAll() {
  section("Catch-all Redirect");

  try {
    let r = await request("GET", "/nonexistent-path");
    // Hono may return 302 (redirect) or 200 (if middleware catches it)
    assert("Unknown path returns redirect or 200", r.status === 302 || r.status === 200, `got ${r.status}`);
  } catch {
    console.log("  ⏭️  Skipped (external redirect target unreachable)");
  }
}

async function testRateLimiting() {
  section("Rate Limiting (burst test)");

  try {
    // Fire 3 rapid requests — should complete without crash
    const promises = Array.from({ length: 3 }, (_, i) =>
      request("POST", "/deepl", { text: `Test burst ${i}`, target_lang: "EN" })
    );
    const responses = await Promise.all(promises);
    const allCompleted = responses.every(r => [200, 429].includes(r.status));
    assert("3 rapid requests complete without crash", allCompleted);
    const rateLimited = responses.filter(r => r.status === 429).length;
    console.log(`  📊 ${3 - rateLimited} succeeded, ${rateLimited} rate-limited`);
  } catch {
    console.log("  ⏭️  Skipped (network timeout on burst test)");
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🧪 STA Endpoint Tests`);
  console.log(`   Target: ${BASE_URL}`);
  console.log(`   API Key: ${API_KEY ? "(set)" : "(not set — admin tests skipped)"}`);

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
  await testCatchAll();
  await testRateLimiting();

  console.log(`\n${"═".repeat(60)}`);
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log(`${"═".repeat(60)}\n`);

  if (failed > 0) {
    console.log("Failed tests:");
    results.forEach(r => console.log(`  ❌ ${r.label}${r.detail ? ` — ${r.detail}` : ""}`));
    process.exit(1);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
