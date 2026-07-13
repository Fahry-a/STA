/**
 * Cache Warming Module
 * Pre-populates cache with popular translations during low-traffic periods
 */

import {
  generateCacheKey,
  getCachedTranslation,
  setCachedTranslation,
} from "./cache";
import { translateWithGoogle } from "./services/googleTranslate";
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

/**
 * Track the last cache warming time
 */
let lastWarmed: string | null = null;

/**
 * Warm cache with popular translations using DeepL
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
    metadata: { warmed: results.warmed, failed: results.failed },
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
