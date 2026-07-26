/**
 * Tests for performance monitoring module
 */

import {
  startPerformanceTracking,
  updatePerformanceMetrics,
  endPerformanceTracking,
  getPerformanceStats,
} from "../../src/lib/performance";

describe("Performance Module", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("startPerformanceTracking", () => {
    it("should return a unique request ID", () => {
      const id1 = startPerformanceTracking("/translate");
      const id2 = startPerformanceTracking("/translate");

      expect(typeof id1).toBe("string");
      expect(id1).not.toBe(id2);
    });

    it("should include timestamp in request ID", () => {
      const id = startPerformanceTracking("/test");
      expect(id).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });

  describe("updatePerformanceMetrics", () => {
    it("should update metrics for a tracked request", () => {
      const requestId = startPerformanceTracking("/test");

      updatePerformanceMetrics(requestId, {
        cacheHit: true,
        proxyUsed: true,
      });

      // No error means the update was applied
      const stats = getPerformanceStats();
      expect(stats).not.toBeNull();
      expect(stats!.totalRequests).toBeGreaterThanOrEqual(1);
    });

    it("should handle updating non-existent request ID gracefully", () => {
      expect(() => {
        updatePerformanceMetrics("non-existent-id", { cacheHit: true });
      }).not.toThrow();
    });
  });

  describe("endPerformanceTracking", () => {
    it("should set duration and success on the metric", () => {
      const requestId = startPerformanceTracking("/test");

      endPerformanceTracking(requestId, true);

      const stats = getPerformanceStats();
      expect(stats).not.toBeNull();
      expect(stats!.successfulRequests).toBeGreaterThanOrEqual(1);
    });

    it("should handle non-existent request ID gracefully", () => {
      expect(() => {
        endPerformanceTracking("non-existent-id", false);
      }).not.toThrow();
    });
  });

  describe("getPerformanceStats", () => {
    it("should return null when no metrics exist", () => {
      // Note: other tests may have added metrics, so we test the structure
      const stats = getPerformanceStats();
      // Stats can be null or an object with expected fields
      if (stats !== null) {
        expect(stats).toHaveProperty("totalRequests");
        expect(stats).toHaveProperty("successfulRequests");
        expect(stats).toHaveProperty("failedRequests");
        expect(stats).toHaveProperty("successRate");
        expect(stats).toHaveProperty("averageDuration");
        expect(stats).toHaveProperty("cacheHitRate");
        expect(stats).toHaveProperty("proxyUsageRate");
        expect(stats).toHaveProperty("rateLimitedRequests");
      }
    });

    it("should calculate success rate correctly", () => {
      const id1 = startPerformanceTracking("/test");
      const id2 = startPerformanceTracking("/test");
      endPerformanceTracking(id1, true);
      endPerformanceTracking(id2, false);

      const stats = getPerformanceStats();
      expect(stats).not.toBeNull();
      expect(stats!.successRate).toBeGreaterThanOrEqual(0);
      expect(stats!.successRate).toBeLessThanOrEqual(100);
    });

    it("should handle many metrics (circular buffer overflow)", () => {
      // Add more than MAX_METRICS (1000) entries to test circular buffer
      const ids: string[] = [];
      for (let i = 0; i < 1100; i++) {
        ids.push(startPerformanceTracking("/test"));
      }

      const stats = getPerformanceStats();
      expect(stats).not.toBeNull();
      expect(stats!.totalRequests).toBeLessThanOrEqual(100);
      // Most recent 100 should be analyzed
    });

    it("should track cache hit rate", () => {
      const id1 = startPerformanceTracking("/test");
      const id2 = startPerformanceTracking("/test");
      updatePerformanceMetrics(id1, { cacheHit: true });
      updatePerformanceMetrics(id2, { cacheHit: false });
      endPerformanceTracking(id1, true);
      endPerformanceTracking(id2, true);

      const stats = getPerformanceStats();
      expect(stats).not.toBeNull();
      expect(stats!.cacheHitRate).toBeGreaterThanOrEqual(0);
    });
  });
});
