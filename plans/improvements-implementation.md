# DeepLX Improvements Implementation Plan

## Table of Contents
1. [Structured Logging with Analytics Engine](#1-structured-logging-with-analytics-engine)
2. [Metrics Endpoint via Debug](#2-metrics-endpoint-via-debug)
3. [Sliding Window Rate Limiter](#3-sliding-window-rate-limiter)
4. [Cache Warming Strategy](#4-cache-warming-strategy)
5. [Health Check Endpoint](#5-health-check-endpoint)
6. [API Documentation Expansion](#6-api-documentation-expansion)
7. [V2 Batch Translation Endpoint](#7-v2-batch-translation-endpoint-with-apr-support)

---

## 1. Structured Logging with Analytics Engine

### Current State
- Basic `console.error` and `console.warn` scattered throughout codebase
- Analytics Engine binding exists in [`wrangler.jsonc`](wrangler.jsonc:4) but unused
- No structured log format or correlation IDs

### Implementation

#### Step 1: Create Logger Module
Create [`src/lib/logger.ts`](src/lib/logger.ts):

```typescript
/**
 * Structured logging module for DeepLX
 * Integrates with Cloudflare Analytics Engine for persistent metrics
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId?: string;
  endpoint?: string;
  clientIP?: string;
  duration?: number;
  cacheHit?: boolean;
  proxyUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Generate unique request ID for correlation
 */
export function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create structured log entry
 */
export function createLogEntry(
  level: LogLevel,
  message: string,
  context?: Partial<LogEntry>
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };
}

/**
 * Write log to Analytics Engine for persistent storage
 */
export function writeLog(
  env: { ANALYTICS: AnalyticsEngineDataset },
  entry: LogEntry
): void {
  try {
    env.ANALYTICS.writeDataPoint({
      blobs: [
        entry.timestamp,
        entry.level,
        entry.message,
        entry.requestId || '',
        entry.endpoint || '',
        entry.clientIP || '',
        entry.proxyUrl || '',
      ],
      doubles: [
        entry.duration || 0,
        entry.cacheHit ? 1 : 0,
      ],
      indexes: [entry.level],
    });
  } catch (error) {
    // Analytics write failed, fallback to console
    console.error('Analytics write failed:', error);
  }
}

/**
 * Convenience logging functions
 */
export const logger = {
  info: (env: any, message: string, context?: Partial<LogEntry>) => {
    const entry = createLogEntry('info', message, context);
    writeLog(env, entry);
  },
  warn: (env: any, message: string, context?: Partial<LogEntry>) => {
    const entry = createLogEntry('warn', message, context);
    writeLog(env, entry);
  },
  error: (env: any, message: string, context?: Partial<LogEntry>) => {
    const entry = createLogEntry('error', message, context);
    writeLog(env, entry);
  },
  debug: (env: any, message: string, context?: Partial<LogEntry>) => {
    const entry = createLogEntry('debug', message, context);
    writeLog(env, entry);
  },
};
```

#### Step 2: Integrate Logger into Request Flow
Update [`src/index.ts`](src/index.ts) to use logger:

```typescript
import { logger, generateRequestId } from './lib/logger';

// In handleTranslation function:
async function handleTranslation(c: any, provider: 'deepl' | 'google') {
  const requestId = generateRequestId();
  const startTime = Date.now();
  const env = c.env;
  const clientIP = getSecureClientIP(c.req.raw) || 'unknown';
  
  logger.info(env, 'Translation request started', {
    requestId,
    endpoint: `/${provider}`,
    clientIP,
  });
  
  // ... existing logic ...
  
  // At response:
  logger.info(env, 'Translation request completed', {
    requestId,
    endpoint: `/${provider}`,
    duration: Date.now() - startTime,
    cacheHit: !!cached,
  });
}
```

#### Step 3: Add Logger Exports
Update [`src/lib/index.ts`](src/lib/index.ts):
```typescript
export * from './logger';
```

---

## 2. Metrics Endpoint via Debug

### Current State
- [`performance.ts`](src/lib/performance.ts:102) has `getPerformanceStats()` returning basic metrics
- Debug endpoint exists but only validates request format
- No way to expose system health metrics publicly

### Implementation

#### Step 1: Create Metrics Handler
Create [`src/lib/metrics.ts`](src/lib/metrics.ts):

```typescript
/**
 * Metrics collection and reporting module
 * Provides system health and performance metrics
 */

import { getPerformanceStats, PerformanceMetrics } from './performance';
import { getProxyEndpoints, getProxyHealthStats } from './proxyManager';
import { CircuitBreaker, getCircuitBreaker } from './circuitBreaker';

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
    // KV metrics would require async fetch
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
  const healthStats = getProxyHealthStats();
  
  return {
    timestamp: new Date().toISOString(),
    uptime: Math.floor((Date.now() - startTime) / 1000),
    performance: getPerformanceStats(),
    proxy: {
      totalEndpoints: endpoints.length,
      healthyEndpoints: healthStats.healthy || 0,
      unhealthyEndpoints: healthStats.unhealthy || 0,
      healthStats,
    },
    cache: {
      memoryCacheSize: 0, // Would need to export from cache.ts
    },
    rateLimit: {
      activeClients: 0, // Would need to export from rateLimit.ts
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
```

#### Step 2: Add Metrics Endpoint
Update [`src/index.ts`](src/index.ts):

```typescript
import { collectMetrics, formatMetricsResponse } from './lib/metrics';

// Add route before catch-all
.get('/metrics', async (c) => {
  const env = c.env;
  
  // Optional: Check for API key or auth
  // if (!validateApiKey(c.req.header('Authorization'))) {
  //   return c.json({ code: 401, message: 'Unauthorized' }, 401);
  // }
  
  const metrics = collectMetrics(env);
  return c.json(formatMetricsResponse(metrics));
})

// Update catch-all to exclude new routes
.all('*', (c) => c.redirect('https://github.com/xixu-me/DeepLX'));
```

#### Step 3: Add Proxy Health Stats Export
Update [`src/lib/proxyManager.ts`](src/lib/proxyManager.ts):

```typescript
/**
 * Get aggregated health statistics for all proxies
 */
export function getProxyHealthStats(): {
  healthy: number;
  unhealthy: number;
  avgResponseTime: number;
  totalRequests: number;
} {
  let healthy = 0;
  let unhealthy = 0;
  let totalResponseTime = 0;
  let totalRequests = 0;
  
  for (const [, health] of proxyHealthMap) {
    if (health.isHealthy) healthy++;
    else unhealthy++;
    totalResponseTime += health.avgResponseTime;
    totalRequests += health.totalRequests;
  }
  
  return {
    healthy,
    unhealthy,
    avgResponseTime: proxyHealthMap.size > 0 
      ? totalResponseTime / proxyHealthMap.size 
      : 0,
    totalRequests,
  };
}
```

---

## 3. Sliding Window Rate Limiter

### Current State
- Token bucket algorithm in [`rateLimit.ts`](src/lib/rateLimit.ts:1)
- Fixed window approach with refill mechanism
- Dual storage: in-memory + KV

### Implementation

#### Step 1: Create Sliding Window Module
Create [`src/lib/slidingWindowRateLimit.ts`](src/lib/slidingWindowRateLimit.ts):

```typescript
/**
 * Sliding Window Rate Limiter
 * More accurate than fixed window, prevents burst at window boundaries
 */

interface WindowEntry {
  timestamp: number;
  count: number;
}

interface SlidingWindowConfig {
  windowMs: number;      // Window size in milliseconds
  maxRequests: number;   // Max requests per window
  subWindows: number;    // Number of sub-windows for precision
}

const DEFAULT_CONFIG: SlidingWindowConfig = {
  windowMs: 60000,       // 1 minute window
  maxRequests: 480,      // 480 requests per minute
  subWindows: 6,         // 10-second sub-windows
};

/**
 * In-memory sliding window storage
 */
const windowStorage = new Map<string, WindowEntry[]>();

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
  return (currentWindow * windowProgress) + (previousWindow * (1 - windowProgress));
}

/**
 * Clean up expired entries from window
 */
function cleanupWindow(entries: WindowEntry[], windowMs: number): WindowEntry[] {
  const cutoff = Date.now() - windowMs;
  return entries.filter(e => e.timestamp > cutoff);
}

/**
 * Check sliding window rate limit
 */
export function checkSlidingWindowRateLimit(
  key: string,
  config: SlidingWindowConfig = DEFAULT_CONFIG
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const windowStart = now - config.windowMs;
  
  // Get or create entries
  let entries = windowStorage.get(key) || [];
  
  // Cleanup old entries
  entries = cleanupWindow(entries, config.windowMs);
  
  // Calculate current window position
  const currentWindowIndex = Math.floor(now / (config.windowMs / config.subWindows));
  const windowStartMs = currentWindowIndex * (config.windowMs / config.subWindows);
  const windowProgress = (now - windowStartMs) / (config.windowMs / config.subWindows);
  
  // Count requests in current and previous sub-windows
  let currentCount = 0;
  let previousCount = 0;
  
  for (const entry of entries) {
    const entryWindowIndex = Math.floor(entry.timestamp / (config.windowMs / config.subWindows));
    if (entryWindowIndex === currentWindowIndex) {
      currentCount += entry.count;
    } else if (entryWindowIndex === currentWindowIndex - 1) {
      previousCount += entry.count;
    }
  }
  
  // Calculate weighted count
  const weightedCount = calculateWeightedCount(currentCount, previousCount, windowProgress);
  
  // Check limit
  const allowed = weightedCount < config.maxRequests;
  const remaining = Math.max(0, Math.floor(config.maxRequests - weightedCount));
  
  if (allowed) {
    // Add new entry
    entries.push({ timestamp: now, count: 1 });
    windowStorage.set(key, entries);
  }
  
  // Calculate reset time
  const resetMs = ((currentWindowIndex + 1) * (config.windowMs / config.subWindows)) - now;
  
  return { allowed, remaining, resetMs };
}

/**
 * Get rate limit headers for response
 */
export function getRateLimitHeaders(
  result: ReturnType<typeof checkSlidingWindowRateLimit>
): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(DEFAULT_CONFIG.maxRequests),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetMs / 1000)),
  };
}
```

#### Step 2: Replace Current Rate Limiter
Update [`src/lib/rateLimit.ts`](src/lib/rateLimit.ts) to use sliding window:

```typescript
import { checkSlidingWindowRateLimit, getRateLimitHeaders } from './slidingWindowRateLimit';

// Replace checkRateLimit function:
export async function checkRateLimit(
  clientIP: string,
  env: Env
): Promise<boolean> {
  const key = `rate_limit:${clientIP}`;
  const result = checkSlidingWindowRateLimit(key);
  
  if (!result.allowed) {
    logger.warn(env, 'Rate limit exceeded', { clientIP });
  }
  
  return result.allowed;
}

// Export for use in response headers:
export { getRateLimitHeaders };
```

#### Step 3: Add Rate Limit Headers to Responses
Update [`src/index.ts`](src/index.ts):

```typescript
import { checkSlidingWindowRateLimit, getRateLimitHeaders } from './lib/slidingWindowRateLimit';

// In handleTranslation:
const rateLimitResult = checkSlidingWindowRateLimit(`rate_limit:${clientIP}`);
const rateLimitHeaders = getRateLimitHeaders(rateLimitResult);

// Add to response:
return c.json(result, {
  status: result.code,
  headers: rateLimitHeaders,
});
```

---

## 4. Cache Warming Strategy

### Current State
- Passive caching in [`cache.ts`](src/lib/cache.ts:1)
- No pre-warming of popular translations
- Scheduled handler only clears memory cache

### Implementation

#### Step 1: Create Cache Warming Module
Create [`src/lib/cacheWarmer.ts`](src/lib/cacheWarmer.ts):

```typescript
/**
 * Cache Warming Module
 * Pre-populates cache with popular translations during low-traffic periods
 */

import { setCachedTranslation, generateCacheKey } from './cache';
import { translateWithGoogle } from './services/googleTranslate';

/**
 * Popular translation pairs that benefit from caching
 */
const POPULAR_TRANSLATIONS = [
  // Common greetings
  { text: 'Hello', source_lang: 'en', target_lang: 'zh' },
  { text: 'Thank you', source_lang: 'en', target_lang: 'ja' },
  { text: 'Good morning', source_lang: 'en', target_lang: 'es' },
  { text: 'How are you?', source_lang: 'en', target_lang: 'fr' },
  { text: 'Goodbye', source_lang: 'en', target_lang: 'de' },
  
  // Technical terms
  { text: 'Artificial Intelligence', source_lang: 'en', target_lang: 'zh' },
  { text: 'Machine Learning', source_lang: 'en', target_lang: 'ja' },
  { text: 'Cloud Computing', source_lang: 'en', target_lang: 'ko' },
  
  // Business phrases
  { text: 'Please find attached', source_lang: 'en', target_lang: 'zh' },
  { text: 'Looking forward to hearing from you', source_lang: 'en', target_lang: 'es' },
];

/**
 * Warm cache with popular translations
 * Should be called during scheduled maintenance
 */
export async function warmCache(env: any): Promise<{
  warmed: number;
  failed: number;
  errors: string[];
}> {
  const results = { warmed: 0, failed: 0, errors: [] as string[] };
  
  for (const translation of POPULAR_TRANSLATIONS) {
    try {
      const cacheKey = generateCacheKey(
        translation.text,
        translation.source_lang,
        translation.target_lang,
        'google'
      );
      
      // Check if already cached
      const { getCachedTranslation } = await import('./cache');
      const existing = await getCachedTranslation(cacheKey, env);
      if (existing) {
        continue; // Skip if already cached
      }
      
      // Translate and cache
      const result = await translateWithGoogle(
        {
          text: translation.text,
          source_lang: translation.source_lang,
          target_lang: translation.target_lang,
        },
        { env, clientIP: 'cache-warmer' }
      );
      
      if (result.code === 200 && result.data) {
        await setCachedTranslation(
          cacheKey,
          {
            data: result.data,
            timestamp: Date.now(),
            source_lang: translation.source_lang.toUpperCase(),
            target_lang: translation.target_lang.toUpperCase(),
            id: result.id,
          },
          env
        );
        results.warmed++;
      } else {
        results.failed++;
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
      
    } catch (error) {
      results.failed++;
      results.errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  
  return results;
}

/**
 * Get cache warming status
 */
export function getCacheWarmingStatus(): {
  totalPopular: number;
  lastWarmed: string | null;
} {
  return {
    totalPopular: POPULAR_TRANSLATIONS.length,
    lastWarmed: null, // Would need to track this
  };
}
```

#### Step 2: Update Scheduled Handler
Update [`src/index.ts`](src/index.ts):

```typescript
import { warmCache } from './lib/cacheWarmer';

async function handleScheduled(event: ScheduledEvent, env: Env): Promise<void> {
  // Clear the in-memory cache every 5 minutes
  clearMemoryCache();
  
  // Warm cache during low-traffic periods (every other run)
  if (event.cron === '*/10 * * * *') { // Only on 10-minute intervals
    try {
      const result = await warmCache(env);
      console.log(`Cache warming completed: ${result.warmed} warmed, ${result.failed} failed`);
    } catch (error) {
      console.error('Cache warming failed:', error);
    }
  }
}
```

#### Step 3: Add Manual Warming Endpoint
Add to [`src/index.ts`](src/index.ts):

```typescript
import { warmCache, getCacheWarmingStatus } from './lib/cacheWarmer';

// Add admin endpoint (protected)
.post('/admin/warm-cache', async (c) => {
  // Check for admin API key
  const apiKey = c.req.header('X-API-Key');
  if (apiKey !== c.env.ADMIN_API_KEY) {
    return c.json({ code: 401, message: 'Unauthorized' }, 401);
  }
  
  const result = await warmCache(c.env);
  return c.json({
    code: 200,
    data: result,
    message: `Cache warming completed: ${result.warmed} warmed, ${result.failed} failed`,
  });
})

.get('/admin/cache-status', async (c) => {
  const apiKey = c.req.header('X-API-Key');
  if (apiKey !== c.env.ADMIN_API_KEY) {
    return c.json({ code: 401, message: 'Unauthorized' }, 401);
  }
  
  return c.json({
    code: 200,
    data: getCacheWarmingStatus(),
  });
})
```

---

## 5. Health Check Endpoint

### Current State
- No dedicated health check endpoint
- Proxy health tracked internally in [`proxyManager.ts`](src/lib/proxyManager.ts:70)
- No way to monitor service status externally

### Implementation

#### Step 1: Create Health Check Module
Create [`src/lib/healthCheck.ts`](src/lib/healthCheck.ts):

```typescript
/**
 * Health Check Module
 * Provides comprehensive service health status
 */

import { getProxyEndpoints, getProxyHealthStats } from './proxyManager';
import { getPerformanceStats } from './performance';
import { checkRateLimit } from './rateLimit';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

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
const SERVICE_VERSION = '1.0.0';

/**
 * Check proxy health
 */
async function checkProxyHealth(env: any): Promise<HealthCheckItem> {
  const endpoints = getProxyEndpoints(env);
  const stats = getProxyHealthStats();
  
  const healthyPercent = endpoints.length > 0 
    ? (stats.healthy / endpoints.length) * 100 
    : 0;
  
  if (healthyPercent >= 80) {
    return {
      status: 'healthy',
      message: `${stats.healthy}/${endpoints.length} proxies healthy`,
      details: stats,
    };
  } else if (healthyPercent >= 50) {
    return {
      status: 'degraded',
      message: `Only ${stats.healthy}/${endpoints.length} proxies healthy`,
      details: stats,
    };
  } else {
    return {
      status: 'unhealthy',
      message: `Critical: Only ${stats.healthy}/${endpoints.length} proxies healthy`,
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
    await env.CACHE_KV.put('_health_check', 'ok', { expirationTtl: 60 });
    const value = await env.CACHE_KV.get('_health_check');
    
    if (value === 'ok') {
      return {
        status: 'healthy',
        message: 'Cache KV is accessible',
      };
    } else {
      return {
        status: 'degraded',
        message: 'Cache KV read/write inconsistency',
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Cache KV is not accessible',
      details: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Check rate limiter health
 */
async function checkRateLimitHealth(env: any): Promise<HealthCheckItem> {
  try {
    const allowed = await checkRateLimit('_health_check', env);
    return {
      status: 'healthy',
      message: 'Rate limiter is operational',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Rate limiter is not operational',
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
      status: 'healthy',
      message: 'No requests processed yet',
    };
  }
  
  if (stats.successRate >= 95) {
    return {
      status: 'healthy',
      message: `Success rate: ${stats.successRate.toFixed(1)}%`,
      details: stats,
    };
  } else if (stats.successRate >= 80) {
    return {
      status: 'degraded',
      message: `Success rate degraded: ${stats.successRate.toFixed(1)}%`,
      details: stats,
    };
  } else {
    return {
      status: 'unhealthy',
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
  const statuses = Object.values(checks).map(c => c.status);
  let overallStatus: HealthStatus = 'healthy';
  
  if (statuses.includes('unhealthy')) {
    overallStatus = 'unhealthy';
  } else if (statuses.includes('degraded')) {
    overallStatus = 'degraded';
  }
  
  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: SERVICE_VERSION,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks,
  };
}
```

#### Step 2: Add Health Check Endpoint
Update [`src/index.ts`](src/index.ts):

```typescript
import { performHealthCheck } from './lib/healthCheck';

// Add health check endpoints
.get('/health', async (c) => {
  const result = await performHealthCheck(c.env);
  const statusCode = result.status === 'healthy' ? 200 : 
                     result.status === 'degraded' ? 200 : 503;
  return c.json(result, statusCode);
})

.get('/health/live', (c) => {
  // Simple liveness check
  return c.json({ status: 'alive', timestamp: new Date().toISOString() });
})

.get('/health/ready', async (c) => {
  // Readiness check - checks if service can handle requests
  const result = await performHealthCheck(c.env);
  const ready = result.status !== 'unhealthy';
  return c.json({ 
    ready,
    status: result.status,
    timestamp: new Date().toISOString(),
  }, ready ? 200 : 503);
})
```

---

## 6. API Documentation Expansion

### Current State
- Basic README with cURL examples
- No OpenAPI/Swagger specification
- Limited endpoint documentation

### Implementation

#### Step 1: Create OpenAPI Specification
Create [`docs/openapi.yaml`](docs/openapi.yaml):

```yaml
openapi: 3.0.3
info:
  title: DeepLX API
  version: 1.0.0
  description: |
    Free translation API powered by DeepL and Google Translate.
    No API keys required.
  contact:
    name: DeepLX
    url: https://github.com/xixu-me/DeepLX
  license:
    name: MIT
    url: https://opensource.org/licenses/MIT

servers:
  - url: https://deeplx.oryn.my.id
    description: Production server

paths:
  /deepl:
    post:
      summary: Translate text using DeepL
      description: |
        High-quality translation using DeepL's neural machine translation.
        Supports 27+ languages with auto-detection.
      tags: [Translation]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TranslationRequest'
            examples:
              basic:
                summary: Basic translation
                value:
                  text: "Hello, world!"
                  source_lang: "EN"
                  target_lang: "ZH"
              auto_detect:
                summary: Auto-detect source language
                value:
                  text: "Bonjour le monde"
                  target_lang: "EN"
      responses:
        '200':
          description: Successful translation
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TranslationResponse'
        '400':
          description: Invalid request
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '429':
          description: Rate limit exceeded
          headers:
            X-RateLimit-Limit:
              schema:
                type: integer
              description: Maximum requests per minute
            X-RateLimit-Remaining:
              schema:
                type: integer
              description: Remaining requests in current window
            X-RateLimit-Reset:
              schema:
                type: integer
              description: Seconds until rate limit resets
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'

  /google:
    post:
      summary: Translate text using Google Translate
      description: |
        Wide language support using Google Translate.
        Fast processing with extensive language coverage.
      tags: [Translation]
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/TranslationRequest'
      responses:
        '200':
          description: Successful translation
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TranslationResponse'

  /health:
    get:
      summary: Service health check
      description: Returns comprehensive health status of all service components
      tags: [Monitoring]
      responses:
        '200':
          description: Service is healthy or degraded
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'
        '503':
          description: Service is unhealthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'

  /metrics:
    get:
      summary: Service metrics
      description: Returns performance and operational metrics
      tags: [Monitoring]
      responses:
        '200':
          description: Metrics retrieved successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MetricsResponse'

components:
  schemas:
    TranslationRequest:
      type: object
      required: [text, target_lang]
      properties:
        text:
          type: string
          maxLength: 5000
          description: Text to translate
          example: "Hello, world!"
        source_lang:
          type: string
          minLength: 2
          maxLength: 5
          description: Source language code (ISO 639-1/639-2)
          example: "EN"
        target_lang:
          type: string
          minLength: 2
          maxLength: 5
          description: Target language code (ISO 639-1/639-2)
          example: "ZH"

    TranslationResponse:
      type: object
      properties:
        code:
          type: integer
          description: HTTP status code
          example: 200
        data:
          type: string
          nullable: true
          description: Translated text
          example: "你好，世界！"
        id:
          type: integer
          description: Unique request identifier
          example: 1234567890
        source_lang:
          type: string
          nullable: true
          description: Detected or specified source language
          example: "EN"
        target_lang:
          type: string
          nullable: true
          description: Target language
          example: "ZH"

    ErrorResponse:
      type: object
      properties:
        code:
          type: integer
          example: 400
        data:
          type: string
          nullable: true
        id:
          type: integer
        source_lang:
          type: string
          nullable: true
        target_lang:
          type: string
          nullable: true

    HealthResponse:
      type: object
      properties:
        status:
          type: string
          enum: [healthy, degraded, unhealthy]
        timestamp:
          type: string
          format: date-time
        version:
          type: string
        uptime:
          type: integer
          description: Uptime in seconds
        checks:
          type: object
          properties:
            proxies:
              $ref: '#/components/schemas/HealthCheckItem'
            cache:
              $ref: '#/components/schemas/HealthCheckItem'
            rateLimit:
              $ref: '#/components/schemas/HealthCheckItem'
            performance:
              $ref: '#/components/schemas/HealthCheckItem'

    HealthCheckItem:
      type: object
      properties:
        status:
          type: string
          enum: [healthy, degraded, unhealthy]
        message:
          type: string
        details:
          type: object

    MetricsResponse:
      type: object
      properties:
        code:
          type: integer
        data:
          type: object
          properties:
            timestamp:
              type: string
            uptime:
              type: integer
            performance:
              type: object
            proxy:
              type: object

  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
      description: Admin API key for protected endpoints

tags:
  - name: Translation
    description: Translation endpoints
  - name: Monitoring
    description: Health and metrics endpoints
```

#### Step 2: Create API Documentation Page
Create [`docs/api.md`](docs/api.md):

```markdown
# DeepLX API Documentation

## Base URL
```
https://deeplx.oryn.my.id
```

## Authentication
No authentication required for translation endpoints.
Admin endpoints require `X-API-Key` header.

## Endpoints

### POST /deepl
Translate text using DeepL's neural machine translation.

**Request Body:**
```json
{
  "text": "Hello, world!",
  "source_lang": "EN",
  "target_lang": "ZH"
}
```

**Response:**
```json
{
  "code": 200,
  "data": "你好，世界！",
  "id": 1234567890,
  "source_lang": "EN",
  "target_lang": "ZH"
}
```

### POST /google
Translate text using Google Translate.

**Request Body:** Same as `/deepl`

**Response:** Same format as `/deepl`

### GET /health
Check service health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "uptime": 86400,
  "checks": {
    "proxies": { "status": "healthy", "message": "20/21 proxies healthy" },
    "cache": { "status": "healthy", "message": "Cache KV is accessible" },
    "rateLimit": { "status": "healthy", "message": "Rate limiter is operational" },
    "performance": { "status": "healthy", "message": "Success rate: 98.5%" }
  }
}
```

### GET /metrics
Get performance metrics (may require authentication).

## Rate Limiting

| Client Type | Limit | Window |
|-------------|-------|--------|
| Standard | 480 requests | 1 minute |
| Per Proxy | 8 requests | 1 second |

**Rate Limit Headers:**
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Seconds until reset

## Supported Languages

| Code | Language |
|------|----------|
| EN | English |
| ZH | Chinese |
| JA | Japanese |
| ES | Spanish |
| FR | French |
| DE | German |
| ... | [View all](https://developers.deepl.com/docs/resources/supported-languages) |

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Invalid request |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Service unavailable |
```

#### Step 3: Update README
Add documentation links to [`README.md`](README.md):

```markdown
## API Documentation

- [Interactive API Docs (Swagger UI)](#) - Coming soon
- [API Reference](docs/api.md) - Detailed endpoint documentation
- [OpenAPI Specification](docs/openapi.yaml) - Machine-readable API spec

## Quick Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/deepl` | POST | Translate with DeepL |
| `/google` | POST | Translate with Google |
| `/health` | GET | Health check |
| `/metrics` | GET | Performance metrics |
```

---

## Implementation Order

| Priority | Improvement | Effort | Impact |
|----------|-------------|--------|--------|
| 1 | Health Check Endpoint | Low | High - Immediate monitoring capability |
| 2 | Structured Logging | Medium | High - Better debugging and analytics |
| 3 | Metrics Endpoint | Low | Medium - Operational visibility |
| 4 | Sliding Window Rate Limiter | Medium | Medium - More accurate limiting |
| 5 | Cache Warming | Medium | Medium - Better cache hit rates |
| 6 | API Documentation | Low | Medium - Developer experience |
| 7 | V2 Batch Endpoint | Medium | High - New batch translation feature |

---

## 7. V2 Batch Translation Endpoint with APR Support

### Current State
- Single text translation only in [`/deepl`](src/index.ts:334) and [`/google`](src/index.ts:342)
- No batch translation support
- No array-based request handling

### New API Specification

**Endpoint:** `POST /v2/translate`

**Request Body:**
```json
{
  "text": ["Hello, world!", "How are you?", "Goodbye!"],
  "APR": true,
  "source_lang": "EN",
  "target_lang": "DE"
}
```

**APR (Array Per Request) Behavior:**
- `APR: true` (default): Each array item is sent as a **separate** DeepL request
- `APR: false`: All array items are **combined** into a single request with `\n` separators

**Validation Rules:**
| Condition | Limit |
|-----------|-------|
| Array items count (APR=true) | Max 10 items |
| Each item length (APR=true) | Max 5000 chars |
| Total length (APR=false) | Max 5000 chars combined |

### Implementation

#### Step 1: Create V2 Types
Update [`src/lib/types.ts`](src/lib/types.ts):

```typescript
/**
 * V2 Batch translation request parameters
 */
export type V2RequestParams = {
  text: string[];
  APR?: boolean; // Array Per Request (default: true)
  source_lang?: SourceLang;
  target_lang: TargetLang;
};

/**
 * V2 Batch translation response
 */
export type V2ResponseParams = {
  code: number;
  data: V2TranslationResult[];
  id: number;
};

/**
 * Individual translation result in batch
 */
export type V2TranslationResult = {
  text: string;
  index: number;
  detected_source_lang?: string;
  success: boolean;
  error?: string;
};

/**
 * Create standardized V2 response format
 */
export function createV2Response(
  code: number,
  data: V2TranslationResult[],
  id?: number
): V2ResponseParams {
  return {
    code,
    data,
    id: id ?? Math.floor(Math.random() * 10000000000),
  };
}
```

#### Step 2: Create V2 Validation Module
Create [`src/lib/v2Validation.ts`](src/lib/v2Validation.ts):

```typescript
/**
 * V2 Request Validation
 * Handles batch translation validation with APR support
 */

import { V2RequestParams } from './types';
import { PAYLOAD_LIMITS } from './config';

export interface V2ValidationResult {
  isValid: boolean;
  errors: string[];
  sanitizedInput?: V2RequestParams;
}

const MAX_ARRAY_ITEMS = 10;
const MAX_TEXT_LENGTH = PAYLOAD_LIMITS.MAX_TEXT_LENGTH; // 5000 chars
const MAX_TOTAL_LENGTH = PAYLOAD_LIMITS.MAX_TEXT_LENGTH; // 5000 chars for combined

/**
 * Validate V2 batch translation request
 */
export function validateV2Request(input: any): V2ValidationResult {
  const errors: string[] = [];

  // Check if input is an object
  if (!input || typeof input !== 'object') {
    return {
      isValid: false,
      errors: ['Request body must be a valid JSON object'],
    };
  }

  // Validate text field - must be array
  if (!input.text) {
    errors.push('text field is required');
  } else if (!Array.isArray(input.text)) {
    errors.push('text field must be an array');
  } else if (input.text.length === 0) {
    errors.push('text array cannot be empty');
  } else if (input.text.length > MAX_ARRAY_ITEMS) {
    errors.push(`text array cannot exceed ${MAX_ARRAY_ITEMS} items`);
  }

  // If text array is invalid, return early
  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Default APR to true
  const apr = input.APR !== undefined ? Boolean(input.APR) : true;

  // Validate each text item
  const sanitizedTexts: string[] = [];
  let totalLength = 0;

  for (let i = 0; i < input.text.length; i++) {
    const item = input.text[i];

    if (typeof item !== 'string') {
      errors.push(`text[${i}] must be a string`);
      continue;
    }

    const trimmed = item.trim();
    if (trimmed.length === 0) {
      errors.push(`text[${i}] cannot be empty`);
      continue;
    }

    if (apr) {
      // APR=true: validate each item individually
      if (trimmed.length > MAX_TEXT_LENGTH) {
        errors.push(`text[${i}] exceeds maximum length of ${MAX_TEXT_LENGTH} characters`);
      }
    }

    totalLength += trimmed.length;
    sanitizedTexts.push(trimmed);
  }

  // APR=false: validate total length
  if (!apr && totalLength > MAX_TOTAL_LENGTH) {
    errors.push(
      `Total text length (${totalLength}) exceeds maximum of ${MAX_TOTAL_LENGTH} characters when APR is false`
    );
  }

  // Validate target_lang (required)
  if (!input.target_lang) {
    errors.push('target_lang is required');
  } else if (typeof input.target_lang !== 'string') {
    errors.push('target_lang must be a string');
  }

  // Validate source_lang (optional)
  if (input.source_lang && typeof input.source_lang !== 'string') {
    errors.push('source_lang must be a string');
  }

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    errors: [],
    sanitizedInput: {
      text: sanitizedTexts,
      APR: apr,
      source_lang: input.source_lang || 'auto',
      target_lang: input.target_lang,
    },
  };
}

/**
 * Format text array for combined request (APR=false)
 * Joins all items with newline separator
 */
export function formatCombinedText(texts: string[]): string {
  return texts.join('\n');
}

/**
 * Parse combined response back to array (APR=false)
 * Splits response by newline separator
 */
export function parseCombinedResponse(response: string, expectedCount: number): string[] {
  const parts = response.split('\n');
  
  // If we got fewer parts than expected, pad with empty strings
  while (parts.length < expectedCount) {
    parts.push('');
  }
  
  return parts.slice(0, expectedCount);
}
```

#### Step 3: Create V2 Translation Handler
Create [`src/lib/v2Translate.ts`](src/lib/v2Translate.ts):

```typescript
/**
 * V2 Batch Translation Handler
 * Supports APR (Array Per Request) mode for batch translations
 */

import { query } from './query';
import {
  V2RequestParams,
  V2ResponseParams,
  V2TranslationResult,
  createV2Response,
  RequestParams,
} from './types';
import {
  validateV2Request,
  formatCombinedText,
  parseCombinedResponse,
} from './v2Validation';

interface V2TranslateConfig {
  env: any;
  clientIP: string;
}

/**
 * Translate batch of texts using DeepL with APR support
 */
export async function translateBatch(
  params: V2RequestParams,
  config: V2TranslateConfig
): Promise<V2ResponseParams> {
  const { env, clientIP } = config;

  // Validate request
  const validation = validateV2Request(params);
  if (!validation.isValid) {
    return createV2Response(400, []);
  }

  const validatedParams = validation.sanitizedInput!;
  const { text: texts, APR, source_lang, target_lang } = validatedParams;

  // APR=true: Send each text as separate request
  if (APR) {
    return translateWithAPR(texts, source_lang, target_lang, env, clientIP);
  }

  // APR=false: Combine texts and send as single request
  return translateCombined(texts, source_lang, target_lang, env, clientIP);
}

/**
 * Translate each text item separately (APR=true)
 */
async function translateWithAPR(
  texts: string[],
  source_lang: string,
  target_lang: string,
  env: any,
  clientIP: string
): Promise<V2ResponseParams> {
  const results: V2TranslationResult[] = [];
  let allSuccess = true;

  // Process all texts in parallel
  const promises = texts.map(async (text, index) => {
    try {
      const requestParams: RequestParams = {
        text,
        source_lang,
        target_lang,
      };

      const result = await query(requestParams, { env, clientIP });

      if (result.code === 200 && result.data) {
        return {
          text: result.data,
          index,
          detected_source_lang: result.source_lang || undefined,
          success: true,
        };
      } else {
        allSuccess = false;
        return {
          text: '',
          index,
          success: false,
          error: `Translation failed with code ${result.code}`,
        };
      }
    } catch (error) {
      allSuccess = false;
      return {
        text: '',
        index,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  const resolvedResults = await Promise.all(promises);
  
  // Sort by index to maintain order
  results.sort((a, b) => a.index - b.index);

  const statusCode = allSuccess ? 200 : 207; // 207 Multi-Status for partial success
  return createV2Response(statusCode, resolvedResults);
}

/**
 * Translate combined text (APR=false)
 * All texts joined with \n and sent as single request
 */
async function translateCombined(
  texts: string[],
  source_lang: string,
  target_lang: string,
  env: any,
  clientIP: string
): Promise<V2ResponseParams> {
  try {
    const combinedText = formatCombinedText(texts);
    
    const requestParams: RequestParams = {
      text: combinedText,
      source_lang,
      target_lang,
    };

    const result = await query(requestParams, { env, clientIP });

    if (result.code === 200 && result.data) {
      // Parse combined response back to array
      const translatedParts = parseCombinedResponse(result.data, texts.length);
      
      const results: V2TranslationResult[] = translatedParts.map((text, index) => ({
        text,
        index,
        detected_source_lang: result.source_lang || undefined,
        success: true,
      }));

      return createV2Response(200, results, result.id);
    } else {
      // Return empty results with error
      const results: V2TranslationResult[] = texts.map((_, index) => ({
        text: '',
        index,
        success: false,
        error: `Translation failed with code ${result.code}`,
      }));

      return createV2Response(result.code, results);
    }
  } catch (error) {
    const results: V2TranslationResult[] = texts.map((_, index) => ({
      text: '',
      index,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }));

    return createV2Response(500, results);
  }
}
```

#### Step 4: Add V2 Route to Index
Update [`src/index.ts`](src/index.ts):

```typescript
import { translateBatch } from './lib/v2Translate';
import { V2RequestParams, createV2Response } from './lib/types';

// Add V2 translation endpoint
.post('/v2/translate', async (c) => {
  const env = c.env;
  const clientIP = getSecureClientIP(c.req.raw) || 'unknown';

  try {
    // Parse request body
    let params: V2RequestParams;
    try {
      params = await c.req.json();
    } catch (parseError) {
      return c.json(
        createV2Response(400, []),
        400
      );
    }

    // Check rate limit
    const rateLimitResult = await checkCombinedRateLimit(
      clientIP,
      'deepl', // Use DeepL proxy endpoints
      env
    );

    if (!rateLimitResult.allowed) {
      return c.json(
        createV2Response(429, []),
        429
      );
    }

    // Translate batch
    const result = await translateBatch(params, { env, clientIP });

    return c.json(result, result.code as any);
  } catch (error) {
    const errorResponse = createErrorResponse(error, {
      endpoint: '/v2/translate',
      clientIP,
    });

    return c.json(
      createV2Response(errorResponse.httpStatus, []),
      errorResponse.httpStatus as any
    );
  }
})
```

### API Examples

#### APR=true (Separate Requests)
```bash
curl -X POST https://deeplx.oryn.my.id/v2/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": ["Hello", "World", "Goodbye"],
    "APR": true,
    "target_lang": "DE"
  }'
```

**Response:**
```json
{
  "code": 200,
  "data": [
    { "text": "Hallo", "index": 0, "success": true },
    { "text": "Welt", "index": 1, "success": true },
    { "text": "Auf Wiedersehen", "index": 2, "success": true }
  ],
  "id": 1234567890
}
```

#### APR=false (Combined Request)
```bash
curl -X POST https://deeplx.oryn.my.id/v2/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": ["Hello", "World", "Goodbye"],
    "APR": false,
    "target_lang": "DE"
  }'
```

**Response:**
```json
{
  "code": 200,
  "data": [
    { "text": "Hallo", "index": 0, "success": true },
    { "text": "Welt", "index": 1, "success": true },
    { "text": "Auf Wiedersehen", "index": 2, "success": true }
  ],
  "id": 1234567890
}
```

---

## File Changes Summary

### New Files
- [`src/lib/logger.ts`](src/lib/logger.ts) - Structured logging module
- [`src/lib/metrics.ts`](src/lib/metrics.ts) - Metrics collection
- [`src/lib/slidingWindowRateLimit.ts`](src/lib/slidingWindowRateLimit.ts) - Sliding window rate limiter
- [`src/lib/cacheWarmer.ts`](src/lib/cacheWarmer.ts) - Cache warming logic
- [`src/lib/healthCheck.ts`](src/lib/healthCheck.ts) - Health check module
- [`src/lib/v2Validation.ts`](src/lib/v2Validation.ts) - V2 request validation
- [`src/lib/v2Translate.ts`](src/lib/v2Translate.ts) - V2 batch translation handler
- [`docs/openapi.yaml`](docs/openapi.yaml) - OpenAPI specification
- [`docs/api.md`](docs/api.md) - API documentation

### Modified Files
- [`src/index.ts`](src/index.ts) - Add new endpoints including /v2/translate
- [`src/lib/index.ts`](src/lib/index.ts) - Export new modules
- [`src/lib/types.ts`](src/lib/types.ts) - Add V2 types
- [`src/lib/rateLimit.ts`](src/lib/rateLimit.ts) - Integrate sliding window
- [`src/lib/proxyManager.ts`](src/lib/proxyManager.ts) - Export health stats
- [`wrangler.jsonc`](wrangler.jsonc) - Add ADMIN_API_KEY env var
- [`README.md`](README.md) - Add documentation links
