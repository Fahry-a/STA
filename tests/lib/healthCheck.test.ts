/**
 * Tests for health check module
 */

import { performHealthCheck } from "../../src/lib/healthCheck";

jest.mock("../../src/lib/proxyManager", () => ({
  getProxyEndpoints: jest.fn().mockReturnValue([
    { url: "https://proxy1.example.com/jsonrpc" },
    { url: "https://proxy2.example.com/jsonrpc" },
  ]),
  getProxyHealthStats: jest.fn().mockReturnValue([
    { url: "https://proxy1.example.com/jsonrpc", healthy: true, avgResponseTime: 200, failureRate: 5 },
    { url: "https://proxy2.example.com/jsonrpc", healthy: true, avgResponseTime: 300, failureRate: 10 },
  ]),
}));

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

jest.mock("../../src/lib/rateLimit", () => ({
  checkRateLimit: jest.fn().mockResolvedValue(true),
}));

describe("Health Check Module", () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = createMockEnv();
    jest.clearAllMocks();

    // Simulate KV write-then-read for health check
    let kvStore: Record<string, string> = {};
    mockEnv.CACHE_KV.put.mockImplementation(async (key: string, value: string) => {
      kvStore[key] = value;
    });
    mockEnv.CACHE_KV.get.mockImplementation(async (key: string) => {
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

      // All mocked subsystems return healthy
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
  });
});
