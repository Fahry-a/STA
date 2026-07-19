/**
 * Tests for retry logic functionality
 */

import {
  calculateSmartDelay,
  isRetryableError,
  retryWithBackoff,
} from "../../src/lib/retryLogic";

// Mock delayRequest so retry backoff sleeps are recorded (not actually waited).
// retryWithBackoff imports delayRequest from ./rateLimit, so we mock that module.
jest.mock("../../src/lib/rateLimit", () => ({
  delayRequest: jest.fn().mockResolvedValue(undefined),
}));
// Import the mocked function for assertions.
import { delayRequest } from "../../src/lib/rateLimit";
const mockedDelayRequest = delayRequest as jest.MockedFunction<
  typeof delayRequest
>;

describe("Retry Logic Module", () => {
  describe("isRetryableError", () => {
    it("should identify retryable timeout and fetch errors", () => {
      const timeoutError = new Error("timeout");
      timeoutError.name = "AbortError";

      const fetchError = new TypeError("fetch failed");

      expect(isRetryableError(timeoutError)).toBe(true);
      expect(isRetryableError(fetchError)).toBe(true);
    });

    it("should identify retryable HTTP status codes", () => {
      const serverError = new Error("Server error");
      (serverError as { status?: number }).status = 500;

      const rateLimitError = new Error("Too many requests");
      (rateLimitError as { status?: number }).status = 429;

      expect(isRetryableError(serverError)).toBe(true);
      expect(isRetryableError(rateLimitError)).toBe(true);
    });

    it("should not retry non-retryable client errors", () => {
      const badRequest = new Error("Bad request");
      (badRequest as { status?: number }).status = 400;

      expect(isRetryableError(badRequest)).toBe(false);
      expect(isRetryableError(new Error("Generic error"))).toBe(false);
    });
  });

  describe("retryWithBackoff", () => {
    const defaultOptions = {
      maxRetries: 3,
      initialDelay: 10,
      backoffFactor: 2,
      isRetryable: isRetryableError,
    };

    it("should succeed on first try", async () => {
      const mockOperation = jest.fn().mockResolvedValue("success");

      await expect(
        retryWithBackoff(mockOperation, defaultOptions)
      ).resolves.toBe("success");
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it("should retry on retryable errors", async () => {
      const retryableError = new TypeError("fetch failed");
      const mockOperation = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce("success");

      await expect(
        retryWithBackoff(mockOperation, defaultOptions)
      ).resolves.toBe("success");
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it("should not retry non-retryable errors", async () => {
      const nonRetryableError = new Error("Bad request");
      (nonRetryableError as { status?: number }).status = 400;
      const mockOperation = jest.fn().mockRejectedValue(nonRetryableError);

      await expect(
        retryWithBackoff(mockOperation, defaultOptions)
      ).rejects.toThrow("Bad request");
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it("should exhaust all retries", async () => {
      const mockOperation = jest
        .fn()
        .mockRejectedValue(new TypeError("fetch failed"));

      await expect(
        retryWithBackoff(mockOperation, defaultOptions)
      ).rejects.toThrow("fetch failed");
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it("should use a custom retry predicate", async () => {
      const customError = new Error("Custom error");
      const mockOperation = jest.fn().mockRejectedValue(customError);
      const customIsRetryable = jest.fn().mockReturnValue(false);

      await expect(
        retryWithBackoff(mockOperation, {
          ...defaultOptions,
          isRetryable: customIsRetryable,
        })
      ).rejects.toThrow("Custom error");

      expect(mockOperation).toHaveBeenCalledTimes(1);
      expect(customIsRetryable).toHaveBeenCalledWith(customError);
    });
  });

  describe("calculateSmartDelay", () => {
    it("should use longer delays for rate limit errors", () => {
      expect(calculateSmartDelay(0, true)).toBe(60000);
      expect(calculateSmartDelay(1, true)).toBeGreaterThan(60000);
    });

    it("should cap non-rate-limit delays", () => {
      expect(calculateSmartDelay(0, false)).toBe(1000);
      expect(calculateSmartDelay(10, false)).toBe(30000);
    });
  });

  describe("backoff jitter", () => {
    const retryableOptions = {
      maxRetries: 3,
      initialDelay: 1000,
      backoffFactor: 2,
      isRetryable: isRetryableError,
    };

    beforeEach(() => {
      mockedDelayRequest.mockClear();
    });

    it("should apply full jitter: delay is in [0, fullDelay]", async () => {
      // Fail twice with retryable errors, then succeed. Two backoff sleeps
      // happen: attempt 0 (fullDelay = 1000) and attempt 1 (fullDelay = 2000).
      const retryableError = new TypeError("fetch failed");
      const operation = jest
        .fn()
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(retryableError)
        .mockResolvedValueOnce("ok");

      await retryWithBackoff(operation, retryableOptions);

      expect(mockedDelayRequest).toHaveBeenCalledTimes(2);
      const delays = mockedDelayRequest.mock.calls.map((c) => c[0]);

      // delayRequest receives the delay converted to seconds. full jitter keeps
      // the delay in [0, fullDelay], so /1000 must be within the same bounds
      // for each attempt's fullDelay.
      expect(delays[0]).toBeGreaterThanOrEqual(0);
      expect(delays[0]).toBeLessThanOrEqual(1); // fullDelay = 1000ms = 1s
      expect(delays[1]).toBeGreaterThanOrEqual(0);
      expect(delays[1]).toBeLessThanOrEqual(2); // fullDelay = 2000ms = 2s
    });

    it("should not sleep when the error is non-retryable (fast-fail path)", async () => {
      const nonRetryableError = new Error("Bad request");
      (nonRetryableError as { status?: number }).status = 400;
      const operation = jest.fn().mockRejectedValue(nonRetryableError);

      await expect(
        retryWithBackoff(operation, retryableOptions)
      ).rejects.toThrow("Bad request");

      expect(mockedDelayRequest).not.toHaveBeenCalled();
    });

    it("should eventually reach the full backoff window across many samples", async () => {
      // Run 40 single-attempt failures and confirm at least one jittered delay
      // is non-zero (jitter is uniform in [0, fullDelay], so a 0-only sample
      // over 40 trials is overwhelmingly unlikely — guards against the delay
      // collapsing to a constant zero regression).
      let sawPositiveDelay = false;
      for (let i = 0; i < 40; i++) {
        mockedDelayRequest.mockClear();
        const operation = jest
          .fn()
          .mockRejectedValueOnce(new TypeError("fetch failed"))
          .mockResolvedValueOnce("ok");
        await retryWithBackoff(operation, retryableOptions);
        const delaySeconds = mockedDelayRequest.mock.calls[0]?.[0] ?? 0;
        if (delaySeconds > 0) {
          sawPositiveDelay = true;
          break;
        }
      }
      expect(sawPositiveDelay).toBe(true);
    });
  });
});
