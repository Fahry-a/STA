/**
 * Cloudflare Workers Environment Bindings for STA
 *
 * Hand-maintained lightweight types. This mirrors the structure emitted by
 * `wrangler types` (re-runnable via `bun run cf-typegen`) but stays small so
 * the repo doesn't carry the full ~500KB bundled workerd runtime typings.
 *
 * The expanded bindings are also defined as global interfaces in
 * src/types/global.d.ts (Env, CacheEntry, ProxyEndpoint, RateLimitEntry); this
 * file is kept so the bindings resolve identically whether or not someone has
 * regenerated it. If you change wrangler.jsonc bindings, regenerate with
 * `bun run cf-typegen` and commit the new file (or update it here by hand).
 */
interface Env {
  /** KV namespace for translation caching */
  CACHE_KV: KVNamespace;

  /** KV namespace for rate limiting data */
  RATE_LIMIT_KV: KVNamespace;

  /** Analytics Engine dataset for metrics collection */
  ANALYTICS: AnalyticsEngineDataset;

  /** Comma-separated list of proxy endpoints (optional) */
  PROXY_URLS?: string;

  /** Enables the /debug endpoint only when set to an explicit truthy value */
  DEBUG_MODE?: string;

  /** Admin API key for protected endpoints (/metrics, /admin/*).
   * Required at runtime: set with `wrangler secret put ADMIN_API_KEY`.
   * When unset or empty, admin endpoints fail-closed. */
  ADMIN_API_KEY?: string;
}
