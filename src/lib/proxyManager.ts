/**
 * IP rotation and proxy management for STA
 * Handles proxy selection, browser fingerprinting, and request routing
 * Includes health tracking, response time weighting, and smart selection
 */

/**
 * Collection of realistic browser user agents for fingerprinting
 */
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
];

/**
 * Collection of realistic accept-language headers for regional diversity
 */
const ACCEPT_LANGUAGES = [
  "en-US,en;q=0.9",
  "en-GB,en;q=0.9",
  "en-US,en;q=0.8,es;q=0.6",
  "en-US,en;q=0.9,fr;q=0.8",
  "en-US,en;q=0.9,de;q=0.8",
];

// ─── Proxy Health Tracking ───────────────────────────────────────────────────

/**
 * Health state for a single proxy endpoint
 */
interface ProxyHealth {
  /** Average response time in ms (exponential moving average) */
  avgResponseTime: number;
  /** Number of consecutive failures */
  consecutiveFailures: number;
  /** Total requests sent to this proxy */
  totalRequests: number;
  /** Total failed requests */
  failedRequests: number;
  /** Timestamp of last failure (0 if never failed) */
  lastFailureTime: number;
  /** Whether the proxy is considered healthy */
  isHealthy: boolean;
  /** Timestamp when the proxy was last marked unhealthy (for cooldown recovery) */
  markedUnhealthyAt: number;
}

/**
 * Default health state for a new proxy
 */
function createDefaultHealth(): ProxyHealth {
  return {
    avgResponseTime: 500, // Assume moderate latency initially
    consecutiveFailures: 0,
    totalRequests: 0,
    failedRequests: 0,
    lastFailureTime: 0,
    isHealthy: true,
    markedUnhealthyAt: 0,
  };
}

/**
 * In-memory proxy health state store
 * Key: proxy URL, Value: health metrics
 *
 * Naturally bounded: entries are only created lazily in `getProxyHealth` for
 * URLs that appear in the configured `PROXY_URLS` list. Unlike the client-IP
 * keyed stores (rateLimit, slidingWindow), the key set here cannot grow with
 * traffic, so no explicit cap or eviction is required.
 */
const proxyHealthMap = new Map<string, ProxyHealth>();

/**
 * Configuration for proxy health management
 */
const HEALTH_CONFIG = {
  /** Number of consecutive failures before marking proxy as unhealthy */
  FAILURE_THRESHOLD: 3,
  /** Cooldown period in ms before retrying an unhealthy proxy (30 seconds) */
  UNHEALTHY_COOLDOWN_MS: 30_000,
  /** Weight multiplier for response time scoring (lower is better) */
  RESPONSE_TIME_WEIGHT: 0.7,
  /** Weight multiplier for success rate scoring (higher is better) */
  SUCCESS_RATE_WEIGHT: 0.3,
  /** EMA smoothing factor for response time (0-1, lower = smoother) */
  EMA_ALPHA: 0.3,
  /** Maximum response time to consider (caps penalty for very slow proxies) */
  MAX_RESPONSE_TIME_MS: 10_000,
};

/**
 * Get or create health state for a proxy URL
 * @param proxyUrl The proxy URL to get health for
 * @returns ProxyHealth object
 */
function getProxyHealth(proxyUrl: string): ProxyHealth {
  if (!proxyHealthMap.has(proxyUrl)) {
    proxyHealthMap.set(proxyUrl, createDefaultHealth());
  }
  return proxyHealthMap.get(proxyUrl)!;
}

/**
 * Record a successful request to a proxy
 * Updates response time EMA and resets failure counters
 * @param proxyUrl The proxy URL that succeeded
 * @param responseTimeMs Response time in milliseconds
 */
export function recordProxySuccess(
  proxyUrl: string,
  responseTimeMs: number
): void {
  const health = getProxyHealth(proxyUrl);

  // Update exponential moving average of response time
  health.avgResponseTime =
    HEALTH_CONFIG.EMA_ALPHA * responseTimeMs +
    (1 - HEALTH_CONFIG.EMA_ALPHA) * health.avgResponseTime;

  // Reset consecutive failures
  health.consecutiveFailures = 0;
  health.totalRequests++;
  health.isHealthy = true;
}

/**
 * Record a failed request to a proxy
 * Increments failure counters and may mark proxy as unhealthy
 * @param proxyUrl The proxy URL that failed
 */
export function recordProxyFailure(proxyUrl: string): void {
  const health = getProxyHealth(proxyUrl);

  health.consecutiveFailures++;
  health.totalRequests++;
  health.failedRequests++;
  health.lastFailureTime = Date.now();

  // Mark as unhealthy if consecutive failures exceed threshold
  if (health.consecutiveFailures >= HEALTH_CONFIG.FAILURE_THRESHOLD) {
    health.isHealthy = false;
    health.markedUnhealthyAt = Date.now();
    console.warn(
      `Proxy marked unhealthy after ${health.consecutiveFailures} consecutive failures: ${proxyUrl}`
    );
  }
}

/**
 * Check if a proxy has recovered from being unhealthy
 * @param proxyUrl The proxy URL to check
 * @returns true if the proxy is available for selection
 */
function isProxyAvailable(proxyUrl: string): boolean {
  const health = getProxyHealth(proxyUrl);

  if (health.isHealthy) {
    return true;
  }

  // Check if cooldown period has elapsed
  const timeSinceMarkedUnhealthy = Date.now() - health.markedUnhealthyAt;
  if (timeSinceMarkedUnhealthy >= HEALTH_CONFIG.UNHEALTHY_COOLDOWN_MS) {
    // Allow retry after cooldown — the proxy might have recovered
    health.isHealthy = true;
    health.consecutiveFailures = 0;
    return true;
  }

  return false;
}

/**
 * Calculate a selection weight score for a proxy
 * Higher score = better candidate for selection
 * Combines response time and success rate into a single score
 * @param proxyUrl The proxy URL to score
 * @returns Selection weight (0-1, higher is better)
 */
function calculateProxyWeight(proxyUrl: string): number {
  const health = getProxyHealth(proxyUrl);

  // Response time score: 1.0 for instant, 0.0 for max response time
  const cappedResponseTime = Math.min(
    health.avgResponseTime,
    HEALTH_CONFIG.MAX_RESPONSE_TIME_MS
  );
  const responseTimeScore =
    1 - cappedResponseTime / HEALTH_CONFIG.MAX_RESPONSE_TIME_MS;

  // Success rate score: based on historical success rate
  const successRateScore =
    health.totalRequests === 0
      ? 0.8 // Default optimistic score for untested proxies
      : 1 - health.failedRequests / health.totalRequests;

  // Weighted combination
  const weight =
    HEALTH_CONFIG.RESPONSE_TIME_WEIGHT * responseTimeScore +
    HEALTH_CONFIG.SUCCESS_RATE_WEIGHT * successRateScore;

  // Ensure minimum weight so no proxy is completely excluded
  return Math.max(weight, 0.05);
}

/**
 * Select the best proxy using weighted random selection
 * Proxies with better health metrics (faster, more reliable) are selected more often
 * @param env Environment bindings containing proxy configuration
 * @returns Promise<ProxyEndpoint | null> - Selected proxy or null if none available
 */
export async function selectProxy(env: Env): Promise<ProxyEndpoint | null> {
  try {
    const proxies = getProxyEndpoints(env);

    if (proxies.length === 0) {
      return null;
    }

    // Filter to available (healthy or recovered) proxies
    const availableProxies = proxies.filter((p) => isProxyAvailable(p.url));

    // If no proxies are available (all unhealthy), fall back to all proxies
    // This ensures the service doesn't completely fail
    const candidates =
      availableProxies.length > 0 ? availableProxies : proxies;

    // Calculate weights for each candidate
    const weights = candidates.map((p) => calculateProxyWeight(p.url));
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // Weighted random selection
    let random = Math.random() * totalWeight;
    for (let i = 0; i < candidates.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return candidates[i];
      }
    }

    // Fallback to last candidate (shouldn't happen normally)
    return candidates[candidates.length - 1];
  } catch (error) {
    console.error("Failed to select proxy:", error);
    return null;
  }
}

/**
 * Get health statistics for all proxies (for monitoring/debugging)
 * @param env Environment bindings containing proxy configuration
 * @returns Array of proxy URL and health data pairs
 */
export function getProxyHealthStats(
  env: Env
): Array<{ url: string; healthy: boolean; avgResponseTime: number; failureRate: number }> {
  const proxies = getProxyEndpoints(env);
  return proxies.map((p) => {
    const health = getProxyHealth(p.url);
    return {
      url: p.url,
      healthy: health.isHealthy,
      avgResponseTime: Math.round(health.avgResponseTime),
      failureRate:
        health.totalRequests === 0
          ? 0
          : Math.round((health.failedRequests / health.totalRequests) * 100),
    };
  });
}

// ─── Proxy Endpoint Parsing ──────────────────────────────────────────────────

/**
 * Get available proxy endpoints from environment configuration
 * Parses and validates proxy URLs from environment variables.
 *
 * Empty / blank entries and non-http(s) values are filtered out. The previous
 * implementation only split on commas, so `PROXY_URLS=""` produced a single
 * endpoint with an empty URL (which then exploded at fetch time) and a trailing
 * comma introduced a phantom empty endpoint that participated in weighted
 * selection. Both silently degraded the service.
 * @param env Environment bindings containing proxy configuration
 * @returns ProxyEndpoint[] - Array of valid proxy endpoints
 */
export function getProxyEndpoints(env: Env): ProxyEndpoint[] {
  if (!env.PROXY_URLS) {
    return [];
  }

  return env.PROXY_URLS.split(",")
    .map((url) => url.trim())
    .filter((url) => url.startsWith("http://") || url.startsWith("https://"))
    .map((url) => ({ url }));
}

// ─── Browser Fingerprinting ──────────────────────────────────────────────────

/**
 * Generate realistic browser fingerprint headers
 * Creates randomized headers to mimic real browser requests
 * @returns Record<string, string> - Object containing HTTP headers
 */
export function generateBrowserFingerprint(): Record<string, string> {
  return {
    "User-Agent": USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)],
    "Accept-Language":
      ACCEPT_LANGUAGES[Math.floor(Math.random() * ACCEPT_LANGUAGES.length)],
    Accept: "application/json, text/plain, */*",
    "Accept-Encoding": "gzip, deflate, br",
    DNT: "1",
    Connection: "keep-alive",
    "Upgrade-Insecure-Requests": "1",
  };
}
