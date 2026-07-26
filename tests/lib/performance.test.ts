/**
 * Tests for performance monitoring module
 */

describe("Performance Module", () => {
  // Use isolateModules to get a fresh circular buffer for each test group
  let startPerformanceTracking: (endpoint: string) => string;
  let updatePerformanceMetrics: (
    requestId: string,
    updates: Partial<any>
  ) => void;
  let endPerformanceTracking: (requestId: string, success: boolean) => void;
  let getPerformanceStats: () => any;

  beforeEach(() => {
    jest.isolateModules(() => {
      const perf = require("../../src/lib/performance");
      startPerformanceTracking = perf.startPerformanceTracking;
      updatePerformanceMetrics = perf.updatePerformanceMetrics;
      endPerformanceTracking = perf.endPerformanceTracking;
      getPerformanceStats = perf.getPerformanceStats;
    });
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

      const stats = getPerformanceStats();
      expect(stats).not.toBeNull();
      expect(stats!.totalRequests).toBeGreaterThanOrEqual(1);
    });

    it("should handle updating non-existent request ID gracefully (line 57)", () => {
      expect(() => {
        updatePerformanceMetrics("non-existent-id", { cacheHit: true });
      }).not.toThrow();
    });

    it("should handle findMetric with empty state (line 57)", () => {
      // With a fresh module, count is 0, so findMetric returns undefined
      // updatePerformanceMetrics calls findMetric internally
      expect(() => {
        updatePerformanceMetrics("empty-state-id", { cacheHit: true });
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

    it("should handle non-existent request ID gracefully (line 138)", () => {
      expect(() => {
        endPerformanceTracking("non-existent-id", false);
      }).not.toThrow();
    });

    it("should handle endPerformanceTracking with empty state", () => {
      // With a fresh module, count is 0, findMetric returns undefined
      expect(() => {
        endPerformanceTracking("empty-state-id", true);
      }).not.toThrow();
    });
  });

  describe("getPerformanceStats", () => {
    it("should return null when no metrics exist (line 151)", () => {
      const stats = getPerformanceStats();
      expect(stats).toBeNull();
    });

    it("should calculate success rate correctly", () => {
      const id1 = startPerformanceTracking("/test");
      const id2 = startPerformanceTracking("/test");
      endPerformanceTracking(id1, true);
      endPerformanceTracking(id2, false);

      const stats = getPerformanceStats();
      expect(stats).not.toBeNull();
      expect(stats!.successRate).toBe(50);
    });

    it("should handle many metrics (circular buffer overflow)", () => {
      const ids: string[] = [];
      for (let i = 0; i < 1100; i++) {
        ids.push(startPerformanceTracking("/test"));
      }

      const stats = getPerformanceStats();
      expect(stats).not.toBeNull();
      expect(stats!.totalRequests).toBeLessThanOrEqual(100);
    });

    it("should find metric in wrapped-around buffer (lines 63-68)", () => {
      // Fill buffer beyond MAX_METRICS (1000) to trigger wrapped-around branch
      const ids: string[] = [];
      for (let i = 0; i < 1050; i++) {
        ids.push(startPerformanceTracking("/test"));
      }

      // Now update one of the recent metrics — this calls findMetric
      // which must use the wrapped-around iteration (lines 63-68)
      const recentId = ids[ids.length - 1];
      updatePerformanceMetrics(recentId, { cacheHit: true });
      endPerformanceTracking(recentId, true);

      const stats = getPerformanceStats();
      expect(stats).not.toBeNull();
    });

    it("should return undefined from findMetric when requestId not found in wrapped buffer (line 68)", () => {
      // Fill buffer beyond MAX_METRICS
      for (let i = 0; i < 1050; i++) {
        startPerformanceTracking("/test");
      }

      // Update a non-existent requestId — findMetric iterates full buffer, returns undefined
      updatePerformanceMetrics("nonexistent-wrapped-id", { cacheHit: true });
      endPerformanceTracking("nonexistent-wrapped-id", true);

      // No error means findMetric returned undefined gracefully
      const stats = getPerformanceStats();
      expect(stats).not.toBeNull();
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

    it("should return all zero values when all requests failed", () => {
      const id1 = startPerformanceTracking("/test");
      const id2 = startPerformanceTracking("/test");
      endPerformanceTracking(id1, false);
      endPerformanceTracking(id2, false);

      const stats = getPerformanceStats();
      expect(stats).not.toBeNull();
      expect(stats!.successfulRequests).toBe(0);
      expect(stats!.failedRequests).toBe(2);
      expect(stats!.successRate).toBe(0);
      expect(stats!.averageDuration).toBe(0);
    });

    it("should track proxy usage rate", () => {
      const id1 = startPerformanceTracking("/test");
      const id2 = startPerformanceTracking("/test");
      updatePerformanceMetrics(id1, { proxyUsed: true });
      updatePerformanceMetrics(id2, { proxyUsed: false });
      endPerformanceTracking(id1, true);
      endPerformanceTracking(id2, true);

      const stats = getPerformanceStats();
      expect(stats).not.toBeNull();
      expect(stats!.proxyUsageRate).toBeGreaterThanOrEqual(0);
      expect(stats!.proxyUsageRate).toBeLessThanOrEqual(100);
    });

    it("should track rate limited requests", () => {
      const id1 = startPerformanceTracking("/test");
      updatePerformanceMetrics(id1, { rateLimited: true });
      endPerformanceTracking(id1, false);

      const stats = getPerformanceStats();
      expect(stats).not.toBeNull();
      expect(stats!.rateLimitedRequests).toBeGreaterThanOrEqual(1);
    });

    it("should return zero for all rates when all requests failed (lines 168-175)", () => {
      const id1 = startPerformanceTracking("/test");
      endPerformanceTracking(id1, false);

      const stats = getPerformanceStats();
      expect(stats).not.toBeNull();
      expect(stats!.successRate).toBe(0);
      expect(stats!.cacheHitRate).toBe(0);
      expect(stats!.proxyUsageRate).toBe(0);
    });
  });
});
