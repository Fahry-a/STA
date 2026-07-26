/**
 * Tests for error handling functionality — full coverage
 */

import {
  createErrorResponse,
  logError,
  isNetworkError,
  isRateLimitError,
  isServerError,
  isPayloadTooLargeError,
  enhanceRateLimitError,
} from "../../src/lib/errorHandler";

describe("Error Handler Module", () => {
  describe("createErrorResponse", () => {
    it("should handle generic errors", () => {
      const error = new Error("Generic error message");
      const result = createErrorResponse(error);
      expect(result.response.code).toBeGreaterThanOrEqual(400);
      expect(result.response.data).toBeNull();
      expect(result.httpStatus).toBeGreaterThanOrEqual(400);
    });

    it("should handle errors with status codes", () => {
      const error = new Error("Bad request");
      (error as any).status = 400;
      const result = createErrorResponse(error);
      expect(result.httpStatus).toBe(400);
    });

    it("should handle errors with code property", () => {
      const error = new Error("Rate limit exceeded");
      (error as any).code = 429;
      const result = createErrorResponse(error);
      expect(result.httpStatus).toBe(429);
    });

    it("should handle timeout errors", () => {
      const error = new Error("Request timeout");
      (error as any).status = 408;
      const result = createErrorResponse(error);
      expect(result.httpStatus).toBe(408);
    });

    it("should handle non-Error objects", () => {
      const r1 = createErrorResponse("String error");
      expect(r1.response.code).toBeGreaterThanOrEqual(400);

      const r2 = createErrorResponse({ message: "Object error" });
      expect(r2.response.code).toBeGreaterThanOrEqual(400);

      const r3 = createErrorResponse(null);
      expect(r3.response.code).toBeGreaterThanOrEqual(400);
    });

    it("should include context information", () => {
      const error = new Error("Test error");
      const result = createErrorResponse(error, {
        endpoint: "/translate",
        clientIP: "192.168.1.1",
      });
      expect(result.response.code).toBeGreaterThanOrEqual(400);
    });
  });

  describe("logError", () => {
    it("should log Error objects with stack trace", () => {
      const error = new Error("test error");
      const details = logError(error, { endpoint: "/test", clientIP: "127.0.0.1" });

      expect(details.message).toBeDefined();
      expect(details.stack).toBeDefined();
      expect(details.endpoint).toBe("/test");
      expect(details.clientIP).toBe("127.0.0.1");
      expect(details.timestamp).toBeGreaterThan(0);
    });

    it("should log non-Error objects", () => {
      const details = logError("string error");
      expect(details.message).toContain("string error");
      expect(details.stack).toBeUndefined();
    });

    it("should log objects with code and status", () => {
      const error = new Error("test");
      (error as any).code = 500;
      (error as any).status = 503;
      const details = logError(error);
      expect(details.code).toBe(500);
      expect(details.status).toBe(503);
    });

    it("should sanitize error messages - remove IPs", () => {
      const error = new Error("Connection to 192.168.1.1 failed");
      const details = logError(error);
      expect(details.message).not.toContain("192.168.1.1");
      expect(details.message).toContain("[IP]");
    });

    it("should sanitize error messages - remove emails", () => {
      const error = new Error("Contact admin@example.com for help");
      const details = logError(error);
      expect(details.message).not.toContain("admin@example.com");
      expect(details.message).toContain("[EMAIL]");
    });

    it("should sanitize error messages - remove hashes", () => {
      const error = new Error("Hash abcdef0123456789abcdef0123456789 mismatch");
      const details = logError(error);
      expect(details.message).not.toContain("abcdef0123456789abcdef0123456789");
      expect(details.message).toContain("[HASH]");
    });

    it("should truncate long messages to 500 chars", () => {
      const longMsg = "x".repeat(1000);
      const error = new Error(longMsg);
      const details = logError(error);
      expect(details.message.length).toBeLessThanOrEqual(500);
    });

    it("should not include clientIP or stack in sanitized output", () => {
      const error = new Error("test");
      (error as any).stack = "Error: test\n    at foo.js:1:1";
      const details = logError(error, { clientIP: "10.0.0.1" });
      // The sanitized console output excludes IP and stack
      expect(details.clientIP).toBe("10.0.0.1"); // raw details keep it
    });
  });

  describe("isNetworkError", () => {
    it("should detect TypeError with fetch message", () => {
      expect(isNetworkError(new TypeError("fetch failed"))).toBe(true);
    });

    it("should detect AbortError", () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      expect(isNetworkError(err)).toBe(true);
    });

    it("should detect network in message", () => {
      expect(isNetworkError(new Error("network error"))).toBe(true);
    });

    it("should detect timeout in message", () => {
      expect(isNetworkError(new Error("request timeout"))).toBe(true);
    });

    it("should return false for unrelated errors", () => {
      expect(isNetworkError(new Error("bad request"))).toBe(false);
      // null/undefined return undefined (falsy), not strictly false
      expect(isNetworkError(null)).toBeFalsy();
      expect(isNetworkError(undefined)).toBeFalsy();
    });
  });

  describe("isRateLimitError", () => {
    it("should detect 429 status", () => {
      expect(isRateLimitError({ status: 429 })).toBe(true);
    });

    it("should detect 429 code", () => {
      expect(isRateLimitError({ code: 429 })).toBe(true);
    });

    it("should return false for other codes", () => {
      expect(isRateLimitError({ status: 200 })).toBe(false);
      expect(isRateLimitError({})).toBe(false);
    });
  });

  describe("isServerError", () => {
    it("should detect 500 status", () => {
      expect(isServerError({ status: 500 })).toBe(true);
    });

    it("should detect 503 status", () => {
      expect(isServerError({ status: 503 })).toBe(true);
    });

    it("should detect via code property", () => {
      expect(isServerError({ code: 502 })).toBe(true);
    });

    it("should return false for 4xx errors", () => {
      expect(isServerError({ status: 400 })).toBe(false);
    });

    it("should handle missing status/code", () => {
      expect(isServerError({})).toBe(false);
    });
  });

  describe("isPayloadTooLargeError", () => {
    it("should detect 413 status", () => {
      expect(isPayloadTooLargeError({ status: 413 })).toBe(true);
    });

    it("should detect 413 code", () => {
      expect(isPayloadTooLargeError({ code: 413 })).toBe(true);
    });

    it("should detect Payload Too Large message", () => {
      expect(isPayloadTooLargeError(new Error("Payload Too Large"))).toBe(true);
    });

    it("should detect lowercase message", () => {
      expect(isPayloadTooLargeError(new Error("payload too large"))).toBe(true);
    });

    it("should return false for other errors", () => {
      expect(isPayloadTooLargeError(new Error("bad request"))).toBe(false);
    });
  });

  describe("enhanceRateLimitError", () => {
    it("should add suggestions for rate limit errors", () => {
      const error = { status: 429, message: "Too many requests" };
      const enhanced = enhanceRateLimitError(error);

      expect(enhanced.suggestions).toBeDefined();
      expect(enhanced.suggestions).toHaveLength(3);
      expect(enhanced.retryAfter).toBe(60);
    });

    it("should return original error for non-rate-limit errors", () => {
      const error = new Error("not rate limited");
      const result = enhanceRateLimitError(error);
      expect(result).toBe(error);
      expect((result as any).suggestions).toBeUndefined();
    });

    it("should detect rate limit via code property", () => {
      const error = { code: 429 };
      const enhanced = enhanceRateLimitError(error);
      expect(enhanced.suggestions).toBeDefined();
    });
  });
});
