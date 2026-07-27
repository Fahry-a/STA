const DOCS_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>STA API Documentation</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --bg: #0a0b10;
    --bg2: #12141e;
    --bg3: #1a1d2e;
    --bg4: #22263a;
    --fg: #e4e6f0;
    --fg2: #9498b0;
    --fg3: #6b7089;
    --accent: #7c8aff;
    --accent2: #5b6cd5;
    --accent-glow: rgba(124, 138, 255, 0.15);
    --green: #4cd964;
    --green-bg: rgba(76, 217, 100, 0.1);
    --red: #ff4757;
    --orange: #ff9f43;
    --orange-bg: rgba(255, 159, 67, 0.1);
    --border: #1e2235;
    --radius: 12px;
    --radius-sm: 8px;
    --font: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
    --mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
    --sidebar-w: 280px;
    --header-h: 0px;
  }
  html { scroll-behavior: smooth; }
  body {
    font-family: var(--font);
    background: var(--bg);
    color: var(--fg);
    line-height: 1.7;
    display: flex;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
  ::selection { background: var(--accent); color: #fff; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: var(--bg); }
  ::-webkit-scrollbar-thumb { background: var(--bg4); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--fg3); }

  /* Progress bar */
  #progress {
    position: fixed;
    top: 0; left: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--accent), #a78bfa, var(--accent));
    background-size: 200% 100%;
    z-index: 100;
    transition: width 0.1s ease;
    box-shadow: 0 0 12px var(--accent-glow);
    animation: progressShimmer 3s ease infinite;
  }
  @keyframes progressShimmer {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
  }

  /* Sidebar */
  nav {
    width: var(--sidebar-w);
    position: fixed;
    top: 0; left: 0;
    bottom: 0;
    background: var(--bg2);
    border-right: 1px solid var(--border);
    padding: 0;
    overflow-y: auto;
    overflow-x: hidden;
    z-index: 50;
    display: flex;
    flex-direction: column;
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }
  nav .nav-header {
    padding: 28px 24px 20px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    position: sticky;
    top: 0;
    background: var(--bg2);
    z-index: 2;
  }
  nav .nav-header h1 {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 1px;
    text-transform: uppercase;
    background: linear-gradient(135deg, var(--accent), #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  nav .nav-header p {
    font-size: 11px;
    color: var(--fg3);
    margin-top: 4px;
    letter-spacing: 0.3px;
  }
  nav .nav-body {
    padding: 12px 0 24px;
    flex: 1;
    overflow-y: auto;
  }
  nav .group {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    color: var(--fg3);
    padding: 20px 24px 6px;
    opacity: 0.6;
  }
  nav a {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 24px;
    color: var(--fg2);
    text-decoration: none;
    font-size: 13px;
    font-weight: 400;
    transition: all 0.2s ease;
    border-left: 2px solid transparent;
    position: relative;
  }
  nav a:hover {
    color: var(--fg);
    background: var(--accent-glow);
  }
  nav a.active {
    color: var(--accent);
    border-left-color: var(--accent);
    background: var(--accent-glow);
    font-weight: 500;
  }
  nav a .nav-icon {
    font-size: 14px;
    opacity: 0.7;
    width: 18px;
    text-align: center;
    flex-shrink: 0;
  }

  /* Mobile menu toggle */
  #menu-toggle {
    display: none;
    position: fixed;
    top: 16px;
    left: 16px;
    z-index: 60;
    background: var(--bg3);
    border: 1px solid var(--border);
    color: var(--fg);
    width: 40px;
    height: 40px;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 18px;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  #menu-toggle:hover { background: var(--bg4); border-color: var(--accent); }
  #menu-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.6);
    z-index: 49;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }

  /* Main content */
  main {
    margin-left: var(--sidebar-w);
    flex: 1;
    max-width: 920px;
    padding: 0 64px 80px;
    min-height: 100vh;
  }

  /* Hero */
  .hero {
    padding: 64px 0 48px;
    position: relative;
  }
  .hero::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: -64px;
    right: -64px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--border), var(--border), transparent);
  }
  .hero h1 {
    font-size: 40px;
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -0.03em;
    background: linear-gradient(135deg, #fff 30%, var(--accent) 70%, #a78bfa 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .hero p {
    font-size: 16px;
    color: var(--fg2);
    margin-top: 12px;
    max-width: 600px;
    line-height: 1.7;
  }
  .hero .base-url {
    margin-top: 20px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--bg3);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 10px 16px;
    font-family: var(--mono);
    font-size: 13px;
    color: var(--fg);
    cursor: pointer;
    transition: all 0.2s;
    position: relative;
  }
  .hero .base-url:hover {
    border-color: var(--accent);
    background: var(--accent-glow);
  }
  .hero .base-url .copy-hint {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-family: var(--font);
    color: var(--fg3);
    font-weight: 600;
  }
  .hero .base-url.copied::after {
    content: 'Copied!';
    position: absolute;
    top: -28px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--green);
    color: #000;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 4px;
    font-family: var(--font);
  }

  /* Section styles */
  section {
    padding: 48px 0;
    border-bottom: 1px solid var(--border);
  }
  section:last-of-type { border-bottom: none; }
  h2 {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 16px;
    color: var(--fg);
    display: flex;
    align-items: center;
    gap: 12px;
  }
  h2 .section-icon {
    font-size: 22px;
  }
  h3 {
    font-size: 17px;
    font-weight: 600;
    margin: 28px 0 10px;
    color: var(--fg);
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  h4 {
    font-size: 14px;
    font-weight: 600;
    margin: 20px 0 8px;
    color: var(--fg2);
  }
  p { color: var(--fg2); font-size: 14px; line-height: 1.8; margin-bottom: 12px; }
  a { color: var(--accent); text-decoration: none; transition: color 0.2s; }
  a:hover { color: #a78bfa; }
  ul, ol { padding-left: 20px; margin-bottom: 16px; }
  li { color: var(--fg2); font-size: 14px; line-height: 1.8; margin-bottom: 4px; }
  li strong { color: var(--fg); }

  /* Badges */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 20px;
    letter-spacing: 0.3px;
    text-transform: uppercase;
    vertical-align: middle;
    white-space: nowrap;
  }
  .badge.post {
    background: var(--green-bg);
    color: var(--green);
    border: 1px solid rgba(76, 217, 100, 0.2);
  }
  .badge.get {
    background: var(--accent-glow);
    color: var(--accent);
    border: 1px solid rgba(124, 138, 255, 0.2);
  }
  .badge.auth {
    background: var(--orange-bg);
    color: var(--orange);
    border: 1px solid rgba(255, 159, 67, 0.2);
  }
  .badge.public {
    background: var(--green-bg);
    color: var(--fg2);
    border: 1px solid rgba(76, 217, 100, 0.15);
  }

  /* Endpoint card */
  .endpoint-card {
    background: var(--bg2);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 16px 20px;
    margin: 12px 0 20px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-family: var(--mono);
    font-size: 13px;
    transition: all 0.2s;
    position: relative;
    overflow: hidden;
  }
  .endpoint-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0;
    width: 3px;
    height: 100%;
    border-radius: 0 2px 2px 0;
  }
  .endpoint-card.post::before { background: var(--green); }
  .endpoint-card.get::before { background: var(--accent); }
  .endpoint-card:hover {
    border-color: var(--bg4);
    background: var(--bg3);
  }
  .endpoint-card .method {
    font-weight: 700;
    font-size: 11px;
    padding: 3px 10px;
    border-radius: 20px;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }
  .endpoint-card .method.post { background: var(--green-bg); color: var(--green); }
  .endpoint-card .method.get { background: var(--accent-glow); color: var(--accent); }
  .endpoint-card .path { color: var(--fg); flex-shrink: 0; }
  .endpoint-card .desc {
    color: var(--fg2);
    font-family: var(--font);
    font-size: 12px;
    margin-left: auto;
    text-align: right;
  }

  /* Tables */
  .table-wrap {
    overflow-x: auto;
    margin: 12px 0 20px;
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th {
    text-align: left;
    padding: 11px 14px;
    font-weight: 600;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    color: var(--fg3);
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
  }
  td {
    padding: 10px 14px;
    color: var(--fg2);
    border-bottom: 1px solid var(--border);
    font-size: 13px;
  }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--bg3); }
  td code {
    font-size: 12px;
    background: var(--bg3);
    padding: 1px 6px;
    border-radius: 4px;
    color: var(--accent);
    font-family: var(--mono);
  }
  td .badge { font-size: 9px; padding: 2px 7px; }

  /* Code blocks */
  .code-block {
    position: relative;
    margin: 12px 0 20px;
    border-radius: var(--radius);
    overflow: hidden;
    background: #0d0f18;
    border: 1px solid var(--border);
    transition: border-color 0.2s;
  }
  .code-block:hover { border-color: var(--bg4); }
  .code-block .code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 16px;
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
    font-size: 11px;
    color: var(--fg3);
    font-weight: 500;
  }
  .code-block .code-header .lang-label {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .code-block .code-header .lang-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }
  .code-block .code-header .lang-dot.bash { background: var(--green); }
  .code-block .code-header .lang-dot.json { background: var(--orange); }
  .code-block .code-header .copy-btn {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--fg3);
    font-size: 11px;
    font-family: var(--font);
    font-weight: 500;
    padding: 3px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .code-block .code-header .copy-btn:hover {
    background: var(--bg4);
    color: var(--fg);
    border-color: var(--fg3);
  }
  .code-block .code-header .copy-btn.copied {
    background: var(--green-bg);
    color: var(--green);
    border-color: rgba(76, 217, 100, 0.3);
  }
  .code-block pre {
    padding: 16px 20px;
    overflow-x: auto;
    font-size: 13px;
    line-height: 1.65;
    font-family: var(--mono);
    tab-size: 2;
    -moz-tab-size: 2;
    margin: 0;
  }
  .code-block pre code {
    background: none;
    padding: 0;
    border-radius: 0;
    color: var(--fg);
    font-family: var(--mono);
    font-size: 13px;
    line-height: 1.65;
  }
  .code-block pre code .hljs-attr { color: #7c8aff; }
  .code-block pre code .hljs-string { color: #4cd964; }
  .code-block pre code .hljs-number { color: #ff9f43; }
  .code-block pre code .hljs-literal { color: #ff6b81; }
  .code-block pre code .hljs-keyword { color: #7c8aff; }
  .code-block pre code .hljs-comment { color: #4a4f6a; font-style: italic; }
  .code-block pre code .hljs-built_in { color: #a78bfa; }
  .code-block pre code .hljs-title { color: #e4e6f0; }
  .code-block pre code .hljs-operator { color: #9498b0; }
  .code-block pre code .hljs-punctuation { color: #9498b0; }

  /* Inline code */
  p code, li code {
    font-family: var(--mono);
    font-size: 13px;
    background: var(--bg3);
    padding: 1px 6px;
    border-radius: 4px;
    color: var(--accent);
    font-weight: 500;
  }

  /* Note / Info box */
  .note {
    background: var(--accent-glow);
    border: 1px solid rgba(124, 138, 255, 0.15);
    border-radius: var(--radius-sm);
    padding: 14px 18px;
    margin: 16px 0;
    font-size: 13px;
    color: var(--fg2);
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .note .note-icon {
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 1px;
  }
  .note strong { color: var(--accent); }

  /* Language grid */
  .lang-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 4px;
    margin: 12px 0 16px;
  }
  .lang-grid .lang-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 13px;
    color: var(--fg2);
    transition: background 0.15s;
  }
  .lang-grid .lang-item:hover { background: var(--bg3); }
  .lang-grid .lang-item .lang-code {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--accent);
    width: 32px;
    flex-shrink: 0;
  }

  /* Auth table specific */
  .auth-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 12px 0 16px;
  }
  .auth-grid .auth-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    background: var(--bg2);
    border-radius: var(--radius-sm);
    border: 1px solid var(--border);
    font-size: 13px;
  }
  .auth-grid .auth-row .endpoint-name {
    color: var(--fg);
    font-family: var(--mono);
    font-size: 12px;
  }
  @media (max-width: 640px) {
    .auth-grid { grid-template-columns: 1fr; }
  }

  /* Footer */
  footer {
    margin-top: 32px;
    padding: 24px 0 12px;
    text-align: center;
    border-top: 1px solid var(--border);
  }
  footer p {
    font-size: 12px;
    color: var(--fg3);
    margin-bottom: 0;
  }
  footer a { color: var(--fg3); }
  footer a:hover { color: var(--accent); }
  footer .footer-links {
    display: flex;
    justify-content: center;
    gap: 20px;
    margin-top: 8px;
  }
  footer .footer-links a {
    font-size: 12px;
    color: var(--fg3);
    transition: color 0.2s;
  }
  footer .footer-links a:hover { color: var(--fg); }

  /* Responsive */
  @media (max-width: 1024px) {
    main { padding: 0 32px 80px; }
    .hero::after { left: -32px; right: -32px; }
  }
  @media (max-width: 768px) {
    #menu-toggle { display: flex; }
    nav {
      transform: translateX(-100%);
      transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      box-shadow: 4px 0 40px rgba(0,0,0,0.4);
    }
    nav.open { transform: translateX(0); }
    #menu-overlay.open { display: block; }
    main {
      margin-left: 0;
      padding: 0 20px 80px;
    }
    .hero {
      padding: 80px 0 36px;
    }
    .hero h1 { font-size: 28px; }
    .hero::after { left: -20px; right: -20px; }
    section { padding: 36px 0; }
    .lang-grid {
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
    }
  }

  /* Animations */
  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate { animation: fadeInUp 0.5s ease forwards; }
  .animate-d1 { animation-delay: 0.05s; }
  .animate-d2 { animation-delay: 0.1s; }
  .animate-d3 { animation-delay: 0.15s; }

  /* Copy toast */
  .toast {
    position: fixed;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%) translateY(80px);
    background: var(--bg3);
    border: 1px solid var(--border);
    color: var(--fg);
    padding: 10px 20px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    font-weight: 500;
    opacity: 0;
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    z-index: 200;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    pointer-events: none;
  }
  .toast.show {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
</style>
</head>
<body>

<div id="progress"></div>
<div id="toast" class="toast">Copied to clipboard</div>

<!-- Mobile menu toggle -->
<button id="menu-toggle" aria-label="Toggle menu">&#9776;</button>
<div id="menu-overlay"></div>

<!-- Sidebar -->
<nav id="sidebar">
  <div class="nav-header">
    <h1>STA API</h1>
    <p>Serverless Translation API</p>
  </div>
  <div class="nav-body">
    <div class="group">Getting Started</div>
    <a href="#overview"><span class="nav-icon">&#9670;</span> Overview</a>
    <a href="#auth"><span class="nav-icon">&#9679;</span> Authentication</a>

    <div class="group">Translation</div>
    <a href="#deepl"><span class="nav-icon">&#8594;</span> POST /deepl</a>
    <a href="#google"><span class="nav-icon">&#8594;</span> POST /google</a>
    <a href="#translate"><span class="nav-icon">&#8594;</span> POST /translate</a>
    <a href="#v2"><span class="nav-icon">&#8594;</span> POST /v2/translate</a>
    <a href="#debug"><span class="nav-icon">&#8594;</span> POST /debug</a>

    <div class="group">Monitoring</div>
    <a href="#health"><span class="nav-icon">&#9733;</span> GET /health</a>
    <a href="#health-live"><span class="nav-icon">&#9733;</span> GET /health/live</a>
    <a href="#health-ready"><span class="nav-icon">&#9733;</span> GET /health/ready</a>
    <a href="#metrics"><span class="nav-icon">&#9733;</span> GET /metrics</a>

    <div class="group">Admin</div>
    <a href="#warm-cache"><span class="nav-icon">&#9881;</span> POST /admin/warm-cache</a>
    <a href="#cache-status"><span class="nav-icon">&#9881;</span> GET /admin/cache-status</a>

    <div class="group">Reference</div>
    <a href="#errors"><span class="nav-icon">&#9888;</span> Error Codes</a>
    <a href="#rate-limiting"><span class="nav-icon">&#9201;</span> Rate Limiting</a>
    <a href="#languages"><span class="nav-icon">&#127760;</span> Languages</a>
  </div>
</nav>

<!-- Main Content -->
<main>
  <div class="hero">
    <h1>STA API</h1>
    <p>Serverless translation proxy supporting <strong>DeepL</strong> and <strong>Google Translate</strong> with intelligent load balancing, two-level caching, and automatic failover.</p>
    <div class="base-url" id="base-url" onclick="copyBaseUrl(this)">
      <span>https://sta.oryn.my.id</span>
      <span class="copy-hint">Copy</span>
    </div>
  </div>

  <!-- Overview -->
  <section id="overview">
    <h2><span class="section-icon">&#9670;</span> Overview</h2>
    <p>STA provides a unified translation API through a distributed network of XDPL proxy endpoints. It handles request routing, load balancing, rate limiting, caching, and automatic failover — giving you a reliable translation service without managing infrastructure.</p>

    <h3>How it works</h3>
    <p>Send a translation request to any endpoint. STA selects the healthiest proxy, builds the appropriate JSONRPC request (with browser fingerprint rotation for DeepL), sends it with retry logic, caches the result, and returns a clean JSON response.</p>

    <h3>Features</h3>
    <ul>
      <li><strong>Two providers</strong> — DeepL neural machine translation &amp; Google Translate</li>
      <li><strong>Two-level cache</strong> — In-memory LRU (1000 entries) + Cloudflare KV (1h TTL)</li>
      <li><strong>Smart proxy rotation</strong> — Weighted random selection by health, with automatic failover</li>
      <li><strong>Rate limiting</strong> — Dual token buckets: per-client IP + per-proxy endpoint</li>
      <li><strong>V2 batch</strong> — Translate up to 10 texts at once with Array Per Request (APR) mode</li>
      <li><strong>Fingerprint rotation</strong> — 5 User-Agents &times; 5 Accept-Language variants</li>
    </ul>
  </section>

  <!-- Authentication -->
  <section id="auth">
    <h2><span class="section-icon">&#9679;</span> Authentication</h2>
    <p>Translation endpoints are <strong>public</strong> — no API key needed. Health and admin endpoints require an <code>X-API-Key</code> header matching your <code>ADMIN_API_KEY</code>.</p>
    <div class="auth-grid">
      <div class="auth-row">
        <span class="endpoint-name">/deepl, /google, /translate, /v2/translate</span>
        <span class="badge public">Public</span>
      </div>
      <div class="auth-row">
        <span class="endpoint-name">/health</span>
        <span class="badge auth">X-API-Key</span>
      </div>
      <div class="auth-row">
        <span class="endpoint-name">/health/live</span>
        <span class="badge public">None</span>
      </div>
      <div class="auth-row">
        <span class="endpoint-name">/health/ready</span>
        <span class="badge auth">X-API-Key</span>
      </div>
      <div class="auth-row">
        <span class="endpoint-name">/metrics, /admin/*</span>
        <span class="badge auth">X-API-Key</span>
      </div>
    </div>
    <div class="note">
      <span class="note-icon">&#8505;</span>
      <span>Admin endpoints are <strong>fail-closed</strong>: if <code>ADMIN_API_KEY</code> is unset, all admin requests return <strong>401</strong>.</span>
    </div>
  </section>

  <!-- Translation Endpoints -->
  <section id="translation-endpoints">
    <h2><span class="section-icon">&#8594;</span> Translation Endpoints</h2>

    <h3 id="deepl">
      POST /deepl
      <span class="badge post">POST</span>
      <span class="badge public">Public</span>
    </h3>
    <p>Translate text using DeepL's neural machine translation engine. Recommended for production use.</p>

    <div class="endpoint-card post">
      <span class="method post">POST</span>
      <span class="path">/deepl</span>
      <span class="desc">DeepL translation</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> bash</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>curl -X POST https://sta.oryn.my.id/deepl \
  -H <span class="hljs-string">"Content-Type: application/json"</span> \
  -d <span class="hljs-string">'{"text": "Hello, world!", "target_lang": "DE"}'</span></code></pre>
    </div>

    <div class="table-wrap">
      <table>
        <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
        <tr><td><code>text</code></td><td>string</td><td>Yes</td><td>Text to translate (max 5000 chars)</td></tr>
        <tr><td><code>source_lang</code></td><td>string</td><td>No</td><td>Source language code — auto-detected if omitted</td></tr>
        <tr><td><code>target_lang</code></td><td>string</td><td>No</td><td>Target language code — defaults to <code>EN</code></td></tr>
      </table>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot json"></span> Response</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>{
  <span class="hljs-attr">"code"</span>: <span class="hljs-number">200</span>,
  <span class="hljs-attr">"data"</span>: <span class="hljs-string">"Hallo, Welt!"</span>,
  <span class="hljs-attr">"id"</span>: <span class="hljs-number">1234567890</span>,
  <span class="hljs-attr">"source_lang"</span>: <span class="hljs-string">"EN"</span>,
  <span class="hljs-attr">"target_lang"</span>: <span class="hljs-string">"DE"</span>
}</code></pre>
    </div>

    <h3 id="google">
      POST /google
      <span class="badge post">POST</span>
      <span class="badge public">Public</span>
    </h3>
    <p>Translate text using Google Translate. Same request/response format as <code>/deepl</code>.</p>

    <div class="endpoint-card post">
      <span class="method post">POST</span>
      <span class="path">/google</span>
      <span class="desc">Google Translate</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> bash</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>curl -X POST https://sta.oryn.my.id/google \
  -H <span class="hljs-string">"Content-Type: application/json"</span> \
  -d <span class="hljs-string">'{"text": "Hello, world!", "target_lang": "JA"}'</span></code></pre>
    </div>

    <h3 id="translate">
      POST /translate
      <span class="badge post">POST</span>
      <span class="badge public">Public</span>
    </h3>
    <p>Legacy endpoint — equivalent to <code>/deepl</code>. Kept for backward compatibility.</p>

    <div class="endpoint-card post">
      <span class="method post">POST</span>
      <span class="path">/translate</span>
      <span class="desc">Legacy DeepL</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> bash</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>curl -X POST https://sta.oryn.my.id/translate \
  -H <span class="hljs-string">"Content-Type: application/json"</span> \
  -d <span class="hljs-string">'{"text": "Hello, world!", "target_lang": "FR"}'</span></code></pre>
    </div>

    <h3 id="v2">
      POST /v2/translate
      <span class="badge post">POST</span>
      <span class="badge public">Public</span>
    </h3>
    <p>Batch translate multiple texts using DeepL with <strong>APR</strong> (Array Per Request) support.</p>

    <div class="endpoint-card post">
      <span class="method post">POST</span>
      <span class="path">/v2/translate</span>
      <span class="desc">Batch translation</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> bash</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>curl -X POST https://sta.oryn.my.id/v2/translate \
  -H <span class="hljs-string">"Content-Type: application/json"</span> \
  -d <span class="hljs-string">'{
    "text": ["Hello", "How are you?", "Goodbye!"],
    "target_lang": "DE",
    "APR": true
  }'</span></code></pre>
    </div>

    <div class="table-wrap">
      <table>
        <tr><th>Field</th><th>Type</th><th>Required</th><th>Description</th></tr>
        <tr><td><code>text</code></td><td>string[]</td><td>Yes</td><td>Array of texts (max 10 items, 5000 chars each)</td></tr>
        <tr><td><code>target_lang</code></td><td>string</td><td>Yes</td><td>Target language code</td></tr>
        <tr><td><code>APR</code></td><td>boolean</td><td>No</td><td>Array Per Request — defaults to <code>true</code></td></tr>
        <tr><td><code>source_lang</code></td><td>string</td><td>No</td><td>Source language code</td></tr>
      </table>
    </div>

    <p><strong>APR modes:</strong></p>
    <ul>
      <li><code>APR: true</code> (default) — each item sent as a <strong>separate</strong> DeepL request (parallel). Max 10 items, 5000 chars each.</li>
      <li><code>APR: false</code> — all items <strong>combined</strong> with <code>\n</code> separators into a single request. 5000 chars total.</li>
    </ul>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot json"></span> Response (success)</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>{
  <span class="hljs-attr">"code"</span>: <span class="hljs-number">200</span>,
  <span class="hljs-attr">"apr"</span>: <span class="hljs-literal">true</span>,
  <span class="hljs-attr">"data"</span>: [
    { <span class="hljs-attr">"text"</span>: <span class="hljs-string">"Hallo"</span>, <span class="hljs-attr">"index"</span>: <span class="hljs-number">0</span>, <span class="hljs-attr">"detected_source_lang"</span>: <span class="hljs-string">"EN"</span>, <span class="hljs-attr">"success"</span>: <span class="hljs-literal">true</span> },
    { <span class="hljs-attr">"text"</span>: <span class="hljs-string">"Wie geht es dir?"</span>, <span class="hljs-attr">"index"</span>: <span class="hljs-number">1</span>, <span class="hljs-attr">"success"</span>: <span class="hljs-literal">true</span> }
  ],
  <span class="hljs-attr">"id"</span>: <span class="hljs-number">1234567890</span>
}</code></pre>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot json"></span> Response (partial failure)</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>{
  <span class="hljs-attr">"code"</span>: <span class="hljs-number">207</span>,
  <span class="hljs-attr">"apr"</span>: <span class="hljs-literal">true</span>,
  <span class="hljs-attr">"data"</span>: [
    { <span class="hljs-attr">"text"</span>: <span class="hljs-string">"Hallo!"</span>, <span class="hljs-attr">"index"</span>: <span class="hljs-number">0</span>, <span class="hljs-attr">"success"</span>: <span class="hljs-literal">true</span> },
    { <span class="hljs-attr">"text"</span>: <span class="hljs-string">""</span>, <span class="hljs-attr">"index"</span>: <span class="hljs-number">1</span>, <span class="hljs-attr">"success"</span>: <span class="hljs-literal">false</span>, <span class="hljs-attr">"error"</span>: <span class="hljs-string">"Translation failed with code 429"</span> }
  ],
  <span class="hljs-attr">"id"</span>: <span class="hljs-number">1234567890</span>
}</code></pre>
    </div>

    <div class="note">
      <span class="note-icon">&#8505;</span>
      <span>The <code>apr</code> field in the response mirrors the mode actually applied. It is always a concrete boolean.</span>
    </div>

    <h3 id="debug">
      POST /debug
      <span class="badge post">POST</span>
      <span class="badge auth">DEBUG_MODE</span>
    </h3>
    <p>Validate request format and inspect the generated DeepL request body. Returns <strong>404</strong> when <code>DEBUG_MODE</code> is not enabled.</p>

    <div class="endpoint-card post">
      <span class="method post">POST</span>
      <span class="path">/debug</span>
      <span class="desc">Request debug</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> bash</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>curl -X POST https://sta.oryn.my.id/debug \
  -H <span class="hljs-string">"Content-Type: application/json"</span> \
  -d <span class="hljs-string">'{"text": "Hello", "source_lang": "EN", "target_lang": "ZH"}'</span></code></pre>
    </div>
  </section>

  <!-- Health & Monitoring -->
  <section id="monitoring">
    <h2><span class="section-icon">&#9733;</span> Health &amp; Monitoring</h2>

    <h3 id="health">
      GET /health
      <span class="badge get">GET</span>
      <span class="badge auth">X-API-Key</span>
    </h3>
    <p>Comprehensive health status of all service components: proxy endpoints, cache, rate limiter, and performance metrics.</p>

    <div class="endpoint-card get">
      <span class="method get">GET</span>
      <span class="path">/health</span>
      <span class="desc">Full health check</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> bash</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>curl -H <span class="hljs-string">"X-API-Key: YOUR_API_KEY"</span> https://sta.oryn.my.id/health</code></pre>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot json"></span> Response</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
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
    </div>
    <p>Returns <strong>503</strong> when the service is unhealthy.</p>

    <h3 id="health-live">
      GET /health/live
      <span class="badge get">GET</span>
      <span class="badge public">None</span>
    </h3>
    <p>Kubernetes-style liveness probe. Intentionally unauthenticated for load balancer integration.</p>

    <div class="endpoint-card get">
      <span class="method get">GET</span>
      <span class="path">/health/live</span>
      <span class="desc">Liveness probe</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> bash</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>curl https://sta.oryn.my.id/health/live</code></pre>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot json"></span> Response</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>{ <span class="hljs-attr">"status"</span>: <span class="hljs-string">"alive"</span>, <span class="hljs-attr">"timestamp"</span>: <span class="hljs-string">"2025-07-27T10:30:00Z"</span> }</code></pre>
    </div>

    <h3 id="health-ready">
      GET /health/ready
      <span class="badge get">GET</span>
      <span class="badge auth">X-API-Key</span>
    </h3>
    <p>Readiness check — whether the service can accept requests.</p>

    <div class="endpoint-card get">
      <span class="method get">GET</span>
      <span class="path">/health/ready</span>
      <span class="desc">Readiness check</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> bash</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>curl -H <span class="hljs-string">"X-API-Key: YOUR_API_KEY"</span> https://sta.oryn.my.id/health/ready</code></pre>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot json"></span> Response</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>{ <span class="hljs-attr">"ready"</span>: <span class="hljs-literal">true</span>, <span class="hljs-attr">"status"</span>: <span class="hljs-string">"healthy"</span>, <span class="hljs-attr">"timestamp"</span>: <span class="hljs-string">"2025-07-27T10:30:00Z"</span> }</code></pre>
    </div>

    <h3 id="metrics">
      GET /metrics
      <span class="badge get">GET</span>
      <span class="badge auth">X-API-Key</span>
    </h3>
    <p>Performance and operational metrics — proxy health, cache stats, request rates.</p>

    <div class="endpoint-card get">
      <span class="method get">GET</span>
      <span class="path">/metrics</span>
      <span class="desc">Operational metrics</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> bash</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>curl -H <span class="hljs-string">"X-API-Key: YOUR_API_KEY"</span> https://sta.oryn.my.id/metrics</code></pre>
    </div>
  </section>

  <!-- Admin -->
  <section id="admin">
    <h2><span class="section-icon">&#9881;</span> Admin</h2>
    <p>All admin endpoints require the <code>X-API-Key</code> header. Returns <strong>401</strong> if missing or invalid.</p>

    <h3 id="warm-cache">
      POST /admin/warm-cache
      <span class="badge post">POST</span>
      <span class="badge auth">X-API-Key</span>
    </h3>
    <p>Manually trigger cache warming with popular translation pairs.</p>

    <div class="endpoint-card post">
      <span class="method post">POST</span>
      <span class="path">/admin/warm-cache</span>
      <span class="desc">Warm cache</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> bash</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>curl -X POST -H <span class="hljs-string">"X-API-Key: YOUR_API_KEY"</span> \
  https://sta.oryn.my.id/admin/warm-cache</code></pre>
    </div>

    <h3 id="cache-status">
      GET /admin/cache-status
      <span class="badge get">GET</span>
      <span class="badge auth">X-API-Key</span>
    </h3>
    <p>Get cache warming status — last warm time and total warmed entries.</p>

    <div class="endpoint-card get">
      <span class="method get">GET</span>
      <span class="path">/admin/cache-status</span>
      <span class="desc">Cache status</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> bash</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>curl -H <span class="hljs-string">"X-API-Key: YOUR_API_KEY"</span> \
  https://sta.oryn.my.id/admin/cache-status</code></pre>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot json"></span> Response</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>{
  <span class="hljs-attr">"code"</span>: <span class="hljs-number">200</span>,
  <span class="hljs-attr">"data"</span>: { <span class="hljs-attr">"lastWarmTime"</span>: <span class="hljs-number">1705312200000</span>, <span class="hljs-attr">"warmedCount"</span>: <span class="hljs-number">10</span> }
}</code></pre>
    </div>
  </section>

  <!-- Reference -->
  <section id="errors">
    <h2><span class="section-icon">&#9888;</span> Error Codes</h2>
    <div class="table-wrap">
      <table>
        <tr><th>Code</th><th>Description</th></tr>
        <tr><td><strong>200</strong></td><td>Success</td></tr>
        <tr><td><strong>207</strong></td><td>Partial success (V2 batch — some translations failed)</td></tr>
        <tr><td><strong>400</strong></td><td>Invalid request — bad JSON, missing fields, validation error</td></tr>
        <tr><td><strong>401</strong></td><td>Unauthorized — missing or invalid <code>X-API-Key</code></td></tr>
        <tr><td><strong>404</strong></td><td>Not found — debug endpoint when <code>DEBUG_MODE</code> is off</td></tr>
        <tr><td><strong>408</strong></td><td>Request timeout — upstream proxy did not respond</td></tr>
        <tr><td><strong>413</strong></td><td>Payload too large — text over 5000 chars or body over 32KB</td></tr>
        <tr><td><strong>415</strong></td><td>Unsupported Media Type — <code>Content-Type</code> must be <code>application/json</code></td></tr>
        <tr><td><strong>429</strong></td><td>Rate limit exceeded</td></tr>
        <tr><td><strong>500</strong></td><td>Internal server error</td></tr>
        <tr><td><strong>503</strong></td><td>Service unavailable</td></tr>
      </table>
    </div>
    <p>All error responses follow the standard format:</p>
    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot json"></span> Error response</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>{ <span class="hljs-attr">"code"</span>: <span class="hljs-number">400</span>, <span class="hljs-attr">"data"</span>: <span class="hljs-literal">null</span>, <span class="hljs-attr">"id"</span>: <span class="hljs-number">1234567890</span>, <span class="hljs-attr">"source_lang"</span>: <span class="hljs-literal">null</span>, <span class="hljs-attr">"target_lang"</span>: <span class="hljs-literal">null</span> }</code></pre>
    </div>
  </section>

  <section id="rate-limiting">
    <h2><span class="section-icon">&#9201;</span> Rate Limiting</h2>
    <p>Dual-level token bucket algorithm with sliding window burst protection.</p>
    <div class="table-wrap">
      <table>
        <tr><th>Level</th><th>Limit</th><th>Window</th></tr>
        <tr><td>Per-client IP</td><td><code>proxy_count &times; 8 &times; 60</code> tokens</td><td>1 minute</td></tr>
        <tr><td>Per-proxy endpoint</td><td>8 tokens/sec, 16 burst</td><td>1 second</td></tr>
      </table>
    </div>
    <div class="note">
      <span class="note-icon">&#8505;</span>
      <span>Rate limiting is enforced on <strong>every</strong> request, including cache hits. Uses fail-open behavior — allows the request if the rate limiter can't reach KV.</span>
    </div>
  </section>

  <section id="languages">
    <h2><span class="section-icon">&#127760;</span> Supported Languages</h2>
    <p>DeepL supports 30+ languages. Google Translate supports 100+ languages. Source language auto-detection is available for all endpoints.</p>
    <div class="lang-grid">
      <div class="lang-item"><span class="lang-code">AUTO</span> Auto-detect</div>
      <div class="lang-item"><span class="lang-code">AR</span> Arabic</div>
      <div class="lang-item"><span class="lang-code">BG</span> Bulgarian</div>
      <div class="lang-item"><span class="lang-code">CS</span> Czech</div>
      <div class="lang-item"><span class="lang-code">DA</span> Danish</div>
      <div class="lang-item"><span class="lang-code">DE</span> German</div>
      <div class="lang-item"><span class="lang-code">EL</span> Greek</div>
      <div class="lang-item"><span class="lang-code">EN</span> English</div>
      <div class="lang-item"><span class="lang-code">ES</span> Spanish</div>
      <div class="lang-item"><span class="lang-code">ET</span> Estonian</div>
      <div class="lang-item"><span class="lang-code">FI</span> Finnish</div>
      <div class="lang-item"><span class="lang-code">FR</span> French</div>
      <div class="lang-item"><span class="lang-code">HE</span> Hebrew</div>
      <div class="lang-item"><span class="lang-code">HU</span> Hungarian</div>
      <div class="lang-item"><span class="lang-code">ID</span> Indonesian</div>
      <div class="lang-item"><span class="lang-code">IT</span> Italian</div>
      <div class="lang-item"><span class="lang-code">JA</span> Japanese</div>
      <div class="lang-item"><span class="lang-code">KO</span> Korean</div>
      <div class="lang-item"><span class="lang-code">LT</span> Lithuanian</div>
      <div class="lang-item"><span class="lang-code">LV</span> Latvian</div>
      <div class="lang-item"><span class="lang-code">NB</span> Norwegian Bokm&aring;l</div>
      <div class="lang-item"><span class="lang-code">NL</span> Dutch</div>
      <div class="lang-item"><span class="lang-code">PL</span> Polish</div>
      <div class="lang-item"><span class="lang-code">PT</span> Portuguese</div>
      <div class="lang-item"><span class="lang-code">RO</span> Romanian</div>
      <div class="lang-item"><span class="lang-code">RU</span> Russian</div>
      <div class="lang-item"><span class="lang-code">SK</span> Slovak</div>
      <div class="lang-item"><span class="lang-code">SL</span> Slovenian</div>
      <div class="lang-item"><span class="lang-code">SV</span> Swedish</div>
      <div class="lang-item"><span class="lang-code">TH</span> Thai</div>
      <div class="lang-item"><span class="lang-code">TR</span> Turkish</div>
      <div class="lang-item"><span class="lang-code">UK</span> Ukrainian</div>
      <div class="lang-item"><span class="lang-code">VI</span> Vietnamese</div>
      <div class="lang-item"><span class="lang-code">ZH</span> Chinese</div>
    </div>
  </section>

  <footer>
    <p>STA v2.0.0 &mdash; Serverless Translation API &middot; MIT License</p>
    <div class="footer-links">
      <a href="https://github.com/Fahry-a/STA" target="_blank" rel="noopener">GitHub</a>
      <a href="https://github.com/Fahry-a/STA/issues" target="_blank" rel="noopener">Issues</a>
      <a href="https://github.com/Fahry-a/STA/releases" target="_blank" rel="noopener">Releases</a>
    </div>
  </footer>
</main>

<script>
  // Progress bar
  window.addEventListener('scroll', function() {
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    var progress = (window.scrollY / docHeight) * 100;
    document.getElementById('progress').style.width = progress + '%';
  });

  // Active nav link
  var sections = document.querySelectorAll('section[id], h2[id], h3[id]');
  var navLinks = document.querySelectorAll('nav a');
  window.addEventListener('scroll', function() {
    var current = '';
    sections.forEach(function(section) {
      var top = section.offsetTop - 120;
      if (window.scrollY >= top) {
        current = section.getAttribute('id');
      }
    });
    navLinks.forEach(function(link) {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
      }
    });
  });

  // Mobile menu
  var menuBtn = document.getElementById('menu-toggle');
  var overlay = document.getElementById('menu-overlay');
  var sidebar = document.getElementById('sidebar');
  function closeMenu() {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
    menuBtn.innerHTML = '&#9776;';
  }
  menuBtn.addEventListener('click', function() {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
    menuBtn.innerHTML = sidebar.classList.contains('open') ? '&#10005;' : '&#9776;';
  });
  overlay.addEventListener('click', closeMenu);
  document.querySelectorAll('nav a').forEach(function(a) {
    a.addEventListener('click', closeMenu);
  });

  // Copy code blocks
  var toastTimer;
  function showToast(msg) {
    var toast = document.getElementById('toast');
    toast.textContent = msg || 'Copied to clipboard';
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 2000);
  }
  function copyCode(btn) {
    var block = btn.closest('.code-block');
    var code = block.querySelector('code');
    var text = code.textContent || code.innerText;
    navigator.clipboard.writeText(text).then(function() {
      btn.textContent = 'Copied!';
      btn.classList.add('copied');
      showToast('Copied to clipboard');
      setTimeout(function() { btn.textContent = 'Copy'; btn.classList.remove('copied'); }, 2000);
    }).catch(function() {
      showToast('Failed to copy');
    });
  }
  function copyBaseUrl(el) {
    navigator.clipboard.writeText('https://sta.oryn.my.id').then(function() {
      el.classList.add('copied');
      showToast('Copied to clipboard');
      setTimeout(function() { el.classList.remove('copied'); }, 2000);
    });
  }

  // Intersection Observer for animations
  document.addEventListener('DOMContentLoaded', function() {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate');
        }
      });
    }, { threshold: 0.1 });
    document.querySelectorAll('section, .code-block, .endpoint-card').forEach(function(el, i) {
      el.style.opacity = '0';
      observer.observe(el);
    });
  });
</script>
</body>
</html>`;

export function handleDocs(c: any): Response | Promise<Response> {
  return c.html(DOCS_PAGE);
}
