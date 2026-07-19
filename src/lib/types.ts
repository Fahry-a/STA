/**
 * Type definitions for the STA translation service
 * Provides comprehensive type safety for API operations and data structures
 */

/**
 * Source language type (includes auto-detection)
 */
export type SourceLang = string | "auto";

/**
 * Target language type (excludes auto-detection)
 */
export type TargetLang = string;

/**
 * Raw response parameters from DeepL API
 * Represents the exact structure returned by the translation service
 */
export type RawResponseParams = {
  jsonrpc: string;
  id: number;
  result: {
    texts: {
      text: string;
    }[];
    lang: string;
    lang_is_confident: boolean;
    detectedLanguages: { unsupported: number } & Record<string, number>;
  };
};

/**
 * Request parameters for translation operations
 */
export type RequestParams = {
  text: string;
  source_lang: SourceLang;
  target_lang: TargetLang;
};

/**
 * Standardized response parameters for STA API
 * Note: Language codes in responses are always returned in uppercase when code is 200
 * When code is not 200, source_lang and target_lang are null
 */
export type ResponseParams = {
  code: number;
  data: string | null;
  id: number;
  source_lang: string | null; // Always uppercase in responses when code is 200, null otherwise
  target_lang: string | null; // Always uppercase in responses when code is 200, null otherwise
};

/**
 * Configuration options for translation operations
 */
/**
 * Configuration options for translation operations
 */
export type Config = {
  proxyEndpoint?: string;
  customHeader?: Record<string, string>;
  clientIP?: string;
};

/**
 * Helper function to create standardized response format
 * Ensures all responses follow the same structure
 * When HTTP status code is not 200, everything is null except the unique request identifier
 */
export function createStandardResponse(
  code: number,
  data: string | null,
  id?: number,
  source_lang?: string,
  target_lang?: string
): ResponseParams {
  const responseId = id ?? Math.floor(Math.random() * 10000000000);

  // If status code is not 200, set everything to null except id
  if (code !== 200) {
    return {
      code,
      data: null,
      id: responseId,
      source_lang: null,
      target_lang: null,
    };
  }

  // For successful responses (code 200), return with actual values
  return {
    code,
    data,
    id: responseId,
    source_lang: (source_lang || "AUTO").toUpperCase(),
    target_lang: (target_lang || "EN").toUpperCase(),
  };
}

/**
 * V2 Batch translation request parameters
 */
export type V2RequestParams = {
  text: string[];
  APR?: boolean; // Array Per Request (default: true)
  source_lang?: SourceLang;
  target_lang: TargetLang;
};

/**
 * V2 Batch translation response
 *
 * `apr` mirrors the Array Per Request mode that was actually applied to the
 * batch (true = one upstream call per text item, false = a single combined
 * call), so clients can tell how the request was processed. It is `false` on
 * responses where validation never ran (parse/early-reject paths), not `null`,
 * to keep the field a concrete boolean in every serialized response.
 */
export type V2ResponseParams = {
  code: number;
  apr: boolean;
  data: V2TranslationResult[];
  id: number;
};

/**
 * Individual translation result in batch
 */
export type V2TranslationResult = {
  text: string;
  index: number;
  detected_source_lang?: string;
  success: boolean;
  error?: string;
};

/**
 * Create standardized V2 response format
 *
 * `options.apr` reports whether Array Per Request mode was applied; it defaults
 * to `false` (never `undefined`) so the `apr` key is always present in the
 * serialized JSON — `JSON.stringify` drops `undefined` values, and callers
 * rely on the field being present on every response.
 * @param options Optional `{ apr?: boolean; id?: number }` — apr defaults to
 * `false`, id defaults to a random 10-digit number.
 */
export function createV2Response(
  code: number,
  data: V2TranslationResult[],
  options?: { apr?: boolean; id?: number }
): V2ResponseParams {
  return {
    code,
    apr: options?.apr ?? false,
    data,
    id: options?.id ?? Math.floor(Math.random() * 10000000000),
  };
}

/**
 * Note: The following interfaces are defined globally in worker-configuration.d.ts:
 * - ProxyEndpoint: Proxy endpoint configuration
 * - CacheEntry: Cache entry structure
 * - RateLimitEntry: Rate limiting data structure
 */
