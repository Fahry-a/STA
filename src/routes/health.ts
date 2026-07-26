/**
 * Health check route handlers
 * Protected by admin API key to prevent exposing internal stats publicly
 */

import { performHealthCheck } from "../lib/healthCheck";
import { isAdminAuthorized } from "../lib/security";

type HealthContext = {
  env: Env;
  req: {
    header: (name: string) => string | undefined;
  };
  json: (data: unknown, status?: number) => Response;
};

/**
 * Comprehensive health check endpoint
 * GET /health - Full health status with subsystem details
 */
export async function handleHealthCheck(c: HealthContext) {
  if (!isAdminAuthorized(c.req.header("X-API-Key"), c.env.ADMIN_API_KEY)) {
    return c.json({ code: 401, message: "Unauthorized" }, 401);
  }

  const result = await performHealthCheck(c.env);
  const statusCode =
    result.status === "healthy" || result.status === "degraded"
      ? 200
      : 503;
  return c.json(result, statusCode);
}

/**
 * Simple liveness check (no auth required)
 * GET /health/live - Returns alive status for load balancer probes
 */
export function handleLiveness(c: HealthContext) {
  return c.json({ status: "alive", timestamp: new Date().toISOString() });
}

/**
 * Readiness check endpoint
 * GET /health/ready - Checks if service can handle requests
 */
export async function handleReadiness(c: HealthContext) {
  if (!isAdminAuthorized(c.req.header("X-API-Key"), c.env.ADMIN_API_KEY)) {
    return c.json({ code: 401, message: "Unauthorized" }, 401);
  }

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
}
