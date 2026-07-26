/**
 * Tests for security functionality
 */

import {
  SECURITY_HEADERS,
  getSecureClientIP,
  handleCORSPreflight,
  validateLanguageCode,
  timingSafeEqual,
  isAdminAuthorized,
} from "../../src/lib/security";

describe("Security Module", () => {
  describe("SECURITY_HEADERS", () => {
    it("should contain required security headers", () => {
      expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
      expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
      expect(SECURITY_HEADERS["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
      expect(SECURITY_HEADERS["Content-Security-Policy"]).toContain("default-src 'self'");
      expect(SECURITY_HEADERS["X-XSS-Protection"]).toBeUndefined();
    });
  });

  describe("handleCORSPreflight", () => {
    it("should return CORS preflight response", () => {
      const mockContext = {
        text: jest.fn().mockReturnValue("preflight response"),
      };
      const result = handleCORSPreflight(mockContext);
      expect(mockContext.text).toHaveBeenCalledWith(
        "",
        200,
        expect.objectContaining({
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        })
      );
    });
  });

  describe("validateLanguageCode", () => {
    it("should validate correct language codes", () => {
      expect(validateLanguageCode("en")).toBe("en");
      expect(validateLanguageCode("zh")).toBe("zh");
      expect(validateLanguageCode("EN")).toBe("en");
      expect(validateLanguageCode("zh-CN")).toBe("zh-cn");
      expect(validateLanguageCode("pt-BR")).toBe("pt-br");
    });

    it("should reject invalid language codes", () => {
      expect(validateLanguageCode("")).toBeNull();
      expect(validateLanguageCode("a")).toBeNull();
      expect(validateLanguageCode("toolong")).toBeNull();
      expect(validateLanguageCode("en@")).toBeNull();
      expect(validateLanguageCode("en_US")).toBeNull();
      expect(validateLanguageCode("123")).toBe("123");
    });

    it("should handle non-string inputs", () => {
      expect(validateLanguageCode(null as any)).toBeNull();
      expect(validateLanguageCode(undefined as any)).toBeNull();
      expect(validateLanguageCode(123 as any)).toBeNull();
      expect(validateLanguageCode({} as any)).toBeNull();
    });

    it("should trim whitespace", () => {
      expect(validateLanguageCode("  en  ")).toBe("en");
      expect(validateLanguageCode("\ten\n")).toBe("en");
    });
  });

  describe("getSecureClientIP", () => {
    it("should extract IP from CF-Connecting-IP header", () => {
      const mockRequest = {
        headers: { get: jest.fn().mockImplementation((h: string) => h === "CF-Connecting-IP" ? "192.168.1.1" : null) },
      };
      expect(getSecureClientIP(mockRequest)).toBe("192.168.1.1");
    });

    it("should extract IP from X-Forwarded-For header", () => {
      const mockRequest = {
        headers: { get: jest.fn().mockImplementation((h: string) => h === "X-Forwarded-For" ? "192.168.1.1, 10.0.0.1" : null) },
      };
      expect(getSecureClientIP(mockRequest)).toBe("192.168.1.1");
    });

    it("should prioritize CF-Connecting-IP over X-Forwarded-For", () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockImplementation((h: string) => {
            if (h === "CF-Connecting-IP") return "192.168.1.1";
            if (h === "X-Forwarded-For") return "10.0.0.1";
            return null;
          }),
        },
      };
      expect(getSecureClientIP(mockRequest)).toBe("192.168.1.1");
    });

    it("should return null for invalid IPs", () => {
      const mockRequest = {
        headers: { get: jest.fn().mockImplementation((h: string) => h === "CF-Connecting-IP" ? "invalid-ip" : null) },
      };
      expect(getSecureClientIP(mockRequest)).toBeNull();
    });

    it("should return null when no IP headers present", () => {
      const mockRequest = { headers: { get: jest.fn().mockReturnValue(null) } };
      expect(getSecureClientIP(mockRequest)).toBeNull();
    });

    it("should handle IPv6 addresses", () => {
      const mockRequest = {
        headers: {
          get: jest.fn().mockImplementation((h: string) =>
            h === "CF-Connecting-IP" ? "2001:0db8:85a3:0000:0000:8a2e:0370:7334" : null
          ),
        },
      };
      expect(getSecureClientIP(mockRequest)).toBe("2001:0db8:85a3:0000:0000:8a2e:0370:7334");
    });

    it("should return null when X-Forwarded-For contains invalid IP", () => {
      const mockRequest = {
        headers: { get: jest.fn().mockImplementation((h: string) => h === "X-Forwarded-For" ? "invalid, also-invalid" : null) },
      };
      expect(getSecureClientIP(mockRequest)).toBeNull();
    });
  });

  describe("timingSafeEqual", () => {
    it("should return true for identical strings", () => {
      expect(timingSafeEqual("hello", "hello")).toBe(true);
    });

    it("should return false for different strings", () => {
      expect(timingSafeEqual("hello", "world")).toBe(false);
    });

    it("should return false for different length strings", () => {
      expect(timingSafeEqual("short", "much longer string")).toBe(false);
      expect(timingSafeEqual("a", "ab")).toBe(false);
      expect(timingSafeEqual("ab", "a")).toBe(false);
    });

    it("should return false for non-string inputs (null)", () => {
      expect(timingSafeEqual(null as any, "test")).toBe(false);
      expect(timingSafeEqual("test", null as any)).toBe(false);
      expect(timingSafeEqual(null as any, null as any)).toBe(false);
    });

    it("should return false for non-string inputs (undefined)", () => {
      expect(timingSafeEqual(undefined as any, "test")).toBe(false);
      expect(timingSafeEqual("test", undefined as any)).toBe(false);
      expect(timingSafeEqual(undefined as any, undefined as any)).toBe(false);
    });

    it("should return false for non-string inputs (numbers)", () => {
      expect(timingSafeEqual(123 as any, "123")).toBe(false);
      expect(timingSafeEqual("123", 123 as any)).toBe(false);
      expect(timingSafeEqual(123 as any, 456 as any)).toBe(false);
    });

    it("should return true for empty strings", () => {
      expect(timingSafeEqual("", "")).toBe(true);
    });

    it("should return false for empty vs non-empty", () => {
      expect(timingSafeEqual("", "a")).toBe(false);
      expect(timingSafeEqual("a", "")).toBe(false);
    });
  });

  describe("isAdminAuthorized", () => {
    it("should authorize when provided key matches secret", () => {
      expect(isAdminAuthorized("my-secret-key", "my-secret-key")).toBe(true);
    });

    it("should reject when provided key does not match secret", () => {
      expect(isAdminAuthorized("wrong-key", "my-secret-key")).toBe(false);
    });

    it("should reject when secret is undefined", () => {
      expect(isAdminAuthorized("my-key", undefined)).toBe(false);
    });

    it("should reject when secret is empty string", () => {
      expect(isAdminAuthorized("my-key", "")).toBe(false);
    });

    it("should reject when provided key is null", () => {
      expect(isAdminAuthorized(null, "my-secret-key")).toBe(false);
    });

    it("should reject when provided key is undefined", () => {
      expect(isAdminAuthorized(undefined, "my-secret-key")).toBe(false);
    });

    it("should reject when both are undefined", () => {
      expect(isAdminAuthorized(undefined, undefined)).toBe(false);
    });

    it("should reject when both are null-ish", () => {
      expect(isAdminAuthorized(null as any, undefined)).toBe(false);
    });

    it("should handle different length keys (timingSafeEqual path)", () => {
      expect(isAdminAuthorized("short", "much-longer-secret")).toBe(false);
    });
  });
});
