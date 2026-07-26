/**
 * Tests for main app endpoints
 */

// Mock the route handlers
jest.mock("../src/routes/translation", () => ({
  handleTranslation: jest.fn(),
}));

jest.mock("../src/routes/v2", () => ({
  handleV2Translation: jest.fn(),
}));

jest.mock("../src/routes/health", () => ({
  handleHealthCheck: jest.fn(),
  handleLiveness: jest.fn(),
  handleReadiness: jest.fn(),
}));

jest.mock("../src/routes/admin", () => ({
  handleMetrics: jest.fn(),
  handleWarmCache: jest.fn(),
  handleCacheStatus: jest.fn(),
}));

jest.mock("../src/routes/debug", () => ({
  handleDebug: jest.fn(),
}));

jest.mock("../src/lib", () => ({
  clearMemoryCache: jest.fn(),
  generateCacheKey: jest.fn().mockReturnValue("cache:test-key"),
  getCachedTranslation: jest.fn(),
  setCachedTranslation: jest.fn(),
  query: jest.fn(),
}));

jest.mock("../src/lib/security", () => ({
  getSecureClientIP: jest.fn().mockReturnValue("192.168.1.1"),
  handleCORSPreflight: jest
    .fn()
    .mockReturnValue(new Response(null, { status: 200 })),
  validateLanguageCode: jest
    .fn()
    .mockImplementation((code) => code?.toLowerCase()),
  SECURITY_HEADERS: {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  },
  isAdminAuthorized: jest.fn().mockReturnValue(true),
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

jest.mock("../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  generateRequestId: jest.fn().mockReturnValue("test-request-id"),
}));

describe("Main App", () => {
  let app: any;
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = createMockEnv();
    jest.clearAllMocks();

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

  describe("GET /translate", () => {
    it("should return message for GET requests", async () => {
      const request = new Request("http://localhost/translate", {
        method: "GET",
      });
      const response = await app.fetch(request, mockEnv);

      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toContain("Please use POST method");
    });
  });

  describe("POST /debug", () => {
    it("should delegate to handleDebug", async () => {
      const { handleDebug } = require("../src/routes/debug");
      handleDebug.mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 200 }), { status: 200 })
      );

      const request = new Request("http://localhost/debug", {
        method: "POST",
        body: JSON.stringify({ text: "Hello world" }),
      });
      await app.fetch(request, mockEnv);

      expect(handleDebug).toHaveBeenCalled();
    });
  });

  describe("POST /translate", () => {
    it("should delegate to handleTranslation with deepl provider", async () => {
      const { handleTranslation } = require("../src/routes/translation");
      handleTranslation.mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 200, data: "你好世界" }), {
          status: 200,
        })
      );

      const request = new Request("http://localhost/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: "Hello world",
          source_lang: "en",
          target_lang: "zh",
        }),
      });
      const response = await app.fetch(request, mockEnv);

      expect(handleTranslation).toHaveBeenCalled();
      expect(response.status).toBe(200);
    });
  });

  describe("POST /deepl", () => {
    it("should delegate to handleTranslation with deepl provider", async () => {
      const { handleTranslation } = require("../src/routes/translation");
      handleTranslation.mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 200 }), { status: 200 })
      );

      const request = new Request("http://localhost/deepl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello", target_lang: "zh" }),
      });
      await app.fetch(request, mockEnv);

      expect(handleTranslation).toHaveBeenCalled();
    });
  });

  describe("POST /google", () => {
    it("should delegate to handleTranslation with google provider", async () => {
      const { handleTranslation } = require("../src/routes/translation");
      handleTranslation.mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 200 }), { status: 200 })
      );

      const request = new Request("http://localhost/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello", target_lang: "zh" }),
      });
      await app.fetch(request, mockEnv);

      expect(handleTranslation).toHaveBeenCalledWith(
        expect.anything(),
        "google"
      );
    });
  });

  describe("POST /v2/translate", () => {
    it("should delegate to handleV2Translation", async () => {
      const { handleV2Translation } = require("../src/routes/v2");
      handleV2Translation.mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 200, data: [] }), { status: 200 })
      );

      const request = new Request("http://localhost/v2/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ["Hello"], target_lang: "zh" }),
      });
      await app.fetch(request, mockEnv);

      expect(handleV2Translation).toHaveBeenCalled();
    });
  });

  describe("GET /health", () => {
    it("should delegate to handleHealthCheck", async () => {
      const { handleHealthCheck } = require("../src/routes/health");
      handleHealthCheck.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "healthy" }), { status: 200 })
      );

      const request = new Request("http://localhost/health");
      await app.fetch(request, mockEnv);

      expect(handleHealthCheck).toHaveBeenCalled();
    });
  });

  describe("GET /health/live", () => {
    it("should delegate to handleLiveness", async () => {
      const { handleLiveness } = require("../src/routes/health");
      handleLiveness.mockResolvedValueOnce(
        new Response(JSON.stringify({ status: "alive" }), { status: 200 })
      );

      const request = new Request("http://localhost/health/live");
      await app.fetch(request, mockEnv);

      expect(handleLiveness).toHaveBeenCalled();
    });
  });

  describe("GET /health/ready", () => {
    it("should delegate to handleReadiness", async () => {
      const { handleReadiness } = require("../src/routes/health");
      handleReadiness.mockResolvedValueOnce(
        new Response(JSON.stringify({ ready: true }), { status: 200 })
      );

      const request = new Request("http://localhost/health/ready");
      await app.fetch(request, mockEnv);

      expect(handleReadiness).toHaveBeenCalled();
    });
  });

  describe("GET /metrics", () => {
    it("should delegate to handleMetrics", async () => {
      const { handleMetrics } = require("../src/routes/admin");
      handleMetrics.mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 200 }), { status: 200 })
      );

      const request = new Request("http://localhost/metrics");
      await app.fetch(request, mockEnv);

      expect(handleMetrics).toHaveBeenCalled();
    });
  });

  describe("POST /admin/warm-cache", () => {
    it("should delegate to handleWarmCache", async () => {
      const { handleWarmCache } = require("../src/routes/admin");
      handleWarmCache.mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 200 }), { status: 200 })
      );

      const request = new Request("http://localhost/admin/warm-cache", {
        method: "POST",
      });
      await app.fetch(request, mockEnv);

      expect(handleWarmCache).toHaveBeenCalled();
    });
  });

  describe("GET /admin/cache-status", () => {
    it("should delegate to handleCacheStatus", async () => {
      const { handleCacheStatus } = require("../src/routes/admin");
      handleCacheStatus.mockResolvedValueOnce(
        new Response(JSON.stringify({ code: 200 }), { status: 200 })
      );

      const request = new Request("http://localhost/admin/cache-status");
      await app.fetch(request, mockEnv);

      expect(handleCacheStatus).toHaveBeenCalled();
    });
  });

  describe("OPTIONS requests", () => {
    it("should handle CORS preflight requests", async () => {
      const request = new Request("http://localhost/translate", {
        method: "OPTIONS",
      });
      const response = await app.fetch(request, mockEnv);

      expect(response.status).toBe(200);
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

  describe("Security headers", () => {
    it("should add security headers to responses", async () => {
      const request = new Request("http://localhost/translate", {
        method: "GET",
      });
      const response = await app.fetch(request, mockEnv);

      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("X-Frame-Options")).toBe("DENY");
    });
  });
});
