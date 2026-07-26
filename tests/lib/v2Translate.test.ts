/**
 * Tests for V2 batch translation and per-item rate-limit charging.
 */

import { beforeEach, describe, expect, it } from "@jest/globals";
import { translateBatch } from "../../src/lib/v2Translate";
import {
  getV2ItemChargeCount,
  validateV2Request,
} from "../../src/lib/v2Validation";
import * as queryModule from "../../src/lib/query";

jest.mock("../../src/lib/query");

const mockQuery = queryModule.query as jest.MockedFunction<typeof queryModule.query>;

function successResponse(translated: string, lang = "ZH", id = 12345) {
  return {
    code: 200,
    data: translated,
    id,
    source_lang: lang,
    target_lang: "ZH",
  };
}

function errorResponse(code: number) {
  return {
    code,
    data: null,
    id: 12345,
    source_lang: null,
    target_lang: null,
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
  const env = createMockEnv();

  beforeEach(() => {
    jest.clearAllMocks();
    mockQuery.mockResolvedValue(successResponse("你好"));
  });

  it("translates each item separately when APR=true", async () => {
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
    expect(result.apr).toBe(true);
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it("translates as a single combined call when APR=false", async () => {
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
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });

  it("rejects an invalid batch with 400 and makes no upstream calls", async () => {
    const result = await translateBatch(
      { text: [], target_lang: "zh" } as any,
      { env, clientIP: "127.0.0.1" }
    );

    expect(result.code).toBe(400);
    expect(result.apr).toBe(false);
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("handles APR=true with partial failures (207 Multi-Status)", async () => {
    mockQuery
      .mockResolvedValueOnce(successResponse("你好"))
      .mockResolvedValueOnce(errorResponse(500));

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
    mockQuery.mockResolvedValue(errorResponse(500));

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

  it("handles APR=true with query throwing (catch block lines 106-107)", async () => {
    mockQuery.mockRejectedValue(new Error("query crashed"));

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
    expect(result.data[0].error).toBe("query crashed");
  });

  it("handles APR=true with non-Error throw (catch block lines 106-107)", async () => {
    mockQuery.mockRejectedValue("string error");

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
    expect(result.data[0].error).toBe("Unknown error");
  });

  it("handles APR=false combined failure", async () => {
    mockQuery.mockResolvedValue(errorResponse(500));

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

  it("handles APR=false combined mode where query throws (catch block lines 178-185)", async () => {
    mockQuery.mockRejectedValue(new Error("combined query explosion"));

    const result = await translateBatch(
      {
        text: ["hello", "world"],
        APR: false,
        source_lang: "en",
        target_lang: "zh",
      },
      { env, clientIP: "127.0.0.1" }
    );

    expect(result.code).toBe(500);
    expect(result.data).toHaveLength(2);
    expect(result.data[0].success).toBe(false);
    expect(result.data[0].error).toBe("combined query explosion");
    expect(result.data[1].success).toBe(false);
    expect(result.data[1].error).toBe("combined query explosion");
  });

  it("APR=false combined mode with non-Error throw", async () => {
    mockQuery.mockRejectedValue("string error");

    const result = await translateBatch(
      {
        text: ["hello"],
        APR: false,
        source_lang: "en",
        target_lang: "zh",
      },
      { env, clientIP: "127.0.0.1" }
    );

    expect(result.code).toBe(500);
    expect(result.data[0].success).toBe(false);
    expect(result.data[0].error).toBe("Unknown error");
  });

  it("handles APR=true with non-string text items", async () => {
    const result = await translateBatch(
      {
        text: [123 as any, "valid"],
        APR: true,
        source_lang: "en",
        target_lang: "zh",
      },
      { env, clientIP: "127.0.0.1" }
    );

    expect(result.code).toBe(400);
  });

  it("APR=true with one item having error code in query response", async () => {
    mockQuery
      .mockResolvedValueOnce(successResponse("translated"))
      .mockResolvedValueOnce(errorResponse(500));

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
    expect(result.data).toHaveLength(2);
    expect(result.data[0].success).toBe(true);
    expect(result.data[1].success).toBe(false);
    expect(result.data[1].error).toBe("Translation failed with code 500");
  });

  it("APR=true all succeed returns 200", async () => {
    mockQuery
      .mockResolvedValueOnce(successResponse("translated1"))
      .mockResolvedValueOnce(successResponse("translated2"));

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
  });

  it("APR=false query returns non-200 code", async () => {
    mockQuery.mockResolvedValue(errorResponse(500));

    const result = await translateBatch(
      {
        text: ["hello"],
        APR: false,
        source_lang: "en",
        target_lang: "zh",
      },
      { env, clientIP: "127.0.0.1" }
    );

    expect(result.code).toBe(500);
    expect(result.data[0].success).toBe(false);
    expect(result.data[0].error).toBe("Translation failed with code 500");
  });

  it("APR=true with source_lang and target_lang preserved", async () => {
    const result = await translateBatch(
      {
        text: ["hello"],
        APR: true,
        source_lang: "en",
        target_lang: "de",
      },
      { env, clientIP: "127.0.0.1" }
    );

    expect(result.code).toBe(200);
    expect(mockQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "hello",
        source_lang: "en",
        target_lang: "de",
      }),
      expect.objectContaining({ env, clientIP: "127.0.0.1" })
    );
  });
});
