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
      // X-XSS-Protection is deprecated and removed
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
});
