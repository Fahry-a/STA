/**
 * Structured logging module for STA
 * Integrates with Cloudflare Analytics Engine for persistent metrics
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

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
 * Falls back to console output when Analytics Engine is unavailable
 */
export function writeLog(env: any, entry: LogEntry): void {
  // Always emit to console for Cloudflare Workers observability
  const consoleMsg = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;
  if (entry.level === "error") {
    console.error(consoleMsg, entry.metadata || "");
  } else if (entry.level === "warn") {
    console.warn(consoleMsg, entry.metadata || "");
  } else {
    console.log(consoleMsg, entry.metadata || "");
  }

  // Attempt to persist to Analytics Engine when available
  try {
    if (env && env.ANALYTICS && typeof env.ANALYTICS.writeDataPoint === "function") {
      env.ANALYTICS.writeDataPoint({
        blobs: [
          entry.timestamp,
          entry.level,
          entry.message,
          entry.requestId || "",
          entry.endpoint || "",
          entry.clientIP || "",
          entry.proxyUrl || "",
        ],
        doubles: [
          entry.duration || 0,
          entry.cacheHit ? 1 : 0,
        ],
        indexes: [entry.level],
      });
    }
  } catch (error) {
    // Analytics write failed, already logged to console above
    console.error("Analytics write failed:", error);
  }
}

/**
 * Convenience logging functions
 */
export const logger = {
  info: (env: any, message: string, context?: Partial<LogEntry>) => {
    const entry = createLogEntry("info", message, context);
    writeLog(env, entry);
  },
  warn: (env: any, message: string, context?: Partial<LogEntry>) => {
    const entry = createLogEntry("warn", message, context);
    writeLog(env, entry);
  },
  error: (env: any, message: string, context?: Partial<LogEntry>) => {
    const entry = createLogEntry("error", message, context);
    writeLog(env, entry);
  },
  debug: (env: any, message: string, context?: Partial<LogEntry>) => {
    const entry = createLogEntry("debug", message, context);
    writeLog(env, entry);
  },
};
