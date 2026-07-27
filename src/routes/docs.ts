/* Hallmark · pre-emit critique: P4 H5 E5 S5 R5 V5 */
/* Hallmark · genre: modern-minimal · macrostructure: Component Playground · theme: Cobalt (dark) · enrichment: none · nav: N3 Side-rail · footer: Ft1 Mast-headed */

const DOCS_PAGE = `<!DOCTYPE html>
<html lang="en" style="overflow-x: clip">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>STA — Serverless Translation API</title>
<link rel="icon" href="https://files.oryn.my.id/images/heheheh-1%3A1.jpg" type="image/jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { overflow-x: clip; }
  body { overflow-x: clip; }

  :root {
    --font-display: 'Space Grotesk', system-ui, sans-serif;
    --font-body: 'Inter', system-ui, sans-serif;
    --font-mono: 'JetBrains Mono', ui-monospace, monospace;

    --color-paper:    oklch(14% 0.008 255);
    --color-paper-2:  oklch(18% 0.012 255);
    --color-paper-3:  oklch(22% 0.014 255);
    --color-paper-4:  oklch(26% 0.016 255);
    --color-ink:      oklch(93% 0.008 285);
    --color-ink-2:    oklch(78% 0.006 285);
    --color-ink-3:    oklch(62% 0.006 285);
    --color-rule:     oklch(28% 0.010 255);
    --color-accent:   oklch(62% 0.16  250);
    --color-accent-2: oklch(52% 0.14  250);
    --color-accent-glow: oklch(62% 0.16 250 / 0.1);
    --color-green:    oklch(65% 0.15  145);
    --color-green-glow: oklch(65% 0.15 145 / 0.1);
    --color-red:      oklch(60% 0.16   25);
    --color-orange:   oklch(70% 0.14   75);
    --color-orange-glow: oklch(70% 0.14 75 / 0.1);
    --color-code-bg:  oklch(10% 0.006 255);
    --color-accent-hover: oklch(72% 0.12  250);
    --color-overlay:  oklch(0% 0 0 / 0.5);
    --color-green-border: oklch(65% 0.15 145 / 0.15);
    --color-accent-border: oklch(62% 0.16 250 / 0.15);
    --color-orange-border: oklch(70% 0.14 75 / 0.15);
    --color-green-border-strong: oklch(65% 0.15 145 / 0.2);
    --color-syntax-pink: oklch(65% 0.14 350);
    --color-syntax-purple: oklch(72% 0.1 285);

    --space-3xs: 0.125rem;
    --space-2xs: 0.25rem;
    --space-xs:  0.5rem;
    --space-sm:  0.75rem;
    --space-md:  1rem;
    --space-lg:  1.5rem;
    --space-xl:  2.5rem;
    --space-2xl: 4rem;
    --space-3xl: 6rem;

    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;

    --ease-out:    cubic-bezier(0.16, 1, 0.3, 1);
    --ease-in:     cubic-bezier(0.7,  0, 0.84, 0);
    --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

    --dur-micro: 120ms;
    --dur-short: 220ms;
    --dur-long:  420ms;

    --z-raised:   10;
    --z-sticky:   200;
    --z-modal:    400;
    --z-toast:    500;
  }

  ::selection { background: var(--color-accent); color: var(--color-paper); }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--color-paper-4); border-radius: 2px; }

  body {
    font-family: var(--font-body);
    background: var(--color-paper);
    color: var(--color-ink);
    line-height: 1.7;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    min-height: 100dvh;
  }

  /* Progress */
  #progress {
    position: fixed;
    top: 0; left: 0;
    height: 2px;
    background: var(--color-accent);
    z-index: var(--z-toast);
    transition: width 0.1s var(--ease-out);
    width: 0;
  }

  /* Sidebar — N3 side-rail adapted */
  .sidebar {
    width: 260px;
    position: fixed;
    top: 0; left: 0;
    bottom: 0;
    background: var(--color-paper-2);
    border-right: 1px solid var(--color-rule);
    z-index: var(--z-sticky);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .sidebar-header {
    padding: var(--space-lg) var(--space-lg) var(--space-md);
    border-bottom: 1px solid var(--color-rule);
    flex-shrink: 0;
    position: sticky;
    top: 0;
    background: var(--color-paper-2);
    z-index: 2;
  }
  .sidebar-header .wordmark {
    font-family: var(--font-display);
    font-size: 1.125rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: var(--color-ink);
    line-height: 1.2;
  }
  .sidebar-header .tagline {
    font-size: 0.75rem;
    color: var(--color-ink-3);
    margin-top: var(--space-3xs);
    font-weight: 400;
  }
  .sidebar-body {
    padding: var(--space-xs) 0 var(--space-xl);
    flex: 1;
  }
  .sidebar-group {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-ink-3);
    padding: var(--space-lg) var(--space-lg) var(--space-2xs);
    opacity: 0.5;
  }
  .sidebar-link {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-lg);
    color: var(--color-ink-2);
    text-decoration: none;
    font-size: 0.8125rem;
    font-weight: 400;
    transition: color var(--dur-micro) var(--ease-out), background var(--dur-micro) var(--ease-out);
    border-left: 2px solid transparent;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sidebar-link:hover {
    color: var(--color-ink);
    background: var(--color-accent-glow);
  }
  .sidebar-link:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: -2px;
  }
  .sidebar-link.active {
    color: var(--color-accent);
    border-left-color: var(--color-accent);
    background: var(--color-accent-glow);
    font-weight: 500;
  }
  .sidebar-link .method-tag {
    font-family: var(--font-mono);
    font-size: 0.625rem;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 3px;
    flex-shrink: 0;
  }
  .sidebar-link .method-tag.post {
    color: var(--color-green);
    background: var(--color-green-glow);
  }
  .sidebar-link .method-tag.get {
    color: var(--color-accent);
    background: var(--color-accent-glow);
  }

  /* Menu toggle */
  #menu-toggle {
    display: none;
    position: fixed;
    top: var(--space-md);
    left: var(--space-md);
    z-index: calc(var(--z-modal) + 1);
    background: var(--color-paper-3);
    border: 1px solid var(--color-rule);
    color: var(--color-ink);
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 1.25rem;
    align-items: center;
    justify-content: center;
    transition: background var(--dur-micro) var(--ease-out), border-color var(--dur-micro) var(--ease-out);
    -webkit-backdrop-filter: blur(12px);
    backdrop-filter: blur(12px);
  }
  #menu-toggle:hover {
    background: var(--color-paper-4);
    border-color: var(--color-accent);
  }
  #menu-toggle:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  #menu-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: var(--color-overlay);
    z-index: calc(var(--z-sticky) + 1);
    -webkit-backdrop-filter: blur(4px);
    backdrop-filter: blur(4px);
  }

  /* Main */
  main {
    margin-left: 260px;
    flex: 1;
    max-width: 920px;
    padding: 0 var(--space-3xl) 80px;
    min-height: 100dvh;
  }

  /* Hero */
  .hero {
    padding: var(--space-3xl) 0 var(--space-2xl);
    position: relative;
  }
  .hero::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: calc(-1 * var(--space-3xl));
    right: calc(-1 * var(--space-3xl));
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--color-rule), var(--color-rule), transparent);
  }
  .hero h1 {
    font-family: var(--font-display);
    font-size: clamp(2rem, 4vw + 0.5rem, 3.25rem);
    font-weight: 700;
    line-height: 1.12;
    letter-spacing: -0.03em;
    color: var(--color-ink);
    overflow-wrap: anywhere;
    min-width: 0;
  }
  .hero p {
    font-size: 0.9375rem;
    color: var(--color-ink-2);
    margin-top: var(--space-sm);
    max-width: 580px;
    line-height: 1.75;
  }
  .hero .base-url {
    margin-top: var(--space-lg);
    display: inline-flex;
    align-items: center;
    gap: var(--space-xs);
    background: var(--color-paper-3);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-md);
    padding: var(--space-sm) var(--space-md);
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--color-ink);
    cursor: pointer;
    transition: border-color var(--dur-micro) var(--ease-out), background var(--dur-micro) var(--ease-out);
    position: relative;
    white-space: nowrap;
  }
  .hero .base-url:hover {
    border-color: var(--color-accent);
    background: var(--color-accent-glow);
  }
  .hero .base-url:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .hero .base-url .copy-hint {
    font-size: 0.625rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    font-family: var(--font-body);
    color: var(--color-ink-3);
    font-weight: 600;
  }
  .hero .base-url[data-state="copied"]::after {
    content: 'Copied!';
    position: absolute;
    top: calc(-1 * var(--space-xl));
    left: 50%;
    translate: -50% 0;
    background: var(--color-green);
    color: var(--color-paper);
    font-size: 0.6875rem;
    font-weight: 600;
    padding: 2px 10px;
    border-radius: 4px;
    font-family: var(--font-body);
  }

  /* Sections */
  section {
    padding: var(--space-2xl) 0;
    border-bottom: 1px solid var(--color-rule);
  }
  section:last-of-type { border-bottom: none; }

  h2 {
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: -0.02em;
    margin-bottom: var(--space-md);
    color: var(--color-ink);
    line-height: 1.25;
    overflow-wrap: anywhere;
    min-width: 0;
  }
  h3 {
    font-family: var(--font-display);
    font-size: 1.0625rem;
    font-weight: 600;
    margin: var(--space-xl) 0 var(--space-xs);
    color: var(--color-ink);
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    flex-wrap: wrap;
    line-height: 1.3;
  }
  h4 {
    font-family: var(--font-display);
    font-size: 0.875rem;
    font-weight: 600;
    margin: var(--space-lg) 0 var(--space-xs);
    color: var(--color-ink-2);
  }
  p {
    color: var(--color-ink-2);
    font-size: 0.875rem;
    line-height: 1.8;
    margin-bottom: var(--space-sm);
  }
  a {
    color: var(--color-accent);
    text-decoration: none;
    transition: color var(--dur-micro) var(--ease-out);
  }
  a:hover { color: var(--color-accent-hover); }
  ul, ol {
    padding-left: var(--space-lg);
    margin-bottom: var(--space-md);
  }
  li {
    color: var(--color-ink-2);
    font-size: 0.875rem;
    line-height: 1.8;
    margin-bottom: var(--space-2xs);
  }
  li strong { color: var(--color-ink); }

  /* Badges */
  .badge {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2xs);
    font-size: 0.625rem;
    font-weight: 700;
    padding: 2px var(--space-xs);
    border-radius: 20px;
    letter-spacing: 0.03em;
    text-transform: uppercase;
    vertical-align: middle;
    white-space: nowrap;
    border: 1px solid transparent;
  }
  .badge.post {
    background: var(--color-green-glow);
    color: var(--color-green);
    border-color: var(--color-green-border);
  }
  .badge.get {
    background: var(--color-accent-glow);
    color: var(--color-accent);
    border-color: var(--color-accent-border);
  }
  .badge.auth {
    background: var(--color-orange-glow);
    color: var(--color-orange);
    border-color: var(--color-orange-border);
  }
  .badge.public {
    background: var(--color-green-glow);
    color: var(--color-ink-2);
    border-color: var(--color-green-border);
  }

  /* Endpoint card */
  .endpoint-card {
    background: var(--color-paper-2);
    border: 1px solid var(--color-rule);
    border-radius: var(--radius-lg);
    padding: var(--space-md) var(--space-lg);
    margin: var(--space-sm) 0 var(--space-lg);
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    transition: border-color var(--dur-micro) var(--ease-out), background var(--dur-micro) var(--ease-out);
  }
  .endpoint-card:hover {
    border-color: var(--color-paper-4);
    background: var(--color-paper-3);
  }
  .endpoint-card .method {
    font-weight: 600;
    font-size: 0.6875rem;
    padding: 2px var(--space-xs);
    border-radius: 20px;
    letter-spacing: 0.05em;
    flex-shrink: 0;
    font-family: var(--font-body);
  }
  .endpoint-card .method.post { background: var(--color-green-glow); color: var(--color-green); }
  .endpoint-card .method.get { background: var(--color-accent-glow); color: var(--color-accent); }
  .endpoint-card .path { color: var(--color-ink); flex-shrink: 0; }
  .endpoint-card .desc {
    color: var(--color-ink-2);
    font-family: var(--font-body);
    font-size: 0.75rem;
    margin-left: auto;
    text-align: right;
  }

  /* Code blocks — Component Playground */
  .code-block {
    position: relative;
    margin: var(--space-sm) 0 var(--space-lg);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: var(--color-code-bg);
    border: 1px solid var(--color-rule);
    transition: border-color var(--dur-micro) var(--ease-out);
  }
  .code-block:hover { border-color: var(--color-paper-4); }
  .code-block .code-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-xs) var(--space-md);
    background: var(--color-paper-2);
    border-bottom: 1px solid var(--color-rule);
    font-size: 0.6875rem;
    color: var(--color-ink-3);
    font-weight: 500;
  }
  .code-block .code-header .lang-label {
    display: flex;
    align-items: center;
    gap: var(--space-2xs);
  }
  .code-block .code-header .lang-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .code-block .code-header .lang-dot.bash { background: var(--color-green); }
  .code-block .code-header .lang-dot.json { background: var(--color-orange); }
  .code-block .code-header .copy-btn {
    background: transparent;
    border: 1px solid var(--color-rule);
    color: var(--color-ink-3);
    font-size: 0.6875rem;
    font-family: var(--font-body);
    font-weight: 500;
    padding: 2px var(--space-xs);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--dur-micro) var(--ease-out);
    display: flex;
    align-items: center;
    gap: var(--space-2xs);
    min-height: 28px;
    white-space: nowrap;
  }
  .code-block .code-header .copy-btn:hover {
    background: var(--color-paper-4);
    color: var(--color-ink);
    border-color: var(--color-ink-3);
  }
  .code-block .code-header .copy-btn:focus-visible {
    outline: 2px solid var(--color-accent);
    outline-offset: 2px;
  }
  .code-block .code-header .copy-btn[data-state="copied"] {
    background: var(--color-green-glow);
    color: var(--color-green);
    border-color: var(--color-green-border-strong);
  }
  .code-block pre {
    padding: var(--space-md) var(--space-lg);
    overflow-x: auto;
    font-size: 0.8125rem;
    line-height: 1.6;
    font-family: var(--font-mono);
    tab-size: 2;
    -moz-tab-size: 2;
    margin: 0;
  }
  .code-block pre code {
    background: none;
    padding: 0;
    border-radius: 0;
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    line-height: 1.6;
  }
  .code-block pre code .hljs-attr { color: var(--color-accent); }
  .code-block pre code .hljs-string { color: var(--color-green); }
  .code-block pre code .hljs-number { color: var(--color-orange); }
  .code-block pre code .hljs-literal { color: var(--color-syntax-pink); }
  .code-block pre code .hljs-keyword { color: var(--color-accent); }
  .code-block pre code .hljs-comment { color: var(--color-ink-3); }
  .code-block pre code .hljs-built_in { color: var(--color-syntax-purple); }
  .code-block pre code .hljs-title { color: var(--color-ink); }
  .code-block pre code .hljs-operator { color: var(--color-ink-2); }
  .code-block pre code .hljs-punctuation { color: var(--color-ink-2); }

  /* Inline code */
  p code, li code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    background: var(--color-paper-3);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
    color: var(--color-accent);
    font-weight: 500;
  }

  /* Tables */
  .table-wrap {
    overflow-x: auto;
    margin: var(--space-sm) 0 var(--space-lg);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-rule);
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  th {
    text-align: left;
    padding: var(--space-xs) var(--space-md);
    font-weight: 600;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-ink-3);
    background: var(--color-paper-2);
    border-bottom: 1px solid var(--color-rule);
    font-family: var(--font-body);
  }
  td {
    padding: var(--space-xs) var(--space-md);
    color: var(--color-ink-2);
    border-bottom: 1px solid var(--color-rule);
    font-size: 0.8125rem;
    font-variant-numeric: tabular-nums;
  }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: var(--color-paper-3); }
  td code {
    font-size: 0.75rem;
    background: var(--color-paper-3);
    padding: 1px 5px;
    border-radius: var(--radius-sm);
    color: var(--color-accent);
    font-family: var(--font-mono);
  }
  td .badge { font-size: 0.5625rem; padding: 1px 6px; }

  /* Note box */
  .note {
    background: var(--color-accent-glow);
    border: 1px solid var(--color-accent-border);
    border-radius: var(--radius-md);
    padding: var(--space-md) var(--space-lg);
    margin: var(--space-md) 0;
    font-size: 0.8125rem;
    color: var(--color-ink-2);
    display: flex;
    gap: var(--space-xs);
    align-items: flex-start;
    line-height: 1.6;
  }
  .note .note-icon {
    font-size: 1rem;
    flex-shrink: 0;
    margin-top: 1px;
    line-height: 1;
  }
  .note strong { color: var(--color-accent); }

  /* Language grid */
  .lang-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: var(--space-3xs);
    margin: var(--space-sm) 0 var(--space-md);
  }
  .lang-item {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-2xs) var(--space-xs);
    border-radius: var(--radius-sm);
    font-size: 0.8125rem;
    color: var(--color-ink-2);
    transition: background var(--dur-micro) var(--ease-out);
  }
  .lang-item:hover { background: var(--color-paper-3); }
  .lang-item .lang-code {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--color-accent);
    width: 32px;
    flex-shrink: 0;
  }

  /* Auth grid */
  .auth-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--space-2xs);
    margin: var(--space-sm) 0 var(--space-md);
  }
  .auth-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-xs) var(--space-md);
    background: var(--color-paper-2);
    border-radius: var(--radius-md);
    border: 1px solid var(--color-rule);
    font-size: 0.8125rem;
  }
  .auth-row .endpoint-name {
    color: var(--color-ink);
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }

  /* Footer — Ft1 Mast-headed */
  footer {
    margin-top: var(--space-xl);
    padding: var(--space-lg) 0 var(--space-md);
    text-align: center;
    border-top: 1px solid var(--color-rule);
  }
  footer .wordmark {
    font-family: var(--font-display);
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--color-ink);
    margin-bottom: var(--space-3xs);
  }
  footer .tagline {
    font-size: 0.75rem;
    color: var(--color-ink-3);
    margin-bottom: var(--space-sm);
  }
  footer .links {
    display: flex;
    justify-content: center;
    gap: var(--space-lg);
    font-size: 0.75rem;
  }
  footer .links a {
    color: var(--color-ink-3);
    transition: color var(--dur-micro) var(--ease-out);
    white-space: nowrap;
  }
  footer .links a:hover { color: var(--color-ink); }

  /* Responsive */
  @media (max-width: 1024px) {
    main { padding: 0 var(--space-xl) 80px; }
    .hero::after { left: calc(-1 * var(--space-xl)); right: calc(-1 * var(--space-xl)); }
  }
  @media (max-width: 768px) {
    #menu-toggle { display: flex; }
    .sidebar {
      transform: translateX(-100%);
      transition: transform var(--dur-long) var(--ease-out);
    }
    .sidebar.open { transform: translateX(0); }
    #menu-overlay.open { display: block; }
    main {
      margin-left: 0;
      padding: 0 var(--space-lg) 80px;
    }
    .hero {
      padding: calc(var(--space-xl) + 48px) 0 var(--space-xl);
    }
    .hero h1 { font-size: clamp(1.5rem, 5vw + 0.5rem, 2rem); }
    .hero::after { left: calc(-1 * var(--space-lg)); right: calc(-1 * var(--space-lg)); }
    section { padding: var(--space-xl) 0; }
    .auth-grid { grid-template-columns: 1fr; }
    .lang-grid {
      grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
    }
    h2 { font-size: 1.25rem; }
  }
  @media (max-width: 414px) {
    main { padding: 0 var(--space-md) 80px; }
    .hero h1 { font-size: 1.375rem; }
    .hero p { font-size: 0.8125rem; }
    .endpoint-card {
      flex-wrap: wrap;
      gap: var(--space-xs);
      padding: var(--space-sm);
    }
    .endpoint-card .desc {
      margin-left: 0;
      text-align: left;
      width: 100%;
    }
    .table-wrap { margin: var(--space-sm) calc(-1 * var(--space-md)) var(--space-lg); }
  }
  @media (max-width: 375px) {
    .hero { padding-top: calc(var(--space-xl) + 44px); }
    .hero h1 { font-size: 1.25rem; }
  }
  @media (max-width: 320px) {
    .lang-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 150ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 150ms !important;
    }
    .sidebar { transition: none; }
  }
</style>
</head>
<body>

<div id="progress"></div>

<button id="menu-toggle" aria-label="Toggle menu">&#9776;</button>
<div id="menu-overlay"></div>

<aside class="sidebar" id="sidebar">
  <div class="sidebar-header">
    <div class="wordmark">STA</div>
    <div class="tagline">Serverless Translation API</div>
  </div>
  <nav class="sidebar-body">
    <div class="sidebar-group">Getting Started</div>
    <a href="#overview" class="sidebar-link">Overview</a>
    <a href="#auth" class="sidebar-link">Authentication</a>

    <div class="sidebar-group">Translation</div>
    <a href="#deepl" class="sidebar-link"><span class="method-tag post">POST</span> /deepl</a>
    <a href="#google" class="sidebar-link"><span class="method-tag post">POST</span> /google</a>
    <a href="#translate" class="sidebar-link"><span class="method-tag post">POST</span> /translate</a>
    <a href="#v2" class="sidebar-link"><span class="method-tag post">POST</span> /v2/translate</a>
    <a href="#debug" class="sidebar-link"><span class="method-tag post">POST</span> /debug</a>

    <div class="sidebar-group">Monitoring</div>
    <a href="#health" class="sidebar-link"><span class="method-tag get">GET</span> /health</a>
    <a href="#health-live" class="sidebar-link"><span class="method-tag get">GET</span> /health/live</a>
    <a href="#health-ready" class="sidebar-link"><span class="method-tag get">GET</span> /health/ready</a>
    <a href="#metrics" class="sidebar-link"><span class="method-tag get">GET</span> /metrics</a>

    <div class="sidebar-group">Admin</div>
    <a href="#warm-cache" class="sidebar-link"><span class="method-tag post">POST</span> /admin/warm-cache</a>
    <a href="#cache-status" class="sidebar-link"><span class="method-tag get">GET</span> /admin/cache-status</a>

    <div class="sidebar-group">Reference</div>
    <a href="#errors" class="sidebar-link">Error Codes</a>
    <a href="#rate-limiting" class="sidebar-link">Rate Limiting</a>
    <a href="#languages" class="sidebar-link">Languages</a>
  </nav>
</aside>

<main>
  <div class="hero">
    <h1>From curl to translation in one call</h1>
    <p>Unified translation API over a distributed proxy network — <strong>DeepL</strong> and <strong>Google Translate</strong> through a single endpoint, with load balancing, two-level caching, and automatic failover.</p>
    <div class="base-url" id="base-url" onclick="copyBaseUrl(this)">
      <span>https://sta.oryn.my.id</span>
      <span class="copy-hint">Copy</span>
    </div>
  </div>

  <section id="overview">
    <h2>Overview</h2>
    <p>STA provides a unified translation API through a distributed network of XDPL proxy endpoints. It handles request routing, load balancing, rate limiting, caching, and automatic failover — giving you a reliable translation service without managing infrastructure.</p>

    <h3>How it works</h3>
    <p>Send a translation request to any endpoint. STA selects the healthiest proxy, builds the appropriate JSONRPC request (with browser fingerprint rotation for DeepL), sends it with retry logic, caches the result, and returns a clean JSON response.</p>

    <h3>Features</h3>
    <ul>
      <li><strong>Two providers</strong> — DeepL neural machine translation and Google Translate</li>
      <li><strong>Two-level cache</strong> — In-memory LRU (1000 entries) plus Cloudflare KV (1h TTL)</li>
      <li><strong>Smart proxy rotation</strong> — Weighted random selection by health, with automatic failover</li>
      <li><strong>Rate limiting</strong> — Dual token buckets: per-client IP and per-proxy endpoint</li>
      <li><strong>V2 batch</strong> — Translate up to 10 texts at once with Array Per Request mode</li>
      <li><strong>Fingerprint rotation</strong> — 5 User-Agents by 5 Accept-Language variants</li>
    </ul>
  </section>

  <section id="auth">
    <h2>Authentication</h2>
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

  <section id="translation-endpoints">
    <h2>Translation Endpoints</h2>

    <h3 id="deepl">
      POST /deepl
      <span class="badge post">POST</span>
      <span class="badge public">Public</span>
    </h3>
    <p>Translate text using DeepL&#x27;s neural machine translation engine. Recommended for production use.</p>

    <div class="endpoint-card">
      <span class="method post">POST</span>
      <span class="path">/deepl</span>
      <span class="desc">DeepL translation</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> curl</span>
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

    <div class="endpoint-card">
      <span class="method post">POST</span>
      <span class="path">/google</span>
      <span class="desc">Google Translate</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> curl</span>
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

    <div class="endpoint-card">
      <span class="method post">POST</span>
      <span class="path">/translate</span>
      <span class="desc">Legacy DeepL</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> curl</span>
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

    <div class="endpoint-card">
      <span class="method post">POST</span>
      <span class="path">/v2/translate</span>
      <span class="desc">Batch translation</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> curl</span>
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

    <div class="endpoint-card">
      <span class="method post">POST</span>
      <span class="path">/debug</span>
      <span class="desc">Request debug</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> curl</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>curl -X POST https://sta.oryn.my.id/debug \
  -H <span class="hljs-string">"Content-Type: application/json"</span> \
  -d <span class="hljs-string">'{"text": "Hello", "source_lang": "EN", "target_lang": "ZH"}'</span></code></pre>
    </div>
  </section>

  <section id="monitoring">
    <h2>Health and Monitoring</h2>

    <h3 id="health">
      GET /health
      <span class="badge get">GET</span>
      <span class="badge auth">X-API-Key</span>
    </h3>
    <p>Comprehensive health status of all service components: proxy endpoints, cache, rate limiter, and performance metrics.</p>

    <div class="endpoint-card">
      <span class="method get">GET</span>
      <span class="path">/health</span>
      <span class="desc">Full health check</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> curl</span>
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

    <div class="endpoint-card">
      <span class="method get">GET</span>
      <span class="path">/health/live</span>
      <span class="desc">Liveness probe</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> curl</span>
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

    <div class="endpoint-card">
      <span class="method get">GET</span>
      <span class="path">/health/ready</span>
      <span class="desc">Readiness check</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> curl</span>
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

    <div class="endpoint-card">
      <span class="method get">GET</span>
      <span class="path">/metrics</span>
      <span class="desc">Operational metrics</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> curl</span>
        <button class="copy-btn" onclick="copyCode(this)">Copy</button>
      </div>
      <pre><code>curl -H <span class="hljs-string">"X-API-Key: YOUR_API_KEY"</span> https://sta.oryn.my.id/metrics</code></pre>
    </div>
  </section>

  <section id="admin">
    <h2>Admin</h2>
    <p>All admin endpoints require the <code>X-API-Key</code> header. Returns <strong>401</strong> if missing or invalid.</p>

    <h3 id="warm-cache">
      POST /admin/warm-cache
      <span class="badge post">POST</span>
      <span class="badge auth">X-API-Key</span>
    </h3>
    <p>Manually trigger cache warming with popular translation pairs.</p>

    <div class="endpoint-card">
      <span class="method post">POST</span>
      <span class="path">/admin/warm-cache</span>
      <span class="desc">Warm cache</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> curl</span>
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

    <div class="endpoint-card">
      <span class="method get">GET</span>
      <span class="path">/admin/cache-status</span>
      <span class="desc">Cache status</span>
    </div>

    <div class="code-block">
      <div class="code-header">
        <span class="lang-label"><span class="lang-dot bash"></span> curl</span>
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

  <section id="errors">
    <h2>Error Codes</h2>
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
    <h2>Rate Limiting</h2>
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
      <span>Rate limiting is enforced on <strong>every</strong> request, including cache hits. Uses fail-open behavior — allows the request if the rate limiter cannot reach KV.</span>
    </div>
  </section>

  <section id="languages">
    <h2>Supported Languages</h2>
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
    <div class="wordmark">STA</div>
    <p class="tagline">Serverless Translation API — MIT License</p>
    <div class="links">
      <a href="https://github.com/Fahry-a/STA" target="_blank" rel="noopener">GitHub</a>
      <a href="https://github.com/Fahry-a/STA/issues" target="_blank" rel="noopener">Issues</a>
      <a href="https://github.com/Fahry-a/STA/releases" target="_blank" rel="noopener">Releases</a>
    </div>
  </footer>
</main>

<script>
  var progress = document.getElementById('progress');
  window.addEventListener('scroll', function() {
    var docHeight = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = (window.scrollY / docHeight * 100) + '%';
  }, { passive: true });

  var sections = document.querySelectorAll('section[id]');
  var navLinks = document.querySelectorAll('.sidebar-link');
  window.addEventListener('scroll', function() {
    var current = '';
    sections.forEach(function(section) {
      if (window.scrollY >= section.offsetTop - 100) {
        current = section.getAttribute('id');
      }
    });
    navLinks.forEach(function(link) {
      link.classList.toggle('active', link.getAttribute('href') === '#' + current);
    });
  }, { passive: true });

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
  document.querySelectorAll('.sidebar-link').forEach(function(a) {
    a.addEventListener('click', closeMenu);
  });

  function copyCode(btn) {
    var block = btn.closest('.code-block');
    var code = block.querySelector('code');
    navigator.clipboard.writeText(code.textContent).then(function() {
      btn.dataset.state = 'copied';
      btn.textContent = 'Copied';
      setTimeout(function() {
        delete btn.dataset.state;
        btn.textContent = 'Copy';
      }, 2500);
    });
  }

  function copyBaseUrl(el) {
    navigator.clipboard.writeText('https://sta.oryn.my.id').then(function() {
      el.dataset.state = 'copied';
      setTimeout(function() { delete el.dataset.state; }, 2500);
    });
  }
</script>
</body>
</html>`;

import type { Context } from 'hono';

export function handleDocs(c: Context): Response {
  return c.html(DOCS_PAGE);
}
