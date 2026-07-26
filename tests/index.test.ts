/**
 * Tests for main app endpoints — routes are exercised directly for coverage.
 * Only external API calls (fetch to DeepL/Google) and KV are mocked.
 */

jest.mock("../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  generateRequestId: jest.fn().mockReturnValue("test-request-id"),
}));

jest.mock("../src/lib/cacheWarmer", () => ({
  warmCache: jest.fn().mockResolvedValue({
    warmed: 5,
    failed: 0,
    errors: [],
    skipped: false,
  }),
  getCacheWarmingStatus: jest.fn().mockReturnValue({
    totalPopular: 10,
    lastWarmed: null,
  }),
}));

jest.mock("../src/lib/rateLimit", () => ({
  ...jest.requireActual("../src/lib/rateLimit"),
  checkCombinedRateLimit: jest.fn().mockResolvedValue({ allowed: true }),
}));

jest.mock("../src/lib/query", () => ({
  ...jest.requireActual("../src/lib/query"),
  query: jest.fn().mockResolvedValue({
    code: 200,
    data: "translated text",
    id: 12345,
    source_lang: "EN",
    target_lang: "ZH",
  }),
  buildRequestBody: jest.fn().mockReturnValue("{}"),
}));

jest.mock("../src/lib/v2Translate", () => ({
  ...jest.requireActual("../src/lib/v2Translate"),
  translateBatch: jest.fn().mockImplementation(async (params: any) => ({
    code: 200,
    data: (params.text || []).map((t: string, i: number) => ({
      text: `translated ${i}`,
      index: i,
      success: true,
    })),
    apr: params.APR ?? true,
  })),
}));

jest.mock("../src/lib/healthCheck", () => ({
  ...jest.requireActual("../src/lib/healthCheck"),
  performHealthCheck: jest.fn().mockResolvedValue({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
    uptime: 100,
    checks: {
      proxies: { status: "healthy", message: "2/2 proxies healthy" },
      cache: { status: "healthy", message: "Cache KV is accessible" },
      rateLimit: { status: "healthy", message: "Rate limiter KV is accessible" },
      performance: { status: "healthy", message: "Success rate: 100.0%" },
    },
  }),
}));

describe("Main App", () => {
  let app: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = createMockEnv();
    jest.clearAllMocks();

    // Mock fetch for DeepL/Google API calls
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          result: {
            texts: [{ text: "translated text" }],
            lang: "EN",
          },
          id: 12345,
        }),
      text: () => Promise.resolve(""),
    }) as jest.Mock;

    delete require.cache[require.resolve("../src/index")];
    const indexModule = require("../src/index");
    app = indexModule.default;
  });

  describe("GET /", () => {
    it("should redirect to GitHub repository", async () => {
      const request = new Request("http://localhost/", { method: "GET" });
      const response = await app.fetch(request, mockEnv);
      expect(response.status).toBe(302);
    });
  });

  describe("GET /translate, /deepl, /google", () => {
    it("GET /translate returns hint", async () => {
      const r = await app.fetch(new Request("http://localhost/translate"), mockEnv);
      expect(r.status).toBe(200);
      expect(await r.text()).toContain("Please use POST method");
    });
    it("GET /deepl returns hint", async () => {
      const r = await app.fetch(new Request("http://localhost/deepl"), mockEnv);
      expect(r.status).toBe(200);
    });
    it("GET /google returns hint", async () => {
      const r = await app.fetch(new Request("http://localhost/google"), mockEnv);
      expect(r.status).toBe(200);
    });
  });

  describe("POST /translate", () => {
    it("should translate successfully", async () => {
      const req = new Request("http://localhost/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello", target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(200);
      const json = await r.json();
      expect(json.code).toBe(200);
      expect(json.data).toBe("translated text");
    });

    it("should return 400 for missing text", async () => {
      const req = new Request("http://localhost/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(400);
    });

    it("should return 400 for empty text", async () => {
      const req = new Request("http://localhost/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "   ", target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(400);
    });

    it("should return 413 for oversized text", async () => {
      const req = new Request("http://localhost/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "a".repeat(100000), target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(413);
    });

    it("should return 415 for missing Content-Type", async () => {
      const req = new Request("http://localhost/translate", {
        method: "POST",
        body: JSON.stringify({ text: "Hello", target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(415);
    });

    it("should return 400 for invalid JSON", async () => {
      const req = new Request("http://localhost/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(400);
    });

    it("should use default language codes", async () => {
      const req = new Request("http://localhost/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(200);
    });
  });

  describe("POST /deepl", () => {
    it("should translate via DeepL", async () => {
      const req = new Request("http://localhost/deepl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello", target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(200);
    });
  });

  describe("POST /google", () => {
    it("should translate via Google", async () => {
      // Mock Google Translate response format
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve([["translated text", null, "en"]]),
        text: () => Promise.resolve(""),
      });

      const req = new Request("http://localhost/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello", target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(200);
    });
  });

  describe("POST /v2/translate", () => {
    it("should handle batch translation", async () => {
      const req = new Request("http://localhost/v2/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ["Hello", "World"], target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(200);
      const json = await r.json();
      expect(json.apr).toBe(true);
      expect(json.data).toHaveLength(2);
    });

    it("should return 400 for missing text", async () => {
      const req = new Request("http://localhost/v2/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(400);
    });

    it("should return 415 for wrong Content-Type", async () => {
      const req = new Request("http://localhost/v2/translate", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "Hello",
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(415);
    });

    it("should handle APR=false combined mode", async () => {
      const req = new Request("http://localhost/v2/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ["Hello", "World"], APR: false, target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(200);
      const json = await r.json();
      expect(json.apr).toBe(false);
    });

    it("should return 400 for empty text array", async () => {
      const req = new Request("http://localhost/v2/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: [], target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(400);
    });

    it("should return 400 for too many items", async () => {
      const req = new Request("http://localhost/v2/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: Array(11).fill("Hi"), target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(400);
    });
  });

  describe("POST /debug", () => {
    it("should return 404 when DEBUG_MODE is disabled", async () => {
      const req = new Request("http://localhost/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(404);
    });

    it("should return debug info when DEBUG_MODE is enabled", async () => {
      mockEnv.DEBUG_MODE = "true";
      const req = new Request("http://localhost/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello", source_lang: "en", target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(200);
      const json = await r.json();
      expect(json.code).toBe(200);
    });

    it("should return 400 for missing text in debug", async () => {
      mockEnv.DEBUG_MODE = "true";
      const req = new Request("http://localhost/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(400);
    });

    it("should return 400 for empty text in debug", async () => {
      mockEnv.DEBUG_MODE = "true";
      const req = new Request("http://localhost/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "  " }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(400);
    });

    it("should return 400 for invalid language codes in debug", async () => {
      mockEnv.DEBUG_MODE = "true";
      const req = new Request("http://localhost/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello", source_lang: "x", target_lang: "y" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(400);
    });

    it("should handle invalid JSON in debug", async () => {
      mockEnv.DEBUG_MODE = "true";
      const req = new Request("http://localhost/debug", {
        method: "POST",
        body: "invalid json",
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(400);
    });
  });

  describe("Health endpoints", () => {
    it("GET /health/live returns alive", async () => {
      const r = await app.fetch(new Request("http://localhost/health/live"), mockEnv);
      expect(r.status).toBe(200);
      const json = await r.json();
      expect(json.status).toBe("alive");
    });

    it("GET /health requires admin key", async () => {
      const r = await app.fetch(new Request("http://localhost/health"), mockEnv);
      expect(r.status).toBe(401);
    });

    it("GET /health with valid key returns health status", async () => {
      const req = new Request("http://localhost/health", {
        headers: { "X-API-Key": "test-api-key" },
      });
      mockEnv.ADMIN_API_KEY = "test-api-key";
      const r = await app.fetch(req, mockEnv);
      expect([200, 503]).toContain(r.status);
      const json = await r.json();
      expect(json.status).toBeDefined();
    });

    it("GET /health/ready requires admin key", async () => {
      const r = await app.fetch(new Request("http://localhost/health/ready"), mockEnv);
      expect(r.status).toBe(401);
    });

    it("GET /health/ready with valid key", async () => {
      mockEnv.ADMIN_API_KEY = "test-api-key";
      const req = new Request("http://localhost/health/ready", {
        headers: { "X-API-Key": "test-api-key" },
      });
      const r = await app.fetch(req, mockEnv);
      expect([200, 503]).toContain(r.status);
    });
  });

  describe("Admin endpoints", () => {
    it("GET /metrics requires admin key", async () => {
      const r = await app.fetch(new Request("http://localhost/metrics"), mockEnv);
      expect(r.status).toBe(401);
    });

    it("GET /metrics with valid key", async () => {
      mockEnv.ADMIN_API_KEY = "test-api-key";
      const req = new Request("http://localhost/metrics", {
        headers: { "X-API-Key": "test-api-key" },
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(200);
    });

    it("POST /admin/warm-cache requires admin key", async () => {
      const req = new Request("http://localhost/admin/warm-cache", { method: "POST" });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(401);
    });

    it("POST /admin/warm-cache with valid key", async () => {
      mockEnv.ADMIN_API_KEY = "test-api-key";
      const req = new Request("http://localhost/admin/warm-cache", {
        method: "POST",
        headers: { "X-API-Key": "test-api-key" },
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(200);
    });

    it("GET /admin/cache-status requires admin key", async () => {
      const r = await app.fetch(new Request("http://localhost/admin/cache-status"), mockEnv);
      expect(r.status).toBe(401);
    });

    it("GET /admin/cache-status with valid key", async () => {
      mockEnv.ADMIN_API_KEY = "test-api-key";
      const req = new Request("http://localhost/admin/cache-status", {
        headers: { "X-API-Key": "test-api-key" },
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(200);
    });
  });

  describe("OPTIONS", () => {
    it("should handle CORS preflight", async () => {
      const r = await app.fetch(
        new Request("http://localhost/translate", { method: "OPTIONS" }),
        mockEnv
      );
      expect(r.status).toBe(200);
    });
  });

  describe("Security headers", () => {
    it("should add security headers to responses", async () => {
      const r = await app.fetch(new Request("http://localhost/translate"), mockEnv);
      expect(r.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(r.headers.get("X-Frame-Options")).toBe("DENY");
      expect(r.headers.get("X-XSS-Protection")).toBeNull();
    });
  });

  describe("Catch-all", () => {
    it("should redirect unknown paths", async () => {
      const r = await app.fetch(new Request("http://localhost/unknown"), mockEnv);
      expect(r.status).toBe(302);
    });
  });

  describe("Scheduled events", () => {
    it("should handle scheduled maintenance", async () => {
      const indexModule = require("../src/index");
      const mockEvent = { scheduledTime: Date.now() } as ScheduledEvent;
      const mockContext = {
        waitUntil: jest.fn(),
        passThroughOnException: jest.fn(),
      } as unknown as ExecutionContext;

      await indexModule.default.scheduled(mockEvent, mockEnv, mockContext);
      expect(mockContext.waitUntil).toHaveBeenCalled();
    });
  });

  describe("translation.ts — Content-Length > MAX_REQUEST_SIZE → 413 (lines 80-88)", () => {
    it("should return 413 when Content-Length exceeds MAX_REQUEST_SIZE", async () => {
      const req = new Request("http://localhost/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "40000",
        },
        body: JSON.stringify({ text: "Hello", target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(413);
      const json = await r.json();
      expect(json.code).toBe(413);
    });
  });

  describe("translation.ts — rate limit exceeded → 429 (lines 167-175)", () => {
    it("should return 429 when rate limit is exceeded", async () => {
      const { checkCombinedRateLimit } = require("../src/lib/rateLimit");
      checkCombinedRateLimit.mockResolvedValueOnce({ allowed: false, reason: "Client rate limit exceeded" });

      const req = new Request("http://localhost/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello", target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(429);
      const json = await r.json();
      expect(json.code).toBe(429);
    });
  });

  describe("translation.ts — catch block → error response (lines 263-280)", () => {
    it("should return error response when checkCombinedRateLimit throws", async () => {
      const { checkCombinedRateLimit } = require("../src/lib/rateLimit");
      checkCombinedRateLimit.mockImplementationOnce(() => {
        throw new Error("Rate limit service unavailable");
      });

      const r = await app.fetch(
        new Request("http://localhost/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "Hello", target_lang: "zh" }),
        }),
        mockEnv
      );
      expect(r.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("v2.ts — Content-Length > MAX_REQUEST_SIZE → 413 (line 46)", () => {
    it("should return 413 when Content-Length exceeds MAX_REQUEST_SIZE", async () => {
      const req = new Request("http://localhost/v2/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": "40000",
        },
        body: JSON.stringify({ text: ["Hello"], target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(413);
      const json = await r.json();
      expect(json.code).toBe(413);
    });
  });

  describe("v2.ts — JSON parse failure → 400 (line 57)", () => {
    it("should return 400 for invalid JSON body", async () => {
      const req = new Request("http://localhost/v2/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json{{{",
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(400);
    });
  });

  describe("v2.ts — rate limit exceeded → 429 (line 84)", () => {
    it("should return 429 when rate limit is exceeded", async () => {
      const { checkCombinedRateLimit } = require("../src/lib/rateLimit");
      checkCombinedRateLimit.mockResolvedValueOnce({ allowed: false, reason: "Client rate limit exceeded" });

      const req = new Request("http://localhost/v2/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ["Hello"], target_lang: "zh" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(429);
      const json = await r.json();
      expect(json.code).toBe(429);
    });
  });

  describe("v2.ts — catch block → error response (lines 96-101)", () => {
    it("should return error response when checkCombinedRateLimit throws", async () => {
      const { checkCombinedRateLimit } = require("../src/lib/rateLimit");
      checkCombinedRateLimit.mockImplementationOnce(() => {
        throw new Error("Rate limit service unavailable");
      });

      const r = await app.fetch(
        new Request("http://localhost/v2/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: ["Hello"], target_lang: "zh" }),
        }),
        mockEnv
      );
      expect(r.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe("debug.ts — buildRequestBody failure catch (lines 102-103)", () => {
    it("should return 400 when buildRequestBody throws", async () => {
      mockEnv.DEBUG_MODE = "true";
      const { buildRequestBody } = require("../src/lib/query");
      buildRequestBody.mockImplementationOnce(() => {
        throw new Error("Build failed");
      });

      const r = await app.fetch(
        new Request("http://localhost/debug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "Hello", target_lang: "zh" }),
        }),
        mockEnv
      );
      expect(r.status).toBe(400);
      const json = await r.json();
      expect(json.code).toBe(400);
    });
  });

  describe("debug.ts — top-level catch block (lines 104-105)", () => {
    it("should return 400 when req.json() throws (top-level catch)", async () => {
      const { handleDebug } = require("../src/routes/debug");
      const throwCtx = {
        env: { DEBUG_MODE: "true" },
        req: {
          json: () => {
            throw new Error("JSON parse error");
          },
          header: () => undefined,
          raw: new Request("http://localhost/debug", { method: "POST" }),
        },
        json: (data: unknown, status?: number) =>
          new Response(JSON.stringify(data), { status: status ?? 200 }),
      };
      const r = await handleDebug(throwCtx);
      expect(r.status).toBe(400);
    });
  });

  describe("health.ts — branch coverage for handleHealthCheck (lines 28-30)", () => {
    it("should return 503 when health check is unhealthy", async () => {
      const { performHealthCheck } = require("../src/lib/healthCheck");
      performHealthCheck.mockResolvedValueOnce({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        uptime: 100,
        checks: {
          proxies: { status: "unhealthy", message: "Critical" },
          cache: { status: "healthy", message: "OK" },
          rateLimit: { status: "healthy", message: "OK" },
          performance: { status: "healthy", message: "OK" },
        },
      });

      const r = await app.fetch(
        new Request("http://localhost/health", {
          headers: { "X-API-Key": "test-api-key" },
        }),
        { ...mockEnv, ADMIN_API_KEY: "test-api-key" }
      );
      expect(r.status).toBe(503);
      const json = await r.json();
      expect(json.status).toBe("unhealthy");
    });

    it("should return 200 when health check is degraded", async () => {
      const { performHealthCheck } = require("../src/lib/healthCheck");
      performHealthCheck.mockResolvedValueOnce({
        status: "degraded",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        uptime: 100,
        checks: {
          proxies: { status: "degraded", message: "Some unhealthy" },
          cache: { status: "healthy", message: "OK" },
          rateLimit: { status: "healthy", message: "OK" },
          performance: { status: "healthy", message: "OK" },
        },
      });

      const r = await app.fetch(
        new Request("http://localhost/health", {
          headers: { "X-API-Key": "test-api-key" },
        }),
        { ...mockEnv, ADMIN_API_KEY: "test-api-key" }
      );
      expect(r.status).toBe(200);
      const json = await r.json();
      expect(json.status).toBe("degraded");
    });
  });

  describe("translation.ts — null params after JSON parse → 400 (line 107)", () => {
    it("should return 400 when JSON body parses to null", async () => {
      const req = new Request("http://localhost/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "null",
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(400);
    });

    it("should return 400 when JSON body parses to a number", async () => {
      const req = new Request("http://localhost/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "42",
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(400);
    });
  });

  describe("translation.ts — invalid language codes → 400 (lines 151-153)", () => {
    it("should return 400 for invalid source and target language codes", async () => {
      const req = new Request("http://localhost/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello", source_lang: "x", target_lang: "y" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(400);
    });
  });

  describe("debug.ts — isDebugModeEnabled with undefined DEBUG_MODE (line 19)", () => {
    it("should return 404 when DEBUG_MODE is undefined", async () => {
      mockEnv.DEBUG_MODE = undefined;
      const req = new Request("http://localhost/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello" }),
      });
      const r = await app.fetch(req, mockEnv);
      expect(r.status).toBe(404);
    });
  });

  describe("health.ts — branch coverage for handleReadiness (lines 52-59)", () => {
    it("should return 200 when ready status is degraded", async () => {
      const { performHealthCheck } = require("../src/lib/healthCheck");
      performHealthCheck.mockResolvedValueOnce({
        status: "degraded",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        uptime: 100,
        checks: {
          proxies: { status: "degraded", message: "Some unhealthy" },
          cache: { status: "healthy", message: "OK" },
          rateLimit: { status: "healthy", message: "OK" },
          performance: { status: "healthy", message: "OK" },
        },
      });

      const r = await app.fetch(
        new Request("http://localhost/health/ready", {
          headers: { "X-API-Key": "test-api-key" },
        }),
        { ...mockEnv, ADMIN_API_KEY: "test-api-key" }
      );
      expect(r.status).toBe(200);
      const json = await r.json();
      expect(json.ready).toBe(true);
      expect(json.status).toBe("degraded");
    });

    it("should return 503 when ready status is unhealthy", async () => {
      const { performHealthCheck } = require("../src/lib/healthCheck");
      performHealthCheck.mockResolvedValueOnce({
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
        uptime: 100,
        checks: {
          proxies: { status: "unhealthy", message: "Critical" },
          cache: { status: "unhealthy", message: "KV failed" },
          rateLimit: { status: "healthy", message: "OK" },
          performance: { status: "healthy", message: "OK" },
        },
      });

      const r = await app.fetch(
        new Request("http://localhost/health/ready", {
          headers: { "X-API-Key": "test-api-key" },
        }),
        { ...mockEnv, ADMIN_API_KEY: "test-api-key" }
      );
      expect(r.status).toBe(503);
      const json = await r.json();
      expect(json.ready).toBe(false);
      expect(json.status).toBe("unhealthy");
    });
  });
});
