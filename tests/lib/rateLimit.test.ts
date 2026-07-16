/**
 * Tests for rate limiting functionality
 */

import { checkRateLimit, delayRequest } from "../../src/lib/rateLimit";

describe("Rate Limit Module", () => {
  let mockEnv: Env;

  beforeEach(() => {
    mockEnv = createMockEnv();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("checkRateLimit", () => {
    it("should allow requests within rate limit", async () => {
      (mockEnv.RATE_LIMIT_KV.get as jest.Mock).mockResolvedValueOnce(null);

      await expect(checkRateLimit("192.168.1.1", mockEnv)).resolves.toBe(true);
    });

    it("should deny requests exceeding rate limit", async () => {
      const blockedClient = `blocked-client-${Date.now()}`;
      (mockEnv.RATE_LIMIT_KV.get as jest.Mock).mockResolvedValueOnce({
        tokens: 0,
        lastRefill: Date.now() + 1000,
      });

      await expect(checkRateLimit(blockedClient, mockEnv)).resolves.toBe(false);
    });

    it("should refill tokens over time", async () => {
      (mockEnv.RATE_LIMIT_KV.get as jest.Mock).mockResolvedValueOnce({
        tokens: 0,
        lastRefill: Date.now() - 60000,
      });

      await expect(checkRateLimit("192.168.1.3", mockEnv)).resolves.toBe(true);
    });

    it("should allow requests when KV read fails", async () => {
      (mockEnv.RATE_LIMIT_KV.get as jest.Mock).mockRejectedValueOnce(
        new Error("KV error")
      );

      await expect(checkRateLimit("192.168.1.4", mockEnv)).resolves.toBe(true);
    });
  });

  describe("delayRequest", () => {
    it("should delay for specified seconds", async () => {
      const startTime = Date.now();
      await delayRequest(0.1);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(90);
    });

    it("should handle zero delay", async () => {
      const startTime = Date.now();
      await delayRequest(0);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(50);
    });
  });
});
