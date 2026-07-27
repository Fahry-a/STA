/**
 * Tests for query module - core translation functionality
 */

import {
  buildRequestBody,
  normalizeLanguageCode,
  query,
} from "../../src/lib/providers/query";
import { PAYLOAD_LIMITS } from "../../src/lib/config";

describe("Query Module", () => {
  let mockEnv: Env;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockEnv = createMockEnv();
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    (globalThis as any).DEBUG_MODE = false;
  });

  afterEach(() => {
    jest.clearAllMocks();
    (globalThis as any).DEBUG_MODE = false;
  });

  describe("normalizeLanguageCode", () => {
    it("should normalize language codes to uppercase", () => {
      expect(normalizeLanguageCode("en")).toBe("EN");
      expect(normalizeLanguageCode("zh")).toBe("ZH");
      expect(normalizeLanguageCode("auto")).toBe("auto");
    });

    it("should handle language name mappings", () => {
      expect(normalizeLanguageCode("english")).toBe("EN");
      expect(normalizeLanguageCode("chinese")).toBe("ZH");
      expect(normalizeLanguageCode("spanish")).toBe("ES");
    });

    it("should handle edge cases", () => {
      expect(normalizeLanguageCode("")).toBe("auto");
      expect(normalizeLanguageCode("AUTO")).toBe("auto");
      expect(normalizeLanguageCode("unknown")).toBe("UNKNOWN");
    });

    it("should handle all mapped language names", () => {
      const languageMap: Record<string, string> = {
        french: "FR",
        german: "DE",
        italian: "IT",
        japanese: "JA",
        portuguese: "PT",
        russian: "RU",
        dutch: "NL",
        polish: "PL",
        swedish: "SV",
        danish: "DA",
        norwegian: "NB",
        finnish: "FI",
        czech: "CS",
        slovak: "SK",
        slovenian: "SL",
        estonian: "ET",
        latvian: "LV",
        lithuanian: "LT",
        hungarian: "HU",
        romanian: "RO",
        bulgarian: "BG",
        greek: "EL",
        turkish: "TR",
        ukrainian: "UK",
        korean: "KO",
        indonesian: "ID",
      };

      for (const [name, code] of Object.entries(languageMap)) {
        expect(normalizeLanguageCode(name)).toBe(code);
      }
    });
  });

  describe("buildRequestBody", () => {
    it("should build valid request body", () => {
      const params = {
        text: "Hello world",
        source_lang: "en",
        target_lang: "zh",
      };

      const body = buildRequestBody(params);
      const parsed = JSON.parse(body);

      expect(parsed.jsonrpc).toBe("2.0");
      expect(parsed.method).toBe("LMT_handle_texts");
      expect(parsed.params.texts[0].text).toBe("Hello world");
      expect(parsed.params.lang.source_lang_user_selected).toBe("EN");
      expect(parsed.params.lang.target_lang).toBe("ZH");
    });

    it("should handle method spacing based on ID", () => {
      const params = {
        text: "Test text",
        source_lang: "en",
        target_lang: "zh",
      };

      const body = buildRequestBody(params);

      // Should contain either "method": or "method" :
      expect(body).toMatch(/"method"\s*:\s*"/);
    });

    it("should throw error for invalid parameters", () => {
      expect(() => buildRequestBody({} as any)).toThrow();
      expect(() => buildRequestBody({ text: "" } as any)).toThrow();
      expect(() => buildRequestBody({ text: "   " } as any)).toThrow();
    });

    it("should handle text length limits", () => {
      const longText = "a".repeat(10000);
      expect(() =>
        buildRequestBody({
          text: longText,
          source_lang: "en",
          target_lang: "zh",
        })
      ).toThrow(/Text too long/);
    });

    it("should build body with text at maximum length", () => {
      const maxText = "a".repeat(PAYLOAD_LIMITS.MAX_TEXT_LENGTH);
      const body = buildRequestBody({
        text: maxText,
        source_lang: "en",
        target_lang: "zh",
      });

      const parsed = JSON.parse(body);
      expect(parsed.params.texts[0].text).toBe(maxText);
    });

    it("should handle text with no source language", () => {
      const body = buildRequestBody({
        text: "Hello",
        target_lang: "zh",
      } as any);
      const parsed = JSON.parse(body);
      expect(parsed.params.lang.source_lang_user_selected).toBe("auto");
    });

    it("should handle text with no target language", () => {
      const body = buildRequestBody({
        text: "Hello",
        source_lang: "en",
      } as any);
      const parsed = JSON.parse(body);
      expect(parsed.params.lang.target_lang).toBe("EN");
    });

    it("should produce valid timestamp (line 247 - invalid timestamp check)", () => {
      const body = buildRequestBody({
        text: "Hello world",
        source_lang: "en",
        target_lang: "zh",
      });
      const parsed = JSON.parse(body);
      expect(parsed.params.timestamp).toBeGreaterThan(0);
      expect(Number.isFinite(parsed.params.timestamp)).toBe(true);
    });

    it("should handle text with many 'i' letters for getTimestamp edge cases (lines 172-190)", () => {
      // Text with many 'i' letters to trigger getTimestamp modification
      const textWithManyI = "i".repeat(500);
      const body = buildRequestBody({
        text: textWithManyI,
        source_lang: "en",
        target_lang: "zh",
      });
      const parsed = JSON.parse(body);
      expect(parsed.params.timestamp).toBeGreaterThan(0);
    });

    it("should handle text with exactly 0 'i' letters (line 167-168)", () => {
      const textNoI = "abc def ghi jkl mno".replace(/i/g, "");
      const body = buildRequestBody({
        text: textNoI,
        source_lang: "en",
        target_lang: "zh",
      });
      const parsed = JSON.parse(body);
      expect(parsed.params.timestamp).toBeGreaterThan(0);
    });

    it("should handle text with very many 'i' letters (modValue > 1000, line 175)", () => {
      // Create text with 1001 'i' letters (modValue = 1002 > 1000)
      const textWithVeryManyI = "i".repeat(1001);
      const body = buildRequestBody({
        text: textWithVeryManyI,
        source_lang: "en",
        target_lang: "zh",
      });
      const parsed = JSON.parse(body);
      // When modValue > 1000, getTimestamp falls back to raw timestamp
      expect(parsed.params.timestamp).toBeGreaterThan(0);
    });

    it("should enable debug logging when DEBUG_MODE is true (lines 231-234)", () => {
      (globalThis as any).DEBUG_MODE = true;

      const body = buildRequestBody({
        text: "Hello world",
        source_lang: "en",
        target_lang: "zh",
      });

      const parsed = JSON.parse(body);
      expect(parsed).toHaveProperty("jsonrpc");
    });

    it("should enable debug logging with auto source lang", () => {
      (globalThis as any).DEBUG_MODE = true;

      const body = buildRequestBody({
        text: "Hello world",
        source_lang: "auto",
        target_lang: "zh",
      });

      const parsed = JSON.parse(body);
      expect(parsed.params.lang.source_lang_user_selected).toBe("auto");
    });

    it("should fall back to raw timestamp when modifiedTimestamp exceeds MAX_SAFE_INTEGER (line 190)", () => {
      const originalDateNow = Date.now;
      Date.now = () => Number.MAX_SAFE_INTEGER;
      try {
        const body = buildRequestBody({
          text: "i",
          source_lang: "en",
          target_lang: "zh",
        });
        const parsed = JSON.parse(body);
        expect(parsed.params.timestamp).toBe(Number.MAX_SAFE_INTEGER);
      } finally {
        Date.now = originalDateNow;
      }
    });

    it("should throw when timestamp is zero (line 247)", () => {
      const originalDateNow = Date.now;
      Date.now = () => 0;
      try {
        expect(() =>
          buildRequestBody({
            text: "Hello",
            source_lang: "en",
            target_lang: "zh",
          })
        ).toThrow("Invalid timestamp generated");
      } finally {
        Date.now = originalDateNow;
      }
    });

    it("should throw when payload exceeds MAX_REQUEST_SIZE (line 268)", () => {
      const OriginalTextEncoder = global.TextEncoder;
      global.TextEncoder = class {
        encode() {
          return new Uint8Array(40000);
        }
      } as any;
      try {
        expect(() =>
          buildRequestBody({
            text: "Hello world",
            source_lang: "en",
            target_lang: "zh",
          })
        ).toThrow(/Request payload too large/);
      } finally {
        global.TextEncoder = OriginalTextEncoder;
      }
    });
  });

  describe("query function", () => {
    it("should return error for missing text", async () => {
      const result = await query({} as any);
      expect(result).toBeValidErrorResponse();
      expect(result.code).toBe(400);
    });

    it("should handle successful translation", async () => {
      const mockResponse = {
        result: {
          texts: [{ text: "你好世界" }],
          lang: "ZH",
        },
        id: 12345,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await query({
        text: "Hello world",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result).toBeValidTranslationResponse();
      expect(result.code).toBe(200);
      expect(result.data).toBe("你好世界");
    });

    it("should handle 429 rate limit response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve("rate limited"),
      } as any);

      const result = await query({
        text: "Hello",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result.code).toBeGreaterThanOrEqual(400);
    });

    it("should handle 400 error response with body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("bad request details"),
      } as any);

      const result = await query({
        text: "Hello",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result.code).toBeGreaterThanOrEqual(400);
    });

    it("should handle non-ok response that fails to read body", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.reject(new Error("read error")),
      } as any);

      const result = await query({
        text: "Hello",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result.code).toBeGreaterThanOrEqual(400);
    });

    it("should handle JSON parse error in response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error("invalid json")),
      } as any);

      const result = await query({
        text: "Hello",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result.code).toBeGreaterThanOrEqual(400);
    });

    it("should handle DeepL API error codes", async () => {
      const errorCodes = [1156049, 1042912, 1042513, 1042003];
      for (const code of errorCodes) {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              error: { code, message: `Error ${code}` },
            }),
        } as any);

        const result = await query({
          text: "Hello",
          source_lang: "en",
          target_lang: "zh",
        });

        expect(result.code).toBeGreaterThanOrEqual(400);
      }
    });

    it("should handle unknown DeepL error code", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            error: { code: 999999, message: "Unknown error" },
          }),
      } as any);

      const result = await query({
        text: "Hello",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result.code).toBeGreaterThanOrEqual(400);
    });

    it("should handle invalid response structure (no texts)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            result: { texts: [], lang: "EN" },
            id: 12345,
          }),
      } as any);

      const result = await query({
        text: "Hello",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result.code).toBeGreaterThanOrEqual(400);
    });

    it("should handle response with no result field", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      } as any);

      const result = await query({
        text: "Hello",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result.code).toBeGreaterThanOrEqual(400);
    });

    it("should handle API errors", async () => {
      const mockErrorResponse = {
        error: {
          code: 1156049,
          message: "Invalid request format",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockErrorResponse),
      } as any);

      const result = await query({
        text: "Hello world",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result).toBeValidErrorResponse();
      expect(result.code).toBeGreaterThanOrEqual(400);
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await query({
        text: "Hello world",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result).toBeValidErrorResponse();
    });

    it("should handle timeout errors", async () => {
      const timeoutError = new Error("Request timed out");
      timeoutError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(timeoutError);

      const result = await query({
        text: "Hello world",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result).toBeValidErrorResponse();
    });

    it("should use proxy when provided", async () => {
      const mockResponse = {
        result: {
          texts: [{ text: "你好世界" }],
          lang: "ZH",
        },
        id: 12345,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      await query(
        {
          text: "Hello world",
          source_lang: "en",
          target_lang: "zh",
        },
        {
          proxyEndpoint: "https://custom-proxy.com/api",
        }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        "https://custom-proxy.com/api",
        expect.any(Object)
      );
    });

    it("should use proxy from env selection", async () => {
      const mockResponse = {
        result: { texts: [{ text: "translated" }], lang: "EN" },
        id: 12345,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      const result = await query(
        { text: "Hello", source_lang: "auto", target_lang: "en" },
        { env: mockEnv }
      );

      expect(result.code).toBe(200);
    });

    it("should handle non-ok response after makeRequest", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: () => Promise.resolve("bad gateway"),
      } as any);

      const result = await query({
        text: "Hello",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result.code).toBeGreaterThanOrEqual(400);
    });

    it("should handle response.ok but non-ok after makeRequest (retry path)", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          text: () => Promise.resolve("unavailable"),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              result: { texts: [{ text: "ok" }], lang: "EN" },
              id: 12345,
            }),
        } as any);

      const result = await query({
        text: "Hello",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result.code).toBe(200);
    });

    it("should handle empty params text", async () => {
      const result = await query({
        text: "",
        source_lang: "en",
        target_lang: "zh",
      } as any);
      expect(result.code).toBe(400);
    });

    it("should handle error with no message in DeepL response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            error: { code: 1156049 },
          }),
      } as any);

      const result = await query({
        text: "Hello",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result.code).toBeGreaterThanOrEqual(400);
    });

    it("should handle error with no code in DeepL response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            error: { message: "Some error" },
          }),
      } as any);

      const result = await query({
        text: "Hello",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result.code).toBeGreaterThanOrEqual(400);
    });

    it("should handle custom headers", async () => {
      const mockResponse = {
        result: { texts: [{ text: "translated" }], lang: "EN" },
        id: 12345,
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as any);

      await query(
        { text: "Hello", source_lang: "en", target_lang: "zh" },
        { customHeader: { "X-Custom": "test" } }
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({ "X-Custom": "test" }),
        })
      );
    });

    it("should handle retryable error then success", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve("server error"),
        } as any)
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              result: { texts: [{ text: "recovered" }], lang: "EN" },
              id: 12345,
            }),
        } as any);

      const result = await query({
        text: "Hello",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result.code).toBe(200);
      expect(result.data).toBe("recovered");
    });

    it("should handle non-retryable error immediately", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("unauthorized"),
      } as any);

      const result = await query({
        text: "Hello",
        source_lang: "en",
        target_lang: "zh",
      });

      expect(result.code).toBeGreaterThanOrEqual(400);
    });

    it("should record proxy failure when request fails with proxy (line 396)", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await query(
        { text: "Hello", source_lang: "en", target_lang: "zh" },
        { env: mockEnv }
      );

      expect(result.code).toBeGreaterThanOrEqual(400);
    });

    it("should record proxy failure on timeout with proxy", async () => {
      const timeoutError = new Error("Request timed out");
      timeoutError.name = "AbortError";
      mockFetch.mockRejectedValueOnce(timeoutError);

      const result = await query(
        { text: "Hello", source_lang: "en", target_lang: "zh" },
        { env: mockEnv }
      );

      expect(result.code).toBeGreaterThanOrEqual(400);
    });
  });
});
