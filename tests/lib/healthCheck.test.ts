/**
 * Tests for health check module
 */

import { performHealthCheck } from "../../src/lib/observability/healthCheck";
import * as proxyManager from "../../src/lib/network/proxyManager";
import * as performance from "../../src/lib/observability/performance";

// Default healthy mocks
jest.mock("../../src/lib/network/proxyManager", () => ({
  getProxyEndpoints: jest.fn().mockReturnValue([
    { url: "https://proxy1.example.com/jsonrpc" },
    { url: "https://proxy2.example.com/jsonrpc" },
  ]),
  getProxyHealthStats: jest.fn().mockReturnValue([
    { url: "https://proxy1.example.com/jsonrpc", healthy: true, avgResponseTime: 200, failureRate: 5 },
    { url: "https://proxy2.example.com/jsonrpc", healthy: true, avgResponseTime: 300, failureRate: 10 },
  ]),
}));

jest.mock("../../src/lib/observability/performance", () => ({
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

jest.mock("../../src/lib/rateLimit", () => ({
  checkRateLimit: jest.fn().mockResolvedValue(true),
}));

describe("Health Check Module", () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = createMockEnv();
    jest.clearAllMocks();

    // Reset to healthy defaults
    (proxyManager.getProxyEndpoints as jest.Mock).mockReturnValue([
      { url: "https://proxy1.example.com/jsonrpc" },
      { url: "https://proxy2.example.com/jsonrpc" },
    ]);
    (proxyManager.getProxyHealthStats as jest.Mock).mockReturnValue([
      { url: "https://proxy1.example.com/jsonrpc", healthy: true, avgResponseTime: 200, failureRate: 5 },
      { url: "https://proxy2.example.com/jsonrpc", healthy: true, avgResponseTime: 300, failureRate: 10 },
    ]);
    (performance.getPerformanceStats as jest.Mock).mockReturnValue({
      totalRequests: 100,
      successfulRequests: 95,
      failedRequests: 5,
      successRate: 95,
      averageDuration: 250,
      cacheHitRate: 60,
      proxyUsageRate: 80,
      rateLimitedRequests: 2,
    });

    // Simulate KV write-then-read for health check
    let kvStore: Record<string, string> = {};
    mockEnv.CACHE_KV.put.mockImplementation(async (key: string, value: string) => {
      kvStore[key] = value;
    });
    mockEnv.CACHE_KV.get.mockImplementation(async (key: string) => {
      return kvStore[key] ?? null;
    });
    mockEnv.RATE_LIMIT_KV.get.mockImplementation(async (key: string) => {
      return kvStore[key] ?? null;
    });
  });

  describe("performHealthCheck", () => {
    it("should return a comprehensive health check result", async () => {
      const result = await performHealthCheck(mockEnv);

      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("version");
      expect(result).toHaveProperty("uptime");
      expect(result).toHaveProperty("checks");
    });

    it("should have correct status type", async () => {
      const result = await performHealthCheck(mockEnv);

      expect(["healthy", "degraded", "unhealthy"]).toContain(result.status);
    });

    it("should include all subsystem checks", async () => {
      const result = await performHealthCheck(mockEnv);

      expect(result.checks).toHaveProperty("proxies");
      expect(result.checks).toHaveProperty("cache");
      expect(result.checks).toHaveProperty("rateLimit");
      expect(result.checks).toHaveProperty("performance");
    });

    it("should have valid ISO timestamp", async () => {
      const result = await performHealthCheck(mockEnv);

      const date = new Date(result.timestamp);
      expect(date.toISOString()).toBe(result.timestamp);
    });

    it("should report version", async () => {
      const result = await performHealthCheck(mockEnv);

      expect(typeof result.version).toBe("string");
      expect(result.version.length).toBeGreaterThan(0);
    });

    it("should report uptime as a non-negative number", async () => {
      const result = await performHealthCheck(mockEnv);

      expect(typeof result.uptime).toBe("number");
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it("should have healthy status when all subsystems are healthy", async () => {
      const result = await performHealthCheck(mockEnv);

      expect(result.status).toBe("healthy");
    });

    it("each check should have status and message", async () => {
      const result = await performHealthCheck(mockEnv);

      for (const check of Object.values(result.checks)) {
        expect(["healthy", "degraded", "unhealthy"]).toContain(check.status);
        expect(typeof check.message).toBe("string");
        expect(check.message.length).toBeGreaterThan(0);
      }
    });

    // --- NEW TESTS FOR UNCOVERED LINES ---

    it("should return degraded when no proxy endpoints (line 44)", async () => {
      (proxyManager.getProxyEndpoints as jest.Mock).mockReturnValue([]);
      (proxyManager.getProxyHealthStats as jest.Mock).mockReturnValue([]);

      const result = await performHealthCheck(mockEnv);

      expect(result.checks.proxies.status).toBe("degraded");
      expect(result.checks.proxies.message).toBe(
        "No proxy endpoints configured"
      );
    });

    it("should return degraded when 50-80% proxies healthy (lines 59-64)", async () => {
      (proxyManager.getProxyEndpoints as jest.Mock).mockReturnValue([
        { url: "https://proxy1.example.com/jsonrpc" },
        { url: "https://proxy2.example.com/jsonrpc" },
        { url: "https://proxy3.example.com/jsonrpc" },
        { url: "https://proxy4.example.com/jsonrpc" },
      ]);
      (proxyManager.getProxyHealthStats as jest.Mock).mockReturnValue([
        { url: "https://proxy1.example.com/jsonrpc", healthy: true, avgResponseTime: 200, failureRate: 5 },
        { url: "https://proxy2.example.com/jsonrpc", healthy: false, avgResponseTime: 5000, failureRate: 100 },
        { url: "https://proxy3.example.com/jsonrpc", healthy: false, avgResponseTime: 5000, failureRate: 100 },
        { url: "https://proxy4.example.com/jsonrpc", healthy: true, avgResponseTime: 300, failureRate: 10 },
      ]);

      const result = await performHealthCheck(mockEnv);

      expect(result.checks.proxies.status).toBe("degraded");
      expect(result.checks.proxies.message).toContain("Only");
    });

    it("should return unhealthy when <50% proxies healthy (lines 65-70)", async () => {
      (proxyManager.getProxyEndpoints as jest.Mock).mockReturnValue([
        { url: "https://proxy1.example.com/jsonrpc" },
        { url: "https://proxy2.example.com/jsonrpc" },
        { url: "https://proxy3.example.com/jsonrpc" },
        { url: "https://proxy4.example.com/jsonrpc" },
      ]);
      (proxyManager.getProxyHealthStats as jest.Mock).mockReturnValue([
        { url: "https://proxy1.example.com/jsonrpc", healthy: true, avgResponseTime: 200, failureRate: 5 },
        { url: "https://proxy2.example.com/jsonrpc", healthy: false, avgResponseTime: 5000, failureRate: 100 },
        { url: "https://proxy3.example.com/jsonrpc", healthy: false, avgResponseTime: 5000, failureRate: 100 },
        { url: "https://proxy4.example.com/jsonrpc", healthy: false, avgResponseTime: 5000, failureRate: 100 },
      ]);

      const result = await performHealthCheck(mockEnv);

      expect(result.checks.proxies.status).toBe("unhealthy");
      expect(result.checks.proxies.message).toContain("Critical");
    });

    it("should return unhealthy when cache KV fails (line 88)", async () => {
      mockEnv.CACHE_KV.get.mockRejectedValueOnce(
        new Error("KV connection failed")
      );

      const result = await performHealthCheck(mockEnv);

      expect(result.checks.cache.status).toBe("unhealthy");
      expect(result.checks.cache.message).toBe("Cache KV is not accessible");
    });

    it("should handle non-Error exception from cache KV (line 89 branch)", async () => {
      mockEnv.CACHE_KV.get.mockRejectedValueOnce("string error");

      const result = await performHealthCheck(mockEnv);

      expect(result.checks.cache.status).toBe("unhealthy");
      expect(result.checks.cache.details).toBe("string error");
    });

    it("should return unhealthy when rate limit KV fails (line 109)", async () => {
      mockEnv.RATE_LIMIT_KV.get.mockRejectedValueOnce(
        new Error("KV connection failed")
      );

      const result = await performHealthCheck(mockEnv);

      expect(result.checks.rateLimit.status).toBe("unhealthy");
      expect(result.checks.rateLimit.message).toBe(
        "Rate limiter is not operational"
      );
    });

    it("should handle non-Error exception from rate limit KV (line 108 branch)", async () => {
      mockEnv.RATE_LIMIT_KV.get.mockRejectedValueOnce("non-error value");

      const result = await performHealthCheck(mockEnv);

      expect(result.checks.rateLimit.status).toBe("unhealthy");
      expect(result.checks.rateLimit.details).toBe("non-error value");
    });

    it("should return healthy with no requests processed yet (line 124)", async () => {
      (performance.getPerformanceStats as jest.Mock).mockReturnValue(null);

      const result = await performHealthCheck(mockEnv);

      expect(result.checks.performance.status).toBe("healthy");
      expect(result.checks.performance.message).toBe(
        "No requests processed yet"
      );
    });

    it("should return degraded when success rate is 80-95% (line 137)", async () => {
      (performance.getPerformanceStats as jest.Mock).mockReturnValue({
        totalRequests: 100,
        successfulRequests: 85,
        failedRequests: 15,
        successRate: 85,
        averageDuration: 300,
        cacheHitRate: 50,
        proxyUsageRate: 70,
        rateLimitedRequests: 5,
      });

      const result = await performHealthCheck(mockEnv);

      expect(result.checks.performance.status).toBe("degraded");
      expect(result.checks.performance.message).toContain(
        "Success rate degraded"
      );
    });

    it("should return unhealthy when success rate <80%", async () => {
      (performance.getPerformanceStats as jest.Mock).mockReturnValue({
        totalRequests: 100,
        successfulRequests: 50,
        failedRequests: 50,
        successRate: 50,
        averageDuration: 500,
        cacheHitRate: 30,
        proxyUsageRate: 40,
        rateLimitedRequests: 10,
      });

      const result = await performHealthCheck(mockEnv);

      expect(result.checks.performance.status).toBe("unhealthy");
      expect(result.checks.performance.message).toContain(
        "Low success rate"
      );
    });

    it("should return overall degraded when one check is degraded (line 169)", async () => {
      (proxyManager.getProxyEndpoints as jest.Mock).mockReturnValue([]);
      (proxyManager.getProxyHealthStats as jest.Mock).mockReturnValue([]);

      const result = await performHealthCheck(mockEnv);

      expect(result.status).toBe("degraded");
    });

    it("should return overall unhealthy when any check is unhealthy", async () => {
      mockEnv.CACHE_KV.get.mockRejectedValueOnce(
        new Error("KV connection failed")
      );

      const result = await performHealthCheck(mockEnv);

      expect(result.status).toBe("unhealthy");
    });
  });
});
