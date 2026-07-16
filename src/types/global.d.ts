// Global type definitions for STA

declare global {
  interface Env {
    CACHE_KV: KVNamespace;
    RATE_LIMIT_KV: KVNamespace;
    ANALYTICS: AnalyticsEngineDataset;
    PROXY_URLS?: string;
    /** Admin API key for protected endpoints (/metrics, /admin/*). Required at
     * runtime: set via `wrangler secret put ADMIN_API_KEY`. When unset or empty,
     * admin endpoints fail-closed (reject every request). */
    ADMIN_API_KEY?: string;
    DEBUG_MODE?: string; // Added for debug endpoint control
  }

  /** Cache entry structure for translation storage. */
  interface CacheEntry {
    /** Translated text content */
    data: string;
    /** Timestamp when translation was cached */
    timestamp: number;
    /** Source language code (uppercase) */
    source_lang: string;
    /** Target language code (uppercase) */
    target_lang: string;
    /** Optional unique request identifier */
    id?: number;
  }

  /** Rate limiting entry structure for the token bucket algorithm. */
  interface RateLimitEntry {
    /** Current number of available tokens */
    tokens: number;
    /** Timestamp of last token refill */
    lastRefill: number;
  }

  /** Proxy endpoint configuration. */
  interface ProxyEndpoint {
    /** Proxy URL endpoint */
    url: string;
  }

  interface ScheduledEvent {
    readonly cron: string;
    readonly scheduledTime: number;
    readonly type: "scheduled";
    waitUntil(promise: Promise<any>): void;
  }

  interface ExecutionContext {
    waitUntil(promise: Promise<any>): void;
    passThroughOnException(): void;
  }
}

// Additional Worker types that might be missing
declare const AbortController: {
  prototype: AbortController;
  new (): AbortController;
};

declare interface AbortController {
  readonly signal: AbortSignal;
  abort(): void;
}

declare const AbortSignal: {
  prototype: AbortSignal;
  new (): AbortSignal;
  abort(): AbortSignal;
  timeout(milliseconds: number): AbortSignal;
};

declare interface AbortSignal extends EventTarget {
  readonly aborted: boolean;
  readonly reason: any;
  addEventListener(
    type: "abort",
    listener: (this: AbortSignal, ev: Event) => any,
    options?: boolean | AddEventListenerOptions
  ): void;
  removeEventListener(
    type: "abort",
    listener: (this: AbortSignal, ev: Event) => any,
    options?: boolean | EventListenerOptions
  ): void;
}

export {};
