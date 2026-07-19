/**
 * Google Translate integration service
 * Provides Google Translate functionality with an STA-compatible API format
 */

import { DEFAULT_RETRY_CONFIG, REQUEST_TIMEOUT } from "../config";
import { createErrorResponse } from "../errorHandler";
import { logger } from "../logger";
import {
  isRetryableError,
  RetryOptions,
  retryWithBackoff,
} from "../retryLogic";
import {
  Config,
  createStandardResponse,
  RequestParams,
  ResponseParams,
} from "../types";

type GoogleTranslateSegment = [string?, ...unknown[]];
type GoogleTranslateBody = [GoogleTranslateSegment[]?, unknown?, string?];

/**
 * Parse a Google Translate response body into translated text + detected lang.
 * @throws when no translation text is present
 * @returns Object with translatedText and detectedSourceLang
 * @private
 */
function parseGoogleResponse(
  body: GoogleTranslateBody,
  fallbackSourceLang: string
): { translatedText: string; detectedSourceLang: string } {
  const segments = Array.isArray(body?.[0]) ? body[0] : [];
  let translatedText = "";
  for (const segment of segments) {
    if (typeof segment?.[0] === "string") {
      translatedText += segment[0];
    }
  }

  if (!translatedText) {
    throw new Error("No translation result received from Google Translate");
  }

  const detectedSourceLang =
    typeof body?.[2] === "string" ? body[2] : fallbackSourceLang;

  return { translatedText, detectedSourceLang };
}

/**
 * Translate text using Google Translate API
 * @param params - Translation parameters (text, source_lang, target_lang)
 * @param config - Configuration options
 * @returns Translation response in STA format
 */
export async function translateWithGoogle(
  params: RequestParams,
  config?: Config & { env?: any; clientIP?: string }
): Promise<ResponseParams> {
  const { text, source_lang, target_lang } = params;

  // Construct the request to Google Translate's internal API
  const googleApiUrl = new URL("https://translate.google.com/translate_a/single");
  googleApiUrl.searchParams.append("client", "gtx"); // Google Translate web client
  googleApiUrl.searchParams.append(
    "sl",
    source_lang === "auto" ? "auto" : source_lang.toLowerCase()
  ); // Source language
  googleApiUrl.searchParams.append("tl", target_lang.toLowerCase()); // Target language
  googleApiUrl.searchParams.append("dt", "t"); // 't' for translation of text
  googleApiUrl.searchParams.append("q", text); // The text to translate
  const requestUrl = googleApiUrl.toString();

  const requestHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://translate.google.com/",
  };

  // Retry options mirror the DeepL path in query.ts so Google Translate gets
  // the same exponential-backoff-with-jitter treatment on transient failures.
  const retryOptions: RetryOptions = {
    ...DEFAULT_RETRY_CONFIG,
    isRetryable: isRetryableError,
  };

  try {
    // Fetch + parse with a request timeout and retry. Previously this was a
    // bare fetch with no AbortController and no retry: a single hung Google
    // response would block the worker request indefinitely, and a transient
    // 5xx failed immediately with no second chance.
    const googleResponseBody = await retryWithBackoff(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      try {
        const response = await fetch(requestUrl, {
          method: "GET",
          headers: requestHeaders,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(
            `Google Translate API responded with status ${response.status}`
          );
          // Non-2xx throws an Error carrying the status via the message; the
          // retry predicate checks `error.status`, so attach it below.
        }

        return (await response.json()) as GoogleTranslateBody;
      } catch (error) {
        clearTimeout(timeoutId);

        // Translate abort into a 408 status so the retry predicate can
        // recognize it as retryable, matching the DeepL path behavior.
        if (error instanceof Error && error.name === "AbortError") {
          const timeoutError = new Error(
            `Google Translate request timed out after ${
              REQUEST_TIMEOUT / 1000
            } seconds`
          );
          (timeoutError as any).status = 408;
          throw timeoutError;
        }

        // Tag HTTP failures with their status so isRetryableError can decide.
        const statusMatch =
          error instanceof Error
            ? error.message.match(/status (\d{3})/)
            : null;
        if (statusMatch) {
          (error as any).status = Number(statusMatch[1]);
        }
        throw error;
      }
    }, retryOptions);

    const { translatedText, detectedSourceLang } = parseGoogleResponse(
      googleResponseBody,
      source_lang
    );

    return createStandardResponse(
      200,
      translatedText,
      Math.floor(Math.random() * 10000000000),
      detectedSourceLang.toUpperCase(),
      target_lang.toUpperCase()
    );
  } catch (error) {
    logger.error(config?.env, "Error in Google Translate", {
      endpoint: "/google",
      clientIP: config?.clientIP || "unknown",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    });

    const errorResponse = createErrorResponse(error, {
      endpoint: "/google",
      clientIP: config?.clientIP || "unknown",
    });

    return errorResponse.response;
  }
}
