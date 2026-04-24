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
  --red: #f87171;
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
  padding: 52px 72px 52px 72px;
  position: relative;
  overflow: hidden;
}

section::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 15% 40%, rgba(56,189,248,0.04) 0%, transparent 55%),
    radial-gradient(ellipse at 85% 65%, rgba(251,191,36,0.03) 0%, transparent 55%);
  pointer-events: none;
}

section > header {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(to right, transparent, var(--blue) 35%, var(--amber) 65%, transparent);
}

h1 {
  font-family: var(--display);
  font-weight: 800;
  font-size: 60px;
  line-height: 1.0;
  letter-spacing: -2px;
  margin: 0 0 16px;
}

h2 {
  font-family: var(--display);
  font-weight: 600;
  font-size: 34px;
  letter-spacing: -0.8px;
  margin: 0 0 20px;
}

h3 {
  font-family: var(--display);
  font-weight: 600;
  font-size: 20px;
  margin: 0 0 12px;
  color: var(--subtle);
}

p {
  margin: 0 0 12px;
  color: var(--subtle);
  font-weight: 300;
  font-size: 16px;
}

code {
  font-family: var(--mono);
  font-size: 13px;
  background: rgba(56,189,248,0.08);
  border: 1px solid rgba(56,189,248,0.18);
  padding: 1px 7px;
  border-radius: 4px;
  color: var(--blue);
}

pre {
  background: rgba(0,0,0,0.45) !important;
  border: 1px solid var(--border) !important;
  border-radius: 12px !important;
  padding: 20px 24px !important;
  font-family: var(--mono) !important;
  font-size: 12.5px !important;
  line-height: 1.75 !important;
  overflow: hidden;
  margin: 0;
}

pre code {
  background: none !important;
  border: none !important;
  padding: 0 !important;
  color: #a5b4fc !important;
  font-size: 12.5px !important;
}

.glass {
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px 24px;
}

.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; }
.g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

.badge {
  display: inline-block;
  font-family: var(--mono);
  font-size: 10px;
  padding: 3px 10px;
  border-radius: 100px;
  font-weight: 500;
  letter-spacing: 0.6px;
  text-transform: uppercase;
}
.bb { background: rgba(56,189,248,0.1); color: var(--blue); border: 1px solid rgba(56,189,248,0.25); }
.ba { background: rgba(251,191,36,0.1); color: var(--amber); border: 1px solid rgba(251,191,36,0.25); }

.node {
  background: var(--glass);
  border: 1px solid var(--border);
  border-radius: 9px;
  padding: 9px 15px;
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.5;
}
.nb { border-color: rgba(56,189,248,0.35); background: rgba(56,189,248,0.06); }
.na { border-color: rgba(251,191,36,0.35); background: rgba(251,191,36,0.06); }
.ng { border-color: rgba(52,211,153,0.35); background: rgba(52,211,153,0.06); }
.np { border-color: rgba(192,132,252,0.35); background: rgba(192,132,252,0.06); }

.step-num {
  width: 32px; height: 32px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
th {
  font-family: var(--display);
  font-weight: 600;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--muted);
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  text-align: left;
}
td {
  padding: 11px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.04);
  font-size: 13px;
  vertical-align: top;
  line-height: 1.5;
}
tr:last-child td { border-bottom: none; }

.ftree {
  font-family: var(--mono);
  font-size: 12.5px;
  line-height: 1.9;
  color: var(--subtle);
}
.ftree .d { color: var(--amber); }
.ftree .h { color: var(--blue); }
.ftree .c { color: var(--muted); font-size: 11px; }

@keyframes fi {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }

.a1 { opacity:0; animation: fi 0.45s ease 0.05s forwards; }
.a2 { opacity:0; animation: fi 0.45s ease 0.2s  forwards; }
.a3 { opacity:0; animation: fi 0.45s ease 0.35s forwards; }
.a4 { opacity:0; animation: fi 0.45s ease 0.5s  forwards; }
.a5 { opacity:0; animation: fi 0.45s ease 0.65s forwards; }
.a6 { opacity:0; animation: fi 0.45s ease 0.8s  forwards; }
.a7 { opacity:0; animation: fi 0.45s ease 0.95s forwards; }

.divider {
  width: 56px; height: 3px;
  background: linear-gradient(to right, var(--blue), transparent);
  border-radius: 2px;
  margin: 18px 0;
}

.seq-actor {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--muted);
  width: 88px;
  text-align: right;
  flex-shrink: 0;
  font-family: var(--mono);
}
.seq-arr {
  color: var(--blue);
  font-size: 17px;
  flex-shrink: 0;
  line-height: 1;
}
.seq-note {
  margin-left: 112px;
  padding: 6px 12px;
  background: rgba(251,191,36,0.07);
  border-left: 2px solid var(--amber);
  border-radius: 0 6px 6px 0;
  color: var(--amber);
  font-family: var(--mono);
  font-size: 11px;
}
</style>

<!-- top bar applied via a header trick -->
<header></header>

<div class="a1" style="margin-top:16px">
  <span class="badge bb">Mo Speech · Next.js 16 · next-intl v4</span>
</div>

<h1 class="a2" style="margin-top:20px;background:linear-gradient(135deg,#f1f5f9 0%,#64748b 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">i18n &amp;<br>Theme Switching</h1>

<div class="divider a3"></div>

<p class="a4" style="font-size:18px;max-width:580px">How locale and theme data flows — from a URL request to a rendered component.</p>

<div class="a5" style="display:flex;gap:20px;margin-top:36px">
  <div class="glass" style="display:flex;align-items:center;gap:12px;padding:14px 20px;border-color:rgba(56,189,248,0.2)">
    <div style="width:8px;height:8px;border-radius:50%;background:var(--blue);animation:pulse 2s infinite"></div>
    <span style="font-family:var(--mono);font-size:12px;color:var(--subtle)"><span style="color:var(--blue)">URL-driven</span> locale pipeline</span>
  </div>
  <div class="glass" style="display:flex;align-items:center;gap:12px;padding:14px 20px;border-color:rgba(251,191,36,0.2)">
    <div style="width:8px;height:8px;border-radius:50%;background:var(--amber);animation:pulse 2s 1s infinite"></div>
    <span style="font-family:var(--mono);font-size:12px;color:var(--subtle)"><span style="color:var(--amber)">CSS-var</span> theme switch · no reload</span>
  </div>
</div>

---

## Two Kinds of Switch

<div class="g2" style="margin-top:4px">

<div class="glass a1" style="border-color:rgba(56,189,248,0.22);padding:28px">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
    <div style="width:38px;height:38px;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.3);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:19px">🌐</div>
    <div>
      <div style="font-family:var(--display);font-weight:600;font-size:20px">Locale</div>
      <code>en ↔ hi</code>
    </div>
  </div>
  <div style="font-family:var(--mono);font-size:12px;color:var(--subtle);line-height:2.1">
    <div>Mechanism&nbsp;&nbsp;<span style="color:var(--blue)">Next.js navigation</span></div>
    <div>Page reload&nbsp;&nbsp;<span style="color:var(--blue)">Yes — full SSR</span></div>
    <div>URL changes&nbsp;&nbsp;<span style="color:var(--blue)">/en → /hi prefix</span></div>
    <div>Messages&nbsp;&nbsp;<span style="color:var(--blue)">Bundled server-side</span></div>
  </div>
  <div class="badge bb" style="margin-top:16px">Server · URL prefix · Full render</div>
</div>

<div class="glass a2" style="border-color:rgba(251,191,36,0.22);padding:28px">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
    <div style="width:38px;height:38px;background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:19px">🎨</div>
    <div>
      <div style="font-family:var(--display);font-weight:600;font-size:20px">Theme</div>
      <code>default ↔ sky</code>
    </div>
  </div>
  <div style="font-family:var(--mono);font-size:12px;color:var(--subtle);line-height:2.1">
    <div>Mechanism&nbsp;&nbsp;<span style="color:var(--amber)">CSS var overwrite</span></div>
    <div>Page reload&nbsp;&nbsp;<span style="color:var(--amber)">No — CSS cascade only</span></div>
    <div>URL changes&nbsp;&nbsp;<span style="color:var(--amber)">Never</span></div>
    <div>Messages&nbsp;&nbsp;<span style="color:var(--amber)">CSS custom properties</span></div>
  </div>
  <div class="badge ba" style="margin-top:16px">Client · :root vars · Instant repaint</div>
</div>

</div>

<div class="glass a3" style="margin-top:20px;padding:14px 20px;border-color:rgba(52,211,153,0.22);display:flex;align-items:center;gap:14px">
  <span style="font-size:18px">↗</span>
  <p style="margin:0;font-size:14px"><strong style="color:var(--green)">Deliberately independent.</strong> You can change theme without reloading. You cannot change locale without a page load — that is Next.js App Router working as designed.</p>
</div>

---

## Locale Pipeline
<p style="margin-bottom:18px">Every server render — URL to component</p>

<div style="display:flex;flex-direction:column;padding-left:8px">

<div class="a1" style="display:flex;align-items:stretch;gap:0">
  <div style="display:flex;flex-direction:column;align-items:center;margin-right:18px">
    <div class="step-num" style="background:rgba(56,189,248,0.15);border:2px solid var(--blue);color:var(--blue)">01</div>
    <div style="width:2px;flex:1;background:linear-gradient(to bottom,var(--blue),rgba(56,189,248,0.25));margin:4px 0"></div>
  </div>
  <div class="node nb" style="margin-bottom:10px;flex:1;align-self:center">
    <span style="color:var(--blue)">Browser</span> &nbsp;·&nbsp; GET <span style="color:var(--text)">/en/home</span>
  </div>
</div>

<div class="a2" style="display:flex;align-items:stretch;gap:0">
  <div style="display:flex;flex-direction:column;align-items:center;margin-right:18px">
    <div class="step-num" style="background:rgba(56,189,248,0.1);border:2px solid rgba(56,189,248,0.5);color:var(--blue)">02</div>
    <div style="width:2px;flex:1;background:linear-gradient(to bottom,rgba(56,189,248,0.25),rgba(56,189,248,0.15));margin:4px 0"></div>
  </div>
  <div class="node" style="margin-bottom:10px;flex:1;align-self:center">
    <span style="color:var(--amber)">next.config.ts</span> &nbsp;·&nbsp; <code>withNextIntl</code> intercepts request
  </div>
</div>

<div class="a3" style="display:flex;align-items:stretch;gap:0">
  <div style="display:flex;flex-direction:column;align-items:center;margin-right:18px">
    <div class="step-num" style="background:rgba(56,189,248,0.07);border:2px solid rgba(56,189,248,0.4);color:var(--blue)">03</div>
    <div style="width:2px;flex:1;background:linear-gradient(to bottom,rgba(56,189,248,0.15),rgba(56,189,248,0.1));margin:4px 0"></div>
  </div>
  <div class="node" style="margin-bottom:10px;flex:1;align-self:center">
    <span style="color:var(--amber)">app/[locale]/layout.tsx</span> &nbsp;·&nbsp; <code>setRequestLocale('en')</code>
  </div>
</div>

<div class="a4" style="display:flex;align-items:stretch;gap:0">
  <div style="display:flex;flex-direction:column;align-items:center;margin-right:18px">
    <div class="step-num" style="background:rgba(56,189,248,0.05);border:2px solid rgba(56,189,248,0.3);color:var(--blue)">04</div>
    <div style="width:2px;flex:1;background:linear-gradient(to bottom,rgba(56,189,248,0.1),rgba(52,211,153,0.2));margin:4px 0"></div>
  </div>
  <div class="node" style="margin-bottom:10px;flex:1;align-self:center">
    <code>getMessages()</code> → <span style="color:var(--amber)">i18n/request.ts</span> &nbsp;·&nbsp; validates · imports <span style="color:var(--green)">messages/en.json</span>
  </div>
</div>

<div class="a5" style="display:flex;align-items:stretch;gap:0">
  <div style="display:flex;flex-direction:column;align-items:center;margin-right:18px">
    <div class="step-num" style="background:rgba(56,189,248,0.04);border:2px solid rgba(56,189,248,0.2);color:var(--blue)">05</div>
    <div style="width:2px;flex:1;background:linear-gradient(to bottom,rgba(52,211,153,0.2),rgba(52,211,153,0.3));margin:4px 0"></div>
  </div>
  <div class="node" style="margin-bottom:10px;flex:1;align-self:center">
    <span style="color:var(--amber)">NextIntlClientProvider</span> &nbsp;·&nbsp; receives <code>messages + locale</code> · wraps page tree
  </div>
</div>

<div class="a6" style="display:flex;align-items:center;gap:18px">
  <div style="width:32px;height:32px;border-radius:50%;background:rgba(52,211,153,0.15);border:2px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">✓</div>
  <div class="node ng" style="flex:1">
    <code>useTranslations()</code> &nbsp;·&nbsp; <span style="color:var(--subtle)">reads from provider context · no extra network request</span>
  </div>
</div>

</div>

---

## Key Files

<div class="g2" style="gap:20px">

<div class="glass a1" style="padding:22px">
  <div style="font-family:var(--display);font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:14px">i18n layer</div>
  <div class="ftree">
    <div><span class="d">next.config.ts</span></div>
    <div style="padding-left:8px" class="c">withNextIntl — activates i18n in Next.js</div>
    <div style="margin-top:10px"><span class="d">i18n/</span></div>
    <div style="padding-left:16px"><span class="h">routing.ts</span></div>
    <div style="padding-left:24px" class="c">locales, defaultLocale, prefix strategy</div>
    <div style="padding-left:16px"><span class="h">request.ts</span></div>
    <div style="padding-left:24px" class="c">validates locale, loads messages/*.json</div>
    <div style="padding-left:16px">navigation.ts</div>
    <div style="padding-left:24px" class="c">locale-aware Link, useRouter, usePathname</div>
    <div style="margin-top:10px"><span class="d">messages/</span></div>
    <div style="padding-left:16px">en.json &nbsp;&nbsp;<span class="c">English strings</span></div>
    <div style="padding-left:16px">hi.json &nbsp;&nbsp;<span class="c">Hindi strings</span></div>
  </div>
</div>

<div class="glass a2" style="padding:22px">
  <div style="font-family:var(--display);font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:14px">app layer</div>
  <div class="ftree">
    <div><span class="d">app/[locale]/</span></div>
    <div style="padding-left:16px"><span class="h">layout.tsx</span></div>
    <div style="padding-left:24px" class="c">setRequestLocale, getMessages, fonts,</div>
    <div style="padding-left:24px" class="c">data-locale, NextIntlClientProvider,</div>
    <div style="padding-left:24px" class="c">generateStaticParams</div>
    <div style="padding-left:16px;margin-top:6px"><span class="d">components/</span></div>
    <div style="padding-left:32px">Sidebar.tsx &nbsp;<span class="c">useTranslations('nav')</span></div>
    <div style="padding-left:32px">TopBar.tsx &nbsp;&nbsp;<span class="c">useTranslations('nav'+'common')</span></div>
    <div style="padding-left:16px;margin-top:6px"><span class="d">settings/</span></div>
    <div style="padding-left:32px">DevTestPanel.tsx <span class="c">locale+theme switcher</span></div>
    <div style="margin-top:6px"><span class="d">contexts/</span></div>
    <div style="padding-left:16px"><span class="h">ThemeContext.tsx</span></div>
    <div style="padding-left:24px" class="c">THEME_TOKENS, applyThemeTokens</div>
  </div>
</div>

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

</div>

<div class="a2" style="display:flex;flex-direction:column;gap:14px">

<div class="glass" style="border-color:rgba(56,189,248,0.22)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--blue);margin-bottom:8px">locales</div>
  <p style="margin:0;font-size:14px">All valid locale codes. Any URL with a different prefix falls back to <code>defaultLocale</code>.</p>
</div>

<div class="glass" style="border-color:rgba(251,191,36,0.22)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--amber);margin-bottom:8px">localePrefix: 'always'</div>
  <p style="margin:0;font-size:14px"><code>/en/home</code> and <code>/hi/home</code> — never bare <code>/home</code>. Locale is always explicit.</p>
</div>

<div class="glass" style="border-color:rgba(52,211,153,0.22)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--green);margin-bottom:8px">Single source of truth</div>
  <p style="margin:0;font-size:14px"><code>request.ts</code>, <code>layout.tsx</code>, and <code>navigation.ts</code> all import from here — no duplication.</p>
</div>

</div>

</div>

---

## `request.ts` — Server Message Loader

<div class="g2" style="gap:28px;align-items:start">

<div class="a1">

```ts
// i18n/request.ts
export default getRequestConfig(
  async ({ requestLocale }) => {
    let locale = await requestLocale;

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
  <p style="margin:0;font-size:14px">Comes from the URL segment. Next.js resolves <code>[locale]</code> and passes it here.</p>
</div>

<div class="glass" style="border-color:rgba(251,191,36,0.22)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--amber);margin-bottom:8px">Guard clause</div>
  <p style="margin:0;font-size:14px">Missing or invalid locale silently falls back to <code>'en'</code>. Prevents 500s on bad URLs.</p>
</div>

<div class="glass" style="border-color:rgba(52,211,153,0.22)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--green);margin-bottom:8px">Dynamic import</div>
  <p style="margin:0;font-size:14px"><code>hi.json</code> is <strong>never sent to English users.</strong> Only the needed language file loads per request.</p>
</div>

</div>

</div>

---

## `useTranslations` — Consuming Messages

<div class="g2" style="gap:28px;align-items:start">

<div class="a1">

```ts
// Sidebar.tsx
const t = useTranslations('nav');

t('home')       // "Home" or "होम"
t('categories') // "Categories" or "श्रेणियाँ"
```

<div class="glass" style="margin-top:14px;border-color:rgba(56,189,248,0.22)">
  <p style="margin:0;font-size:14px"><code>useTranslations('nav')</code> locks lookup to the <span style="color:var(--blue)">nav namespace.</span> Missing keys throw in development — intentional early catch.</p>
</div>

</div>

<div class="a2">

<div style="font-family:var(--display);font-size:12px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:10px">JSON structure (en.json)</div>

```json
{
  "nav": {
    "home": "Home",
    "categories": "Categories"
  }
}
```

<div class="glass" style="margin-top:14px;border-color:rgba(52,211,153,0.22)">
  <p style="margin:0;font-size:14px">The namespace maps <strong>directly</strong> to the hook argument. <span style="color:var(--green)">No indirection, no magic.</span></p>
</div>

</div>

</div>

---

## Locale Switch — Full Sequence

<div style="display:flex;flex-direction:column;gap:9px;margin-top:4px">

<div class="a1" style="display:flex;align-items:center;gap:10px">
  <span class="seq-actor">User</span>
  <span class="seq-arr">→</span>
  <div class="node" style="flex:1">clicks <span style="color:var(--blue)">"हिन्दी"</span> button in DevTestPanel</div>
</div>

<div class="a2" style="display:flex;align-items:center;gap:10px">
  <span class="seq-actor">DevTestPanel</span>
  <span class="seq-arr">→</span>
  <div class="node" style="flex:1"><code>router.replace(pathname, &#123; locale: 'hi' &#125;)</code></div>
</div>

<div class="seq-note a2" style="font-size:11px">uses <code>@/i18n/navigation</code> useRouter · swaps locale prefix in URL: /en/settings → /hi/settings</div>

<div class="a3" style="display:flex;align-items:center;gap:10px">
  <span class="seq-actor">Next.js</span>
  <span class="seq-arr">→</span>
  <div class="node na" style="flex:1">full page request → <span style="color:var(--amber)">/hi/settings</span></div>
</div>

<div class="a4" style="display:flex;align-items:center;gap:10px">
  <span class="seq-actor">Server</span>
  <span class="seq-arr">→</span>
  <div class="node" style="flex:1"><code>[locale] = 'hi'</code> · <code>setRequestLocale('hi')</code> · <code>import messages/hi.json</code></div>
</div>

<div class="a5" style="display:flex;align-items:center;gap:10px">
  <span class="seq-actor">Browser</span>
  <span class="seq-arr" style="transform:scaleX(-1);display:inline-block">→</span>
  <div class="node ng" style="flex:1">HTML with <span style="color:var(--green)">Hindi strings</span> + <code>data-locale="hi"</code></div>
</div>

</div>

<div class="glass a6" style="margin-top:16px;padding:12px 18px;border-color:rgba(251,191,36,0.25);display:flex;align-items:center;gap:12px">
  <span style="color:var(--amber);font-size:18px">⚠</span>
  <p style="margin:0;font-size:13px">The <code>useRouter</code> in DevTestPanel must come from <span style="color:var(--amber)"><code>@/i18n/navigation</code></span> — not <code>next/navigation</code>. The next-intl wrapper understands <code>&#123; locale &#125;</code> and rewrites the URL prefix. The plain Next.js router does not.</p>
</div>

---

## Two Routers — Which to Use

<table class="a1">
<thead>
<tr>
  <th>Import</th>
  <th>Locale-aware?</th>
  <th>Use when</th>
</tr>
</thead>
<tbody>
<tr>
  <td><code>next/navigation</code> · <code>useRouter</code></td>
  <td style="color:var(--muted)">No</td>
  <td>Most navigation — within the same locale</td>
</tr>
<tr>
  <td style="color:var(--blue)"><code>@/i18n/navigation</code> · <code>useRouter</code></td>
  <td style="color:var(--green)">Yes</td>
  <td>Locale switching only<br><code>router.replace(path, &#123; locale: 'hi' &#125;)</code></td>
</tr>
<tr>
  <td><code>next/navigation</code> · <code>usePathname</code></td>
  <td style="color:var(--muted)">No</td>
  <td>Returns full path incl. <code>/en/</code> · Sidebar, TopBar</td>
</tr>
<tr>
  <td style="color:var(--blue)"><code>@/i18n/navigation</code> · <code>usePathname</code></td>
  <td style="color:var(--green)">Yes</td>
  <td>Strips locale prefix · <code>/home</code> not <code>/en/home</code></td>
</tr>
</tbody>
</table>

<div class="g3 a2" style="margin-top:16px">
  <div class="glass" style="padding:12px 16px;border-color:rgba(56,189,248,0.15)">
    <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:5px">Sidebar.tsx</div>
    <p style="margin:0;font-size:12px">plain <code>next/navigation</code> + manual <code>/&#123;locale&#125;/…</code> hrefs</p>
  </div>
  <div class="glass" style="padding:12px 16px;border-color:rgba(56,189,248,0.15)">
    <div style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-bottom:5px">TopBar.tsx</div>
    <p style="margin:0;font-size:12px">plain <code>next/navigation</code> usePathname + useParams</p>
  </div>
  <div class="glass" style="padding:12px 16px;border-color:rgba(251,191,36,0.3)">
    <div style="font-family:var(--mono);font-size:10px;color:var(--amber);margin-bottom:5px">DevTestPanel.tsx</div>
    <p style="margin:0;font-size:12px"><code>@/i18n/navigation</code> — only place that needs locale switching</p>
  </div>
</div>

---

## Font Switching — Driven by Locale, Not Theme

<div class="g2" style="gap:28px;align-items:start">

<div style="display:flex;flex-direction:column">

<div class="a1" style="display:flex;align-items:stretch;gap:0">
  <div style="display:flex;flex-direction:column;align-items:center;margin-right:16px">
    <div class="step-num" style="background:rgba(192,132,252,0.15);border:2px solid var(--purple);color:var(--purple)">1</div>
    <div style="width:2px;flex:1;background:linear-gradient(to bottom,var(--purple),rgba(192,132,252,0.3));margin:4px 0"></div>
  </div>
  <div class="node np" style="margin-bottom:10px;flex:1;align-self:center">
    <span style="color:var(--amber)">layout.tsx</span> · locale <span style="color:var(--purple)">=== 'hi'</span>
  </div>
</div>

<div class="a2" style="display:flex;align-items:stretch;gap:0">
  <div style="display:flex;flex-direction:column;align-items:center;margin-right:16px">
    <div class="step-num" style="background:rgba(192,132,252,0.1);border:2px solid rgba(192,132,252,0.5);color:var(--purple)">2</div>
    <div style="width:2px;flex:1;background:linear-gradient(to bottom,rgba(192,132,252,0.3),rgba(192,132,252,0.2));margin:4px 0"></div>
  </div>
  <div class="node" style="margin-bottom:10px;flex:1;align-self:center;border-color:rgba(192,132,252,0.2)">
    adds <code>notoSans.variable</code> + <code>notoDevanagari.variable</code> to root <code>className</code>
  </div>
</div>

<div class="a3" style="display:flex;align-items:stretch;gap:0">
  <div style="display:flex;flex-direction:column;align-items:center;margin-right:16px">
    <div class="step-num" style="background:rgba(192,132,252,0.07);border:2px solid rgba(192,132,252,0.35);color:var(--purple)">3</div>
    <div style="width:2px;flex:1;background:linear-gradient(to bottom,rgba(192,132,252,0.2),rgba(52,211,153,0.25));margin:4px 0"></div>
  </div>
  <div class="node" style="margin-bottom:10px;flex:1;align-self:center;border-color:rgba(192,132,252,0.15)">
    sets <code>data-locale="hi"</code> on root div
  </div>
</div>

<div class="a4" style="display:flex;align-items:center;gap:16px">
  <div style="width:32px;height:32px;border-radius:50%;background:rgba(52,211,153,0.15);border:2px solid var(--green);display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">✓</div>
  <div class="node ng" style="flex:1">
    <code>globals.css [data-locale='hi']</code> fires · Devanagari font applied
  </div>
</div>

</div>

<div class="a5" style="display:flex;flex-direction:column;gap:14px">

<div class="glass" style="border-color:rgba(192,132,252,0.22)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--purple);margin-bottom:8px">next/font behaviour</div>
  <p style="margin:0;font-size:14px">The CSS variable is only registered if the <code>variable</code> class appears on a DOM node. <strong>Noto Devanagari is never loaded for English users.</strong></p>
</div>

<div class="glass" style="border-color:rgba(251,191,36,0.22)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--amber);margin-bottom:8px">Two things happen</div>
  <p style="margin:0;font-size:14px">① <code>next/font</code> registers the CSS var for the font<br>② <code>data-locale</code> tells CSS which font-family stack to use</p>
</div>

</div>

</div>

---

## Theme Switch — CSS Vars Only, No React Re-render

<div style="display:flex;flex-direction:column;gap:9px;margin-top:4px">

<div class="a1" style="display:flex;align-items:center;gap:10px">
  <span class="seq-actor">User</span>
  <span class="seq-arr">→</span>
  <div class="node" style="flex:1">clicks <span style="color:var(--amber)">"Sky"</span> button in DevTestPanel</div>
</div>

<div class="a2" style="display:flex;align-items:center;gap:10px">
  <span class="seq-actor">DevTestPanel</span>
  <span class="seq-arr">→</span>
  <div class="node na" style="flex:1"><code>setTheme('sky', THEME_TOKENS.sky)</code></div>
</div>

<div class="a3" style="display:flex;align-items:center;gap:10px">
  <span class="seq-actor">ThemeContext</span>
  <span class="seq-arr">→</span>
  <div class="node" style="flex:1"><code>setActiveThemeId('sky')</code> · <code>setTokens(THEME_TOKENS.sky)</code> · calls <code>applyThemeTokens()</code></div>
</div>

<div class="a4" style="display:flex;align-items:center;gap:10px">
  <span class="seq-actor">:root</span>
  <span class="seq-arr">→</span>
  <div class="node" style="flex:1;display:flex;align-items:center;gap:10px">
    <span>for each token: <code>style.setProperty('--theme-primary', '#00A6F4')</code></span>
    <div style="width:14px;height:14px;border-radius:3px;background:#00A6F4;flex-shrink:0;border:1px solid rgba(255,255,255,0.2)"></div>
  </div>
</div>

<div class="a5" style="display:flex;align-items:center;gap:10px">
  <span class="seq-actor">Browser</span>
  <span class="seq-arr" style="transform:scaleX(-1);display:inline-block">→</span>
  <div class="node ng" style="flex:1">CSS cascade resolves · all <code>bg-theme-primary</code> repaint <span style="color:var(--green)">instantly</span></div>
</div>

</div>

<div class="glass a6" style="margin-top:16px;padding:12px 18px;border-color:rgba(52,211,153,0.25);display:flex;align-items:center;gap:12px">
  <span style="color:var(--green);font-size:18px">⚡</span>
  <p style="margin:0;font-size:13px">Theme lives entirely in <strong>CSS custom properties on <code>:root</code>.</strong> Components use Tailwind utilities (<code>bg-theme-primary</code>) which resolve via CSS vars at paint time. <span style="color:var(--green)">No React re-render triggered.</span></p>
</div>

---

## The Two Switches Are Orthogonal

<div style="display:flex;gap:28px;align-items:flex-start;margin-top:8px">

<!-- Matrix -->
<div class="a1" style="flex:1">
<div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto auto;gap:10px">

  <!-- Header row -->
  <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:var(--muted);text-align:center;padding:4px">default theme</div>
  <div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:var(--amber);text-align:center;padding:4px">sky theme</div>

  <!-- en row -->
  <div class="node nb a2" style="text-align:center;padding:16px 10px">
    <div style="font-size:16px;margin-bottom:6px">🌐</div>
    <div>/en + default</div>
  </div>
  <div class="node na a3" style="text-align:center;padding:16px 10px">
    <div style="font-size:16px;margin-bottom:6px">🌐</div>
    <div>/en + sky</div>
  </div>

  <!-- hi row -->
  <div class="node nb a4" style="text-align:center;padding:16px 10px">
    <div style="font-size:16px;margin-bottom:6px">🇮🇳</div>
    <div>/hi + default</div>
  </div>
  <div class="node a5" style="text-align:center;padding:16px 10px;border-color:rgba(52,211,153,0.4);background:rgba(52,211,153,0.06)">
    <div style="font-size:16px;margin-bottom:6px">🇮🇳</div>
    <div>/hi + sky</div>
  </div>

</div>

<div style="display:flex;justify-content:space-between;margin-top:12px;padding:0 4px">
  <div style="font-family:var(--mono);font-size:10px;color:var(--blue);text-transform:uppercase;letter-spacing:0.6px">← Locale axis (URL / page load)</div>
  <div style="font-family:var(--mono);font-size:10px;color:var(--amber);text-transform:uppercase;letter-spacing:0.6px">Theme axis (CSS vars) →</div>
</div>
</div>

<!-- Side panel -->
<div class="a6" style="width:320px;display:flex;flex-direction:column;gap:14px">

<div class="glass" style="border-color:rgba(56,189,248,0.22)">
  <div style="font-family:var(--mono);font-size:10px;color:var(--blue);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.6px">Locale switch</div>
  <p style="margin:0;font-size:13px"><code>router.replace(path, &#123; locale: 'hi' &#125;)</code> — moves row to row. Theme persists.</p>
</div>

<div class="glass" style="border-color:rgba(251,191,36,0.22)">
  <div style="font-family:var(--mono);font-size:10px;color:var(--amber);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.6px">Theme switch</div>
  <p style="margin:0;font-size:13px"><code>setTheme('sky', tokens)</code> — moves column to column. Locale untouched.</p>
</div>

<div class="glass" style="border-color:rgba(192,132,252,0.22)">
  <div style="font-family:var(--mono);font-size:10px;color:var(--purple);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.6px">Only coupling</div>
  <p style="margin:0;font-size:13px">Locale controls which <strong>font</strong> CSS variable is registered. Theme has zero influence on fonts.</p>
</div>

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
  <div style="font-family:var(--mono);font-size:11px;color:var(--blue);margin-bottom:8px">Build time</div>
  <p style="margin:0;font-size:13px">Next.js pre-renders the layout for every locale. <code>/en/*</code> and <code>/hi/*</code> become statically generated shells — no locale detection at runtime.</p>
</div>

</div>

<div class="a2">
  <div style="font-family:var(--display);font-size:13px;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:14px">Adding a new language</div>
  <div style="display:flex;flex-direction:column;gap:10px">

    <div class="glass" style="display:flex;align-items:flex-start;gap:14px;padding:16px">
      <div class="step-num" style="width:28px;height:28px;background:rgba(56,189,248,0.15);border:2px solid var(--blue);color:var(--blue);font-size:12px">1</div>
      <div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--blue);margin-bottom:4px">routing.ts</div>
        <p style="margin:0;font-size:13px">Add locale code: <code>['en', 'hi', 'fr']</code></p>
      </div>
    </div>

    <div class="glass" style="display:flex;align-items:flex-start;gap:14px;padding:16px">
      <div class="step-num" style="width:28px;height:28px;background:rgba(251,191,36,0.15);border:2px solid var(--amber);color:var(--amber);font-size:12px">2</div>
      <div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--amber);margin-bottom:4px">messages/fr.json</div>
        <p style="margin:0;font-size:13px">Same key structure as <code>en.json</code></p>
      </div>
    </div>

    <div class="glass" style="display:flex;align-items:flex-start;gap:14px;padding:16px">
      <div class="step-num" style="width:28px;height:28px;background:rgba(192,132,252,0.15);border:2px solid var(--purple);color:var(--purple);font-size:12px">3</div>
      <div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--purple);margin-bottom:4px">layout.tsx (non-Latin only)</div>
        <p style="margin:0;font-size:13px">Load font, add to <code>fontClasses</code>, add <code>[data-locale]</code> rule to <code>globals.css</code></p>
      </div>
    </div>

    <div class="glass" style="display:flex;align-items:flex-start;gap:14px;padding:16px">
      <div class="step-num" style="width:28px;height:28px;background:rgba(52,211,153,0.15);border:2px solid var(--green);color:var(--green);font-size:12px">4</div>
      <div>
        <div style="font-family:var(--mono);font-size:11px;color:var(--green);margin-bottom:4px">DevTestPanel.tsx</div>
        <p style="margin:0;font-size:13px">Add button to <code>LOCALES</code> array. <strong style="color:var(--green)">generateStaticParams picks it up automatically.</strong></p>
      </div>
    </div>

  </div>
</div>

</div>
