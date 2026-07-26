# AGENTS.md

## What this is

STA — Serverless Translation API running on Cloudflare Workers. Fork of DeepLX, rebranded for production. Hono framework, TypeScript, dual translation providers (DeepL + Google).

## Essential commands

| Command | Purpose |
|---------|---------|
| `bun run lint` | Type check only (`tsc --noEmit`) — **no ESLint** |
| `bun run test` | Run all tests (Jest 30 + SWC) |
| `bun run test:unit` | Unit tests only (`tests/lib/`) |
| `bun run test:integration` | Integration tests (`tests/integration/`) |
| `bun run dev` | Local dev server (`wrangler dev`) |
| `bun run deploy` | Deploy to Cloudflare Workers |
| `bun run cf-typegen` | Regenerate Cloudflare Worker types |

**CI order:** `bun install --frozen-lockfile` → lockfile verify → `bun run lint` → `bun run test`

## Architecture

- **Entry point:** `src/index.ts` — Hono router, all route definitions, scheduled handler
- **Translation:** `src/lib/query.ts` (DeepL JSONRPC), `src/lib/services/googleTranslate.ts`
- **Caching:** `src/lib/cache.ts` — two-level: in-memory LRU (doubly-linked list, 1000 max) + Cloudflare KV (1h TTL)
- **Rate limiting:** `src/lib/rateLimit.ts` — token bucket, dual-level (in-memory 5s TTL + KV 1h), per-client + per-proxy
- **Proxy mgmt:** `src/lib/proxyManager.ts` — weighted random selection, health tracking, fingerprint rotation
- **Config:** `src/lib/config.ts` — all tunable constants centralized here

## Key conventions

- **Package manager:** Bun. CI verifies `bun.lock` is unchanged after install.
- **Test runner:** Jest 30 with `@swc/jest` (SWC transform, not ts-jest). 30s timeout.
- **Path alias:** `@/` maps to `src/` (configured in jest `moduleNameMapper`).
- **TypeScript:** Strict mode, ES2020 target, `noEmit: true` (Wrangler handles bundling).
- **No ESLint:** "Lint" means type-check only. Format with whatever editor default.
- **Runtime:** Cloudflare Workers (V8 isolates, not Node.js). `WebWorker` lib, not `Node`.

## Environment / secrets

Set via `wrangler secret put` (production) or `.dev.vars` (local):

- `PROXY_URLS` — comma-separated XDPL proxy endpoints (**must include `/jsonrpc` path**)
- `ADMIN_API_KEY` — protects `/metrics` and `/admin/*` endpoints

Cloudflare bindings in `wrangler.jsonc`:
- `CACHE_KV`, `RATE_LIMIT_KV` (KV namespaces)
- `ANALYTICS` (Analytics Engine)

## Gotchas

- `PROXY_URLS` entries need the full path (e.g. `https://proxy0.example.com/jsonrpc`), not just the host.
- Cron runs every 10 minutes (`*/10 * * * *`). It does gradual TTL-based cache eviction, not full wipe.
- Debug endpoint (`/debug`) is disabled unless `DEBUG_MODE` env var is set to a truthy value.
- Health check at `/health` exposes internal stats (proxy health, cache size) — no auth required.
- `esbuild` is pinned to `0.28.1` via `package.json` overrides to avoid compatibility issues.
- Global types (`Env`, `CacheEntry`, `RateLimitEntry`, `ProxyEndpoint`) are declared in `src/types/global.d.ts` and mirrored in `worker-configuration.d.ts`. Don't redeclare locally.

## Testing notes

- Test setup: `tests/setup.ts` — defines `createMockEnv()` on `globalThis`, custom matchers, mock factories.
- Three tiers: unit (`tests/lib/`), integration (`tests/integration/`), performance (`tests/performance/`).
- `collectCoverageFrom` excludes `*.d.ts` and `index.ts` barrel files.
- Tests use `jest.fn()` mocks extensively. Global `fetch` is mocked in most test files.

## Deploy flow

CI (on push to main / PR) → Deploy (auto-triggered after CI succeeds on main) → injects secrets → `wrangler deploy`. Non-cancelling concurrency group for production safety.
