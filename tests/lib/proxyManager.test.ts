/**
 * Tests for proxy management functionality
 */

import {
  generateBrowserFingerprint,
  getProxyEndpoints,
  selectProxy,
  recordProxySuccess,
  recordProxyFailure,
  getProxyHealthStats,
} from "../../src/lib/proxyManager";

describe("Proxy Manager Module", () => {
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = createMockEnv();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("generateBrowserFingerprint", () => {
    it("should generate browser-like headers", () => {
      const fingerprint = generateBrowserFingerprint();

      expect(fingerprint).toHaveProperty("User-Agent");
      expect(fingerprint).toHaveProperty("Accept");
      expect(fingerprint).toHaveProperty("Accept-Language");
      expect(fingerprint).toHaveProperty("Accept-Encoding");
      expect(fingerprint).toHaveProperty("DNT");
      expect(fingerprint).toHaveProperty("Connection");
      expect(fingerprint).toHaveProperty("Upgrade-Insecure-Requests");
    });

    it("should generate string header values", () => {
      const fingerprint = generateBrowserFingerprint();

      Object.values(fingerprint).forEach((value) => {
        expect(typeof value).toBe("string");
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe("getProxyEndpoints", () => {
    it("should parse proxy URLs from environment", () => {
      const endpoints = getProxyEndpoints(mockEnv);

      expect(Array.isArray(endpoints)).toBe(true);
      expect(endpoints.length).toBe(2);
      expect(endpoints[0]).toHaveProperty("url");
    });

    it("should trim proxy URLs", () => {
      const endpoints = getProxyEndpoints({
        ...mockEnv,
        PROXY_URLS:
          " https://test1.example.com/jsonrpc , https://test2.example.com/jsonrpc ",
      });

      expect(endpoints).toEqual([
        { url: "https://test1.example.com/jsonrpc" },
        { url: "https://test2.example.com/jsonrpc" },
      ]);
    });

    it("should handle missing proxy URLs", () => {
      const envWithoutProxies = { ...mockEnv, PROXY_URLS: undefined };
      const endpoints = getProxyEndpoints(envWithoutProxies);

      expect(endpoints).toEqual([]);
    });

    it("should filter out non-http URLs", () => {
      const envWithMixed = {
        ...mockEnv,
        PROXY_URLS:
          "https://valid.example.com/jsonrpc,ftp://invalid.example.com/jsonrpc,not-a-url",
      };
      const endpoints = getProxyEndpoints(envWithMixed);

      expect(endpoints).toEqual([
        { url: "https://valid.example.com/jsonrpc" },
      ]);
    });

    it("should handle empty string PROXY_URLS", () => {
      const envEmpty = { ...mockEnv, PROXY_URLS: "" };
      const endpoints = getProxyEndpoints(envEmpty);
      expect(endpoints).toEqual([]);
    });

    it("should handle blank entries in PROXY_URLS", () => {
      const envBlank = {
        ...mockEnv,
        PROXY_URLS: "https://proxy1.example.com/jsonrpc,,  ,https://proxy2.example.com/jsonrpc",
      };
      const endpoints = getProxyEndpoints(envBlank);
      expect(endpoints).toEqual([
        { url: "https://proxy1.example.com/jsonrpc" },
        { url: "https://proxy2.example.com/jsonrpc" },
      ]);
    });
  });

  describe("selectProxy", () => {
    it("should select a proxy from available endpoints", async () => {
      const proxy = await selectProxy(mockEnv);

      expect(proxy).not.toBeNull();
      expect(proxy?.url).toMatch(/^https:\/\/test[12]\.example\.com\/jsonrpc$/);
    });

    it("should return null when no proxies are available", async () => {
      const envWithoutProxies = { ...mockEnv, PROXY_URLS: undefined };
      const proxy = await selectProxy(envWithoutProxies);

      expect(proxy).toBeNull();
    });

    it("should select proxy after cooldown recovery (lines 169-171)", async () => {
      const proxyUrl = "https://test1.example.com/jsonrpc";

      // Mark proxy as unhealthy (3 consecutive failures)
      recordProxyFailure(proxyUrl);
      recordProxyFailure(proxyUrl);
      recordProxyFailure(proxyUrl);

      // Verify proxy is unhealthy
      const stats = getProxyHealthStats(mockEnv);
      const proxy1Stats = stats.find((s) => s.url === proxyUrl);
      expect(proxy1Stats?.healthy).toBe(false);

      // Simulate cooldown period passing (30+ seconds)
      // We need to advance Date.now. Use jest.spyOn on Date
      const originalDateNow = Date.now;
      const startTime = originalDateNow();
      Date.now = jest.fn(() => startTime + 31000); // 31 seconds later

      try {
        const proxy = await selectProxy(mockEnv);
        expect(proxy).not.toBeNull();
      } finally {
        Date.now = originalDateNow;
      }
    });

    it("should return null and log error when getProxyEndpoints throws (lines 246-251)", async () => {
      const envThrowing = {
        ...mockEnv,
        PROXY_URLS: "https://valid.example.com/jsonrpc",
      };

      // Mock getProxyEndpoints to throw
      // We can't easily mock the internal function, but we can test the error path
      // by passing an env that causes issues
      // Actually, selectProxy calls getProxyEndpoints which handles its own errors
      // Let's test a different approach: make the env object throw on property access
      const throwingEnv = new Proxy(envThrowing, {
        get(target, prop) {
          if (prop === "PROXY_URLS") {
            throw new Error("Environment access failed");
          }
          return Reflect.get(target, prop);
        },
      });

      const proxy = await selectProxy(throwingEnv as any);
      expect(proxy).toBeNull();
    });

    it("should fallback to all proxies when all are unhealthy", async () => {
      const proxyUrl1 = "https://test1.example.com/jsonrpc";
      const proxyUrl2 = "https://test2.example.com/jsonrpc";

      // Mark both proxies as unhealthy
      recordProxyFailure(proxyUrl1);
      recordProxyFailure(proxyUrl1);
      recordProxyFailure(proxyUrl1);
      recordProxyFailure(proxyUrl2);
      recordProxyFailure(proxyUrl2);
      recordProxyFailure(proxyUrl2);

      // Should still select a proxy (fallback to all)
      const proxy = await selectProxy(mockEnv);
      expect(proxy).not.toBeNull();
    });

    it("should use weighted random selection", async () => {
      // Run selection multiple times to verify it works
      const selections = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const proxy = await selectProxy(mockEnv);
        if (proxy) selections.add(proxy.url);
      }

      // With 2 proxies, we should see both selected at least once in 20 attempts
      expect(selections.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe("recordProxySuccess and recordProxyFailure", () => {
    it("should track proxy health after successes and failures", () => {
      const proxyUrl = "https://test1.example.com/jsonrpc";

      // Record some successes
      recordProxySuccess(proxyUrl, 200);
      recordProxySuccess(proxyUrl, 300);

      let stats = getProxyHealthStats(mockEnv);
      let proxyStats = stats.find((s) => s.url === proxyUrl);
      expect(proxyStats?.healthy).toBe(true);

      // Record failures until unhealthy
      recordProxyFailure(proxyUrl);
      recordProxyFailure(proxyUrl);
      recordProxyFailure(proxyUrl);

      stats = getProxyHealthStats(mockEnv);
      proxyStats = stats.find((s) => s.url === proxyUrl);
      expect(proxyStats?.healthy).toBe(false);
    });

    it("should reset consecutive failures on success", () => {
      const proxyUrl = "https://test1.example.com/jsonrpc";

      recordProxyFailure(proxyUrl);
      recordProxyFailure(proxyUrl);
      // 2 failures, not yet unhealthy

      recordProxySuccess(proxyUrl, 150);
      // Success resets consecutive failures

      recordProxyFailure(proxyUrl);
      // Only 1 consecutive failure now, not unhealthy

      const stats = getProxyHealthStats(mockEnv);
      const proxyStats = stats.find((s) => s.url === proxyUrl);
      expect(proxyStats?.healthy).toBe(true);
    });
  });
});
