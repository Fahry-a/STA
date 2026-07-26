# AGENTS.md

## What this is

**STA** (Serverless Translation API) — a production-grade, free translation proxy running on Cloudflare Workers. Fork of [DeepLX](https://github.com/xixu-me/DeepLX), rebranded and hardened.

**Stack:** Hono v4 (HTTP framework) · TypeScript 7 (strict mode) · Cloudflare Workers (V8 isolates) · Jest 30 + SWC (tests) · Bun (package manager & CI)

**What it does:** Intercepts DeepL's internal JSONRPC API (`www2.deepl.com/jsonrpc`) and Google Translate's internal API (`translate.google.com/translate_a/single`) through a network of XDPL proxy endpoints, with load balancing, rate limiting, and two-level caching.

---

## Essential commands

| Command | Purpose | Notes |
|---------|---------|-------|
| `bun run lint` | Type check only | `tsc --noEmit` — **no ESLint configured** |
| `bun run test` | Run all tests | Jest 30 + `@swc/jest`, 30s timeout |
| `bun run test:unit` | Unit tests only | `tests/lib/` directory |
| `bun run test:integration` | Integration tests | `tests/integration/` directory |
| `bun run test:performance` | Performance tests | `tests/performance/` directory |
| `bun run test:coverage` | Tests with coverage | Uses `collectCoverageFrom` config |
| `bun run test:endpoints` | Test all API endpoints | `scripts/test-endpoints.mjs` — comprehensive endpoint smoke test |
| `bun run dev` | Local dev server | `wrangler dev` with `.dev.vars` |
| `bun run start` | Local dev server | Alias for `bun run dev` |
| `bun run deploy` | Deploy to production | `wrangler deploy` to Cloudflare |
| `bun run cf-typegen` | Regenerate CF types | Updates `worker-configuration.d.ts` |

**CI pipeline order:**
```
bun install --frozen-lockfile
  → verify bun.lock unchanged
    → bun run lint (tsc --noEmit)
      → bun run test (jest)
```

---

## Project structure

```
src/
├── index.ts                    # Entry point — Hono router, all routes, cron handler
├── types/
│   └── global.d.ts             # Global type declarations (Env, CacheEntry, etc.)
└── lib/
    ├── index.ts                # Barrel export (re-exports from all modules)
    ├── config.ts               # All tunable constants (timeout, rate limits, payload limits)
    ├── const.ts                # Immutable values (API_URL, REQUEST_ALTERNATIVES)
    ├── types.ts                # Core types + response factory functions
    ├── env.ts                  # Environment validation utilities
    ├── query.ts                # DeepL JSONRPC translation engine (core)
    ├── services/
    │   └── googleTranslate.ts  # Google Translate integration
    ├── v2Translate.ts          # V2 batch translation (APR mode)
    ├── v2Validation.ts         # V2 request validation
    ├── validation.ts           # V1 request validation
    ├── cache.ts                # Two-level cache (LRU memory + Cloudflare KV)
    ├── cacheWarmer.ts          # Pre-populate cache with popular translations
    ├── rateLimit.ts            # Token bucket rate limiting (dual-level)
    ├── slidingWindowRateLimit.ts # Sliding window burst protection
    ├── proxyManager.ts         # Proxy selection, health tracking, fingerprinting
    ├── retryLogic.ts           # Exponential backoff with jitter
    ├── errorHandler.ts         # Error processing, sanitization, responses
    ├── security.ts             # Security headers, CORS, IP validation, admin auth
    ├── securityConfig.ts       # Security configuration constants
    ├── logger.ts               # Structured logging → Analytics Engine
    ├── metrics.ts              # System metrics collection
    ├── performance.ts          # Per-request performance tracking
    ├── healthCheck.ts          # Comprehensive health status checks
    └── textUtils.ts            # Payload size estimation and validation

tests/
├── setup.ts                    # Jest global setup, mock factories, custom matchers
├── utils/
│   └── testHelpers.ts          # Shared mock utilities
├── lib/                        # Unit tests (one per module)
│   ├── cache.test.ts
│   ├── query.test.ts
│   ├── rateLimit.test.ts
│   ├── security.test.ts
│   ├── v2Translate.test.ts
│   ├── services/
│   │   └── googleTranslate.test.ts
│   └── ...
├── integration/                # End-to-end integration tests
│   ├── translation.test.ts
│   └── multiProvider.test.ts
└── performance/                # Load and stress tests
    └── load.test.ts

docs/
├── api.md                      # Human-readable API documentation
└── openapi.yaml                # OpenAPI 3.0.3 spec

scripts/
└── test-endpoints.mjs          # Endpoint smoke test (50+ cases across all routes)
```

---

## Architecture

### Request flow

```
HTTP Request → Hono Router
  → CORS preflight check (OPTIONS)
  → Security headers middleware
  → Content-Type validation (415 if not application/json)
  → Content-Length check (413 if > 32KB)
  → JSON body parse
  → Input validation (structure, text length, language codes)
  → Rate limiting (token bucket: per-client + per-proxy)
  → Cache lookup (LRU memory → Cloudflare KV)
    → Cache hit: return immediately
    → Cache miss:
      → Proxy manager selects endpoint (weighted random by health)
      → Build DeepL JSONRPC request (with fingerprint rotation)
      → Send with retry (exponential backoff, max 3 retries)
      → Record proxy health (success/failure)
      → Store in cache (memory + KV)
  → Return response
```

### Translation providers

| Provider | Endpoint | Method | Notes |
|----------|----------|--------|-------|
| DeepL | `POST /deepl` | JSONRPC to `www2.deepl.com/jsonrpc` | Via proxy rotation |
| Google | `POST /google` | GET to `translate.google.com/translate_a/single` | Direct, `client=gtx` |
| Legacy | `POST /translate` | Same as `/deepl` | Backward compatibility |
| V2 Batch | `POST /v2/translate` | DeepL with APR support | Array Per Request mode |
| Debug | `POST /debug` | Generates DeepL request body | Requires `DEBUG_MODE=true` |

### Caching

Two-level cache with automatic promotion:

1. **In-memory LRU** — Doubly-linked list, O(1) get/set/evict, max 1000 entries
2. **Cloudflare KV** — Persistent, 1-hour TTL, promoted to memory on hit

Cache key: SHA-256 of `text:source_lang:target_lang:provider`. Scheduled cron does gradual TTL-based eviction (not full wipe).

### Rate limiting

Token bucket algorithm, dual-level:

- **Per-client IP** — Dynamic limit: `proxy_count × 8 × 60` tokens/minute
- **Per-proxy endpoint** — 8 tokens/sec, 16 burst capacity

Two-tier storage: in-memory (5s TTL) + KV (1h TTL). Sliding window sub-check for burst protection at window boundaries.

### Proxy management

- Weighted random selection (response time EMA + success rate)
- Health tracking: 3 consecutive failures → unhealthy (30s cooldown)
- Browser fingerprint rotation: 5 User-Agents × 5 Accept-Language variants
- Automatic failover when all proxies unhealthy

---

## Key conventions

### Code style

- **2 spaces** indentation, **single quotes**, **trailing commas**
- Lines under 100 characters
- Explicit type annotations on function parameters and returns
- No `any` in production code (use proper types or `unknown`)
- JSDoc comments on public functions

### TypeScript

- **Strict mode** enabled
- **Target:** ES2020
- **Module:** ESNext with bundler resolution
- **Lib:** ES2020 + WebWorker (Cloudflare Workers runtime, **not Node.js**)
- **`noEmit: true`** — TypeScript is for type-checking only; Wrangler handles bundling via esbuild
- **Path alias:** `@/` → `src/` (configured in jest `moduleNameMapper`)

### Testing

- **Runner:** Jest 30 with `@swc/jest` (SWC transform, not ts-jest — much faster)
- **Timeout:** 30 seconds per test
- **Setup:** `tests/setup.ts` — `createMockEnv()` on `globalThis`, custom matchers
- **Mocking:** `jest.fn()` extensively; global `fetch` is mocked in most test files
- **Coverage:** Excludes `*.d.ts` and `index.ts` barrel files
- **Three tiers:** unit (`tests/lib/`), integration (`tests/integration/`), performance (`tests/performance/`)

### Package management

- **Bun** is the package manager (not npm/yarn/pnpm)
- CI verifies `bun.lock` is unchanged after install (`git diff --exit-code -- bun.lock`)
- `esbuild` pinned to `0.28.1` via `package.json` overrides to avoid compatibility issues

---

## Environment & secrets

### Secrets (set via `wrangler secret put` or `.dev.vars`)

| Secret | Purpose | Format |
|--------|---------|--------|
| `PROXY_URLS` | XDPL proxy endpoints | Comma-separated URLs, **must include `/jsonrpc` path** |
| `ADMIN_API_KEY` | Admin endpoint auth | Random string, protects `/metrics` and `/admin/*` |

**Example `PROXY_URLS`:**
```
https://proxy0.example.com/jsonrpc,https://proxy1.example.com/jsonrpc
```

### Cloudflare bindings (in `wrangler.jsonc`)

| Binding | Type | Purpose |
|---------|------|---------|
| `CACHE_KV` | KV namespace | Translation cache (1h TTL) |
| `RATE_LIMIT_KV` | KV namespace | Rate limit state persistence |
| `ANALYTICS` | Analytics Engine | Structured logging & metrics |

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `DEBUG_MODE` | `"false"` | Enables `POST /debug` endpoint when `"true"` |

### Local development

1. Copy `.dev.vars.example` to `.dev.vars`
2. Fill in `PROXY_URLS` (with `/jsonrpc` paths) and `ADMIN_API_KEY`
3. Run `bun run dev` — starts `wrangler dev`

---

## Gotchas & operational notes

### Configuration

- `PROXY_URLS` entries need the full path (e.g. `https://proxy0.example.com/jsonrpc`), not just the host. Without `/jsonrpc`, requests return 404.
- Cron runs every 10 minutes (`*/10 * * * *`). It does gradual TTL-based cache eviction + cache warming with popular translations.
- Debug endpoint (`/debug`) is disabled unless `DEBUG_MODE` env var is set to `"true"`, `"1"`, `"yes"`, or `"on"`.

### Security

- Health check at `/health` exposes internal stats (proxy health, cache size) — **no auth required**. Consider restricting in production.
- Admin endpoints fail-closed: if `ADMIN_API_KEY` is unset, all admin requests return 401.
- Rate limiting uses fail-closed behavior (rejects on KV failure) via `FAIL_SAFE_ON_ERROR` in `securityConfig.ts`.
- CORS is set to `*` — consider restricting for production use.

### Types

- Global types (`Env`, `CacheEntry`, `RateLimitEntry`, `ProxyEndpoint`) are declared in `src/types/global.d.ts` and mirrored in `worker-configuration.d.ts`.
- Don't redeclare these locally — it will cause type drift.
- Run `bun run cf-typegen` after changing `wrangler.jsonc` bindings.

### Testing

- Tests run with `bun run test` (uses Jest via bun). `bun test` (native) may not process `setupFilesAfterEnv` correctly — prefer `bun run test`.
- `createMockEnv()` is set on `globalThis` in `tests/setup.ts`. If tests can't find it, check the setup file is loaded.
- `collectCoverageFrom` excludes barrel files (`src/**/index.ts`) and type declarations (`*.d.ts`).

### Performance

- LRU cache uses a doubly-linked list for O(1) promotion (not Map re-insertion).
- SHA-256 cache key generation is async (`crypto.subtle.digest`) — runs on every request.
- Proxy selection uses weighted random (not round-robin) to naturally favor healthy endpoints.

---

## Deploy flow

```
Push to main / PR
  → CI workflow: install → lockfile check → lint → test
    → Deploy workflow (auto-triggered after CI succeeds on main)
      → Re-run lint + test (belt-and-suspenders)
      → Inject PROXY_URLS and ADMIN_API_KEY secrets
      → wrangler deploy
```

- Deploy has a **non-cancelling** concurrency group for production safety.
- Deploy only runs on the default branch after CI succeeds.
- Manual dispatch available via `workflow_dispatch`.
