/**
 * Tests for V2 batch translation and per-item rate-limit charging.
 */

import { beforeEach, describe, expect, it } from "@jest/globals";
import { translateBatch } from "../../src/lib/v2Translate";
import {
  getV2ItemChargeCount,
  validateV2Request,
} from "../../src/lib/v2Validation";

function mockDeepLResponse(translated: string, lang = "ZH", id = 12345) {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        result: { texts: [{ text: translated }], lang },
        id,
      }),
    text: () => Promise.resolve(JSON.stringify({})),
  };
}

describe("V2 Validation — getV2ItemChargeCount", () => {
  it("charges one token per text item when APR=true", () => {
    const v = validateV2Request({
      text: ["a", "b", "c"],
      APR: true,
      target_lang: "zh",
    });
    expect(v.isValid).toBe(true);
    expect(getV2ItemChargeCount(v)).toBe(3);
  });

  it("charges a single token when APR=false (combined call)", () => {
    const v = validateV2Request({
      text: ["a", "b", "c"],
      APR: false,
      target_lang: "zh",
    });
    expect(v.isValid).toBe(true);
    expect(getV2ItemChargeCount(v)).toBe(1);
  });

  it("defaults APR to true (one charge per item)", () => {
    const v = validateV2Request({
      text: ["a", "b"],
      target_lang: "zh",
    });
    expect(v.isValid).toBe(true);
    expect(v.sanitizedInput?.APR).toBe(true);
    expect(getV2ItemChargeCount(v)).toBe(2);
  });

  it("charges 1 for an invalid request (prevents rate-limit bypass)", () => {
    const v = validateV2Request({ text: [], target_lang: "zh" });
    expect(v.isValid).toBe(false);
    expect(getV2ItemChargeCount(v)).toBe(1);
  });

  it("charges 1 when text is not an array (prevents rate-limit bypass)", () => {
    const v = validateV2Request({ text: "hello", target_lang: "zh" });
    expect(v.isValid).toBe(false);
    expect(getV2ItemChargeCount(v)).toBe(1);
  });
});

describe("V2 Validation — APR string sentinels", () => {
  it('honors the string sentinel "false" as APR=false (Boolean("false") bug)', () => {
    const v = validateV2Request({
      text: ["a", "b", "c"],
      APR: "false",
      target_lang: "zh",
    });
    expect(v.isValid).toBe(true);
    expect(v.sanitizedInput?.APR).toBe(false);
    // APR=false is a single combined call → one charge, not N.
    expect(getV2ItemChargeCount(v)).toBe(1);
  });

  it('honors the string sentinel "true" as APR=true', () => {
    const v = validateV2Request({
      text: ["a", "b"],
      APR: "true",
      target_lang: "zh",
    });
    expect(v.isValid).toBe(true);
    expect(v.sanitizedInput?.APR).toBe(true);
    expect(getV2ItemChargeCount(v)).toBe(2);
  });

  it("still accepts a real boolean for APR", () => {
    const vTrue = validateV2Request({
      text: ["a"],
      APR: true,
      target_lang: "zh",
    });
    expect(vTrue.sanitizedInput?.APR).toBe(true);

    const vFalse = validateV2Request({
      text: ["a"],
      APR: false,
      target_lang: "zh",
    });
    expect(vFalse.sanitizedInput?.APR).toBe(false);
  });

  it("trims and is case-insensitive when parsing string sentinels", () => {
    const v = validateV2Request({
      text: ["a"],
      APR: "  FALSE  ",
      target_lang: "zh",
    });
    expect(v.sanitizedInput?.APR).toBe(false);
  });
});

describe("V2 translateBatch", () => {
  beforeEach(() => {
    // Stub the upstream DeepL fetch used by query().
    global.fetch = jest.fn(() =>
      Promise.resolve(mockDeepLResponse("你好"))
    ) as jest.Mock;
    // Keep timers real so retry backoff (with jitter) resolves promptly on
    // the happy path (no retries occur here).
  });

  it("translates each item separately when APR=true", async () => {
    const env = createMockEnv();
    const result = await translateBatch(
      {
        text: ["hello", "world"],
        APR: true,
        source_lang: "en",
        target_lang: "zh",
      },
      { env, clientIP: "127.0.0.1" }
    );

    expect(result.code).toBe(200);
    expect(result.data).toHaveLength(2);
    expect(result.data.every((r) => r.success)).toBe(true);
    // The response surfaces the APR mode that was applied.
    expect(result.apr).toBe(true);
    // One upstream call per item.
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("translates as a single combined call when APR=false", async () => {
    const env = createMockEnv();
    const result = await translateBatch(
      {
        text: ["hello", "world"],
        APR: false,
        source_lang: "en",
        target_lang: "zh",
      },
      { env, clientIP: "127.0.0.1" }
    );

    expect(result.code).toBe(200);
    expect(result.data).toHaveLength(2);
    expect(result.apr).toBe(false);
    // A single combined upstream call.
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid batch with 400 and makes no upstream calls", async () => {
    const env = createMockEnv();
    const result = await translateBatch(
      { text: [], target_lang: "zh" } as any,
      { env, clientIP: "127.0.0.1" }
    );

    expect(result.code).toBe(400);
    expect(result.apr).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("handles APR=true with partial failures (207 Multi-Status)", async () => {
    let callCount = 0;
    global.fetch = jest.fn(() => {
      callCount++;
      if (callCount === 1) {
        // First call succeeds
        return Promise.resolve(mockDeepLResponse("你好"));
      }
      // Second call returns error
      return Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve("server error"),
      });
    }) as jest.Mock;

    const env = createMockEnv();
    const result = await translateBatch(
      {
        text: ["hello", "world"],
        APR: true,
        source_lang: "en",
        target_lang: "zh",
      },
      { env, clientIP: "127.0.0.1" }
    );

    expect(result.code).toBe(207);
    expect(result.apr).toBe(true);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].success).toBe(true);
    expect(result.data[1].success).toBe(false);
  });

  it("handles APR=true with all failures", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve("error"),
      })
    ) as jest.Mock;

    const env = createMockEnv();
    const result = await translateBatch(
      {
        text: ["hello"],
        APR: true,
        source_lang: "en",
        target_lang: "zh",
      },
      { env, clientIP: "127.0.0.1" }
    );

    expect(result.code).toBe(207);
    expect(result.data[0].success).toBe(false);
    expect(result.data[0].error).toBeDefined();
  });

  it("handles APR=true with fetch exceptions", async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new TypeError("fetch failed"))
    ) as jest.Mock;

    const env = createMockEnv();
    const result = await translateBatch(
      {
        text: ["hello"],
        APR: true,
        source_lang: "en",
        target_lang: "zh",
      },
      { env, clientIP: "127.0.0.1" }
    );

    expect(result.code).toBe(207);
    expect(result.data[0].success).toBe(false);
  });

  it("handles APR=false combined failure", async () => {
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        status: 500,
        text: () => Promise.resolve("error"),
      })
    ) as jest.Mock;

    const env = createMockEnv();
    const result = await translateBatch(
      {
        text: ["hello", "world"],
        APR: false,
        source_lang: "en",
        target_lang: "zh",
      },
      { env, clientIP: "127.0.0.1" }
    );

    expect(result.code).toBeGreaterThanOrEqual(400);
    expect(result.data).toHaveLength(2);
    expect(result.data.every((r) => !r.success)).toBe(true);
  });

  it("handles APR=false fetch exception", async () => {
    global.fetch = jest.fn(() =>
      Promise.reject(new TypeError("fetch failed"))
    ) as jest.Mock;

    const env = createMockEnv();
    const result = await translateBatch(
      {
        text: ["hello"],
        APR: false,
        source_lang: "en",
        target_lang: "zh",
      },
      { env, clientIP: "127.0.0.1" }
    );

    expect(result.code).toBeGreaterThanOrEqual(400);
    expect(result.data[0].success).toBe(false);
  });

  it("handles APR=true with non-string text items", async () => {
    const env = createMockEnv();
    const result = await translateBatch(
      {
        text: [123 as any, "valid"],
        APR: true,
        source_lang: "en",
        target_lang: "zh",
      },
      { env, clientIP: "127.0.0.1" }
    );

    // Validation should reject the non-string item
    expect(result.code).toBe(400);
  });
});
