/**
 * Sliding Window Rate Limiter
 * More accurate than fixed window, prevents burst at window boundaries
 */

import { RATE_LIMIT_CONFIG, calculateDynamicRateLimits } from "./config";
import { getProxyEndpoints } from "./proxyManager";
import { logger } from "./logger";

interface WindowEntry {
  timestamp: number;
  count: number;
}

interface SlidingWindowConfig {
  windowMs: number; // Window size in milliseconds
  maxRequests: number; // Max requests per window
  subWindows: number; // Number of sub-windows for precision
}

const DEFAULT_CONFIG: SlidingWindowConfig = {
  windowMs: 60000, // 1 minute window
  maxRequests: RATE_LIMIT_CONFIG.BASE_TOKENS_PER_MINUTE, // 480 requests per minute
  subWindows: 6, // 10-second sub-windows
};

/**
 * In-memory sliding window storage
 *
 * Bounded by MAX_WINDOW_STORAGE_SIZE using LRU semantics: each access touches
 * the key (delete + re-insert) so iteration order tracks recency, and the
 * oldest key is evicted on overflow. The previous unbounded Map never removed
 * key entries even after all their sub-windows expired — `cleanupWindow`
 * returned an empty array but left it in the Map — so under a spoofed-IP flood
 * of unique clients the storage grew without limit. We now delete emptied keys
 * and cap the total count.
 */
const windowStorage = new Map<string, WindowEntry[]>();
const MAX_WINDOW_STORAGE_SIZE = 5000; // Hard ceiling on tracked rate-limit keys

/**
 * Promote a sliding-window key to most-recently-used, evicting LRU on overflow.
 * @param key The key to touch
 * @param value The entries to store
 */
function touchWindowStorage(key: string, value: WindowEntry[]): void {
  windowStorage.delete(key);
  windowStorage.set(key, value);

  while (windowStorage.size > MAX_WINDOW_STORAGE_SIZE) {
    const oldestKey = windowStorage.keys().next().value;
    if (oldestKey === undefined) {
      break;
    }
    windowStorage.delete(oldestKey);
  }
}

/**
 * Calculate weighted count for sliding window
 * Uses linear interpolation between current and previous window
 */
function calculateWeightedCount(
  currentWindow: number,
  previousWindow: number,
  windowProgress: number
): number {
  // Weight decreases as we move through the window
  return currentWindow * windowProgress + previousWindow * (1 - windowProgress);
}

/**
 * Clean up expired entries from window
 */
function cleanupWindow(entries: WindowEntry[], windowMs: number): WindowEntry[] {
  const cutoff = Date.now() - windowMs;
  return entries.filter((e) => e.timestamp > cutoff);
}

/**
 * Get dynamic max requests based on available proxy endpoints
 * @param env Environment bindings containing proxy configuration
 * @returns Max requests per window based on proxy count
 */
function getDynamicMaxRequests(env?: any): number {
  if (!env) {
    return DEFAULT_CONFIG.maxRequests;
  }
  try {
    const proxyEndpoints = getProxyEndpoints(env);
    const rateLimits = calculateDynamicRateLimits(proxyEndpoints.length);
    return rateLimits.TOKENS_PER_MINUTE;
  } catch {
    return DEFAULT_CONFIG.maxRequests;
  }
}

/**
 * Check sliding window rate limit
 * @param key Unique key for the client (e.g. rate_limit:IP)
 * @param env Environment bindings (optional, used for dynamic limit calculation)
 * @param config Custom sliding window configuration (optional)
 */
export function checkSlidingWindowRateLimit(
  key: string,
  env?: any,
  config?: Partial<SlidingWindowConfig>
): { allowed: boolean; remaining: number; resetMs: number } {
  const effectiveConfig: SlidingWindowConfig = {
    ...DEFAULT_CONFIG,
    maxRequests: getDynamicMaxRequests(env),
    ...config,
  };

  const now = Date.now();
  const subWindowSize = effectiveConfig.windowMs / effectiveConfig.subWindows;

  // Get or create entries
  let entries = windowStorage.get(key) || [];

  // Cleanup old entries
  entries = cleanupWindow(entries, effectiveConfig.windowMs);

  // Drop the key entirely when it has no live sub-windows so the Map doesn't
  // accumulate emptied keys (a leak under high client churn).
  if (entries.length === 0) {
    windowStorage.delete(key);
  }

  // Calculate current window position
  const currentWindowIndex = Math.floor(now / subWindowSize);
  const windowStartMs = currentWindowIndex * subWindowSize;
  const windowProgress = (now - windowStartMs) / subWindowSize;

  // Count requests in current and previous sub-windows
  let currentCount = 0;
  let previousCount = 0;

  for (const entry of entries) {
    const entryWindowIndex = Math.floor(entry.timestamp / subWindowSize);
    if (entryWindowIndex === currentWindowIndex) {
      currentCount += entry.count;
    } else if (entryWindowIndex === currentWindowIndex - 1) {
      previousCount += entry.count;
    }
  }

  // Calculate weighted count
  const weightedCount = calculateWeightedCount(
    currentCount,
    previousCount,
    windowProgress
  );

  // Check limit
  const allowed = weightedCount < effectiveConfig.maxRequests;
  const remaining = Math.max(
    0,
    Math.floor(effectiveConfig.maxRequests - weightedCount)
  );

  if (allowed) {
    // Add new entry
    entries.push({ timestamp: now, count: 1 });
    touchWindowStorage(key, entries);
  }

  // Calculate reset time
  const resetMs = (currentWindowIndex + 1) * subWindowSize - now;

  // Log rate limit exceeded
  if (!allowed && env) {
    logger.warn(env, "Rate limit exceeded", { clientIP: key });
  }

  return { allowed, remaining, resetMs };
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(
  result: ReturnType<typeof checkSlidingWindowRateLimit>,
  env?: any
): Record<string, string> {
  const maxRequests = getDynamicMaxRequests(env);
  return {
    "X-RateLimit-Limit": String(maxRequests),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetMs / 1000)),
  };
}

/**
 * Clear all sliding window entries (for testing or maintenance)
 */
export function clearSlidingWindowStorage(): void {
  windowStorage.clear();
}
