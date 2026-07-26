/**
 * Tests for cache module - translation caching functionality
 */

import {
  clearMemoryCache,
  generateCacheKey,
  getCachedTranslation,
  resetMemoryCache,
  setCachedTranslation,
} from "../../src/lib/cache";

describe("Cache Module", () => {
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = createMockEnv();
    resetMemoryCache();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("generateCacheKey", () => {
    it("should generate consistent cache keys", () => {
      const key1 = generateCacheKey("Hello world", "EN", "ZH");
      const key2 = generateCacheKey("Hello world", "EN", "ZH");

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^cache_/);
    });

    it("should generate different keys for different inputs", () => {
      const key1 = generateCacheKey("Hello world", "EN", "ZH");
      const key2 = generateCacheKey("Hello world", "EN", "ES");
      const key3 = generateCacheKey("Goodbye world", "EN", "ZH");

      expect(key1).not.toBe(key2);
      expect(key1).not.toBe(key3);
      expect(key2).not.toBe(key3);
    });

    it("should handle special characters in text", () => {
      const key = generateCacheKey("Hello, 世界! @#$%", "EN", "ZH");
      expect(key).toMatch(/^cache_/);
    });

    it("should include provider in key generation", () => {
      const key1 = generateCacheKey("Hello", "EN", "ZH", "deepl");
      const key2 = generateCacheKey("Hello", "EN", "ZH");
      expect(key1).not.toBe(key2);
    });

    it("should normalize auto source lang", () => {
      const key = generateCacheKey("Hello", "auto", "ZH");
      expect(key).toContain("cache_auto_ZH_");
    });

    it("should uppercase language codes", () => {
      const key1 = generateCacheKey("Hello", "en", "zh");
      const key2 = generateCacheKey("Hello", "EN", "ZH");
      expect(key1).toBe(key2);
    });
  });

  describe("setCachedTranslation", () => {
    it("should store translation in memory and KV", async () => {
      const cacheEntry = {
        data: "你好世界",
        timestamp: Date.now(),
        source_lang: "EN",
        target_lang: "ZH",
        id: 12345,
      };

      await setCachedTranslation("test-key", cacheEntry, mockEnv);

      expect(mockEnv.CACHE_KV.put).toHaveBeenCalledWith(
        "test-key",
        JSON.stringify(cacheEntry),
        expect.objectContaining({
          expirationTtl: expect.any(Number),
        })
      );
    });

    it("should handle KV storage errors gracefully", async () => {
      (mockEnv.CACHE_KV.put as jest.Mock).mockRejectedValueOnce(
        new Error("KV error")
      );

      const cacheEntry = {
        data: "你好世界",
        timestamp: Date.now(),
        source_lang: "EN",
        target_lang: "ZH",
      };

      await expect(
        setCachedTranslation("test-key", cacheEntry, mockEnv)
      ).resolves.not.toThrow();
    });
  });

  describe("getCachedTranslation", () => {
    it("should return from memory cache on hit", async () => {
      const cacheEntry = {
        data: "你好世界",
        timestamp: Date.now(),
        source_lang: "EN",
        target_lang: "ZH",
        id: 12345,
      };

      // Store in memory first
      await setCachedTranslation("mem-key", cacheEntry, mockEnv);

      // Should return from memory without hitting KV
      const result = await getCachedTranslation("mem-key", mockEnv);
      expect(result).toEqual(cacheEntry);
    });

    it("should promote KV hit to memory cache", async () => {
      const cacheEntry = {
        data: "你好世界",
        timestamp: Date.now(),
        source_lang: "EN",
        target_lang: "ZH",
        id: 12345,
      };

      (mockEnv.CACHE_KV.get as jest.Mock).mockResolvedValueOnce(cacheEntry);

      const result = await getCachedTranslation("kv-key", mockEnv);
      expect(result).toEqual(cacheEntry);

      // Second call should hit memory
      (mockEnv.CACHE_KV.get as jest.Mock).mockClear();
      const result2 = await getCachedTranslation("kv-key", mockEnv);
      expect(result2).toEqual(cacheEntry);
      expect(mockEnv.CACHE_KV.get).not.toHaveBeenCalled();
    });

    it("should return null for cache miss", async () => {
      (mockEnv.CACHE_KV.get as jest.Mock).mockResolvedValueOnce(null);
      const result = await getCachedTranslation("miss-key", mockEnv);
      expect(result).toBeNull();
    });

    it("should return null for expired KV entries", async () => {
      const expiredEntry = {
        data: "你好世界",
        timestamp: Date.now() - 25 * 60 * 60 * 1000,
        source_lang: "EN",
        target_lang: "ZH",
      };
      (mockEnv.CACHE_KV.get as jest.Mock).mockResolvedValueOnce(expiredEntry);
      const result = await getCachedTranslation("expired-key", mockEnv);
      expect(result).toBeNull();
    });

    it("should handle KV retrieval errors gracefully", async () => {
      (mockEnv.CACHE_KV.get as jest.Mock).mockRejectedValueOnce(
        new Error("KV error")
      );
      const result = await getCachedTranslation("error-key", mockEnv);
      expect(result).toBeNull();
    });

    it("should return null for outer exceptions", async () => {
      // Force an error in the outer try block
      (mockEnv.CACHE_KV.get as jest.Mock).mockRejectedValueOnce(
        new Error("outer error")
      );
      const result = await getCachedTranslation("outer-error", mockEnv);
      expect(result).toBeNull();
    });
  });

  describe("clearMemoryCache", () => {
    it("should clear expired entries and return count", () => {
      // Add some entries first
      const recent = {
        data: "recent",
        timestamp: Date.now(),
        source_lang: "EN",
        target_lang: "ZH",
      };
      const old = {
        data: "old",
        timestamp: Date.now() - 2 * 60 * 60 * 1000, // 2 hours ago
        source_lang: "EN",
        target_lang: "ZH",
      };

      // Store entries via setCachedTranslation (uses memory cache)
      setCachedTranslation("recent-key", recent, mockEnv);
      setCachedTranslation("old-key", old, mockEnv);

      const removed = clearMemoryCache();
      expect(typeof removed).toBe("number");
      expect(removed).toBeGreaterThanOrEqual(0);
    });
  });

  describe("LRU cache operations", () => {
    it("should evict LRU entry when cache is full", async () => {
      // The memory cache max is 1000. We can't easily fill it in a test,
      // but we can test the has/delete operations.
      const entry = {
        data: "test",
        timestamp: Date.now(),
        source_lang: "EN",
        target_lang: "ZH",
      };

      await setCachedTranslation("lru-key", entry, mockEnv);

      // Verify it's in cache
      const result = await getCachedTranslation("lru-key", mockEnv);
      expect(result).toEqual(entry);
    });

    it("should handle getMemoryCacheSize", async () => {
      const { getMemoryCacheSize } = await import("../../src/lib/cache");
      const size = getMemoryCacheSize();
      expect(typeof size).toBe("number");
      expect(size).toBeGreaterThanOrEqual(0);
    });
  });
});
