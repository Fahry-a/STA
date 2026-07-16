/**
 * Security middleware for STA API
 * Provides security headers, CORS configuration, and request sanitization
 */

/**
 * Security headers configuration
 */
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'none'; object-src 'none';",
};

/**
 * CORS configuration
 */
const CORS_CONFIG = {
  "Access-Control-Allow-Origin": "*", // Consider restricting in production
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

/**
 * Add security headers to response
 * @param response The response object to modify
 * @returns Modified response with security headers
 */
export function addSecurityHeaders(response: any): any {
  const newHeaders = new Map(response.headers);

  // Add security headers
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  // Add CORS headers for API endpoints
  Object.entries(CORS_CONFIG).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  return {
    ...response,
    headers: newHeaders,
  };
}

/**
 * Handle CORS preflight requests
 * @param c Hono context
 * @returns CORS preflight response
 */
export function handleCORSPreflight(c: any) {
  return c.text("", 200, CORS_CONFIG);
}

/**
 * Validate language codes
 * @param langCode The language code to validate
 * @returns Original language code if valid, or null if invalid
 */
export function validateLanguageCode(langCode: string): string | null {
  if (typeof langCode !== "string") {
    return null;
  }

  // Check if language code matches expected pattern (alphanumeric and hyphens only)
  const normalized = langCode.toLowerCase().trim();

  if (normalized.length < 2 || normalized.length > 5) {
    return null;
  }

  // Only allow valid language code characters
  if (!/^[a-z0-9-]+$/.test(normalized)) {
    return null;
  }

  return normalized;
}

/**
 * Rate limit by IP with enhanced security
 * @param request The incoming request
 * @returns Validated client IP or null if suspicious
 */
export function getSecureClientIP(request: any): string | null {
  // Get IP from Cloudflare headers first (most trusted)
  const cfIP = request.headers.get("CF-Connecting-IP");
  if (cfIP && isValidIP(cfIP)) {
    return cfIP;
  }

  // Fallback to X-Forwarded-For (less trusted)
  const forwardedFor = request.headers.get("X-Forwarded-For");
  if (forwardedFor) {
    const firstIP = forwardedFor.split(",")[0]?.trim();
    if (firstIP && isValidIP(firstIP)) {
      return firstIP;
    }
  }

  return null; // Return null for suspicious requests
}

/**
 * Basic IP address validation
 * @param ip The IP address to validate
 * @returns True if IP appears valid
 */
function isValidIP(ip: string): boolean {
  // Basic IPv4 and IPv6 validation. Accepts both fully-expanded and
  // compressed/compressed IPv6 (::-shorthand) since Cloudflare sends
  // compressed forms for many IPv6 clients.
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6Regex =
    /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|:([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{0,4}|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{0,4})$/;

  return ipv4Regex.test(ip) || ipv6Regex.test(ip);
}

/**
 * Constant-time string comparison to avoid timing side-channels on secrets.
 *
 * `a !== b` short-circuits on the first differing byte, leaking the secret
 * prefix through response timing. This compares lengths first and then XORs
 * every byte unconditionally, so the running time only depends on the string
 * lengths, not their contents. Length mismatch returns false early (length is
 * not itself a sensitive value here — the header the client sends is public).
 * @param a Client-supplied value (public)
 * @param b Secret to compare against
 * @returns true if the two strings are equal
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Verify a request's admin API key against the configured secret.
 * Fail-closed: if ADMIN_API_KEY is not configured (unset / empty), every
 * admin request is rejected so the endpoints cannot be bypassed by a missing
 * configuration. Comparison is constant-time.
 * @param provided The value of the X-API-Key header sent by the client
 * @param secret The configured ADMIN_API_KEY secret
 * @returns true if access is authorized
 */
export function isAdminAuthorized(
  provided: string | null | undefined,
  secret: string | undefined
): boolean {
  if (!secret || secret.length === 0) {
    return false;
  }
  if (!provided) {
    return false;
  }
  return timingSafeEqual(provided, secret);
}
