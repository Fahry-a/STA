/**
 * Translation route handler for DeepL and Google providers
 */

import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  generateCacheKey,
  getCachedTranslation,
  setCachedTranslation,
  query,
  normalizeLanguageCode,
  getSecureClientIP,
  isAdminAuthorized,
  validateLanguageCode,
  createStandardResponse,
  PAYLOAD_LIMITS,
  checkCombinedRateLimit,
  startPerformanceTracking,
  updatePerformanceMetrics,
  endPerformanceTracking,
  translateWithGoogle,
} from "../lib";
import { logger, generateRequestId } from "../lib/observability/logger";
import { createErrorResponse } from "../lib/observability/errorHandler";
import { validateTranslationRequest } from "../lib/providers/validation";

type TranslationContext = {
  env: Env;
  req: {
    json: () => Promise<unknown>;
    header: (name: string) => string | undefined;
    raw: Request;
  };
  json: (data: unknown, status?: number) => Response;
};

/**
 * Common translation handler function
 * Processes translation requests for both DeepL and Google Translate
 * @param c - Hono context
 * @param provider - Translation provider ('deepl' or 'google')
 * @returns Translation response
 */
export async function handleTranslation(
  c: TranslationContext,
  provider: "deepl" | "google"
) {
  const env = c.env;
  const clientIP = getSecureClientIP(c.req.raw) || "unknown";
  const requestId = generateRequestId();
  const startTime = Date.now();

  // Start performance tracking
  const perfRequestId = startPerformanceTracking(`/${provider}`);

  logger.info(env, "Translation request started", {
    requestId,
    endpoint: `/${provider}`,
    clientIP,
  });

  try {
    // Validate Content-Type header
    const contentType = c.req.header("Content-Type") || "";
    if (!contentType.includes("application/json")) {
      logger.warn(env, "Invalid Content-Type", {
        requestId,
        endpoint: `/${provider}`,
        clientIP,
        metadata: { contentType },
      });
      updatePerformanceMetrics(perfRequestId, { success: false });
      endPerformanceTracking(perfRequestId, false);
      return c.json(createStandardResponse(415, null), 415);
    }

    // Check Content-Length at middleware level to reject oversized bodies early
    const contentLength = c.req.header("Content-Length");
    if (contentLength && parseInt(contentLength, 10) > PAYLOAD_LIMITS.MAX_REQUEST_SIZE) {
      logger.warn(env, "Request body too large", {
        requestId,
        endpoint: `/${provider}`,
        clientIP,
        metadata: { contentLength },
      });
      updatePerformanceMetrics(perfRequestId, { success: false });
      endPerformanceTracking(perfRequestId, false);
      return c.json(createStandardResponse(413, null), 413);
    }

    // Parse request parameters with better error handling
    let params: Record<string, unknown>;
    try {
      params = await c.req.json() as Record<string, unknown>;
    } catch (parseError) {
      logger.warn(env, "Request parse failed", {
        requestId,
        endpoint: `/${provider}`,
        clientIP,
      });
      updatePerformanceMetrics(perfRequestId, { success: false });
      endPerformanceTracking(perfRequestId, false);
      return c.json(createStandardResponse(400, null), 400);
    }

    if (!params || typeof params !== "object") {
      return c.json(createStandardResponse(400, null), 400);
    }

    if (typeof params.text !== "string") {
      return c.json(createStandardResponse(400, null), 400);
    }

    const sanitizedText = params.text as string;

    if (sanitizedText.trim().length === 0) {
      return c.json(createStandardResponse(400, null), 400);
    }

    if (sanitizedText.length > PAYLOAD_LIMITS.MAX_TEXT_LENGTH) {
      logger.warn(env, "Text exceeds maximum length", {
        requestId,
        endpoint: `/${provider}`,
        clientIP,
        metadata: { length: sanitizedText.length },
      });
      return c.json(
        createStandardResponse(413, null, undefined, undefined, undefined),
        413
      );
    }

    // Run the structured validator for the canonical request checks
    const validation = validateTranslationRequest(params as Record<string, unknown>);
    const structureErrors = validation.errors.filter(
      (err: string) =>
        !err.toLowerCase().includes("language") &&
        !err.toLowerCase().includes("source") &&
        !err.toLowerCase().includes("target")
    );

    // Validate and sanitize language parameters
    const sourceLang = params.source_lang
      ? validateLanguageCode(params.source_lang as string)
      : "auto";
    const targetLang = params.target_lang
      ? validateLanguageCode(params.target_lang as string)
      : "en";

    if (structureErrors.length > 0 || !sourceLang || !targetLang) {
      updatePerformanceMetrics(perfRequestId, { success: false });
      endPerformanceTracking(perfRequestId, false);
      return c.json(createStandardResponse(400, null), 400);
    }

    // Enforce rate limiting at the handler entry point
    const rateLimitEndpoint =
      provider === "google"
        ? "https://translate.google.com/translate_a/single"
        : "deepl";
    const rateLimitResult = await checkCombinedRateLimit(
      clientIP,
      rateLimitEndpoint,
      env
    );
    if (!rateLimitResult.allowed) {
      logger.warn(env, "Request rate limited", {
        requestId,
        endpoint: `/${provider}`,
        clientIP,
        metadata: { reason: rateLimitResult.reason },
      });
      updatePerformanceMetrics(perfRequestId, { rateLimited: true, success: false });
      endPerformanceTracking(perfRequestId, false);
      return c.json(createStandardResponse(429, null), 429);
    }

    // Check cache first for faster response
    const normalizedSourceLang = normalizeLanguageCode(sourceLang);
    const normalizedTargetLang = normalizeLanguageCode(targetLang);
    const cacheKey = generateCacheKey(
      sanitizedText,
      normalizedSourceLang,
      normalizedTargetLang,
      provider
    );
    const cached = await getCachedTranslation(cacheKey, env);

    if (cached) {
      logger.info(env, "Translation request completed (cache hit)", {
        requestId,
        endpoint: `/${provider}`,
        duration: Date.now() - startTime,
        cacheHit: true,
      });
      updatePerformanceMetrics(perfRequestId, { cacheHit: true, success: true });
      endPerformanceTracking(perfRequestId, true);
      return c.json(
        createStandardResponse(
          200,
          cached.data,
          cached.id || Math.floor(Math.random() * 10000000000),
          cached.source_lang,
          cached.target_lang
        )
      );
    }

    // Prepare validated parameters for translation
    const validatedParams = {
      text: sanitizedText,
      source_lang: normalizedSourceLang,
      target_lang: normalizedTargetLang,
    };

    let result;

    if (provider === "google") {
      result = await translateWithGoogle(validatedParams, {
        env,
        clientIP,
      });
    } else {
      result = await query(validatedParams, {
        env,
        clientIP,
      });
    }

    // Cache successful translations
    if (result.code === 200 && result.data) {
      await setCachedTranslation(
        cacheKey,
        {
          data: result.data,
          timestamp: Date.now(),
          source_lang:
            result.source_lang || validatedParams.source_lang.toUpperCase(),
          target_lang:
            result.target_lang || validatedParams.target_lang.toUpperCase(),
          id: result.id,
        },
        env
      );
    }

    const duration = Date.now() - startTime;
    logger.info(env, "Translation request completed", {
      requestId,
      endpoint: `/${provider}`,
      duration,
      cacheHit: false,
    });

    updatePerformanceMetrics(perfRequestId, {
      proxyUsed: provider === "deepl",
      success: result.code === 200,
    });
    endPerformanceTracking(perfRequestId, result.code === 200);

    return c.json(result, result.code as ContentfulStatusCode);
  } catch (error) {
    logger.error(env, "Translation request failed", {
      requestId,
      endpoint: `/${provider}`,
      duration: Date.now() - startTime,
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    });

    updatePerformanceMetrics(perfRequestId, { success: false });
    endPerformanceTracking(perfRequestId, false);

    const errorResponse = createErrorResponse(error, {
      endpoint: `/${provider}`,
      clientIP,
    });

    return c.json(errorResponse.response, errorResponse.httpStatus as ContentfulStatusCode);
  }
}
