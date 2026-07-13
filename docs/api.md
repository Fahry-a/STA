# DeepLX API Documentation

## Base URL
```
https://deeplx.oryn.my.id
```

## Authentication
No authentication required for translation endpoints.
Admin endpoints require `X-API-Key` header.

## Endpoints

### POST /deepl
Translate text using DeepL's neural machine translation.

**Request Body:**
```json
{
  "text": "Hello, world!",
  "source_lang": "EN",
  "target_lang": "ZH"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Text to translate (max 5000 chars) |
| `source_lang` | string | No | Source language code (auto-detected if omitted) |
| `target_lang` | string | Yes | Target language code |

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
Translate text using Google Translate.

**Request Body:** Same as `/deepl`

**Response:** Same format as `/deepl`

### POST /v2/translate
Batch translate multiple texts using DeepL with APR (Array Per Request) support.

**Request Body:**
```json
{
  "text": ["Hello, world!", "How are you?", "Goodbye!"],
  "APR": true,
  "source_lang": "EN",
  "target_lang": "DE"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string[] | Yes | Array of texts (max 10 items) |
| `APR` | boolean | No | Array Per Request (default: true) |
| `source_lang` | string | No | Source language code |
| `target_lang` | string | Yes | Target language code |

**APR Behavior:**
- `APR: true` (default): Each array item is sent as a **separate** DeepL request (max 10 items, 5000 chars each).
- `APR: false`: All array items are **combined** into a single request with `\n` separators (5000 chars total).

**Response:**
```json
{
  "code": 200,
  "data": [
    { "text": "Hallo, Welt!", "index": 0, "detected_source_lang": "EN", "success": true },
    { "text": "Wie geht es dir?", "index": 1, "detected_source_lang": "EN", "success": true },
    { "text": "Auf Wiedersehen!", "index": 2, "detected_source_lang": "EN", "success": true }
  ],
  "id": 1234567890
}
```

### GET /health
Check service health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "uptime": 86400,
  "checks": {
    "proxies": { "status": "healthy", "message": "20/21 proxies healthy" },
    "cache": { "status": "healthy", "message": "Cache KV is accessible" },
    "rateLimit": { "status": "healthy", "message": "Rate limiter is operational" },
    "performance": { "status": "healthy", "message": "Success rate: 98.5%" }
  }
}
```

### GET /metrics
Get performance metrics. Requires `X-API-Key` header.

**Response:**
```json
{
  "code": 200,
  "data": {
    "timestamp": "2024-01-15T10:30:00Z",
    "uptime": 86400,
    "performance": { ... },
    "proxy": { "totalEndpoints": 21, "healthyEndpoints": 20, "unhealthyEndpoints": 1 },
    "cache": { "memoryCacheSize": 150 },
    "rateLimit": { "activeClients": 0 }
  },
  "id": 1234567890
}
```

### POST /admin/warm-cache
Manually trigger cache warming. Requires `X-API-Key` header.

### GET /admin/cache-status
Get cache warming status. Requires `X-API-Key` header.

## Rate Limiting

| Client Type | Limit | Window |
|-------------|-------|--------|
| Standard | 480 requests | 1 minute |
| Per Proxy | 8 requests | 1 second |

**Rate Limit Headers:**
- `X-RateLimit-Limit`: Maximum requests per window
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Seconds until reset

## Supported Languages

| Code | Language |
|------|----------|
| EN | English |
| ZH | Chinese |
| JA | Japanese |
| ES | Spanish |
| FR | French |
| DE | German |
| ... | [View all](https://developers.deepl.com/docs/resources/supported-languages) |

## Error Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 207 | Partial success (V2 batch - some translations failed) |
| 400 | Invalid request |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Service unavailable |
