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

  // Default APR to true
  const apr = input.APR !== undefined ? Boolean(input.APR) : true;

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
