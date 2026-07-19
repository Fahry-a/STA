/**
 * Two-level caching system: In-memory LRU + Cloudflare KV
 * Provides fast access to cached translations with fallback to persistent storage
 * In-memory cache uses LRU eviction to prevent unbounded memory growth
 */

import { logger } from "./logger";

/**
 * Cache configuration constants
 */
const CACHE_TTL = 3600; // 1 hour in seconds
const MEMORY_CACHE_MAX_SIZE = 1000; // Maximum items in memory cache before LRU eviction

/**
 * LRU (Least Recently Used) cache implementation
 * Extends Map to add max-size eviction with automatic cleanup
 * When the cache exceeds maxSize, the least recently used entry is evicted
 */
class LRUCache<V> extends Map<string, V> {
  private maxSize: number;

  constructor(maxSize: number) {
    super();
    this.maxSize = maxSize;
  }

  /**
   * Set a value in the cache, evicting the LRU entry if at capacity
   * @param key The cache key
   * @param value The value to store
   * @returns This map instance (for chaining)
   */
  set(key: string, value: V): this {
    // If key already exists, delete it first to update its position in the iteration order
    if (super.has(key)) {
      super.delete(key);
    }

    // Evict the oldest (least recently used) entry if at capacity
    if (super.size >= this.maxSize) {
      // Map iterators iterate in insertion order — first key is the LRU
      const oldestKey = super.keys().next().value;
      if (oldestKey !== undefined) {
        super.delete(oldestKey);
      }
    }

    return super.set(key, value);
  }

  /**
   * Get a value from the cache, promoting it to most-recently-used on access
   * @param key The cache key
   * @returns The cached value or undefined
   */
  get(key: string): V | undefined {
    const value = super.get(key);
    if (value !== undefined) {
      // Re-insert to move to the end (most recently used position)
      super.delete(key);
      super.set(key, value);
    }
    return value;
  }

  /**
   * Check if a key exists in the cache, promoting it on access
   * @param key The cache key
   * @returns true if the key exists
   */
  has(key: string): boolean {
    const exists = super.has(key);
    if (exists) {
      // Promote to most recently used
      const value = super.get(key)!;
      super.delete(key);
      super.set(key, value);
    }
    return exists;
  }
}

/**
 * In-memory LRU cache for fast access to recent translations
 * Bounded to MEMORY_CACHE_MAX_SIZE entries to prevent memory leaks
 */
const memoryCache = new LRUCache<CacheEntry>(MEMORY_CACHE_MAX_SIZE);

/**
 * Generate a unique cache key for translation requests
 * Uses SHA-256 for a collision-resistant, deterministic key.
 *
 * The previous implementation used a 32-bit DJB-style hash (~6-7 chars,
 * truncated to 50). With inputs up to 5000 characters that keyspace is
 * small enough for birthday collisions, and a collision silently returns the
 * translation of a *different* text as a cache hit — a correctness bug for a
 * translation service. SHA-256 (256-bit) makes that negligible.
 *
 * Returns a Promise because crypto.subtle.digest is asynchronous.
 * @param text The text to translate
 * @param sourceLang The source language code
 * @param targetLang The target language code
 * @param provider Optional provider name suffix
 * @returns A unique cache key string
 */
export async function generateCacheKey(
  text: string,
  sourceLang: string,
  targetLang: string,
  provider?: string
): Promise<string> {
  // Normalize language codes to uppercase for consistent caching
  const normalizedSourceLang =
    sourceLang === "auto" ? "auto" : sourceLang.toUpperCase();
  const normalizedTargetLang = targetLang.toUpperCase();
  const providerSuffix = provider ? `:${provider}` : "";
  const content = `${text}:${normalizedSourceLang}:${normalizedTargetLang}${providerSuffix}`;

  const data = new TextEncoder().encode(content);
  const digestBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(digestBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `cache_${normalizedSourceLang}_${normalizedTargetLang}_${hashHex}`;
}

export async function getCachedTranslation(
  key: string,
  env: Env
): Promise<CacheEntry | null> {
  try {
    // Check in-memory LRU cache first
    const memoryResult = memoryCache.get(key);
    if (
      memoryResult &&
      Date.now() - memoryResult.timestamp < CACHE_TTL * 1000
    ) {
      return memoryResult;
    }

    // Check KV cache with improved error handling
    try {
      const kvResult = (await env.CACHE_KV.get(
        key,
        "json"
      )) as CacheEntry | null;
      if (kvResult && Date.now() - kvResult.timestamp < CACHE_TTL * 1000) {
        // Store in memory cache for faster future access
        memoryCache.set(key, kvResult);
        return kvResult;
      }
    } catch (kvError) {
      logger.warn(env, "Failed to get cached translation from KV", {
        metadata: {
          error: kvError instanceof Error ? kvError.message : String(kvError),
        },
      });
      // Continue without cache if KV fails
    }

    return null;
  } catch (error) {
    logger.error(env, "Cache retrieval failed", {
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return null;
  }
}

/**
 * Store translation in two-level cache system
 * Stores in both in-memory LRU cache and KV storage for persistence
 * @param key The cache key to store under
 * @param entry The cache entry to store
 * @param env Environment bindings containing KV namespace
 * @returns Promise<void>
 */
export async function setCachedTranslation(
  key: string,
  entry: CacheEntry,
  env: Env
): Promise<void> {
  try {
    // Store in memory LRU cache (automatically evicts LRU entry if at capacity)
    memoryCache.set(key, entry);

    // Store in KV cache (may fail, but don't let it break the response)
    try {
      await env.CACHE_KV.put(key, JSON.stringify(entry), {
        expirationTtl: CACHE_TTL,
      });
    } catch (kvError) {
      logger.warn(env, "Failed to store cached translation in KV", {
        metadata: {
          error: kvError instanceof Error ? kvError.message : String(kvError),
        },
      });
      // Don't throw - the translation was successful, caching is just an optimization
    }
  } catch (error) {
    logger.error(env, "Cache storage failed", {
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    });
    // Don't throw - the translation was successful, caching is just an optimization
  }
}

/**
 * Get the current size of the in-memory cache
 * Useful for monitoring and debugging
 * @returns Number of entries in the memory cache
 */
export function getMemoryCacheSize(): number {
  return memoryCache.size;
}

/**
 * Clear the in-memory cache
 * Useful for testing or when memory needs to be freed
 * @returns void
 */
export function clearMemoryCache(): void {
  memoryCache.clear();
}
