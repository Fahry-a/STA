/**
 * Performance monitoring and optimization utilities for STA (Serverless Translation API)
 * Provides request tracking, metrics collection, and performance analysis
 */

/**
 * Performance metrics interface for request tracking
 */
export interface PerformanceMetrics {
  requestId: string;
  endpoint: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  cacheHit: boolean;
  proxyUsed: boolean;
  rateLimited: boolean;
  retryCount: number;
  success: boolean;
}

/**
 * In-memory metrics storage using a circular buffer for O(1) insertions
 * and bounded memory usage. The head/tail pointers avoid expensive splice
 * operations on every insert.
 */
const metrics: PerformanceMetrics[] = [];
let head = 0;
let tail = 0;
let count = 0;

/**
 * Maximum number of metrics to keep in memory
 */
const MAX_METRICS = 1000;

/**
 * Push a metric into the circular buffer, overwriting the oldest entry
 * when at capacity.
 */
function pushMetric(entry: PerformanceMetrics): void {
  if (count < MAX_METRICS) {
    metrics[tail] = entry;
    tail = (tail + 1) % MAX_METRICS;
    count++;
  } else {
    // Buffer full — overwrite oldest entry and advance head
    metrics[tail] = entry;
    tail = (tail + 1) % MAX_METRICS;
    head = (head + 1) % MAX_METRICS;
  }
}

/**
 * Get all metrics in chronological order from the circular buffer.
 */
function getAllMetrics(): PerformanceMetrics[] {
  if (count === 0) return [];
  if (count < MAX_METRICS) {
    return metrics.slice(0, count);
  }
  // Buffer full: head..MAX_METRICS then 0..head
  return [
    ...metrics.slice(head, MAX_METRICS),
    ...metrics.slice(0, head),
  ];
}

/**
 * Start performance tracking for a request
 * Creates a new performance tracking entry with unique ID
 * @param endpoint The API endpoint being called
 * @returns Unique request ID for tracking
 */
export function startPerformanceTracking(endpoint: string): string {
  // Generate UUID in Workers-compatible way
  const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  pushMetric({
    requestId,
    endpoint,
    startTime: Date.now(),
    cacheHit: false,
    proxyUsed: false,
    rateLimited: false,
    retryCount: 0,
    success: false,
  });

  return requestId;
}

/**
 * Update performance metrics for a tracked request
 * Allows partial updates to existing metrics entries
 * @param requestId The unique request ID to update
 * @param updates Partial metrics object with values to update
 * @returns void
 */
export function updatePerformanceMetrics(
  requestId: string,
  updates: Partial<PerformanceMetrics>
): void {
  const all = getAllMetrics();
  const metric = all.find((m) => m.requestId === requestId);
  if (metric) {
    Object.assign(metric, updates);
  }
}

/**
 * End performance tracking for a request
 * Finalizes metrics collection and calculates duration
 * @param requestId The unique request ID to finalize
 * @param success Whether the request was successful
 * @returns void
 */
export function endPerformanceTracking(
  requestId: string,
  success: boolean
): void {
  const all = getAllMetrics();
  const metric = all.find((m) => m.requestId === requestId);
  if (metric) {
    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.success = success;
  }
}

/**
 * Generate aggregated performance statistics
 * Analyzes recent metrics to provide insights into system performance
 * @returns Performance statistics object or null if no metrics available
 */
export function getPerformanceStats() {
  const all = getAllMetrics();
  if (all.length === 0) return null;

  const recent = all.slice(-100); // Last 100 requests for analysis
  const successful = recent.filter((m) => m.success);
  const failed = recent.filter((m) => !m.success);

  const avgDuration =
    successful.length > 0
      ? successful.reduce((sum, m) => sum + (m.duration || 0), 0) /
        successful.length
      : 0;

  return {
    totalRequests: recent.length,
    successfulRequests: successful.length,
    failedRequests: failed.length,
    successRate:
      recent.length > 0 ? (successful.length / recent.length) * 100 : 0,
    averageDuration: Math.round(avgDuration),
    cacheHitRate:
      recent.length > 0
        ? (recent.filter((m) => m.cacheHit).length / recent.length) * 100
        : 0,
    proxyUsageRate:
      recent.length > 0
        ? (recent.filter((m) => m.proxyUsed).length / recent.length) * 100
        : 0,
    rateLimitedRequests: recent.filter((m) => m.rateLimited).length,
  };
}
