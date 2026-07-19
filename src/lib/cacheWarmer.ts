/**
 * Cache Warming Module
 * Pre-populates cache with popular translations during low-traffic periods.
 *
 * The scheduled cron fires in every isolate that handles it concurrently. To
 * avoid a thundering-herd of real DeepL translation requests (one full warm
 * per isolate every cron tick), warming is gated by a leader lock stored in KV:
 * a given warm run only proceeds if it can acquire the lock, and the lock is
 * held for the warm interval so overlapping cron triggers across isolates
 * skip. KV has its own TTL, so the lock clears even if a holder dies mid-run.
 */

import {
  generateCacheKey,
  getCachedTranslation,
  setCachedTranslation,
} from "./cache";
import { query } from "./query";
import { logger } from "./logger";

/**
 * Popular translation pairs that benefit from caching
 */
const POPULAR_TRANSLATIONS = [
  // Common greetings
  { text: "Hello", source_lang: "en", target_lang: "zh" },
  { text: "Thank you", source_lang: "en", target_lang: "ja" },
  { text: "Good morning", source_lang: "en", target_lang: "es" },
  { text: "How are you?", source_lang: "en", target_lang: "fr" },
  { text: "Goodbye", source_lang: "en", target_lang: "de" },

  // Technical terms
  { text: "Artificial Intelligence", source_lang: "en", target_lang: "zh" },
  { text: "Machine Learning", source_lang: "en", target_lang: "ja" },
  { text: "Cloud Computing", source_lang: "en", target_lang: "ko" },

  // Business phrases
  { text: "Please find attached", source_lang: "en", target_lang: "zh" },
  {
    text: "Looking forward to hearing from you",
    source_lang: "en",
    target_lang: "es",
  },
];

/** Minimum interval between warm runs, in milliseconds. */
const WARM_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

/** KV key used as the cross-isolate leader lock for cache warming. */
const WARM_LOCK_KEY = "_cache_warmer_lock";

/**
 * Track the last cache warming time (per-isolate, informational only).
 */
let lastWarmed: string | null = null;

/**
 * Try to acquire the cross-isolate cache-warming leader lock from KV.
 *
 * We read the current lock value; if it exists and is still fresh (younger than
 * WARM_INTERVAL_MS), another isolate owns the warm right now and we skip. If it
 * is stale or absent we write our claim. This is a best-effort fence: KV is
 * eventually consistent, so two isolates that read "no lock" at the same instant
 * could both proceed — but the window is one cron tick and the cost is at most a
 * duplicated warm, far better than the previous behavior of every isolate warming
 * unconditionally every run. The held time is bounded by the KV TTL.
 * @returns true if this caller should perform the warm
 */
async function acquireWarmLock(env: any): Promise<boolean> {
  if (!env?.CACHE_KV) {
    return false; // Nothing we can do without KV
  }

  try {
    const existing = await env.CACHE_KV.get(WARM_LOCK_KEY, "json");
    if (existing && typeof existing === "object") {
      const age = Date.now() - (existing as { timestamp: number }).timestamp;
      if (age < WARM_INTERVAL_MS) {
        return false; // Another isolate warmed recently
      }
    }
  } catch {
    // KV read failed: be conservative and skip this tick rather than risk
    // stampeding the proxies. The next cron tick will retry.
    return false;
  }

  try {
    await env.CACHE_KV.put(
      WARM_LOCK_KEY,
      JSON.stringify({ timestamp: Date.now() }),
      { expirationTtl: Math.ceil(WARM_INTERVAL_MS / 1000) }
    );
  } catch {
    // Lock write failed; proceed anyway since we already decided to warm.
  }
  return true;
}

/**
 * Warm cache with popular translations using DeepL.
 *
 * Should be called during scheduled maintenance. Returns skipped=true when
 * another isolate owns the warm lock for this interval.
 */
export async function warmCache(env: any): Promise<{
  warmed: number;
  failed: number;
  errors: string[];
  skipped: boolean;
}> {
  const results = {
    warmed: 0,
    failed: 0,
    errors: [] as string[],
    skipped: false,
  };

  const acquired = await acquireWarmLock(env);
  if (!acquired) {
    results.skipped = true;
    logger.info(env, "Cache warming skipped (lock held or unavailable)");
    return results;
  }

  for (const translation of POPULAR_TRANSLATIONS) {
    try {
      const cacheKey = await generateCacheKey(
        translation.text,
        translation.source_lang,
        translation.target_lang,
        "deepl"
      );

      // Check if already cached
      const existing = await getCachedTranslation(cacheKey, env);
      if (existing) {
        continue; // Skip if already cached
      }

      // Translate and cache using DeepL
      const result = await query(
        {
          text: translation.text,
          source_lang: translation.source_lang,
          target_lang: translation.target_lang,
        },
        { env, clientIP: "cache-warmer" }
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
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      results.failed++;
      results.errors.push(
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  lastWarmed = new Date().toISOString();
  logger.info(env, "Cache warming completed", {
    metadata: {
      warmed: results.warmed,
      failed: results.failed,
      skipped: results.skipped,
    },
  });

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
    lastWarmed,
  };
}
