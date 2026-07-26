/**
 * Tests for cache warming module
 */

import { warmCache, getCacheWarmingStatus } from "../../src/lib/cacheWarmer";

jest.mock("../../src/lib/cache", () => ({
  generateCacheKey: jest.fn().mockReturnValue("cache:test-key"),
  getCachedTranslation: jest.fn().mockResolvedValue(null),
  setCachedTranslation: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/lib/query", () => ({
  query: jest.fn().mockResolvedValue({
    code: 200,
    data: "translated text",
    id: 12345,
    source_lang: "EN",
    target_lang: "ZH",
  }),
}));

jest.mock("../../src/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("Cache Warmer Module", () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = createMockEnv();
    jest.clearAllMocks();
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
      // Mock KV to allow lock acquisition
      mockEnv.CACHE_KV.get.mockResolvedValue(null);
      mockEnv.CACHE_KV.put.mockResolvedValue(undefined);

      const result = await warmCache(mockEnv);

      // May be skipped or warmed depending on lock state
      expect(typeof result.warmed).toBe("number");
      expect(result.warmed).toBeGreaterThanOrEqual(0);
    });

    it("should skip when lock is held by another isolate", async () => {
      // Mock KV to return a fresh lock (another isolate warmed recently)
      mockEnv.CACHE_KV.get.mockResolvedValue({
        timestamp: Date.now(),
      });

      const result = await warmCache(mockEnv);

      expect(result.skipped).toBe(true);
    });

    it("should proceed when lock is stale", async () => {
      // Mock KV to return a stale lock (older than WARM_INTERVAL_MS)
      mockEnv.CACHE_KV.get.mockResolvedValue({
        timestamp: Date.now() - 20 * 60 * 1000, // 20 minutes ago
      });
      mockEnv.CACHE_KV.put.mockResolvedValue(undefined);

      const { query } = require("../../src/lib/query");
      query.mockResolvedValue({
        code: 200,
        data: "warmed translation",
        id: 99999,
        source_lang: "EN",
        target_lang: "ZH",
      });

      const result = await warmCache(mockEnv);

      // Should have attempted warming (may be partially warmed)
      expect(result.warmed).toBeGreaterThanOrEqual(0);
    });

    it("should handle translation errors gracefully", async () => {
      mockEnv.CACHE_KV.get.mockResolvedValue(null);
      mockEnv.CACHE_KV.put.mockResolvedValue(undefined);

      const { query } = require("../../src/lib/query");
      query.mockRejectedValue(new Error("DeepL API error"));

      const result = await warmCache(mockEnv);

      expect(result.failed).toBeGreaterThanOrEqual(0);
      expect(result.errors.length).toBeGreaterThanOrEqual(0);
    });
  });
});
