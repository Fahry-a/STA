/**
 * STA (Serverless Translation API)
 */

import { Hono } from "hono";
import {
  clearMemoryCache,
  generateCacheKey,
  getCachedTranslation,
  query,
  setCachedTranslation,
} from "./lib";

import { PAYLOAD_LIMITS } from "./lib/config";
import { createErrorResponse } from "./lib/errorHandler";
import { logger, generateRequestId } from "./lib/logger";
import { collectMetrics, formatMetricsResponse } from "./lib/metrics";
import { performHealthCheck } from "./lib/healthCheck";
import { warmCache, getCacheWarmingStatus } from "./lib/cacheWarmer";
import { translateBatch } from "./lib/v2Translate";
import { normalizeLanguageCode } from "./lib/query";
import {
  getSecureClientIP,
  handleCORSPreflight,
  isAdminAuthorized,
  validateLanguageCode,
} from "./lib/security";
import { translateWithGoogle } from "./lib/services/googleTranslate";
import {
  createStandardResponse,
  createV2Response,
  type V2RequestParams,
} from "./lib/types";
import { checkCombinedRateLimit } from "./lib/rateLimit";

/**
 * Initialize Hono app with environment bindings
 */
const app = new Hono<{ Bindings: Env }>();

function isDebugModeEnabled(value?: string): boolean {
  if (!value) {
    return false;
  }

  return ["true", "1", "yes", "on"].includes(value.trim().toLowerCase());
}

/**
 * Scheduled event handler for periodic maintenance tasks
 * Executes every 5 minutes as configured in wrangler.jsonc
 * @param event The scheduled event object
 * @param env Environment bindings
 * @param ctx Execution context for background tasks
 */
function scheduled(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): void {
  ctx.waitUntil(handleScheduled(event, env));
}

/**
 * Handle scheduled maintenance tasks
 * Performs cache cleanup and other periodic maintenance
 * @param event The scheduled event object
 * @param env Environment bindings
 */
async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  // Clear the in-memory cache on each scheduled tick. The LRU already bounds
  // size, so this is a hygiene reset rather than a leak fix. The memory cache
  // is per-isolate, so this only clears the local isolate's view.
  clearMemoryCache();

  // Warm the cache with popular translations. The cron fires every 10 minutes,
  // and warmCache() itself holds a cross-isolate KV leader lock for the warm
  // interval, so only one isolate actually performs the DeepL calls per tick
  // — the rest skip to avoid a thundering herd against the proxy endpoints.
  try {
    const result = await warmCache(env);
    logger.info(env, "Cache warming completed", {
      metadata: {
        warmed: result.warmed,
        failed: result.failed,
        skipped: result.skipped,
      },
    });
  } catch (error) {
    logger.error(env, "Cache warming failed", {
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
  }
}

/**
 * Worker export configuration
 * Defines the main fetch handler and scheduled event handler
 */
const worker = {
  fetch: app.fetch,
  scheduled,
};

export default worker;

/**
 * Common translation handler function
 * Processes translation requests for both DeepL and Google Translate
 * @param c - Hono context
 * @param provider - Translation provider ('deepl' or 'google')
 * @returns Translation response
 */
async function handleTranslation(c: any, provider: "deepl" | "google") {
  const env = c.env;
  const clientIP = getSecureClientIP(c.req.raw) || "unknown";
  const requestId = generateRequestId();
  const startTime = Date.now();

  logger.info(env, "Translation request started", {
    requestId,
    endpoint: `/${provider}`,
    clientIP,
  });

  try {
    // Parse request parameters with better error handling
    let params;
    try {
      params = await c.req.json();
    } catch (parseError) {
      logger.warn(env, "Request parse failed", {
        requestId,
        endpoint: `/${provider}`,
        clientIP,
      });
      return c.json(createStandardResponse(400, null), 400);
    }

    // Enhanced parameter validation with input sanitization
    if (!params || typeof params !== "object") {
      return c.json(createStandardResponse(400, null), 400);
    }

    if (!params.text || typeof params.text !== "string") {
      return c.json(createStandardResponse(400, null), 400);
    }

    const sanitizedText = params.text;

    if (!sanitizedText.trim()) {
      return c.json(createStandardResponse(400, null), 400);
    }

    // Reject oversized text instead of silently truncating it. Silently slicing
    // input would return a translation of only the first 5000 chars with a 200,
    // which is silent data loss the caller can never detect.
    if (sanitizedText.length > PAYLOAD_LIMITS.MAX_TEXT_LENGTH) {
      logger.warn(env, "Text exceeds maximum length", {
        requestId,
        endpoint: `/${provider}`,
        clientIP,
        metadata: { length: sanitizedText.length },
      });
      return c.json(
        createStandardResponse(
          413,
          null,
          undefined,
          undefined,
          undefined
        ),
        413
      );
    }

    // Validate and sanitize language parameters
    const sourceLang = params.source_lang
      ? validateLanguageCode(params.source_lang)
      : "auto";
    const targetLang = params.target_lang
      ? validateLanguageCode(params.target_lang)
      : "en";

    if (!sourceLang || !targetLang) {
      return c.json(createStandardResponse(400, null), 400);
    }

    // Enforce rate limiting at the handler entry point so that EVERY request —
    // including cache hits — consumes a token. Previously rate limiting only ran
    // inside query() on the DeepL cache-miss path; cache hits and all Google
    // requests bypassed it, leaving the public endpoints open to unbounded
    // amplification.
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
      return c.json(createStandardResponse(429, null), 429);
    }

    // Check cache first for faster response
    const normalizedSourceLang = normalizeLanguageCode(sourceLang);
    const normalizedTargetLang = normalizeLanguageCode(targetLang);
    const cacheKey = await generateCacheKey(
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

    // Choose translation provider. Rate limiting is enforced above; query() no
    // longer re-checks it, so a normal DeepL request isn't double-charged.
    if (provider === "google") {
      result = await translateWithGoogle(validatedParams, {
        env,
        clientIP,
      });
    } else {
      // Use DeepL as default
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

    logger.info(env, "Translation request completed", {
      requestId,
      endpoint: `/${provider}`,
      duration: Date.now() - startTime,
      cacheHit: false,
    });

    return c.json(result, result.code as any);
  } catch (error) {
    logger.error(env, "Translation request failed", {
      requestId,
      endpoint: `/${provider}`,
      duration: Date.now() - startTime,
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    });

    const errorResponse = createErrorResponse(error, {
      endpoint: `/${provider}`,
      clientIP,
    });

    return c.json(errorResponse.response, errorResponse.httpStatus as any);
  }
}

/**
 * API Route Definitions
 * Defines all available endpoints and their handlers
 */
app
  // Add CORS preflight handling for all routes
  .options("*", (c) => handleCORSPreflight(c))

  .get("/translate", (c) => c.text("Please use POST method :)"))
  .get("/deepl", (c) => c.text("Please use POST method :)"))
  .get("/google", (c) => c.text("Please use POST method :)"))

  /**
   * Debug endpoint for request format validation and troubleshooting
   * SECURITY: This endpoint is disabled in production unless DEBUG_MODE is explicitly enabled
   * POST /debug
   */
  .post("/debug", async (c) => {
    // Check if debug mode is enabled via environment variable
    if (!isDebugModeEnabled(c.env.DEBUG_MODE)) {
      return c.json(createStandardResponse(404, null), 404);
    }

    const env = c.env;
    const clientIP = getSecureClientIP(c.req.raw) || "unknown";

    try {
      const params = await c.req.json().catch(() => ({}));

      // Import buildRequestBody from query module for debugging
      const { buildRequestBody } = await import("./lib/query");

      if (!params.text || typeof params.text !== "string") {
        return c.json(
          createStandardResponse(400, "Missing text parameter"),
          400
        );
      }

      // Basic text validation
      const sanitizedText = params.text;
      if (!sanitizedText.trim()) {
        return c.json(
          createStandardResponse(400, "Invalid text parameter"),
          400
        );
      }

      // Validate language codes
      const sourceLang = params.source_lang
        ? validateLanguageCode(params.source_lang)
        : "auto";
      const targetLang = params.target_lang
        ? validateLanguageCode(params.target_lang)
        : "en";

      if (!sourceLang || !targetLang) {
        return c.json(
          createStandardResponse(400, "Invalid language codes"),
          400
        );
      }

      const sanitizedParams = {
        text: sanitizedText,
        source_lang: sourceLang,
        target_lang: targetLang,
      };

      try {
        const requestBody = buildRequestBody(sanitizedParams);
        const parsedBody = JSON.parse(requestBody);

        const debugInfo = {
          status: "Request format is valid",
          client_ip: clientIP, // Safe to show in debug mode
          generated_request: parsedBody,
          sanitized_params: sanitizedParams, // Show sanitized version
          validation: {
            text_length: sanitizedText.length,
            sanitized_text_length: sanitizedText.length,
            has_source_lang: !!sourceLang,
            has_target_lang: !!targetLang,
            request_id: parsedBody.id,
            timestamp: parsedBody.params?.timestamp,
            method_format: requestBody.includes('"method" : "')
              ? "spaced"
              : "normal",
            normalized_source_lang: sourceLang,
            normalized_target_lang: targetLang,
          },
        };

        return c.json(
          createStandardResponse(200, JSON.stringify(debugInfo)),
          200
        );
      } catch (buildError) {
        const errorMessage =
          buildError instanceof Error
            ? buildError.message
            : "Request build failed";
        return c.json(createStandardResponse(400, errorMessage), 400);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return c.json(createStandardResponse(400, errorMessage), 400);
    }
  })

  /**
   * Main translation endpoint with comprehensive features
   * Handles single text translation with rate limiting, caching, and error handling
   * POST /translate - Uses DeepL (legacy endpoint)
   */
  .post("/translate", async (c) => {
    return handleTranslation(c, "deepl");
  })

  /**
   * DeepL translation endpoint
   * POST /deepl - Uses DeepL translation service
   */
  .post("/deepl", async (c) => {
    return handleTranslation(c, "deepl");
  })

  /**
   * Google Translate endpoint
   * POST /google - Uses Google Translate service
   */
  .post("/google", async (c) => {
    return handleTranslation(c, "google");
  })

  /**
   * V2 Batch Translation endpoint
   * POST /v2/translate - Batch translation with APR (Array Per Request) support
   */
  .post("/v2/translate", async (c) => {
    const env = c.env;
    const clientIP = getSecureClientIP(c.req.raw) || "unknown";

    try {
      // Parse request body
      let params: V2RequestParams;
      try {
        params = await c.req.json();
      } catch (parseError) {
        return c.json(createV2Response(400, []), 400);
      }

      // Check rate limit
      const rateLimitResult = await checkCombinedRateLimit(
        clientIP,
        "deepl", // Use DeepL proxy endpoints
        env
      );

      if (!rateLimitResult.allowed) {
        return c.json(createV2Response(429, []), 429);
      }

      // Translate batch
      const result = await translateBatch(params, { env, clientIP });

      return c.json(result, result.code as any);
    } catch (error) {
      const errorResponse = createErrorResponse(error, {
        endpoint: "/v2/translate",
        clientIP,
      });

      return c.json(
        createV2Response(errorResponse.httpStatus, []),
        errorResponse.httpStatus as any
      );
    }
  })

  /**
   * Health Check endpoints
   * GET /health - Comprehensive health status
   * GET /health/live - Simple liveness check
   * GET /health/ready - Readiness check
   */
  .get("/health", async (c) => {
    const result = await performHealthCheck(c.env);
    const statusCode =
      result.status === "healthy" || result.status === "degraded"
        ? 200
        : 503;
    return c.json(result, statusCode);
  })

  .get("/health/live", (c) => {
    // Simple liveness check
    return c.json({ status: "alive", timestamp: new Date().toISOString() });
  })

  .get("/health/ready", async (c) => {
    // Readiness check - checks if service can handle requests
    const result = await performHealthCheck(c.env);
    const ready = result.status !== "unhealthy";
    return c.json(
      {
        ready,
        status: result.status,
        timestamp: new Date().toISOString(),
      },
      ready ? 200 : 503
    );
  })

  /**
   * Metrics endpoint (protected by API key)
   * GET /metrics - Service performance and operational metrics
   */
  .get("/metrics", (c) => {
    // Require admin API key to prevent exposing operational details publicly.
    // Fails closed when ADMIN_API_KEY is unset; comparison is constant-time.
    if (!isAdminAuthorized(c.req.header("X-API-Key"), c.env.ADMIN_API_KEY)) {
      return c.json({ code: 401, message: "Unauthorized" }, 401);
    }

    const env = c.env;
    const metrics = collectMetrics(env);
    return c.json(formatMetricsResponse(metrics));
  })

  /**
   * Admin endpoints (protected by API key)
   * POST /admin/warm-cache - Manually trigger cache warming
   * GET /admin/cache-status - Get cache warming status
   */
  .post("/admin/warm-cache", async (c) => {
    if (!isAdminAuthorized(c.req.header("X-API-Key"), c.env.ADMIN_API_KEY)) {
      return c.json({ code: 401, message: "Unauthorized" }, 401);
    }

    const result = await warmCache(c.env);
    return c.json({
      code: 200,
      data: result,
      message: `Cache warming completed: ${result.warmed} warmed, ${result.failed} failed`,
    });
  })

  .get("/admin/cache-status", (c) => {
    if (!isAdminAuthorized(c.req.header("X-API-Key"), c.env.ADMIN_API_KEY)) {
      return c.json({ code: 401, message: "Unauthorized" }, 401);
    }

    return c.json({
      code: 200,
      data: getCacheWarmingStatus(),
    });
  })

  /**
   * Catch-all route for undefined paths
   * Redirects all other requests to the GitHub repository
   */
  .all("*", (c) => c.redirect("https://github.com/Fahry-a/STA"));
