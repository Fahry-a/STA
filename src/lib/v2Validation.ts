/**
 * V2 Request Validation
 * Handles batch translation validation with APR support
 */

import { PAYLOAD_LIMITS } from "./config";

export interface V2ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedInput?: any;
}

const MAX_ARRAY_ITEMS = 10;
const MAX_TEXT_LENGTH = PAYLOAD_LIMITS.MAX_TEXT_LENGTH; // 5000 chars
const MAX_TOTAL_LENGTH = PAYLOAD_LIMITS.MAX_TEXT_LENGTH; // 5000 chars for combined

/**
 * Parse the APR flag from a request body into a concrete boolean.
 *
 * APR defaults to `true` when omitted. Real booleans pass through unchanged.
 * String sentinels "true"/"false" (case-insensitive, trimmed) are honored so a
 * client sending `"APR": "false"` over JSON gets combined mode, not the N-call
 * true path that `Boolean("false")` would have produced. Any other value falls
 * back to legacy `Boolean()` coercion to preserve prior behavior.
 */
function parseApr(value: unknown): boolean {
  if (value === undefined) {
    return true;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") {
      return true;
    }
    if (normalized === "false") {
      return false;
    }
  }
  return Boolean(value);
}

/**
 * Validate V2 batch translation request
 */
export function validateV2Request(input: any): V2ValidationResult {
  const errors: string[] = [];

  // Check if input is an object
  if (!input || typeof input !== "object") {
    return {
      isValid: false,
      errors: ["Request body must be a valid JSON object"],
    };
  }

  // Validate text field - must be array
  if (!input.text) {
    errors.push("text field is required");
  } else if (!Array.isArray(input.text)) {
    errors.push("text field must be an array");
  } else if (input.text.length === 0) {
    errors.push("text array cannot be empty");
  } else if (input.text.length > MAX_ARRAY_ITEMS) {
    errors.push(`text array cannot exceed ${MAX_ARRAY_ITEMS} items`);
  }

  // If text array is invalid, return early
  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Default APR to true. Parse leniently so string sentinels ("true"/"false",
  // as clients commonly send over JSON where booleans may arrive quoted) are
  // honored — Boolean("false") is true, which previously made an APR:"false"
  // curl run as APR:true (N upstream calls instead of one combined call).
  const apr = parseApr(input.APR);

  // Validate each text item
  const sanitizedTexts: string[] = [];
  let totalLength = 0;

  for (let i = 0; i < input.text.length; i++) {
    const item = input.text[i];

    if (typeof item !== "string") {
      errors.push(`text[${i}] must be a string`);
      continue;
    }

    const trimmed = item.trim();
    if (trimmed.length === 0) {
      errors.push(`text[${i}] cannot be empty`);
      continue;
    }

    if (apr) {
      // APR=true: validate each item individually
      if (trimmed.length > MAX_TEXT_LENGTH) {
        errors.push(
          `text[${i}] exceeds maximum length of ${MAX_TEXT_LENGTH} characters`
        );
      }
    }

    totalLength += trimmed.length;
    sanitizedTexts.push(trimmed);
  }

  // APR=false: validate total length
  if (!apr && totalLength > MAX_TOTAL_LENGTH) {
    errors.push(
      `Total text length (${totalLength}) exceeds maximum of ${MAX_TOTAL_LENGTH} characters when APR is false`
    );
  }

  // Validate target_lang (required)
  if (!input.target_lang) {
    errors.push("target_lang is required");
  } else if (typeof input.target_lang !== "string") {
    errors.push("target_lang must be a string");
  }

  // Validate source_lang (optional)
  if (input.source_lang && typeof input.source_lang !== "string") {
    errors.push("source_lang must be a string");
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    sanitizedInput: {
      text: sanitizedTexts,
      APR: apr,
      source_lang: input.source_lang || "auto",
      target_lang: input.target_lang,
    },
  };
}

/**
 * Compute how many upstream translation calls a validated V2 batch will make,
 * for rate-limit charging.
 *
 * APR=true issues one DeepL call per item; APR=false issues a single combined
 * call. Charging one rate-limit token per real upstream call is what bounds
 * batch amplification (a 10-item APR=true batch previously fired 10 upstream
 * calls charged as a single client token). The returned count is already
 * bounded by MAX_ARRAY_ITEMS.
 * @param validation The result of validateV2Request (only valid inputs are
 * meaningful; for invalid input this returns 0 so no tokens are spent).
 * @returns Number of rate-limit charges the batch warrants
 */
export function getV2ItemChargeCount(validation: V2ValidationResult): number {
  if (!validation.isValid || !validation.sanitizedInput) {
    return 0;
  }
  return validation.sanitizedInput.APR
    ? validation.sanitizedInput.text.length
    : 1;
}

/**
 * Format text array for combined request (APR=false)
 * Joins all items with newline separator
 */
export function formatCombinedText(texts: string[]): string {
  return texts.join("\n");
}

/**
 * Parse combined response back to array (APR=false)
 * Splits response by newline separator
 */
export function parseCombinedResponse(
  response: string,
  expectedCount: number
): string[] {
  const parts = response.split("\n");

  // If we got fewer parts than expected, pad with empty strings
  while (parts.length < expectedCount) {
    parts.push("");
  }

  return parts.slice(0, expectedCount);
}
