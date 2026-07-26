/**
 * Tests for metrics collection module
 */

import { collectMetrics, formatMetricsResponse } from "../../src/lib/metrics";

jest.mock("../../src/lib/performance", () => ({
  getPerformanceStats: jest.fn().mockReturnValue({
    totalRequests: 100,
    successfulRequests: 95,
    failedRequests: 5,
    successRate: 95,
    averageDuration: 250,
    cacheHitRate: 60,
    proxyUsageRate: 80,
    rateLimitedRequests: 2,
  }),
}));

jest.mock("../../src/lib/proxyManager", () => ({
  getProxyEndpoints: jest.fn().mockReturnValue([
    { url: "https://proxy1.example.com/jsonrpc" },
    { url: "https://proxy2.example.com/jsonrpc" },
  ]),
  getProxyHealthStats: jest.fn().mockReturnValue([
    { url: "https://proxy1.example.com/jsonrpc", healthy: true, avgResponseTime: 200, failureRate: 5 },
    { url: "https://proxy2.example.com/jsonrpc", healthy: false, avgResponseTime: 800, failureRate: 30 },
  ]),
}));

jest.mock("../../src/lib/cache", () => ({
  getMemoryCacheSize: jest.fn().mockReturnValue(42),
}));

describe("Metrics Module", () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = createMockEnv();
    jest.clearAllMocks();
  });

  describe("collectMetrics", () => {
    it("should collect comprehensive system metrics", () => {
      const metrics = collectMetrics(mockEnv);

      expect(metrics).toHaveProperty("timestamp");
      expect(metrics).toHaveProperty("uptime");
      expect(metrics).toHaveProperty("performance");
      expect(metrics).toHaveProperty("proxy");
      expect(metrics).toHaveProperty("cache");
      expect(metrics).toHaveProperty("rateLimit");
    });

    it("should include proxy information", () => {
      const metrics = collectMetrics(mockEnv);

      expect(metrics.proxy.totalEndpoints).toBe(2);
      expect(metrics.proxy.healthyEndpoints).toBe(1);
      expect(metrics.proxy.unhealthyEndpoints).toBe(1);
      expect(metrics.proxy.healthStats).toHaveLength(2);
    });

    it("should include cache size", () => {
      const metrics = collectMetrics(mockEnv);

      expect(metrics.cache.memoryCacheSize).toBe(42);
    });

    it("should include uptime as a number", () => {
      const metrics = collectMetrics(mockEnv);

      expect(typeof metrics.uptime).toBe("number");
      expect(metrics.uptime).toBeGreaterThanOrEqual(0);
    });

    it("should include valid ISO timestamp", () => {
      const metrics = collectMetrics(mockEnv);

      const date = new Date(metrics.timestamp);
      expect(date.toISOString()).toBe(metrics.timestamp);
    });
  });

  describe("formatMetricsResponse", () => {
    it("should wrap metrics in standard response format", () => {
      const metrics = collectMetrics(mockEnv);
      const response = formatMetricsResponse(metrics);

      expect(response.code).toBe(200);
      expect(response.data).toBe(metrics);
      expect(typeof response.id).toBe("number");
      expect(response.id).toBeGreaterThan(0);
    });
  });
});
