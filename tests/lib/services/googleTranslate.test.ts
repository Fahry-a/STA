/**
 * Google Translate service integration tests
 */

import { beforeEach, describe, expect, it } from "@jest/globals";
import { translateWithGoogle } from "../../../src/lib/services/googleTranslate";

/**
 * Build a minimal fetch-mocked Response satisfying the shape used by the
 * Google path (ok + status + json()).
 */
function mockResponse(
  data: unknown,
  options: { ok?: boolean; status?: number } = {}
) {
  const ok = options.ok ?? true;
  return {
    ok,
    status: options.status ?? (ok ? 200 : 500),
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  };
}

describe("Google Translate Service", () => {
  let mockEnv: any;

  beforeEach(() => {
    mockEnv = {};
  });

  describe("translateWithGoogle", () => {
    it("should handle successful translation request", async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve(
          mockResponse([[["Hello", "Hola", null, null, 10]], null, "en"])
        )
      ) as jest.Mock;

      const params = {
        text: "Hello",
        source_lang: "en",
        target_lang: "es",
      };

      const result = await translateWithGoogle(params, {
        env: mockEnv,
        clientIP: "127.0.0.1",
      });

      expect(result.code).toBe(200);
      expect(result.data).toBe("Hello");
      expect(result.source_lang).toBe("EN");
      expect(result.target_lang).toBe("ES");
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("translate.google.com"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "User-Agent": expect.stringContaining("Mozilla"),
          }),
          // AbortController signal must now be attached (timeout enforcement)
          signal: expect.anything(),
        })
      );
    });

    it("should fail without retry on a non-retryable 4xx error", async () => {
      // 400 is not in isRetryableError's retry set, so this must fail fast and
      // deterministically (no backoff delay).
      global.fetch = jest.fn(() =>
        Promise.resolve(mockResponse(null, { ok: false, status: 400 }))
      ) as jest.Mock;

      const params = {
        text: "Hello",
        source_lang: "en",
        target_lang: "es",
      };

      const result = await translateWithGoogle(params, {
        env: mockEnv,
        clientIP: "127.0.0.1",
      });

      expect(result.code).toBe(400);
      expect(result.data).toBeNull();
      // Should only have called Google once — no retry attempts.
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("should retry a 5xx error then succeed", async () => {
      // First call: 503 (retryable). Second call: success.
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(mockResponse(null, { ok: false, status: 503 }))
        .mockResolvedValueOnce(
          mockResponse([[["Oi", null, null, null]], null, "en"])
        ) as jest.Mock;

      const params = {
        text: "Hello",
        source_lang: "en",
        target_lang: "pt",
      };

      const result = await translateWithGoogle(params, {
        env: mockEnv,
        clientIP: "127.0.0.1",
      });

      expect(result.code).toBe(200);
      expect(result.data).toBe("Oi");
      // Exactly two fetch calls: the failed attempt plus the retried success.
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should retry on a timeout (AbortError) then succeed", async () => {
      // First call rejects with an AbortError-shaped error (as the
      // AbortController timeout would produce). Our wrapper maps that to a
      // retryable 408 and retries. The second call succeeds.
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";

      global.fetch = jest
        .fn()
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce(
          mockResponse([[["Hallo", null, null, null]], null, "en"])
        ) as jest.Mock;

      const params = {
        text: "Hello",
        source_lang: "en",
        target_lang: "de",
      };

      const result = await translateWithGoogle(params, {
        env: mockEnv,
        clientIP: "127.0.0.1",
      });

      expect(result.code).toBe(200);
      expect(result.data).toBe("Hallo");
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should fail fast on a non-retryable network error", async () => {
      // A plain Error (not TypeError, no status) is not retryable, so the
      // wrapper fails immediately without burning retry delays.
      global.fetch = jest.fn(() =>
        Promise.reject(new Error("Network error"))
      ) as jest.Mock;

      const params = {
        text: "Hello",
        source_lang: "en",
        target_lang: "es",
      };

      const result = await translateWithGoogle(params, {
        env: mockEnv,
        clientIP: "127.0.0.1",
      });

      expect(result.code).toBe(500);
      expect(result.data).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("should treat an empty translation response as a hard failure", async () => {
      global.fetch = jest.fn(() =>
        Promise.resolve(mockResponse([]))
      ) as jest.Mock;

      const params = {
        text: "Hello",
        source_lang: "en",
        target_lang: "es",
      };

      const result = await translateWithGoogle(params, {
        env: mockEnv,
        clientIP: "127.0.0.1",
      });

      expect(result.code).toBe(500);
      expect(result.data).toBeNull();
    });
  });
});
