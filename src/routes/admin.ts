/**
 * Admin route handlers (protected by API key)
 */

import { warmCache, getCacheWarmingStatus } from "../lib/cache/cacheWarmer";
import { collectMetrics, formatMetricsResponse } from "../lib/observability/metrics";
import { isAdminAuthorized } from "../lib/security/security";

type AdminContext = {
  env: Env;
  req: {
    header: (name: string) => string | undefined;
  };
  json: (data: unknown, status?: number) => Response;
};

/**
 * Metrics endpoint (protected by API key)
 * GET /metrics - Service performance and operational metrics
 */
export function handleMetrics(c: AdminContext) {
  if (!isAdminAuthorized(c.req.header("X-API-Key"), c.env.ADMIN_API_KEY)) {
    return c.json({ code: 401, message: "Unauthorized" }, 401);
  }

  const env = c.env;
  const metrics = collectMetrics(env);
  return c.json(formatMetricsResponse(metrics));
}

/**
 * Manual cache warming trigger
 * POST /admin/warm-cache
 */
export async function handleWarmCache(c: AdminContext) {
  if (!isAdminAuthorized(c.req.header("X-API-Key"), c.env.ADMIN_API_KEY)) {
    return c.json({ code: 401, message: "Unauthorized" }, 401);
  }

  const result = await warmCache(c.env);
  return c.json({
    code: 200,
    data: result,
    message: `Cache warming completed: ${result.warmed} warmed, ${result.failed} failed`,
  });
}

/**
 * Cache warming status
 * GET /admin/cache-status
 */
export function handleCacheStatus(c: AdminContext) {
  if (!isAdminAuthorized(c.req.header("X-API-Key"), c.env.ADMIN_API_KEY)) {
    return c.json({ code: 401, message: "Unauthorized" }, 401);
  }

  return c.json({
    code: 200,
    data: getCacheWarmingStatus(),
  });
}
