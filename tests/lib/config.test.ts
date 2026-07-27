/**
 * Tests for configuration module
 */

import {
  calculateDynamicRateLimits,
  RATE_LIMIT_CONFIG,
} from "../../src/lib/config";

describe("Config Module", () => {
  describe("calculateDynamicRateLimits", () => {
    it("should return base limits when zero proxies (line 59)", () => {
      const result = calculateDynamicRateLimits(0);

      expect(result.TOKENS_PER_MINUTE).toBe(
        RATE_LIMIT_CONFIG.BASE_TOKENS_PER_MINUTE
      );
      expect(result.REFILL_RATE).toBe(
        RATE_LIMIT_CONFIG.BASE_TOKENS_PER_MINUTE / 60
      );
    });

    it("should calculate limits based on proxy count", () => {
      const result = calculateDynamicRateLimits(3);

      const expectedTokensPerMinute =
        3 * RATE_LIMIT_CONFIG.PROXY_TOKENS_PER_SECOND * 60;
      expect(result.TOKENS_PER_MINUTE).toBe(expectedTokensPerMinute);
      expect(result.REFILL_RATE).toBe(expectedTokensPerMinute / 60);
    });

    it("should return single-proxy limits for one proxy", () => {
      const result = calculateDynamicRateLimits(1);

      const expected =
        1 * RATE_LIMIT_CONFIG.PROXY_TOKENS_PER_SECOND * 60;
      expect(result.TOKENS_PER_MINUTE).toBe(expected);
      expect(result.REFILL_RATE).toBe(expected / 60);
    });

    it("should scale linearly with proxy count", () => {
      const r1 = calculateDynamicRateLimits(2);
      const r2 = calculateDynamicRateLimits(4);

      expect(r2.TOKENS_PER_MINUTE).toBe(r1.TOKENS_PER_MINUTE * 2);
    });
  });
});
