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

  it("charges 0 for an invalid request (no tokens spent)", () => {
    const v = validateV2Request({ text: [], target_lang: "zh" });
    expect(v.isValid).toBe(false);
    expect(getV2ItemChargeCount(v)).toBe(0);
  });

  it("charges 0 when text is not an array", () => {
    const v = validateV2Request({ text: "hello", target_lang: "zh" });
    expect(v.isValid).toBe(false);
    expect(getV2ItemChargeCount(v)).toBe(0);
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
});
