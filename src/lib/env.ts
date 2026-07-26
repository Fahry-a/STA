/**
 * Environment validation utilities for STA
 * Validates required bindings and environment variables
 */

/**
 * Validate required environment bindings and variables
 * Ensures all necessary Cloudflare Workers bindings are available
 * @param env The environment object to validate
 * @returns Array of error messages (empty if validation passes)
 */
export function validateEnvironment(env: Env): string[] {
  const errors: string[] = [];

  if (!env.CACHE_KV) {
    errors.push("CACHE_KV binding is required");
  }

  if (!env.RATE_LIMIT_KV) {
    errors.push("RATE_LIMIT_KV binding is required");
  }

  // Optional environment variables are handled gracefully
  // PROXY_URLS is not required but recommended for production use

  return errors;
}
