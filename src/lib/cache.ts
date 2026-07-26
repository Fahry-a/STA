/**
 * Two-level caching system: In-memory LRU + Cloudflare KV
 * Provides fast access to cached translations with fallback to persistent storage
 * In-memory cache uses a doubly-linked list for O(1) LRU eviction
 */

import { logger } from "./logger";

/**
 * Cache configuration constants
 */
const CACHE_TTL = 3600; // 1 hour in seconds
const MEMORY_CACHE_MAX_SIZE = 1000; // Maximum items in memory cache before LRU eviction

/**
 * Doubly-linked list node for O(1) LRU operations
 */
class LRUNode<V> {
  key: string;
  value: V;
  prev: LRUNode<V> | null = null;
  next: LRUNode<V> | null = null;

  constructor(key: string, value: V) {
    this.key = key;
    this.value = value;
  }
}

/**
 * LRU (Least Recently Used) cache implementation using a doubly-linked list
 * and a Map for O(1) get/set/evict operations
 */
class LRUCache<V> {
  private maxSize: number;
  private map: Map<string, LRUNode<V>> = new Map();
  private head: LRUNode<V>; // dummy head (most-recent side)
  private tail: LRUNode<V>; // dummy tail (least-recent side)

  constructor(maxSize: number) {
    this.maxSize = maxSize;
    this.head = new LRUNode("", null as unknown as V);
    this.tail = new LRUNode("", null as unknown as V);
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  get size(): number {
    return this.map.size;
  }

  private addToFront(node: LRUNode<V>): void {
    node.next = this.head.next;
    node.prev = this.head;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  private removeNode(node: LRUNode<V>): void {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private moveToFront(node: LRUNode<V>): void {
    this.removeNode(node);
    this.addToFront(node);
  }

  private evict(): void {
    const lru = this.tail.prev;
    if (lru && lru !== this.head) {
      this.removeNode(lru);
      this.map.delete(lru.key);
    }
  }

  set(key: string, value: V): void {
    const existing = this.map.get(key);
    if (existing) {
      existing.value = value;
      this.moveToFront(existing);
      return;
    }

    if (this.map.size >= this.maxSize) {
      this.evict();
    }

    const node = new LRUNode(key, value);
    this.map.set(key, node);
    this.addToFront(node);
  }

  get(key: string): V | undefined {
    const node = this.map.get(key);
    if (!node) return undefined;
    this.moveToFront(node);
    return node.value;
  }

  has(key: string): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.moveToFront(node);
    return true;
  }

  delete(key: string): boolean {
    const node = this.map.get(key);
    if (!node) return false;
    this.removeNode(node);
    this.map.delete(key);
    return true;
  }

  clear(): void {
    this.map.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }
}

/**
 * In-memory LRU cache for fast access to recent translations
 * Bounded to MEMORY_CACHE_MAX_SIZE entries to prevent memory leaks
 */
const memoryCache = new LRUCache<CacheEntry>(MEMORY_CACHE_MAX_SIZE);

/**
 * Track all cache keys for gradual TTL-based eviction during scheduled cleanup.
 * The LRU class doesn't expose an iterator, so we maintain a parallel key set.
 */
const trackedCacheKeys = new Set<string>();

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
    trackedCacheKeys.add(key);

    // Bound the tracked keys set to match cache size
    while (trackedCacheKeys.size > MEMORY_CACHE_MAX_SIZE) {
      const oldestKey = trackedCacheKeys.values().next().value;
      if (oldestKey !== undefined) {
        trackedCacheKeys.delete(oldestKey);
      }
    }

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
 * Gradually expire stale entries from the in-memory cache
 * Instead of clearing the entire cache (which causes a cold-start penalty),
 * this removes only entries older than the TTL, preserving recent hot entries.
 * @returns Number of entries removed
 */
export function clearMemoryCache(): number {
  let removed = 0;
  const now = Date.now();
  const ttlMs = CACHE_TTL * 1000;

  const keysToRemove: string[] = [];
  for (const key of trackedCacheKeys) {
    const entry = memoryCache.get(key);
    if (!entry || now - entry.timestamp > ttlMs) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    memoryCache.delete(key);
    trackedCacheKeys.delete(key);
    removed++;
  }

  return removed;
}
