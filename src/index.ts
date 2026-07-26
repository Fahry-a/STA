/**
 * STA (Serverless Translation API)
 */

import { Hono } from "hono";
import {
  clearMemoryCache,
} from "./lib";
import { logger } from "./lib/logger";
import { SECURITY_HEADERS, getSecureClientIP, handleCORSPreflight } from "./lib/security";
import { handleTranslation } from "./routes/translation";
import { handleV2Translation } from "./routes/v2";
import { handleHealthCheck, handleLiveness, handleReadiness } from "./routes/health";
import { handleMetrics, handleWarmCache, handleCacheStatus } from "./routes/admin";
import { handleDebug } from "./routes/debug";
import { warmCache } from "./lib/cacheWarmer";

/**
 * Initialize Hono app with environment bindings
 */
const app = new Hono<{ Bindings: Env }>();

/**
 * Scheduled event handler for periodic maintenance tasks
 * Executes every 10 minutes as configured in wrangler.jsonc
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
 * Performs cache cleanup and cache warming
 */
async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  clearMemoryCache();

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
 */
const worker = {
  fetch: app.fetch,
  scheduled,
};

export default worker;

/**
 * Apply security headers to every response.
 * Must be registered before route definitions so it covers all routes.
 */
app.use("*", async (c, next) => {
  await next();

  try {
    const existing = new Headers(c.res.headers);
    for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
      existing.set(key, value);
    }
    c.res = new Response(c.res.body, {
      status: c.res.status,
      statusText: c.res.statusText,
      headers: existing,
    });
  } catch {
    // If header rewriting fails, leave the original response intact
  }
});

/**
 * API Route Definitions
 */
app
  .options("*", (c) => handleCORSPreflight(c))

  .get("/translate", (c) => c.text("Please use POST method :)"))
  .get("/deepl", (c) => c.text("Please use POST method :)"))
  .get("/google", (c) => c.text("Please use POST method :)"))

  .post("/debug", (c) => handleDebug(c))

  .post("/translate", (c) => handleTranslation(c, "deepl"))
  .post("/deepl", (c) => handleTranslation(c, "deepl"))
  .post("/google", (c) => handleTranslation(c, "google"))

  .post("/v2/translate", (c) => handleV2Translation(c))

  .get("/health", (c) => handleHealthCheck(c))
  .get("/health/live", (c) => handleLiveness(c))
  .get("/health/ready", (c) => handleReadiness(c))

  .get("/metrics", (c) => handleMetrics(c))

  .post("/admin/warm-cache", (c) => handleWarmCache(c))
  .get("/admin/cache-status", (c) => handleCacheStatus(c))

  .all("*", (c) => c.redirect("https://github.com/Fahry-a/STA"));
