# STA API Documentation

## Base URL
```
https://sta.oryn.my.id
```

## Authentication

| Endpoint | Auth Required |
|----------|--------------|
| Translation endpoints (`/deepl`, `/google`, `/translate`, `/v2/translate`) | No |
| Health endpoints (`/health`, `/health/live`, `/health/ready`) | No |
| Admin endpoints (`/metrics`, `/admin/*`) | Yes — `X-API-Key` header |

## Translation Endpoints

### POST /deepl
Translate text using DeepL's neural machine translation.

**Request:**
```bash
curl -X POST https://sta.oryn.my.id/deepl \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, world!", "source_lang": "EN", "target_lang": "ZH"}'
```

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Text to translate (max 5000 chars) |
| `source_lang` | string | No | Source language code (auto-detected if omitted) |
| `target_lang` | string | No | Target language code (default: `EN`) |

**Response:**
```json
{
  "code": 200,
  "data": "你好，世界！",
  "id": 1234567890,
  "source_lang": "EN",
  "target_lang": "ZH"
}
```

### POST /google
Translate text using Google Translate. Same request/response format as `/deepl`.

**Request:**
```bash
curl -X POST https://sta.oryn.my.id/google \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, world!", "target_lang": "JA"}'
```

### POST /translate
Legacy endpoint — equivalent to `/deepl`. Kept for backward compatibility.

**Request:**
```bash
curl -X POST https://sta.oryn.my.id/translate \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, world!", "target_lang": "DE"}'
```

### GET /translate, GET /deepl, GET /google
Returns `"Please use POST method :)"` — informational only.

---

## V2 Batch Translation

### POST /v2/translate
Batch translate multiple texts using DeepL with APR (Array Per Request) support.

**Request:**
```bash
curl -X POST https://sta.oryn.my.id/v2/translate \
  -H "Content-Type: application/json" \
  -d '{
    "text": ["Hello, world!", "How are you?", "Goodbye!"],
    "target_lang": "DE",
    "APR": true
  }'
```

**Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string[] | Yes | Array of texts to translate (max 10 items) |
| `target_lang` | string | Yes | Target language code |
| `APR` | boolean \| string | No | Array Per Request mode (default: `true`). Accepts boolean or string `"true"`/`"false"`. |
| `source_lang` | string | No | Source language code |

**APR Modes:**
- `APR: true` (default) — each item sent as a **separate** DeepL request. Max 10 items, 5000 chars each.
- `APR: false` — all items **combined** into a single request with `\n` separators. 5000 chars total.

**Response (all success):**
```json
{
  "code": 200,
  "apr": true,
  "data": [
    { "text": "Hallo, Welt!", "index": 0, "detected_source_lang": "EN", "success": true },
    { "text": "Wie geht es dir?", "index": 1, "detected_source_lang": "EN", "success": true },
    { "text": "Auf Wiedersehen!", "index": 2, "detected_source_lang": "EN", "success": true }
  ],
  "id": 1234567890
}
```

**Response (partial failure):**
```json
{
  "code": 207,
  "apr": true,
  "data": [
    { "text": "Hallo, Welt!", "index": 0, "detected_source_lang": "EN", "success": true },
    { "text": "", "index": 1, "success": false, "error": "Translation failed with code 429" }
  ],
  "id": 1234567890
}
```

The `apr` field mirrors the mode actually applied. It is always a concrete boolean.

---

## Debug Endpoint

### POST /debug
Validate request format and inspect generated DeepL request body. **Disabled by default** — requires `DEBUG_MODE=true` env var. Returns 404 when disabled.

**Request:**
```bash
curl -X POST https://sta.oryn.my.id/debug \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, world!", "source_lang": "EN", "target_lang": "ZH"}'
```

**Response (when enabled):**
```json
{
  "code": 200,
  "data": "{\"status\":\"Request format is valid\",\"validation\":{\"text_length\":13,\"has_source_lang\":true,\"has_target_lang\":true,\"request_id\":1234567890,\"has_timestamp\":true,\"method_format\":\"normal\",\"normalized_source_lang\":\"en\",\"normalized_target_lang\":\"zh\"}}",
  "id": 1234567890,
  "source_lang": "AUTO",
  "target_lang": "EN"
}
```

---

## Health Endpoints

### GET /health
Comprehensive health status of all service components.

**Request:**
```bash
curl https://sta.oryn.my.id/health
```

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "checks": {
    "proxies": { "status": "healthy", "message": "20/21 proxies healthy" },
    "cache": { "status": "healthy", "message": "Cache KV is accessible" },
    "rateLimit": { "status": "healthy", "message": "Rate limiter is operational" },
    "performance": { "status": "healthy", "message": "Success rate: 98.5%" }
  }
}
```

Returns `503` when `status` is `"unhealthy"`.

### GET /health/live
Simple liveness check (Kubernetes-style).

**Request:**
```bash
curl https://sta.oryn.my.id/health/live
```

**Response:**
```json
{ "status": "alive", "timestamp": "2024-01-15T10:30:00Z" }
```

### GET /health/ready
Readiness check — returns whether the service can handle requests.

**Request:**
```bash
curl https://sta.oryn.my.id/health/ready
```

**Response (200):**
```json
{ "ready": true, "status": "healthy", "timestamp": "2024-01-15T10:30:00Z" }
```

Returns `503` when `ready` is `false`.

---

## Admin Endpoints

All admin endpoints require the `X-API-Key` header. Returns `401` if missing or invalid.

### GET /metrics
Get performance and operational metrics.

**Request:**
```bash
curl -H "X-API-Key: YOUR_API_KEY" https://sta.oryn.my.id/metrics
```

**Response:**
```json
{
  "code": 200,
  "data": {
    "timestamp": "2024-01-15T10:30:00Z",
    "uptime": 86400,
    "performance": null,
    "proxy": {
      "totalEndpoints": 21,
      "healthyEndpoints": 20,
      "unhealthyEndpoints": 1,
      "endpoints": [...]
    },
    "cache": { "memoryCacheSize": 150 }
  }
}
```

### POST /admin/warm-cache
Manually trigger cache warming with popular translations.

**Request:**
```bash
curl -X POST -H "X-API-Key: YOUR_API_KEY" https://sta.oryn.my.id/admin/warm-cache
```

**Response:**
```json
{
  "code": 200,
  "data": { "warmed": 10, "failed": 0, "skipped": 0 },
  "message": "Cache warming completed: 10 warmed, 0 failed"
}
```

### GET /admin/cache-status
Get cache warming status.

**Request:**
```bash
curl -H "X-API-Key: YOUR_API_KEY" https://sta.oryn.my.id/admin/cache-status
```

**Response:**
```json
{
  "code": 200,
  "data": { "lastWarmTime": 1705312200000, "warmedCount": 10 }
}
```

---

## Rate Limiting

Dual-level token bucket: per-client IP + per-proxy endpoint.

| Level | Limit | Window |
|-------|-------|--------|
| Per-client | `proxy_count × 8 × 60` tokens | 1 minute |
| Per-proxy | 8 tokens/sec, 16 burst | per second |

Rate limiting is enforced on **every** request including cache hits.

---

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 207 | Partial success (V2 batch — some translations failed) |
| 400 | Invalid request (bad JSON, missing fields, validation error) |
| 408 | Request timeout (upstream proxy did not respond in time) |
| 413 | Payload too large (text exceeds 5000 chars or body > 32KB) |
| 415 | Unsupported Media Type (Content-Type must be `application/json`) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Service unavailable (health check failed) |

---

## Supported Languages

| Code | Language |
|------|----------|
| EN | English |
| ZH | Chinese |
| JA | Japanese |
| ES | Spanish |
| FR | French |
| DE | German |
| IT | Italian |
| PT | Portuguese |
| RU | Russian |
| NL | Dutch |
| PL | Polish |
| ... | [View all DeepL languages](https://developers.deepl.com/docs/resources/supported-languages) |

Google Translate supports 100+ languages. Source language is auto-detected when omitted.
