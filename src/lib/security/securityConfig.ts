/**
 * Security configuration for STA API
 * Centralizes all security-related settings and policies
 */

/**
 * Security policy configuration
 */
export const SECURITY_CONFIG = {
  // Input validation limits
  MAX_INPUT_LENGTH: 30000,

  // Rate limiting
  STRICT_RATE_LIMITING: true,
  // When true, rate-limit failures (KV down) are fail-open so legitimate users
  // aren't blocked during transient infrastructure issues. Set to false only
  // if abuse during outages is a greater concern than availability.
  FAIL_SAFE_ON_ERROR: true,

  // CORS settings
  CORS_ORIGINS: ["*"], // Restrict in production
  CORS_METHODS: ["GET", "POST", "OPTIONS"],
  CORS_HEADERS: ["Content-Type", "Authorization"],

  // Debug settings
  ENABLE_DEBUG_IN_PRODUCTION: false,
  SHOW_STACK_TRACES: false,
  LOG_CLIENT_IPS: true,

  // Headers
  SECURITY_HEADERS: {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Content-Security-Policy":
      "default-src 'self'; script-src 'none'; object-src 'none';",
  },
};
