/**
 * Health Check Module
 * Provides comprehensive service health status
 */

import { getProxyEndpoints, getProxyHealthStats } from "./proxyManager";
import { getPerformanceStats } from "./performance";
import { checkRateLimit } from "./rateLimit";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    proxies: HealthCheckItem;
    cache: HealthCheckItem;
    rateLimit: HealthCheckItem;
    performance: HealthCheckItem;
  };
}

export interface HealthCheckItem {
  status: HealthStatus;
  message: string;
  details?: any;
}

const startTime = Date.now();
const SERVICE_VERSION = "1.0.0";

/**
 * Check proxy health
 */
async function checkProxyHealth(env: any): Promise<HealthCheckItem> {
  const endpoints = getProxyEndpoints(env);
  const stats = getProxyHealthStats(env);

  const healthyCount = stats.filter((s) => s.healthy).length;

  if (endpoints.length === 0) {
    return {
      status: "degraded",
      message: "No proxy endpoints configured",
      details: stats,
    };
  }

  const healthyPercent = (healthyCount / endpoints.length) * 100;

  if (healthyPercent >= 80) {
    return {
      status: "healthy",
      message: `${healthyCount}/${endpoints.length} proxies healthy`,
      details: stats,
    };
  } else if (healthyPercent >= 50) {
    return {
      status: "degraded",
      message: `Only ${healthyCount}/${endpoints.length} proxies healthy`,
      details: stats,
    };
  } else {
    return {
      status: "unhealthy",
      message: `Critical: Only ${healthyCount}/${endpoints.length} proxies healthy`,
      details: stats,
    };
  }
}

/**
 * Check cache health
 */
async function checkCacheHealth(env: any): Promise<HealthCheckItem> {
  try {
    // Try to read/write to KV
    await env.CACHE_KV.put("_health_check", "ok", { expirationTtl: 60 });
    const value = await env.CACHE_KV.get("_health_check");

    if (value === "ok") {
      return {
        status: "healthy",
        message: "Cache KV is accessible",
      };
    } else {
      return {
        status: "degraded",
        message: "Cache KV read/write inconsistency",
      };
    }
  } catch (error) {
    return {
      status: "unhealthy",
      message: "Cache KV is not accessible",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check rate limiter health
 */
async function checkRateLimitHealth(env: any): Promise<HealthCheckItem> {
  try {
    const allowed = await checkRateLimit("_health_check", env);
    return {
      status: "healthy",
      message: "Rate limiter is operational",
      details: { allowed },
    };
  } catch (error) {
    return {
      status: "unhealthy",
      message: "Rate limiter is not operational",
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check performance metrics
 */
function checkPerformanceHealth(): HealthCheckItem {
  const stats = getPerformanceStats();

  if (!stats) {
    return {
      status: "healthy",
      message: "No requests processed yet",
    };
  }

  if (stats.successRate >= 95) {
    return {
      status: "healthy",
      message: `Success rate: ${stats.successRate.toFixed(1)}%`,
      details: stats,
    };
  } else if (stats.successRate >= 80) {
    return {
      status: "degraded",
      message: `Success rate degraded: ${stats.successRate.toFixed(1)}%`,
      details: stats,
    };
  } else {
    return {
      status: "unhealthy",
      message: `Low success rate: ${stats.successRate.toFixed(1)}%`,
      details: stats,
    };
  }
}

/**
 * Perform comprehensive health check
 */
export async function performHealthCheck(env: any): Promise<HealthCheckResult> {
  const checks = {
    proxies: await checkProxyHealth(env),
    cache: await checkCacheHealth(env),
    rateLimit: await checkRateLimitHealth(env),
    performance: checkPerformanceHealth(),
  };

  // Determine overall status
  const statuses = Object.values(checks).map((c) => c.status);
  let overallStatus: HealthStatus = "healthy";

  if (statuses.includes("unhealthy")) {
    overallStatus = "unhealthy";
  } else if (statuses.includes("degraded")) {
    overallStatus = "degraded";
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: SERVICE_VERSION,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };
}
