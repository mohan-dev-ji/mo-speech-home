---
marp: true
html: true
paginate: true
---

<style>
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Epilogue:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg: #07090f;
  --glass: rgba(255,255,255,0.04);
  --border: rgba(255,255,255,0.08);
  --text: #e8edf5;
  --muted: #4a5568;
  --subtle: #94a3b8;
  --blue: #38bdf8;
  --amber: #fbbf24;
  --green: #34d399;
  --purple: #c084fc;
  --display: 'Bricolage Grotesque', sans-serif;
  --body: 'Epilogue', sans-serif;
  --mono: 'JetBrains Mono', monospace;
}

section {
  background: var(--bg);
  color: var(--text);
  font-family: var(--body);
  font-size: 18px;
  line-height: 1.6;
  padding: 48px 72px;
  position: relative;
  overflow: hidden;
}

section::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 20% 30%, rgba(56,189,248,0.05) 0%, transparent 55%),
    radial-gradient(ellipse at 80% 70%, rgba(52,211,153,0.03) 0%, transparent 55%);
  pointer-events: none;
}

section > header {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(to right, transparent, var(--blue) 40%, var(--green) 70%, transparent);
}

h1 { font-family: var(--display); font-weight: 800; font-size: 58px; line-height: 1.0; letter-spacing: -2px; margin: 0 0 16px; }
h2 { font-family: var(--display); font-weight: 600; font-size: 32px; letter-spacing: -0.7px; margin: 0 0 18px; }

p { margin: 0 0 12px; color: var(--subtle); font-weight: 300; font-size: 16px; }

code {
  font-family: var(--mono); font-size: 13px;
  background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.2);
  padding: 1px 7px; border-radius: 4px; color: var(--blue);
}

pre {
  background: rgba(0,0,0,0.5) !important;
  border: 1px solid var(--border) !important;
  border-radius: 12px !important;
  padding: 18px 22px !important;
  font-family: var(--mono) !important;
  font-size: 12.5px !important;
  line-height: 1.75 !important;
  margin: 0;
}

pre code { background: none !important; border: none !important; padding: 0 !important; color: #a5b4fc !important; font-size: 12.5px !important; }

.glass { background: var(--glass); border: 1px solid var(--border); border-radius: 14px; padding: 18px 22px; }
.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
.g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

.badge { display: inline-block; font-family: var(--mono); font-size: 10px; padding: 3px 10px; border-radius: 100px; font-weight: 500; letter-spacing: 0.6px; text-transform: uppercase; }
.bb { background: rgba(56,189,248,0.1); color: var(--blue); border: 1px solid rgba(56,189,248,0.25); }
.bg_ { background: rgba(52,211,153,0.1); color: var(--green); border: 1px solid rgba(52,211,153,0.25); }

.node { background: var(--glass); border: 1px solid var(--border); border-radius: 9px; padding: 9px 15px; font-family: var(--mono); font-size: 12px; line-height: 1.5; }
.nb { border-color: rgba(56,189,248,0.35); background: rgba(56,189,248,0.06); }
.ng { border-color: rgba(52,211,153,0.35); background: rgba(52,211,153,0.06); }
.na { border-color: rgba(251,191,36,0.35); background: rgba(251,191,36,0.06); }
.np { border-color: rgba(192,132,252,0.35); background: rgba(192,132,252,0.06); }

.divider { width: 56px; height: 3px; background: linear-gradient(to right, var(--blue), transparent); border-radius: 2px; margin: 16px 0; }

table { width: 100%; border-collapse: collapse; font-size: 14px; }
th { font-family: var(--display); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.6px; color: var(--muted); padding: 8px 14px; border-bottom: 1px solid var(--border); text-align: left; }
td { padding: 11px 14px; border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 13px; vertical-align: top; line-height: 1.5; }
tr:last-child td { border-bottom: none; }

.ftree { font-family: var(--mono); font-size: 12.5px; line-height: 1.9; color: var(--subtle); }
.ftree .d { color: var(--amber); }
.ftree .h { color: var(--blue); }
.ftree .c { color: var(--muted); font-size: 11px; }

.seq-actor { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--muted); width: 88px; text-align: right; flex-shrink: 0; font-family: var(--mono); }
.seq-arr { color: var(--blue); font-size: 17px; flex-shrink: 0; }
.seq-note { margin-left: 112px; padding: 5px 12px; background: rgba(251,191,36,0.07); border-left: 2px solid var(--amber); border-radius: 0 6px 6px 0; color: var(--amber); font-family: var(--mono); font-size: 11px; }

/* SVG diagram styles */
@keyframes dash-march {
  from { stroke-dashoffset: 36; }
  to   { stroke-dashoffset: 0; }
}
@keyframes box-in {
  from { opacity: 0; transform: scale(0.88); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes arrow-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes fi {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

.fl { stroke-dasharray: 8 4; animation: dash-march 1.4s linear infinite; }
.fl2 { stroke-dasharray: 8 4; animation: dash-march 1.4s linear 0.4s infinite; }
.fl3 { stroke-dasharray: 8 4; animation: dash-march 1.4s linear 0.8s infinite; }
.fl4 { stroke-dasharray: 8 4; animation: dash-march 1.4s linear 1.2s infinite; }
.fl5 { stroke-dasharray: 8 4; animation: dash-march 1.4s linear 1.6s infinite; }

.svgb1 { animation: box-in 0.4s ease 0.1s both; }
.svgb2 { animation: box-in 0.4s ease 0.4s both; }
.svgb3 { animation: box-in 0.4s ease 0.7s both; }
.svgb4 { animation: box-in 0.4s ease 1.0s both; }
.svgb5 { animation: box-in 0.4s ease 1.3s both; }
.svgb6 { animation: box-in 0.4s ease 1.6s both; }
.svgb7 { animation: box-in 0.4s ease 1.9s both; }
.svga1 { animation: arrow-in 0.3s ease 0.55s both; }
.svga2 { animation: arrow-in 0.3s ease 0.85s both; }
.svga3 { animation: arrow-in 0.3s ease 1.15s both; }
.svga4 { animation: arrow-in 0.3s ease 1.45s both; }
.svga5 { animation: arrow-in 0.3s ease 1.75s both; }
.svga6 { animation: arrow-in 0.3s ease 2.05s both; }

.a1 { opacity:0; animation: fi 0.45s ease 0.05s forwards; }
.a2 { opacity:0; animation: fi 0.45s ease 0.2s  forwards; }
.a3 { opacity:0; animation: fi 0.45s ease 0.35s forwards; }
.a4 { opacity:0; animation: fi 0.45s ease 0.5s  forwards; }
.a5 { opacity:0; animation: fi 0.45s ease 0.65s forwards; }
.a6 { opacity:0; animation: fi 0.45s ease 0.8s  forwards; }
</style>

<header></header>

<div class="a1" style="margin-top:20px">
  <span class="badge bb">Mo Speech · Next.js 16 · next-intl v4</span>
</div>

<h1 class="a2" style="margin-top:20px;background:linear-gradient(135deg,#f1f5f9 0%,#38bdf8 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">Locale<br>Switching</h1>

<div class="divider a3"></div>

<p class="a4" style="font-size:19px;max-width:600px">How a URL request becomes translated text in a component — entirely server-side, zero client fetching.</p>

<div class="a5" style="display:flex;gap:20px;margin-top:32px;flex-wrap:wrap">
  <div class="glass" style="display:flex;align-items:center;gap:12px;padding:14px 20px;border-color:rgba(56,189,248,0.2)">
    <div style="width:8px;height:8px;border-radius:50%;background:var(--blue);animation:pulse 2s infinite"></div>
    <span style="font-family:var(--mono);font-size:12px;color:var(--subtle)"><span style="color:var(--blue)">URL prefix</span> drives everything</span>
  </div>
  <div class="glass" style="display:flex;align-items:center;gap:12px;padding:14px 20px;border-color:rgba(52,211,153,0.2)">
    <div style="width:8px;height:8px;border-radius:50%;background:var(--green);animation:pulse 2s 0.7s infinite"></div>
    <span style="font-family:var(--mono);font-size:12px;color:var(--subtle)"><span style="color:var(--green)">Full page load</span> on every switch</span>
  </div>
  <div class="glass" style="display:flex;align-items:center;gap:12px;padding:14px 20px;border-color:rgba(192,132,252,0.2)">
    <div style="width:8px;height:8px;border-radius:50%;background:var(--purple);animation:pulse 2s 1.4s infinite"></div>
    <span style="font-family:var(--mono);font-size:12px;color:var(--subtle)"><span style="color:var(--purple)">Messages bundled</span> into HTML, no extra request</span>
  </div>
</div>

---

## The URL Is the Source of Truth

<p style="margin-bottom:20px">Every locale decision flows from one thing — the prefix in the URL</p>

<!-- URL anatomy SVG -->
<svg viewBox="0 0 1020 130" style="width:100%;height:auto;overflow:visible" class="a1">
  <!-- URL text -->
  <text x="510" y="38" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="32" font-weight="500" fill="#e8edf5" letter-spacing="-1">/en/home</text>

  <!-- bracket under 'en' segment — x positions tuned to JetBrains Mono 32px: / = ~19px, en = ~38px each char -->
  <line x1="382" y1="52" x2="382" y2="62" stroke="rgba(56,189,248,0.8)" stroke-width="2" class="svgb2"/>
  <line x1="382" y1="62" x2="436" y2="62" stroke="rgba(56,189,248,0.8)" stroke-width="2" class="svgb2"/>
  <line x1="436" y1="62" x2="436" y2="52" stroke="rgba(56,189,248,0.8)" stroke-width="2" class="svgb2"/>
  <text x="409" y="80" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-size="13" fill="#38bdf8" class="svgb2">[locale] segment</text>
  <text x="409" y="96" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#4a5568" class="svgb2">extracted by Next.js</text>

  <!-- bracket under 'home' segment -->
  <line x1="454" y1="52" x2="454" y2="68" stroke="rgba(52,211,153,0.8)" stroke-width="2" class="svgb3"/>
  <line x1="454" y1="68" x2="636" y2="68" stroke="rgba(52,211,153,0.8)" stroke-width="2" class="svgb3"/>
  <line x1="636" y1="68" x2="636" y2="52" stroke="rgba(52,211,153,0.8)" stroke-width="2" class="svgb3"/>
  <text x="545" y="88" text-anchor="middle" font-family="Bricolage Grotesque, sans-serif" font-size="13" fill="#34d399" class="svgb3">path segment</text>
  <text x="545" y="104" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="11" fill="#4a5568" class="svgb3">unchanged on locale switch</text>

  <!-- arrow to the left showing en/hi -->
  <line x1="360" y1="22" x2="195" y2="22" stroke="rgba(56,189,248,0.5)" stroke-width="1.5" stroke-dasharray="5 3" class="svgb4"/>
  <polygon points="195,18 180,22 195,26" fill="rgba(56,189,248,0.7)" class="svga3"/>
  <rect x="60" y="8" width="120" height="28" rx="6" fill="rgba(56,189,248,0.08)" stroke="rgba(56,189,248,0.35)" stroke-width="1.2" class="svgb4"/>
  <text x="120" y="27" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="13" fill="#38bdf8" class="svgb4">en | hi | fr…</text>

  <!-- arrow to the right for 'home' stays -->
  <line x1="660" y1="22" x2="800" y2="22" stroke="rgba(52,211,153,0.5)" stroke-width="1.5" stroke-dasharray="5 3" class="svgb5"/>
  <polygon points="800,18 815,22 800,26" fill="rgba(52,211,153,0.7)" class="svga4"/>
  <rect x="815" y="8" width="185" height="28" rx="6" fill="rgba(52,211,153,0.08)" stroke="rgba(52,211,153,0.35)" stroke-width="1.2" class="svgb5"/>
  <text x="907" y="27" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="13" fill="#34d399" class="svgb5">/home /categories…</text>
</svg>

<div class="g2 a2" style="margin-top:24px;gap:20px">
  <div class="glass" style="border-color:rgba(56,189,248,0.2)">
    <div style="font-family:var(--mono);font-size:11px;color:var(--blue);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.6px">localePrefix: 'always'</div>
    <p style="margin:0;font-size:14px">Every route in this app has the locale in the URL. <code>/home</code> doesn't exist — only <code>/en/home</code> or <code>/hi/home</code>.</p>
  </div>
  <div class="glass" style="border-color:rgba(52,211,153,0.2)">
    <div style="font-family:var(--mono);font-size:11px;color:var(--green);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.6px">Why this matters</div>
    <p style="margin:0;font-size:14px">The server knows the locale before rendering a single component. No client detection, no guessing, no flash.</p>
  </div>
</div>

---

## The Server-Side Pipeline

<p style="margin-bottom:16px">What happens on every page load — before a single component renders</p>

<!-- Pipeline SVG — 2-row flow -->
<svg viewBox="0 0 1060 240" style="width:100%;height:auto;overflow:visible">

  <!-- ROW 1: Browser → withNextIntl → layout.tsx → request.ts -->
  <!-- Box 1: Browser -->
  <g class="svgb1">
    <rect x="0" y="30" width="148" height="60" rx="8" fill="rgba(56,189,248,0.08)" stroke="rgba(56,189,248,0.4)" stroke-width="1.5"/>
    <text x="74" y="54" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#38bdf8" font-weight="500">Browser</text>
    <text x="74" y="72" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#64748b">GET /en/home</text>
  </g>
  <!-- Arrow 1 -->
  <g class="svga1">
    <line x1="148" y1="60" x2="196" y2="60" stroke="#38bdf8" stroke-width="1.5" class="fl"/>
    <polygon points="196,55 210,60 196,65" fill="#38bdf8"/>
  </g>
  <!-- Box 2: withNextIntl -->
  <g class="svgb2">
    <rect x="210" y="30" width="162" height="60" rx="8" fill="rgba(56,189,248,0.06)" stroke="rgba(56,189,248,0.3)" stroke-width="1.5"/>
    <text x="291" y="54" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#38bdf8" font-weight="500">next.config.ts</text>
    <text x="291" y="72" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#64748b">withNextIntl</text>
  </g>
  <!-- Arrow 2 -->
  <g class="svga2">
    <line x1="372" y1="60" x2="420" y2="60" stroke="#38bdf8" stroke-width="1.5" class="fl2"/>
    <polygon points="420,55 434,60 420,65" fill="#38bdf8"/>
  </g>
  <!-- Box 3: layout.tsx -->
  <g class="svgb3">
    <rect x="434" y="30" width="172" height="60" rx="8" fill="rgba(251,191,36,0.07)" stroke="rgba(251,191,36,0.4)" stroke-width="1.5"/>
    <text x="520" y="54" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#fbbf24" font-weight="500">[locale]/layout.tsx</text>
    <text x="520" y="72" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#64748b">setRequestLocale('en')</text>
  </g>
  <!-- Arrow 3 -->
  <g class="svga3">
    <line x1="606" y1="60" x2="654" y2="60" stroke="#fbbf24" stroke-width="1.5" class="fl3"/>
    <polygon points="654,55 668,60 654,65" fill="#fbbf24"/>
  </g>
  <!-- Box 4: request.ts -->
  <g class="svgb4">
    <rect x="668" y="30" width="148" height="60" rx="8" fill="rgba(251,191,36,0.06)" stroke="rgba(251,191,36,0.3)" stroke-width="1.5"/>
    <text x="742" y="54" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#fbbf24" font-weight="500">request.ts</text>
    <text x="742" y="72" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#64748b">validates + imports</text>
  </g>
  <!-- Arrow 4 going RIGHT then DOWN -->
  <g class="svga4">
    <line x1="816" y1="60" x2="870" y2="60" stroke="#fbbf24" stroke-width="1.5" class="fl4"/>
    <line x1="870" y1="60" x2="870" y2="155" stroke="#fbbf24" stroke-width="1.5"/>
    <polygon points="865,155 870,170 875,155" fill="#fbbf24"/>
  </g>
  <!-- Box 5: en.json -->
  <g class="svgb5">
    <rect x="796" y="170" width="148" height="60" rx="8" fill="rgba(52,211,153,0.07)" stroke="rgba(52,211,153,0.4)" stroke-width="1.5"/>
    <text x="870" y="194" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#34d399" font-weight="500">messages/en.json</text>
    <text x="870" y="212" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#64748b">dynamic import</text>
  </g>

  <!-- ROW 2: arrow from layout.tsx DOWN to NextIntlClientProvider, then useTranslations -->
  <!-- Vertical arrow from layout.tsx down -->
  <g class="svga3">
    <line x1="520" y1="90" x2="520" y2="145" stroke="rgba(251,191,36,0.5)" stroke-width="1.5" stroke-dasharray="5 3"/>
    <line x1="520" y1="145" x2="356" y2="145" stroke="rgba(251,191,36,0.5)" stroke-width="1.5" stroke-dasharray="5 3"/>
    <polygon points="356,140 340,145 356,150" fill="rgba(251,191,36,0.6)"/>
  </g>
  <!-- Box 6: NextIntlClientProvider -->
  <g class="svgb4">
    <rect x="166" y="170" width="196" height="60" rx="8" fill="rgba(192,132,252,0.07)" stroke="rgba(192,132,252,0.4)" stroke-width="1.5"/>
    <text x="264" y="194" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10.5" fill="#c084fc" font-weight="500">NextIntlClientProvider</text>
    <text x="264" y="212" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#64748b">wraps entire page tree</text>
  </g>
  <!-- Arrow from en.json to NextIntlClientProvider -->
  <g class="svga5">
    <line x1="796" y1="200" x2="440" y2="200" stroke="#34d399" stroke-width="1.5" class="fl5"/>
    <polygon points="440,195 424,200 440,205" fill="#34d399"/>
  </g>
  <!-- Arrow 6 from NextIntlClientProvider to useTranslations -->
  <g class="svga5">
    <line x1="166" y1="200" x2="118" y2="200" stroke="#c084fc" stroke-width="1.5" class="fl"/>
    <polygon points="118,195 102,200 118,205" fill="#c084fc"/>
  </g>
  <!-- Box 7: useTranslations -->
  <g class="svgb6">
    <rect x="0" y="170" width="102" height="60" rx="8" fill="rgba(52,211,153,0.09)" stroke="rgba(52,211,153,0.5)" stroke-width="1.5"/>
    <text x="51" y="194" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#34d399" font-weight="500">useTranslations</text>
    <text x="51" y="212" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#64748b">() reads context</text>
  </g>

  <!-- Labels -->
  <text x="530" y="120" font-family="Epilogue,sans-serif" font-size="11" fill="#4a5568" font-style="italic">getMessages() + NextIntlClientProvider</text>
  <text x="440" y="220" font-family="Epilogue,sans-serif" font-size="11" fill="#4a5568" font-style="italic">flows left →</text>
</svg>

<div class="glass a6" style="margin-top:12px;padding:12px 18px;border-color:rgba(52,211,153,0.2);display:flex;align-items:center;gap:12px">
  <span style="color:var(--green);font-size:16px">✓</span>
  <p style="margin:0;font-size:13px">Strings are bundled into the HTML payload — no extra network request from the browser. Zero flash of untranslated content.</p>
</div>

---

## `routing.ts` — The Locale Contract

<div class="g2" style="gap:28px;align-items:start">

<div class="a1">

```ts
// i18n/routing.ts
export const routing = defineRouting({
  locales: ['en', 'hi'],
  defaultLocale: 'en',
  localePrefix: 'always',
});
```

<div class="glass" style="margin-top:14px;border-color:rgba(52,211,153,0.2)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--green);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px">Single source of truth</div>
  <p style="margin:0;font-size:14px"><code>request.ts</code>, <code>layout.tsx</code>, and <code>navigation.ts</code> all import from here. Add a locale in one place and everything picks it up.</p>
</div>
</div>

<div class="a2" style="display:flex;flex-direction:column;gap:14px">

<div class="glass" style="border-color:rgba(56,189,248,0.22)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--blue);margin-bottom:8px">locales array</div>
  <p style="margin:0;font-size:14px">All valid locale codes. A URL with any other prefix falls back to <code>defaultLocale</code> rather than throwing a 404.</p>
</div>

<div class="glass" style="border-color:rgba(251,191,36,0.22)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--amber);margin-bottom:8px">localePrefix: 'always'</div>
  <p style="margin:0;font-size:14px"><code>/en/home</code> and <code>/hi/home</code> — never bare <code>/home</code>. The locale is always legible in the URL. No hidden state.</p>
</div>

<div class="glass" style="border-color:rgba(192,132,252,0.22)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--purple);margin-bottom:8px">generateStaticParams</div>
  <p style="margin:0;font-size:14px">At build time, Next.js maps this array to pre-render a shell for every locale — zero runtime detection cost.</p>
</div>

</div>
</div>

---

## `request.ts` — Loading the Right Messages

<div class="g2" style="gap:28px;align-items:start">

<div class="a1">

```ts
// i18n/request.ts
export default getRequestConfig(
  async ({ requestLocale }) => {
    let locale = await requestLocale;

    // Guard: fall back to 'en'
    if (!locale ||
        !routing.locales.includes(locale)) {
      locale = routing.defaultLocale;
    }

    return {
      locale,
      messages: (
        await import(
          `../messages/${locale}.json`
        )
      ).default,
    };
  }
);
```

</div>

<div class="a2" style="display:flex;flex-direction:column;gap:14px">

<div class="glass" style="border-color:rgba(56,189,248,0.22)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--blue);margin-bottom:8px">requestLocale</div>
  <p style="margin:0;font-size:14px">Next.js resolves <code>[locale]</code> from the URL and passes it here. This is a promise — <code>await</code> it first.</p>
</div>

<div class="glass" style="border-color:rgba(251,191,36,0.22)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--amber);margin-bottom:8px">Guard clause</div>
  <p style="margin:0;font-size:14px">If the locale is missing or not in our list, silently fall back to English. Prevents 500s on bad URLs.</p>
</div>

<div class="glass" style="border-color:rgba(52,211,153,0.22)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--green);margin-bottom:8px">Dynamic import</div>
  <p style="margin:0;font-size:14px">The template literal means <code>hi.json</code> is <strong>never sent to English users.</strong> Each request loads only what it needs.</p>
</div>

</div>
</div>

---

## `useTranslations` — Consuming in Components

<div class="g2" style="gap:28px;align-items:start">

<div class="a1">

```ts
// Sidebar.tsx
const t = useTranslations('nav');

t('home')        // "Home"      (en)
                 // "होम"       (hi)
t('categories')  // "Categories"(en)
                 // "श्रेणियाँ"  (hi)
```

<div class="glass" style="margin-top:14px;border-color:rgba(56,189,248,0.2)">
  <p style="margin:0;font-size:14px">Missing keys <strong>throw at runtime in development</strong> — intentional. Broken translations are caught before they ship.</p>
</div>

</div>

<div class="a2">

<div style="font-family:var(--display);font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:10px">en.json structure</div>

```json
{
  "nav": {
    "home": "Home",
    "categories": "Categories"
  }
}
```

<div class="glass" style="margin-top:14px;border-color:rgba(52,211,153,0.2)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--green);margin-bottom:8px">How it maps</div>
  <p style="margin:0;font-size:14px"><code>useTranslations('nav')</code> → namespace = top-level key.<br><code>t('home')</code> → <code>messages.nav.home</code>.<br>No indirection. No magic.</p>
</div>

</div>
</div>

---

## Switching Locale — The Full Sequence

<p style="margin-bottom:12px">What happens from button click to re-rendered page</p>

<!-- Sequence SVG -->
<svg viewBox="0 0 1060 280" style="width:100%;height:auto">

  <!-- Actor vertical lines -->
  <line x1="80"  y1="30" x2="80"  y2="270" stroke="rgba(255,255,255,0.07)" stroke-width="1" stroke-dasharray="4 4"/>
  <line x1="290" y1="30" x2="290" y2="270" stroke="rgba(255,255,255,0.07)" stroke-width="1" stroke-dasharray="4 4"/>
  <line x1="530" y1="30" x2="530" y2="270" stroke="rgba(255,255,255,0.07)" stroke-width="1" stroke-dasharray="4 4"/>
  <line x1="760" y1="30" x2="760" y2="270" stroke="rgba(255,255,255,0.07)" stroke-width="1" stroke-dasharray="4 4"/>
  <line x1="980" y1="30" x2="980" y2="270" stroke="rgba(255,255,255,0.07)" stroke-width="1" stroke-dasharray="4 4"/>

  <!-- Actor labels -->
  <rect x="22" y="6" width="116" height="26" rx="5" fill="rgba(56,189,248,0.1)" stroke="rgba(56,189,248,0.3)" stroke-width="1"/>
  <text x="80" y="24" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#38bdf8">User</text>

  <rect x="198" y="6" width="184" height="26" rx="5" fill="rgba(56,189,248,0.08)" stroke="rgba(56,189,248,0.2)" stroke-width="1"/>
  <text x="290" y="24" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#38bdf8">DevTestPanel</text>

  <rect x="390" y="6" width="280" height="26" rx="5" fill="rgba(251,191,36,0.08)" stroke="rgba(251,191,36,0.25)" stroke-width="1"/>
  <text x="530" y="24" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#fbbf24">@/i18n/navigation router</text>

  <rect x="686" y="6" width="148" height="26" rx="5" fill="rgba(192,132,252,0.08)" stroke="rgba(192,132,252,0.25)" stroke-width="1"/>
  <text x="760" y="24" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#c084fc">Next.js Server</text>

  <rect x="920" y="6" width="118" height="26" rx="5" fill="rgba(52,211,153,0.08)" stroke="rgba(52,211,153,0.25)" stroke-width="1"/>
  <text x="980" y="24" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#34d399">Browser</text>

  <!-- Message 1: User clicks -->
  <g class="svgb2">
    <line x1="80" y1="68" x2="275" y2="68" stroke="#38bdf8" stroke-width="1.5" class="fl"/>
    <polygon points="275,63 290,68 275,73" fill="#38bdf8"/>
    <text x="184" y="62" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#94a3b8">clicks "हिन्दी"</text>
  </g>

  <!-- Message 2: router.replace -->
  <g class="svgb3">
    <line x1="290" y1="100" x2="515" y2="100" stroke="#fbbf24" stroke-width="1.5" class="fl2"/>
    <polygon points="515,95 530,100 515,105" fill="#fbbf24"/>
    <text x="408" y="94" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#94a3b8">replace(path, &#123; locale:'hi' &#125;)</text>
  </g>

  <!-- Note: swaps prefix -->
  <rect x="380" y="110" width="300" height="30" rx="5" fill="rgba(251,191,36,0.07)" stroke="rgba(251,191,36,0.25)" stroke-width="1" class="svgb3"/>
  <text x="530" y="129" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#fbbf24" class="svgb3">/en/settings → /hi/settings</text>

  <!-- Message 3: GET /hi/settings -->
  <g class="svgb4">
    <line x1="530" y1="158" x2="745" y2="158" stroke="#c084fc" stroke-width="1.5" class="fl3"/>
    <polygon points="745,153 760,158 745,163" fill="#c084fc"/>
    <text x="643" y="152" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#94a3b8">GET /hi/settings</text>
  </g>

  <!-- Message 4: server processes -->
  <g class="svgb5">
    <rect x="686" y="168" width="148" height="36" rx="5" fill="rgba(192,132,252,0.07)" stroke="rgba(192,132,252,0.2)" stroke-width="1"/>
    <text x="760" y="184" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#c084fc">setRequestLocale('hi')</text>
    <text x="760" y="198" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#64748b">import messages/hi.json</text>
  </g>

  <!-- Message 5: HTML response -->
  <g class="svgb6">
    <line x1="980" y1="222" x2="995" y2="222" stroke="rgba(52,211,153,0.2)" stroke-width="1"/>
    <line x1="760" y1="222" x2="965" y2="222" stroke="#34d399" stroke-width="1.5" class="fl4"/>
    <polygon points="965,217 980,222 965,227" fill="#34d399"/>
    <text x="868" y="216" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#34d399">HTML + Hindi strings + data-locale="hi"</text>
  </g>

  <!-- Message 6: repaint -->
  <g class="svgb7">
    <rect x="920" y="234" width="118" height="30" rx="5" fill="rgba(52,211,153,0.08)" stroke="rgba(52,211,153,0.25)" stroke-width="1"/>
    <text x="980" y="253" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#34d399">page re-renders ✓</text>
  </g>
</svg>

<div class="glass a6" style="padding:10px 18px;border-color:rgba(251,191,36,0.25);display:flex;align-items:center;gap:10px">
  <span style="color:var(--amber)">⚠</span>
  <p style="margin:0;font-size:13px"><code>useRouter</code> must come from <span style="color:var(--amber)"><code>@/i18n/navigation</code></span> — not <code>next/navigation</code>. The next-intl wrapper understands <code>&#123; locale &#125;</code> and rewrites the prefix. The plain router does not.</p>
</div>

---

## Two Routers — Know Which to Use

<table class="a1">
<thead>
<tr><th>Import</th><th>Locale-aware?</th><th>Use when</th></tr>
</thead>
<tbody>
<tr>
  <td><code>next/navigation</code> · <code>useRouter</code></td>
  <td style="color:var(--muted)">No</td>
  <td>Most navigation — moving within the same locale</td>
</tr>
<tr>
  <td style="color:var(--blue)"><code>@/i18n/navigation</code> · <code>useRouter</code></td>
  <td style="color:var(--green)">Yes</td>
  <td>Locale switching · <code>router.replace(path, &#123; locale &#125;)</code></td>
</tr>
<tr>
  <td><code>next/navigation</code> · <code>usePathname</code></td>
  <td style="color:var(--muted)">No</td>
  <td>Returns <code>/en/home</code> — used in Sidebar, TopBar</td>
</tr>
<tr>
  <td style="color:var(--blue)"><code>@/i18n/navigation</code> · <code>usePathname</code></td>
  <td style="color:var(--green)">Yes</td>
  <td>Strips prefix · returns <code>/home</code> not <code>/en/home</code></td>
</tr>
</tbody>
</table>

<div class="g3 a2" style="margin-top:18px;gap:14px">
  <div class="glass" style="padding:12px 16px;border-color:rgba(56,189,248,0.15)">
    <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:5px">Sidebar.tsx</div>
    <p style="margin:0;font-size:12px">plain <code>next/navigation</code> + manual <code>/&#123;locale&#125;/…</code> hrefs</p>
  </div>
  <div class="glass" style="padding:12px 16px;border-color:rgba(56,189,248,0.15)">
    <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:5px">TopBar.tsx</div>
    <p style="margin:0;font-size:12px">plain <code>next/navigation</code> + useParams for locale reading</p>
  </div>
  <div class="glass" style="padding:12px 16px;border-color:rgba(251,191,36,0.3)">
    <div style="font-family:var(--mono);font-size:10px;color:var(--amber);margin-bottom:5px">DevTestPanel.tsx</div>
    <p style="margin:0;font-size:12px"><code>@/i18n/navigation</code> — only place that switches locale</p>
  </div>
</div>

---

## `generateStaticParams` + Adding a Language

<div class="g2" style="gap:28px;align-items:start">

<div class="a1">

```ts
// app/[locale]/layout.tsx
export function generateStaticParams() {
  return routing.locales.map(
    (locale) => ({ locale })
  );
  // → [{ locale: 'en' }, { locale: 'hi' }]
}
```

<div class="glass" style="margin-top:14px;border-color:rgba(56,189,248,0.22)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--blue);margin-bottom:8px">Build time pre-rendering</div>
  <p style="margin:0;font-size:13px">Next.js generates a static shell for every locale at build time. <code>/en/*</code> and <code>/hi/*</code> are served instantly — no locale detection at runtime.</p>
</div>
</div>

<div class="a2">
<div style="font-family:var(--display);font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:14px">Adding a new language — 4 steps</div>
<div style="display:flex;flex-direction:column;gap:10px">

  <div class="glass" style="display:flex;align-items:flex-start;gap:14px;padding:14px">
    <div style="width:28px;height:28px;border-radius:50%;background:rgba(56,189,248,0.15);border:2px solid var(--blue);color:var(--blue);display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:800;font-size:14px;flex-shrink:0">1</div>
    <div><span style="font-family:var(--mono);font-size:11px;color:var(--blue)">routing.ts</span><br><p style="margin:4px 0 0;font-size:13px">Add locale code: <code>['en', 'hi', 'fr']</code></p></div>
  </div>

  <div class="glass" style="display:flex;align-items:flex-start;gap:14px;padding:14px">
    <div style="width:28px;height:28px;border-radius:50%;background:rgba(251,191,36,0.15);border:2px solid var(--amber);color:var(--amber);display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:800;font-size:14px;flex-shrink:0">2</div>
    <div><span style="font-family:var(--mono);font-size:11px;color:var(--amber)">messages/fr.json</span><br><p style="margin:4px 0 0;font-size:13px">Same key structure as <code>en.json</code></p></div>
  </div>

  <div class="glass" style="display:flex;align-items:flex-start;gap:14px;padding:14px">
    <div style="width:28px;height:28px;border-radius:50%;background:rgba(192,132,252,0.15);border:2px solid var(--purple);color:var(--purple);display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:800;font-size:14px;flex-shrink:0">3</div>
    <div><span style="font-family:var(--mono);font-size:11px;color:var(--purple)">layout.tsx (non-Latin only)</span><br><p style="margin:4px 0 0;font-size:13px">Load font, add to fontClasses, add <code>[data-locale]</code> CSS rule</p></div>
  </div>

  <div class="glass" style="display:flex;align-items:flex-start;gap:14px;padding:14px">
    <div style="width:28px;height:28px;border-radius:50%;background:rgba(52,211,153,0.15);border:2px solid var(--green);color:var(--green);display:flex;align-items:center;justify-content:center;font-family:var(--display);font-weight:800;font-size:14px;flex-shrink:0">4</div>
    <div><span style="font-family:var(--mono);font-size:11px;color:var(--green)">DevTestPanel.tsx</span><br><p style="margin:4px 0 0;font-size:13px">Add button to <code>LOCALES</code> array. <strong style="color:var(--green)">generateStaticParams picks it up automatically.</strong></p></div>
  </div>

</div>
</div>

</div>
