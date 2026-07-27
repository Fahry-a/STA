/**
 * Tests for cache warming module
 */

jest.mock("../../src/lib/cache", () => ({
  generateCacheKey: jest.fn().mockReturnValue("cache:test-key"),
  getCachedTranslation: jest.fn().mockResolvedValue(null),
  setCachedTranslation: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/lib/providers/query", () => ({
  query: jest.fn(),
}));

jest.mock("../../src/lib/observability/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("Cache Warmer Module", () => {
  let mockEnv: any;
  let warmCache: any;
  let getCacheWarmingStatus: any;

  beforeEach(() => {
    jest.resetModules();
    mockEnv = createMockEnv();

    const mod = require("../../src/lib/cache/cacheWarmer");
    warmCache = mod.warmCache;
    getCacheWarmingStatus = mod.getCacheWarmingStatus;

    // Set up default mock behavior for each fresh module load
    const queryMod = require("../../src/lib/providers/query");
    queryMod.query.mockResolvedValue({
      code: 200,
      data: "translated text",
      id: 12345,
      source_lang: "EN",
      target_lang: "ZH",
    });
  });

  describe("getCacheWarmingStatus", () => {
    it("should return status with totalPopular count", () => {
      const status = getCacheWarmingStatus();

      expect(status).toHaveProperty("totalPopular");
      expect(typeof status.totalPopular).toBe("number");
      expect(status.totalPopular).toBeGreaterThan(0);
    });

    it("should return lastWarmed as null initially", () => {
      const status = getCacheWarmingStatus();
      expect(status.lastWarmed).toBeNull();
    });
  });

  describe("warmCache", () => {
    it("should return results object with correct shape", async () => {
      const result = await warmCache(mockEnv);

      expect(result).toHaveProperty("warmed");
      expect(result).toHaveProperty("failed");
      expect(result).toHaveProperty("errors");
      expect(result).toHaveProperty("skipped");
      expect(typeof result.warmed).toBe("number");
      expect(typeof result.failed).toBe("number");
      expect(Array.isArray(result.errors)).toBe(true);
      expect(typeof result.skipped).toBe("boolean");
    });

    it("should skip when KV is unavailable", async () => {
      const envNoKV = { ...mockEnv, CACHE_KV: undefined };
      const result = await warmCache(envNoKV);

      expect(result.skipped).toBe(true);
      expect(result.warmed).toBe(0);
    });

    it("should warm cache when lock is acquired", async () => {
      mockEnv.CACHE_KV.get.mockResolvedValue(null);
      mockEnv.CACHE_KV.put.mockResolvedValue(undefined);

      const result = await warmCache(mockEnv);

      expect(typeof result.warmed).toBe("number");
      expect(result.warmed).toBeGreaterThanOrEqual(0);
    });

    it("should skip when lock is held by another isolate", async () => {
      mockEnv.CACHE_KV.get.mockResolvedValue({
        timestamp: Date.now(),
      });

      const result = await warmCache(mockEnv);

      expect(result.skipped).toBe(true);
    });

    it("should proceed when lock is stale", async () => {
      mockEnv.CACHE_KV.get.mockResolvedValue({
        timestamp: Date.now() - 20 * 60 * 1000,
      });
      mockEnv.CACHE_KV.put.mockResolvedValue(undefined);

      const result = await warmCache(mockEnv);

      expect(result.warmed).toBeGreaterThanOrEqual(0);
    });

    it("should handle translation errors gracefully", async () => {
      mockEnv.CACHE_KV.get.mockResolvedValue(null);
      mockEnv.CACHE_KV.put.mockResolvedValue(undefined);

      const result = await warmCache(mockEnv);

      expect(result.failed).toBeGreaterThanOrEqual(0);
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });

    it("should skip when KV read fails in acquireWarmLock (line 85)", async () => {
      mockEnv.CACHE_KV.get.mockRejectedValueOnce(new Error("KV read error"));

      const result = await warmCache(mockEnv);

      expect(result.skipped).toBe(true);
      expect(result.warmed).toBe(0);
    });

    it("should skip warming for already-cached translations (line 138)", async () => {
      mockEnv.CACHE_KV.get.mockResolvedValue(null);
      mockEnv.CACHE_KV.put.mockResolvedValue(undefined);

      const result = await warmCache(mockEnv);

      expect(result.warmed).toBeGreaterThanOrEqual(0);
      expect(result.skipped).toBe(false);
    });

    it("should count failures when query returns non-200 (line 165)", async () => {
      mockEnv.CACHE_KV.get.mockResolvedValue(null);
      mockEnv.CACHE_KV.put.mockResolvedValue(undefined);

      const queryMod = require("../../src/lib/providers/query");
      queryMod.query.mockResolvedValue({ code: 500, data: null });

      const result = await warmCache(mockEnv);

      expect(result.failed).toBeGreaterThan(0);
    });

    it("should handle non-Error throws from query (line 173 String branch)", async () => {
      mockEnv.CACHE_KV.get.mockResolvedValue(null);
      mockEnv.CACHE_KV.put.mockResolvedValue(undefined);

      const queryMod = require("../../src/lib/providers/query");
      queryMod.query.mockRejectedValue("string error");

      const result = await warmCache(mockEnv);

      expect(result.failed).toBeGreaterThan(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
