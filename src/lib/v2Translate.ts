/**
 * V2 Batch Translation Handler
 * Supports APR (Array Per Request) mode for batch translations
 */

import { query } from "./query";
import { type RequestParams, createV2Response } from "./types";
import {
  type V2RequestParams,
  type V2ResponseParams,
  type V2TranslationResult,
} from "./types";
import {
  validateV2Request,
  formatCombinedText,
  parseCombinedResponse,
} from "./v2Validation";

interface V2TranslateConfig {
  env: any;
  clientIP: string;
}

/**
 * Translate batch of texts using DeepL with APR support
 */
export async function translateBatch(
  params: V2RequestParams,
  config: V2TranslateConfig
): Promise<V2ResponseParams> {
  const { env, clientIP } = config;

  // Validate request
  const validation = validateV2Request(params);
  if (!validation.isValid) {
    return createV2Response(400, []);
  }

  const validatedParams = validation.sanitizedInput!;
  const {
    text: texts,
    APR,
    source_lang,
    target_lang,
  } = validatedParams;

  // APR=true: Send each text as separate request
  if (APR) {
    return translateWithAPR(texts, source_lang, target_lang, env, clientIP);
  }

  // APR=false: Combine texts and send as single request
  return translateCombined(texts, source_lang, target_lang, env, clientIP);
}

/**
 * Translate each text item separately (APR=true)
 */
async function translateWithAPR(
  texts: string[],
  source_lang: string,
  target_lang: string,
  env: any,
  clientIP: string
): Promise<V2ResponseParams> {
  let allSuccess = true;

  // Process all texts in parallel
  const promises = texts.map(async (text, index) => {
    try {
      const requestParams: RequestParams = {
        text,
        source_lang,
        target_lang,
      };

      const result = await query(requestParams, { env, clientIP });

      if (result.code === 200 && result.data) {
        return {
          text: result.data,
          index,
          detected_source_lang: result.source_lang || undefined,
          success: true,
        } as V2TranslationResult;
      } else {
        allSuccess = false;
        return {
          text: "",
          index,
          success: false,
          error: `Translation failed with code ${result.code}`,
        } as V2TranslationResult;
      }
    } catch (error) {
      allSuccess = false;
      return {
        text: "",
        index,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      } as V2TranslationResult;
    }
  });

  const resolvedResults = await Promise.all(promises);

  // Sort by index to maintain order
  resolvedResults.sort((a, b) => a.index - b.index);

  // 207 Multi-Status for partial success
  const statusCode = allSuccess ? 200 : 207;
  return createV2Response(statusCode, resolvedResults);
}

/**
 * Translate combined text (APR=false)
 * All texts joined with \n and sent as single request
 */
async function translateCombined(
  texts: string[],
  source_lang: string,
  target_lang: string,
  env: any,
  clientIP: string
): Promise<V2ResponseParams> {
  try {
    const combinedText = formatCombinedText(texts);

    const requestParams: RequestParams = {
      text: combinedText,
      source_lang,
      target_lang,
    };

    const result = await query(requestParams, { env, clientIP });

    if (result.code === 200 && result.data) {
      // Parse combined response back to array
      const translatedParts = parseCombinedResponse(
        result.data,
        texts.length
      );

      const results: V2TranslationResult[] = translatedParts.map(
        (text, index) => ({
          text,
          index,
          detected_source_lang: result.source_lang || undefined,
          success: true,
        })
      );

      return createV2Response(200, results, result.id);
    } else {
      // Return empty results with error
      const results: V2TranslationResult[] = texts.map((_, index) => ({
        text: "",
        index,
        success: false,
        error: `Translation failed with code ${result.code}`,
      }));

      return createV2Response(result.code, results);
    }
  } catch (error) {
    const results: V2TranslationResult[] = texts.map((_, index) => ({
      text: "",
      index,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }));

    return createV2Response(500, results);
  }
}
