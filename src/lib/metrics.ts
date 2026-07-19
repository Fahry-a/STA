/**
 * Metrics collection and reporting module
 * Provides system health and performance metrics
 */

import { getPerformanceStats } from "./performance";
import { getProxyEndpoints, getProxyHealthStats } from "./proxyManager";
import { getMemoryCacheSize } from "./cache";

export interface SystemMetrics {
  timestamp: string;
  uptime: number;
  performance: ReturnType<typeof getPerformanceStats>;
  proxy: {
    totalEndpoints: number;
    healthyEndpoints: number;
    unhealthyEndpoints: number;
    healthStats: ReturnType<typeof getProxyHealthStats>;
  };
  cache: {
    memoryCacheSize: number;
  };
  rateLimit: {
    activeClients: number;
  };
}

const startTime = Date.now();

/**
 * Collect comprehensive system metrics
 */
export function collectMetrics(env: any): SystemMetrics {
  const endpoints = getProxyEndpoints(env);
  const healthStats = getProxyHealthStats(env);

  const healthyEndpoints = healthStats.filter((h) => h.healthy).length;
  const unhealthyEndpoints = healthStats.filter((h) => !h.healthy).length;

  return {
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    performance: getPerformanceStats(),
    proxy: {
      totalEndpoints: endpoints.length,
      healthyEndpoints,
      unhealthyEndpoints,
      healthStats,
    },
    cache: {
      memoryCacheSize: getMemoryCacheSize(),
    },
    rateLimit: {
      activeClients: 0, // In-memory tracking would require a counter export
    },
  };
}

/**
 * Format metrics for API response
 */
export function formatMetricsResponse(metrics: SystemMetrics) {
  return {
    code: 200,
    data: metrics,
    id: Math.floor(Math.random() * 10000000000),
  };
}
