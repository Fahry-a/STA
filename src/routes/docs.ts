const DOCS_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>STA API Documentation</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0f1117; --bg2: #1a1d28; --bg3: #232738;
    --fg: #e1e4ed; --fg2: #9ca0b0;
    --accent: #7c8aff; --accent2: #5a6bd6;
    --green: #4cd964; --red: #ff4757; --orange: #ff9f43;
    --border: #2d3140; --code-bg: #161922;
    --font: -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
    --mono: 'JetBrains Mono','Fira Code','SF Mono',Consolas,monospace;
  }
  body {
    font-family: var(--font); background: var(--bg); color: var(--fg);
    line-height: 1.7; display: flex; min-height: 100vh;
  }
  nav {
    width: 260px; position: fixed; top: 0; left: 0; bottom: 0;
    background: var(--bg2); border-right: 1px solid var(--border);
    padding: 24px 0; overflow-y: auto; z-index: 10;
  }
  nav h1 {
    font-size: 14px; font-weight: 700; letter-spacing: .5px;
    text-transform: uppercase; color: var(--accent);
    padding: 0 20px 16px; border-bottom: 1px solid var(--border);
    margin-bottom: 8px;
  }
  nav a {
    display: block; padding: 6px 20px; color: var(--fg2);
    text-decoration: none; font-size: 13px; transition: color .15s;
  }
  nav a:hover, nav a.active { color: var(--accent); }
  nav .group {
    font-size: 11px; font-weight: 600; text-transform: uppercase;
    letter-spacing: .8px; color: var(--fg2); padding: 16px 20px 4px;
    opacity: .5;
  }
  main {
    margin-left: 260px; flex: 1; max-width: 900px; padding: 48px 56px 80px;
  }
  h2 {
    font-size: 26px; font-weight: 700; margin: 40px 0 16px;
    padding-bottom: 8px; border-bottom: 1px solid var(--border);
  }
  h2:first-child { margin-top: 0; }
  h3 {
    font-size: 18px; font-weight: 600; margin: 28px 0 12px; color: var(--accent);
  }
  h4 {
    font-size: 14px; font-weight: 600; margin: 20px 0 8px; color: var(--fg);
  }
  p, li { color: var(--fg2); font-size: 14px; line-height: 1.8; margin-bottom: 8px; }
  ul, ol { padding-left: 20px; margin-bottom: 12px; }
  li { margin-bottom: 4px; }
  code {
    font-family: var(--mono); font-size: 13px;
    background: var(--code-bg); padding: 2px 6px; border-radius: 4px;
    color: var(--accent);
  }
  pre {
    background: var(--code-bg); border: 1px solid var(--border);
    border-radius: 8px; padding: 16px 20px; overflow-x: auto;
    margin: 12px 0 20px; font-size: 13px; line-height: 1.6;
  }
  pre code { background: none; padding: 0; border-radius: 0; color: var(--fg); }
  table {
    width: 100%; border-collapse: collapse; margin: 12px 0 20px;
    font-size: 13px;
  }
  th, td {
    text-align: left; padding: 8px 12px;
    border-bottom: 1px solid var(--border);
  }
  th { font-weight: 600; color: var(--fg); background: var(--bg2); }
  td { color: var(--fg2); }
  tr:hover td { background: var(--bg3); }
  .badge {
    display: inline-block; font-size: 11px; font-weight: 600;
    padding: 2px 8px; border-radius: 4px; margin-left: 6px;
    vertical-align: middle;
  }
  .badge.post { background: rgba(76, 217, 100, .15); color: var(--green); }
  .badge.get { background: rgba(124, 138, 255, .15); color: var(--accent); }
  .badge.auth { background: rgba(255, 159, 67, .15); color: var(--orange); }
  .badge.public { background: rgba(76, 217, 100, .1); color: var(--green); }
  .endpoint {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 8px; padding: 12px 16px; margin: 8px 0 16px;
    font-family: var(--mono); font-size: 13px; display: flex;
    align-items: center; gap: 10px;
  }
  .endpoint .method {
    font-weight: 700; font-size: 12px; text-transform: uppercase;
    padding: 2px 8px; border-radius: 4px;
  }
  .endpoint .method.post { background: rgba(76, 217, 100, .15); color: var(--green); }
  .endpoint .method.get { background: rgba(124, 138, 255, .15); color: var(--accent); }
  .endpoint .path { color: var(--fg); }
  .endpoint .desc { color: var(--fg2); font-family: var(--font); font-size: 12px; flex: 1; text-align: right; }
  .json-key { color: #7c8aff; }
  .json-string { color: #4cd964; }
  .json-number { color: #ff9f43; }
  .json-bool { color: #ff6b81; }
  .json-null { color: #9ca0b0; }
  .hljs-attr { color: #7c8aff; }
  .hljs-string { color: #4cd964; }
  .hljs-number { color: #ff9f43; }
  .hljs-literal { color: #ff6b81; }
  .hljs-keyword { color: #7c8aff; }
  .hljs-comment { color: #4a4f6a; font-style: italic; }
  @media (max-width: 768px) {
    nav { display: none; }
    main { margin-left: 0; padding: 24px; }
  }
</style>
</head>
<body>
<nav>
  <h1>STA API</h1>
  <a href="#overview">Overview</a>
  <a href="#auth">Authentication</a>
  <div class="group">Translation</div>
  <a href="#deepl">POST /deepl</a>
  <a href="#google">POST /google</a>
  <a href="#translate">POST /translate</a>
  <a href="#v2">POST /v2/translate</a>
  <a href="#debug">POST /debug</a>
  <div class="group">Monitoring</div>
  <a href="#health">GET /health</a>
  <a href="#health-live">GET /health/live</a>
  <a href="#health-ready">GET /health/ready</a>
  <a href="#metrics">GET /metrics</a>
  <div class="group">Admin</div>
  <a href="#warm-cache">POST /admin/warm-cache</a>
  <a href="#cache-status">GET /admin/cache-status</a>
  <div class="group">Reference</div>
  <a href="#errors">Error Codes</a>
  <a href="#rate-limiting">Rate Limiting</a>
  <a href="#languages">Languages</a>
</nav>
<main>
<h2 id="overview">Overview</h2>
<p>STA is a free, serverless translation proxy that supports both <strong>DeepL</strong> and <strong>Google Translate</strong>. It provides a unified API with intelligent load balancing, two-level caching, and automatic failover.</p>
<div class="endpoint">
  <span class="method">BASE</span>
  <span class="path">https://sta.oryn.my.id</span>
  <span class="desc">Production instance — or self-host your own</span>
</div>

<h2 id="auth">Authentication</h2>
<p>Translation endpoints are <strong>public</strong>. Health and admin endpoints require an <code>X-API-Key</code> header matching your <code>ADMIN_API_KEY</code>.</p>
<table>
  <tr><th>Endpoint</th><th>Auth</th></tr>
  <tr><td><code>/deepl</code>, <code>/google</code>, <code>/translate</code>, <code>/v2/translate</code></td><td><span class="badge public">Public</span></td></tr>
  <tr><td><code>/health</code></td><td><span class="badge auth">X-API-Key</span></td></tr>
  <tr><td><code>/health/live</code></td><td><span class="badge public">None</span></td></tr>
  <tr><td><code>/health/ready</code></td><td><span class="badge auth">X-API-Key</span></td></tr>
  <tr><td><code>/metrics</code>, <code>/admin/*</code></td><td><span class="badge auth">X-API-Key</span></td></tr>
</table>

<h3 id="deepl">POST /deepl <span class="badge post">POST</span> <span class="badge public">Public</span></h3>
<p>Translate text using DeepL's neural machine translation engine. Recommended for production use.</p>
<pre><code><span class="hljs-comment"># Basic translation</span>
curl -X POST https://sta.oryn.my.id/deepl \\
  -H <span class="hljs-string">"Content-Type: application/json"</span> \\
  -d <span class="hljs-string">'{"text": "Hello, world!", "target_lang": "DE"}'</span></code></pre>
<table>
  <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
  <tr><td><code>text</code></td><td>string</td><td>Yes</td><td>Text to translate (max 5000 chars)</td></tr>
  <tr><td><code>source_lang</code></td><td>string</td><td>No</td><td>Source language code — auto-detected if omitted</td></tr>
  <tr><td><code>target_lang</code></td><td>string</td><td>No</td><td>Target language code — defaults to <code>EN</code></td></tr>
</table>
<pre><code>{
  <span class="hljs-attr">"code"</span>: <span class="hljs-number">200</span>,
  <span class="hljs-attr">"data"</span>: <span class="hljs-string">"Hallo, Welt!"</span>,
  <span class="hljs-attr">"id"</span>: <span class="hljs-number">1234567890</span>,
  <span class="hljs-attr">"source_lang"</span>: <span class="hljs-string">"EN"</span>,
  <span class="hljs-attr">"target_lang"</span>: <span class="hljs-string">"DE"</span>
}</code></pre>

<h3 id="google">POST /google <span class="badge post">POST</span> <span class="badge public">Public</span></h3>
<p>Translate text using Google Translate. Same request/response format as <code>/deepl</code>.</p>
<pre><code>curl -X POST https://sta.oryn.my.id/google \\
  -H <span class="hljs-string">"Content-Type: application/json"</span> \\
  -d <span class="hljs-string">'{"text": "Hello, world!", "target_lang": "JA"}'</span></code></pre>

<h3 id="translate">POST /translate <span class="badge post">POST</span> <span class="badge public">Public</span></h3>
<p>Legacy endpoint — equivalent to <code>/deepl</code>. Kept for backward compatibility.</p>
<pre><code>curl -X POST https://sta.oryn.my.id/translate \\
  -H <span class="hljs-string">"Content-Type: application/json"</span> \\
  -d <span class="hljs-string">'{"text": "Hello, world!", "target_lang": "FR"}'</span></code></pre>

<h3 id="v2">POST /v2/translate <span class="badge post">POST</span> <span class="badge public">Public</span></h3>
<p>Batch translate multiple texts using DeepL with <strong>APR</strong> (Array Per Request) support.</p>
<pre><code>curl -X POST https://sta.oryn.my.id/v2/translate \\
  -H <span class="hljs-string">"Content-Type: application/json"</span> \\
  -d <span class="hljs-string">'{
    "text": ["Hello", "How are you?", "Goodbye!"],
    "target_lang": "DE",
    "APR": true
  }'</span></code></pre>
<table>
  <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
  <tr><td><code>text</code></td><td>string[]</td><td>Yes</td><td>Array of texts (max 10 items)</td></tr>
  <tr><td><code>target_lang</code></td><td>string</td><td>Yes</td><td>Target language code</td></tr>
  <tr><td><code>APR</code></td><td>boolean</td><td>No</td><td>Array Per Request — defaults to <code>true</code></td></tr>
  <tr><td><code>source_lang</code></td><td>string</td><td>No</td><td>Source language code</td></tr>
</table>
<p><code>APR: true</code> sends each item as a separate DeepL request (parallel). <code>APR: false</code> joins all items with <code>\\n</code> into a single request.</p>
<pre><code>{
  <span class="hljs-attr">"code"</span>: <span class="hljs-number">200</span>,
  <span class="hljs-attr">"apr"</span>: <span class="hljs-literal">true</span>,
  <span class="hljs-attr">"data"</span>: [
    { <span class="hljs-attr">"text"</span>: <span class="hljs-string">"Hallo"</span>, <span class="hljs-attr">"index"</span>: <span class="hljs-number">0</span>, <span class="hljs-attr">"detected_source_lang"</span>: <span class="hljs-string">"EN"</span>, <span class="hljs-attr">"success"</span>: <span class="hljs-literal">true</span> },
    { <span class="hljs-attr">"text"</span>: <span class="hljs-string">"Wie geht es dir?"</span>, <span class="hljs-attr">"index"</span>: <span class="hljs-number">1</span>, <span class="hljs-attr">"success"</span>: <span class="hljs-literal">true</span> }
  ],
  <span class="hljs-attr">"id"</span>: <span class="hljs-number">1234567890</span>
}</code></pre>

<h3 id="debug">POST /debug <span class="badge post">POST</span> <span class="badge auth">DEBUG_MODE</span></h3>
<p>Validate request format and inspect the generated DeepL request body. Returns <strong>404</strong> when <code>DEBUG_MODE</code> is not enabled.</p>
<pre><code>curl -X POST https://sta.oryn.my.id/debug \\
  -H <span class="hljs-string">"Content-Type: application/json"</span> \\
  -d <span class="hljs-string">'{"text": "Hello", "source_lang": "EN", "target_lang": "ZH"}'</span></code></pre>

<h2>Health &amp; Monitoring</h2>
<h3 id="health">GET /health <span class="badge get">GET</span> <span class="badge auth">X-API-Key</span></h3>
<p>Comprehensive health status of all service components: proxy endpoints, cache, rate limiter, and performance metrics.</p>
<pre><code>curl -H <span class="hljs-string">"X-API-Key: YOUR_API_KEY"</span> https://sta.oryn.my.id/health</code></pre>
<pre><code>{
  <span class="hljs-attr">"status"</span>: <span class="hljs-string">"healthy"</span>,
  <span class="hljs-attr">"timestamp"</span>: <span class="hljs-string">"2025-07-27T10:30:00Z"</span>,
  <span class="hljs-attr">"version"</span>: <span class="hljs-string">"2.0.0"</span>,
  <span class="hljs-attr">"checks"</span>: {
    <span class="hljs-attr">"proxies"</span>: { <span class="hljs-attr">"status"</span>: <span class="hljs-string">"healthy"</span>, <span class="hljs-attr">"message"</span>: <span class="hljs-string">"8/10 proxies healthy"</span> },
    <span class="hljs-attr">"cache"</span>: { <span class="hljs-attr">"status"</span>: <span class="hljs-string">"healthy"</span> },
    <span class="hljs-attr">"rateLimit"</span>: { <span class="hljs-attr">"status"</span>: <span class="hljs-string">"healthy"</span> },
    <span class="hljs-attr">"performance"</span>: { <span class="hljs-attr">"status"</span>: <span class="hljs-string">"healthy"</span> }
  }
}</code></pre>
<p>Returns <strong>503</strong> when the service is unhealthy.</p>

<h3 id="health-live">GET /health/live <span class="badge get">GET</span> <span class="badge public">None</span></h3>
<p>Kubernetes-style liveness probe. Intentionally unauthenticated for load balancer integration.</p>
<pre><code>curl https://sta.oryn.my.id/health/live</code></pre>
<pre><code>{ <span class="hljs-attr">"status"</span>: <span class="hljs-string">"alive"</span>, <span class="hljs-attr">"timestamp"</span>: <span class="hljs-string">"2025-07-27T10:30:00Z"</span> }</code></pre>

<h3 id="health-ready">GET /health/ready <span class="badge get">GET</span> <span class="badge auth">X-API-Key</span></h3>
<p>Readiness check — whether the service can accept requests.</p>
<pre><code>curl -H <span class="hljs-string">"X-API-Key: YOUR_API_KEY"</span> https://sta.oryn.my.id/health/ready</code></pre>
<pre><code>{ <span class="hljs-attr">"ready"</span>: <span class="hljs-literal">true</span>, <span class="hljs-attr">"status"</span>: <span class="hljs-string">"healthy"</span>, <span class="hljs-attr">"timestamp"</span>: <span class="hljs-string">"2025-07-27T10:30:00Z"</span> }</code></pre>

<h3 id="metrics">GET /metrics <span class="badge get">GET</span> <span class="badge auth">X-API-Key</span></h3>
<p>Performance and operational metrics — proxy health, cache stats, request rates.</p>
<pre><code>curl -H <span class="hljs-string">"X-API-Key: YOUR_API_KEY"</span> https://sta.oryn.my.id/metrics</code></pre>

<h2>Admin</h2>
<h3 id="warm-cache">POST /admin/warm-cache <span class="badge post">POST</span> <span class="badge auth">X-API-Key</span></h3>
<p>Manually trigger cache warming with popular translation pairs.</p>
<pre><code>curl -X POST -H <span class="hljs-string">"X-API-Key: YOUR_API_KEY"</span> https://sta.oryn.my.id/admin/warm-cache</code></pre>

<h3 id="cache-status">GET /admin/cache-status <span class="badge get">GET</span> <span class="badge auth">X-API-Key</span></h3>
<p>Get cache warming status — last warm time and total warmed entries.</p>
<pre><code>curl -H <span class="hljs-string">"X-API-Key: YOUR_API_KEY"</span> https://sta.oryn.my.id/admin/cache-status</code></pre>

<h2 id="errors">Error Codes</h2>
<table>
  <tr><th>Code</th><th>Description</th></tr>
  <tr><td>200</td><td>Success</td></tr>
  <tr><td>207</td><td>Partial success (V2 batch — some translations failed)</td></tr>
  <tr><td>400</td><td>Invalid request — bad JSON, missing fields, validation error</td></tr>
  <tr><td>401</td><td>Unauthorized — missing or invalid <code>X-API-Key</code></td></tr>
  <tr><td>404</td><td>Not found — debug endpoint when <code>DEBUG_MODE</code> is off</td></tr>
  <tr><td>408</td><td>Request timeout — upstream proxy did not respond</td></tr>
  <tr><td>413</td><td>Payload too large — text over 5000 chars or body over 32KB</td></tr>
  <tr><td>415</td><td>Unsupported Media Type — <code>Content-Type</code> must be <code>application/json</code></td></tr>
  <tr><td>429</td><td>Rate limit exceeded</td></tr>
  <tr><td>500</td><td>Internal server error</td></tr>
  <tr><td>503</td><td>Service unavailable</td></tr>
</table>
<p>All error responses follow the standard format:</p>
<pre><code>{ <span class="hljs-attr">"code"</span>: <span class="hljs-number">400</span>, <span class="hljs-attr">"data"</span>: <span class="hljs-literal">null</span>, <span class="hljs-attr">"id"</span>: <span class="hljs-number">1234567890</span>, <span class="hljs-attr">"source_lang"</span>: <span class="hljs-literal">null</span>, <span class="hljs-attr">"target_lang"</span>: <span class="hljs-literal">null</span> }</code></pre>

<h2 id="rate-limiting">Rate Limiting</h2>
<p>Dual-level token bucket algorithm with sliding window burst protection.</p>
<table>
  <tr><th>Level</th><th>Limit</th><th>Window</th></tr>
  <tr><td>Per-client IP</td><td><code>proxy_count × 8 × 60</code> tokens</td><td>1 minute</td></tr>
  <tr><td>Per-proxy endpoint</td><td>8 tokens/sec, 16 burst</td><td>1 second</td></tr>
</table>
<p>Rate limiting is enforced on <strong>every</strong> request, including cache hits.</p>

<h2 id="languages">Supported Languages</h2>
<table>
  <tr><th>Code</th><th>Language</th></tr>
  <tr><td>AUTO</td><td>Auto-detect (source only)</td></tr>
  <tr><td>AR</td><td>Arabic</td><tr>
  <tr><td>BG</td><td>Bulgarian</td></tr>
  <tr><td>CS</td><td>Czech</td></tr>
  <tr><td>DA</td><td>Danish</td></tr>
  <tr><td>DE</td><td>German</td></tr>
  <tr><td>EL</td><td>Greek</td></tr>
  <tr><td>EN</td><td>English</td></tr>
  <tr><td>ES</td><td>Spanish</td></tr>
  <tr><td>ET</td><td>Estonian</td></tr>
  <tr><td>FI</td><td>Finnish</td></tr>
  <tr><td>FR</td><td>French</td></tr>
  <tr><td>HE</td><td>Hebrew</td></tr>
  <tr><td>HU</td><td>Hungarian</td></tr>
  <tr><td>ID</td><td>Indonesian</td></tr>
  <tr><td>IT</td><td>Italian</td></tr>
  <tr><td>JA</td><td>Japanese</td></tr>
  <tr><td>KO</td><td>Korean</td></tr>
  <tr><td>LT</td><td>Lithuanian</td></tr>
  <tr><td>LV</td><td>Latvian</td></tr>
  <tr><td>NB</td><td>Norwegian Bokmål</td></tr>
  <tr><td>NL</td><td>Dutch</td></tr>
  <tr><td>PL</td><td>Polish</td></tr>
  <tr><td>PT</td><td>Portuguese</td></tr>
  <tr><td>RO</td><td>Romanian</td></tr>
  <tr><td>RU</td><td>Russian</td></tr>
  <tr><td>SK</td><td>Slovak</td></tr>
  <tr><td>SL</td><td>Slovenian</td></tr>
  <tr><td>SV</td><td>Swedish</td></tr>
  <tr><td>TH</td><td>Thai</td></tr>
  <tr><td>TR</td><td>Turkish</td></tr>
  <tr><td>UK</td><td>Ukrainian</td></tr>
  <tr><td>VI</td><td>Vietnamese</td></tr>
  <tr><td>ZH</td><td>Chinese</td></tr>
</table>
<p>Google Translate supports 100+ languages. Source language auto-detection is available for all endpoints.</p>

<p style="margin-top: 48px; font-size: 12px; color: var(--fg2); opacity: .6; text-align: center; border-top: 1px solid var(--border); padding-top: 24px;">
  STA v2.0.0 — Serverless Translation API &middot; MIT License
</p>
</main>
</body>
</html>`;

export function handleDocs(c: any): Response | Promise<Response> {
  return c.html(DOCS_PAGE);
}
