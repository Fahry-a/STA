/**
 * Google Translate service integration tests
 */

import { beforeEach, afterEach, describe, expect, it } from "@jest/globals";
import { translateWithGoogle } from "../../../src/lib/providers/googleTranslate";
import { PAYLOAD_LIMITS } from "../../../src/lib/config";

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
    global.fetch = jest.fn() as jest.Mock;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("translateWithGoogle", () => {
    it("should handle successful translation request", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse([[["Hello", "Hola", null, null, 10]], null, "en"])
      );

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
          signal: expect.anything(),
        })
      );
    });

    it("should fail without retry on a non-retryable 4xx error", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse(null, { ok: false, status: 400 })
      );

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
      expect(fetch).toHaveBeenCalledTimes(1);
    });

    it("should retry a 5xx error then succeed", async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce(mockResponse(null, { ok: false, status: 503 }))
        .mockResolvedValueOnce(
          mockResponse([[["Oi", null, null, null]], null, "en"])
        );

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
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it("should retry on a timeout (AbortError) then succeed", async () => {
      const abortError = new Error("The operation was aborted");
      abortError.name = "AbortError";

      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce(
          mockResponse([[["Hallo", null, null, null]], null, "en"])
        );

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
      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

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
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse([]));

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

    it("should reject text longer than MAX_TEXT_LENGTH with 413", async () => {
      const longText = "a".repeat(PAYLOAD_LIMITS.MAX_TEXT_LENGTH + 1);

      const params = {
        text: longText,
        source_lang: "en",
        target_lang: "es",
      };

      const result = await translateWithGoogle(params, {
        env: mockEnv,
        clientIP: "127.0.0.1",
      });

      expect(result.code).toBe(413);
      expect(result.data).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it("should allow text at exactly MAX_TEXT_LENGTH", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse([[["ok", null, null, null]], null, "en"])
      );

      const params = {
        text: "a".repeat(PAYLOAD_LIMITS.MAX_TEXT_LENGTH),
        source_lang: "en",
        target_lang: "es",
      };

      const result = await translateWithGoogle(params, {
        env: mockEnv,
        clientIP: "127.0.0.1",
      });

      expect(result.code).toBe(200);
      expect(fetch).toHaveBeenCalled();
    });

    it("should use auto source language in URL", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse([[["auto-detected", null, null, null]], null, "auto"])
      );

      const params = {
        text: "Hello",
        source_lang: "auto",
        target_lang: "es",
      };

      await translateWithGoogle(params, {
        env: mockEnv,
        clientIP: "127.0.0.1",
      });

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("sl=auto"),
        expect.anything()
      );
    });

    it("should handle response without env or clientIP", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse([[["Hi", null, null, null]], null, "en"])
      );

      const result = await translateWithGoogle({
        text: "Hello",
        source_lang: "en",
        target_lang: "es",
      });

      expect(result.code).toBe(200);
    });

    it("should handle non-Error rejection (line 140 false branch)", async () => {
      (global.fetch as jest.Mock).mockRejectedValue("string error");

      const result = await translateWithGoogle(
        { text: "Hello", source_lang: "en", target_lang: "es" },
        { env: mockEnv, clientIP: "127.0.0.1" }
      );

      expect(result.code).toBe(500);
      expect(result.data).toBeNull();
    });

    it("should use 'unknown' clientIP in error logging when config has no clientIP (lines 165-173)", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const result = await translateWithGoogle(
        { text: "Hello", source_lang: "en", target_lang: "es" },
        { env: mockEnv }
      );

      expect(result.code).toBe(500);
      expect(result.data).toBeNull();
    });

    it("should log error with non-Error value in catch block (lines 165-173)", async () => {
      (global.fetch as jest.Mock).mockRejectedValue(42);

      const result = await translateWithGoogle(
        { text: "Hello", source_lang: "en", target_lang: "es" },
        { env: mockEnv }
      );

      expect(result.code).toBe(500);
      expect(result.data).toBeNull();
    });

    it("should skip non-string segment entries (line 37 false branch)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse([
          [
            ["translated", null],
            [null, null],
          ],
          null,
          "en",
        ])
      );

      const result = await translateWithGoogle(
        { text: "Hello", source_lang: "en", target_lang: "es" },
        { env: mockEnv, clientIP: "127.0.0.1" }
      );

      expect(result.code).toBe(200);
      expect(result.data).toBe("translated");
    });

    it("should use fallbackSourceLang when body[2] is not a string (line 47 false branch)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse([[["translated", null]], null, null])
      );

      const result = await translateWithGoogle(
        { text: "Hello", source_lang: "en", target_lang: "es" },
        { env: mockEnv, clientIP: "127.0.0.1" }
      );

      expect(result.code).toBe(200);
      expect(result.data).toBe("translated");
    });

    it("should handle segments where all entries are non-strings (line 37 false branch)", async () => {
      (global.fetch as jest.Mock).mockResolvedValue(
        mockResponse([[[null, null], [undefined, null]], null, "en"])
      );

      const result = await translateWithGoogle(
        { text: "Hello", source_lang: "en", target_lang: "es" },
        { env: mockEnv, clientIP: "127.0.0.1" }
      );

      expect(result.code).toBe(500);
      expect(result.data).toBeNull();
    });
  });
});
