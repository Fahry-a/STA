/**
 * Tests for V2 Request Validation
 */

import {
  validateV2Request,
  getV2ItemChargeCount,
  formatCombinedText,
  parseCombinedResponse,
} from "../../src/lib/v2Validation";

describe("V2 Validation", () => {
  describe("validateV2Request", () => {
    it("should accept a valid request with APR=true", () => {
      const result = validateV2Request({
        text: ["hello", "world"],
        APR: true,
        target_lang: "zh",
        source_lang: "en",
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedInput?.APR).toBe(true);
      expect(result.sanitizedInput?.text).toEqual(["hello", "world"]);
    });

    it("should accept a valid request with APR=false", () => {
      const result = validateV2Request({
        text: ["hello"],
        APR: false,
        target_lang: "de",
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedInput?.APR).toBe(false);
    });

    it("non-object input: null returns invalid", () => {
      const result = validateV2Request(null as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Request body must be a valid JSON object");
    });

    it("non-object input: string returns invalid", () => {
      const result = validateV2Request("hello" as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("Request body must be a valid JSON object");
    });

    it("non-object input: array returns invalid (triggers typeof check)", () => {
      // Arrays have typeof === "object" in JS, so they pass the type check
      // but fail because they don't have .text property
      const result = validateV2Request([] as any);
      expect(result.isValid).toBe(false);
      // Arrays are objects in JS, so they pass the type check, then fail on missing text
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should reject when text is missing", () => {
      const result = validateV2Request({ target_lang: "zh" } as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("text field is required");
    });

    it("should reject when text is not an array", () => {
      const result = validateV2Request({ text: "hello", target_lang: "zh" } as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("text field must be an array");
    });

    it("should reject empty text array", () => {
      const result = validateV2Request({ text: [], target_lang: "zh" });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("text array cannot be empty");
    });

    it("should reject text array exceeding max items", () => {
      const result = validateV2Request({
        text: Array(11).fill("hello"),
        target_lang: "zh",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("cannot exceed"))).toBe(true);
    });

    it("empty string items in text array: rejects empty strings", () => {
      const result = validateV2Request({
        text: ["hello", "", "world"],
        target_lang: "zh",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("cannot be empty"))).toBe(true);
    });

    it("should reject non-string text items", () => {
      const result = validateV2Request({
        text: [123 as any, "valid"],
        target_lang: "zh",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("must be a string"))).toBe(true);
    });

    it("should reject text items that are only whitespace", () => {
      const result = validateV2Request({
        text: ["   ", "valid"],
        target_lang: "zh",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("cannot be empty"))).toBe(true);
    });

    it("APR=true with oversized individual item (>5000 chars)", () => {
      const result = validateV2Request({
        text: ["a".repeat(5001)],
        APR: true,
        target_lang: "zh",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("exceeds maximum length"))).toBe(true);
    });

    it("APR=false with oversized total (>5000 chars combined)", () => {
      const result = validateV2Request({
        text: ["a".repeat(3000), "b".repeat(3000)],
        APR: false,
        target_lang: "zh",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("Total text length"))).toBe(true);
    });

    it("missing target_lang", () => {
      const result = validateV2Request({
        text: ["hello"],
        APR: true,
      } as any);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("target_lang is required");
    });

    it("target_lang as number", () => {
      const result = validateV2Request({
        text: ["hello"],
        target_lang: 123 as any,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("target_lang must be a string");
    });

    it("source_lang as number", () => {
      const result = validateV2Request({
        text: ["hello"],
        source_lang: 123 as any,
        target_lang: "zh",
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain("source_lang must be a string");
    });

    it("parseApr with number value (triggers Boolean fallback)", () => {
      const result = validateV2Request({
        text: ["hello"],
        APR: 42 as any,
        target_lang: "zh",
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedInput?.APR).toBe(true);
    });

    it("parseApr with number 0 (Boolean(0) = false)", () => {
      const result = validateV2Request({
        text: ["hello"],
        APR: 0 as any,
        target_lang: "zh",
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedInput?.APR).toBe(false);
    });

    it("parseApr with undefined defaults to true", () => {
      const result = validateV2Request({
        text: ["hello"],
        target_lang: "zh",
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedInput?.APR).toBe(true);
    });

    it("should default source_lang to auto when not provided", () => {
      const result = validateV2Request({
        text: ["hello"],
        target_lang: "zh",
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedInput?.source_lang).toBe("auto");
    });

    it("should preserve source_lang when provided", () => {
      const result = validateV2Request({
        text: ["hello"],
        source_lang: "en",
        target_lang: "zh",
      });
      expect(result.isValid).toBe(true);
      expect(result.sanitizedInput?.source_lang).toBe("en");
    });
  });

  describe("getV2ItemChargeCount", () => {
    it("charges per item when APR=true", () => {
      const v = validateV2Request({ text: ["a", "b", "c"], APR: true, target_lang: "zh" });
      expect(getV2ItemChargeCount(v)).toBe(3);
    });

    it("charges 1 when APR=false", () => {
      const v = validateV2Request({ text: ["a", "b", "c"], APR: false, target_lang: "zh" });
      expect(getV2ItemChargeCount(v)).toBe(1);
    });

    it("charges 1 for invalid requests", () => {
      const v = validateV2Request({ text: [] });
      expect(getV2ItemChargeCount(v)).toBe(1);
    });
  });

  describe("formatCombinedText", () => {
    it("joins texts with newline", () => {
      expect(formatCombinedText(["hello", "world"])).toBe("hello\nworld");
    });

    it("returns single text unchanged", () => {
      expect(formatCombinedText(["hello"])).toBe("hello");
    });
  });

  describe("parseCombinedResponse", () => {
    it("splits response by newline", () => {
      const result = parseCombinedResponse("hello\nworld", 2);
      expect(result).toEqual(["hello", "world"]);
    });

    it("pads with empty strings when fewer parts", () => {
      const result = parseCombinedResponse("hello", 3);
      expect(result).toEqual(["hello", "", ""]);
    });

    it("truncates when more parts than expected", () => {
      const result = parseCombinedResponse("a\nb\nc", 2);
      expect(result).toEqual(["a", "b"]);
    });
  });
});
