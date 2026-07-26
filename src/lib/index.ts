/**
 * STA Library Module Exports
 * Central export file for all STA library modules and utilities
 */

// Core functionality exports
export * from "./cache";
export * from "./errorHandler";
export * from "./logger";
export * from "./metrics";
export * from "./healthCheck";
export * from "./cacheWarmer";
export * from "./slidingWindowRateLimit";
export * from "./v2Validation";
export * from "./v2Translate";
export * from "./validation";
export {
  getProxyEndpoints,
  selectProxy,
  generateBrowserFingerprint,
  recordProxySuccess,
  recordProxyFailure,
  getProxyHealthStats,
} from "./proxyManager";
export * from "./rateLimit";
export * from "./retryLogic";
export * from "./textUtils";
export * from "./types";
export * from "./config";
export {
  SECURITY_HEADERS,
  getSecureClientIP,
  handleCORSPreflight,
  isAdminAuthorized,
  validateLanguageCode,
  timingSafeEqual,
} from "./security";
export { SECURITY_CONFIG } from "./securityConfig";
export { translateWithGoogle } from "./services/googleTranslate";
export {
  startPerformanceTracking,
  updatePerformanceMetrics,
  endPerformanceTracking,
  getPerformanceStats,
} from "./performance";

// Named exports for the main query functions
export { query, normalizeLanguageCode, buildRequestBody } from "./query";
