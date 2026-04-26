---
marp: true
html: true
paginate: true
---

<style>
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,600;9..144,800&family=Plus+Jakarta+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

:root {
  --bg: #f8f5ef;
  --bg2: #f0ebe0;
  --surface: rgba(0,0,0,0.04);
  --border: rgba(0,0,0,0.1);
  --border2: rgba(0,0,0,0.18);
  --text: #1c1510;
  --muted: #7d6b5a;
  --subtle: #a8957f;
  --coral: #c94b2a;
  --teal: #1a7a6e;
  --gold: #9a7000;
  --red: #c0392b;
  --purple: #5e2ca5;
  --display: 'Fraunces', serif;
  --body: 'Plus Jakarta Sans', sans-serif;
  --mono: 'JetBrains Mono', monospace;
}

section {
  background: var(--bg);
  color: var(--text);
  font-family: var(--body);
  font-size: 17px;
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
    radial-gradient(ellipse at 0% 0%, rgba(201,75,42,0.05) 0%, transparent 45%),
    radial-gradient(ellipse at 100% 100%, rgba(26,122,110,0.04) 0%, transparent 45%);
  pointer-events: none;
}

section > header {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(to right, var(--coral) 0%, var(--gold) 50%, var(--teal) 100%);
}

section::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E");
  opacity: 0.4;
  pointer-events: none;
}

h1 { font-family: var(--display); font-weight: 800; font-size: 56px; line-height: 1.0; letter-spacing: -2px; margin: 0 0 14px; color: var(--text); font-style: italic; }
h2 { font-family: var(--display); font-weight: 600; font-size: 30px; letter-spacing: -0.6px; margin: 0 0 18px; color: var(--text); }

p { margin: 0 0 12px; color: var(--muted); font-weight: 300; font-size: 15px; }

code {
  font-family: var(--mono); font-size: 12.5px;
  background: rgba(0,0,0,0.06);
  border: 1px solid rgba(0,0,0,0.14);
  padding: 1px 7px; border-radius: 4px;
  color: var(--coral);
}

.card {
  background: white;
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 18px 22px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}

.card-coral { border-left: 3px solid var(--coral); }
.card-teal  { border-left: 3px solid var(--teal); }
.card-gold  { border-left: 3px solid var(--gold); }
.card-red   { border-left: 3px solid var(--red); border-color: rgba(192,57,43,0.3); }
.card-purple{ border-left: 3px solid var(--purple); }

.g2 { display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }
.g3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
.g4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; }

.badge { display: inline-block; font-family: var(--mono); font-size: 10px; padding: 3px 10px; border-radius: 100px; font-weight: 500; letter-spacing: 0.6px; text-transform: uppercase; }
.bc { background: rgba(201,75,42,0.1); color: var(--coral); border: 1px solid rgba(201,75,42,0.25); }
.bt { background: rgba(26,122,110,0.1); color: var(--teal); border: 1px solid rgba(26,122,110,0.25); }
.bg_ { background: rgba(154,112,0,0.1); color: var(--gold); border: 1px solid rgba(154,112,0,0.25); }
.br { background: rgba(192,57,43,0.1); color: var(--red); border: 1px solid rgba(192,57,43,0.25); }
.bp { background: rgba(94,44,165,0.1); color: var(--purple); border: 1px solid rgba(94,44,165,0.25); }

.label { font-family: var(--display); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 8px; }
.divider { width: 48px; height: 3px; background: var(--coral); border-radius: 2px; margin: 14px 0; }

.token-pill {
  display: inline-block;
  font-family: var(--mono);
  font-size: 10.5px;
  padding: 3px 10px;
  border-radius: 6px;
  background: rgba(0,0,0,0.04);
  border: 1px solid rgba(0,0,0,0.1);
  color: var(--text);
  margin: 2px 3px;
}

/* SVG diagram animations */
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
@keyframes shake-x {
  0%,100% { transform: translateX(0); }
  20%     { transform: translateX(-4px); }
  40%     { transform: translateX(4px); }
  60%     { transform: translateX(-3px); }
  80%     { transform: translateX(3px); }
}

.fl  { stroke-dasharray: 7 4; animation: dash-march 1.3s linear infinite; }
.fl2 { stroke-dasharray: 7 4; animation: dash-march 1.3s linear 0.35s infinite; }
.fl3 { stroke-dasharray: 7 4; animation: dash-march 1.3s linear 0.7s infinite; }
.fl4 { stroke-dasharray: 7 4; animation: dash-march 1.3s linear 1.05s infinite; }
.fl5 { stroke-dasharray: 7 4; animation: dash-march 1.3s linear 1.4s infinite; }

.svgb1 { animation: box-in 0.4s ease 0.1s both; }
.svgb2 { animation: box-in 0.4s ease 0.4s both; }
.svgb3 { animation: box-in 0.4s ease 0.7s both; }
.svgb4 { animation: box-in 0.4s ease 1.0s both; }
.svgb5 { animation: box-in 0.4s ease 1.3s both; }
.svgb6 { animation: box-in 0.4s ease 1.6s both; }
.svga1 { animation: arrow-in 0.3s ease 0.5s both; }
.svga2 { animation: arrow-in 0.3s ease 0.8s both; }
.svga3 { animation: arrow-in 0.3s ease 1.1s both; }
.svga4 { animation: arrow-in 0.3s ease 1.4s both; }
.svga5 { animation: arrow-in 0.3s ease 1.7s both; }
.svga6 { animation: arrow-in 0.3s ease 2.0s both; }

.err { animation: shake-x 0.5s ease 1.8s both; }

.a1 { opacity:0; animation: fi 0.45s ease 0.05s forwards; }
.a2 { opacity:0; animation: fi 0.45s ease 0.2s  forwards; }
.a3 { opacity:0; animation: fi 0.45s ease 0.35s forwards; }
.a4 { opacity:0; animation: fi 0.45s ease 0.5s  forwards; }
.a5 { opacity:0; animation: fi 0.45s ease 0.65s forwards; }
.a6 { opacity:0; animation: fi 0.45s ease 0.8s  forwards; }
</style>

<header></header>

<div class="a1" style="margin-top:16px;display:flex;gap:10px">
  <span class="badge bc">Mo Speech</span>
  <span class="badge bt">Design System</span>
  <span class="badge bg_">Figma → Code</span>
</div>

<h1 class="a2" style="margin-top:20px">The Design<br>System Story</h1>

<div class="divider a3"></div>

<p class="a4" style="font-size:18px;max-width:640px;color:var(--muted)">From Figma variables and colour palettes to runtime theme switching — and why Tailwind tokens alone weren't enough.</p>

<div class="a5" style="display:flex;gap:16px;margin-top:28px;flex-wrap:wrap">
  <div class="card card-coral" style="padding:12px 18px;display:flex;align-items:center;gap:10px">
    <span style="font-size:18px">🎨</span>
    <span style="font-family:var(--mono);font-size:11px;color:var(--coral)">6 themes · 15 colour tokens</span>
  </div>
  <div class="card" style="padding:12px 18px;display:flex;align-items:center;gap:10px">
    <span style="font-size:18px">📦</span>
    <span style="font-family:var(--mono);font-size:11px;color:var(--muted)">Exported to JSON</span>
  </div>
  <div class="card card-red" style="padding:12px 18px;display:flex;align-items:center;gap:10px">
    <span style="font-size:18px">✗</span>
    <span style="font-family:var(--mono);font-size:11px;color:var(--red)">Tailwind tokens alone broke</span>
  </div>
  <div class="card card-teal" style="padding:12px 18px;display:flex;align-items:center;gap:10px">
    <span style="font-size:18px">✓</span>
    <span style="font-family:var(--mono);font-size:11px;color:var(--teal)">CSS vars + ThemeContext</span>
  </div>
</div>

---

## The Full Journey

<svg viewBox="0 0 1060 200" style="width:100%;height:auto;overflow:visible">

  <!-- Step 1: Figma -->
  <g class="svgb1">
    <rect x="0" y="55" width="170" height="92" rx="9" fill="white" stroke="rgba(201,75,42,0.5)" stroke-width="1.8"/>
    <rect x="0" y="55" width="170" height="8" rx="9" fill="rgba(201,75,42,0.15)"/>
    <rect x="0" y="59" width="170" height="4" fill="rgba(201,75,42,0.15)"/>
    <text x="85" y="88" text-anchor="middle" font-family="Fraunces, serif" font-size="14" font-weight="600" fill="#1c1510">Figma</text>
    <text x="85" y="105" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#7d6b5a">Variables panel</text>
    <text x="85" y="118" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#a8957f">15 colour · spacing · roundness</text>
  </g>

  <!-- Arrow 1 -->
  <g class="svga1">
    <line x1="170" y1="101" x2="200" y2="101" stroke="#c94b2a" stroke-width="1.8" class="fl"/>
    <polygon points="200,96 215,101 200,106" fill="#c94b2a"/>
  </g>

  <!-- Step 2: JSON Export -->
  <g class="svgb2">
    <rect x="215" y="55" width="155" height="92" rx="9" fill="white" stroke="rgba(154,112,0,0.5)" stroke-width="1.8"/>
    <text x="292" y="88" text-anchor="middle" font-family="Fraunces, serif" font-size="14" font-weight="600" fill="#1c1510">JSON Export</text>
    <text x="292" y="105" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#7d6b5a">*.tokens.json</text>
    <text x="292" y="118" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#a8957f">6 files · one per theme</text>
  </g>

  <!-- Arrow 2 -->
  <g class="svga2">
    <line x1="370" y1="101" x2="400" y2="101" stroke="#9a7000" stroke-width="1.8" class="fl2"/>
    <polygon points="400,96 415,101 400,106" fill="#9a7000"/>
  </g>

  <!-- Step 3: Claude Code -->
  <g class="svgb3">
    <rect x="415" y="55" width="155" height="92" rx="9" fill="white" stroke="rgba(94,44,165,0.4)" stroke-width="1.8"/>
    <text x="492" y="88" text-anchor="middle" font-family="Fraunces, serif" font-size="14" font-weight="600" fill="#1c1510">Claude Code</text>
    <text x="492" y="105" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#7d6b5a">generates tokens</text>
    <text x="492" y="118" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#a8957f">CSS vars + Tailwind</text>
  </g>

  <!-- Arrow 3 — splits -->
  <g class="svga3">
    <line x1="570" y1="101" x2="600" y2="101" stroke="#888" stroke-width="1.8" class="fl3"/>
    <line x1="600" y1="101" x2="600" y2="50" stroke="#888" stroke-width="1.4"/>
    <line x1="600" y1="50" x2="628" y2="50" stroke="#888" stroke-width="1.4"/>
    <polygon points="628,45 643,50 628,55" fill="#888"/>
    <line x1="600" y1="101" x2="600" y2="140" stroke="#888" stroke-width="1.4"/>
    <line x1="600" y1="140" x2="628" y2="140" stroke="#888" stroke-width="1.4"/>
    <polygon points="628,135 643,140 628,145" fill="#888"/>
  </g>

  <!-- Step 4a: Tailwind tokens (FAILED) -->
  <g class="svgb4 err">
    <rect x="643" y="18" width="160" height="66" rx="9" fill="rgba(192,57,43,0.07)" stroke="rgba(192,57,43,0.5)" stroke-width="1.8" stroke-dasharray="5 3"/>
    <text x="723" y="43" text-anchor="middle" font-family="Fraunces, serif" font-size="13" font-weight="600" fill="#c0392b">Tailwind Tokens</text>
    <text x="723" y="59" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#c0392b">@theme · static values</text>
    <text x="723" y="73" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#c0392b">✗ runtime switch fails</text>
  </g>

  <!-- Step 4b: CSS vars (SUCCESS) -->
  <g class="svgb4">
    <rect x="643" y="108" width="160" height="66" rx="9" fill="rgba(26,122,110,0.07)" stroke="rgba(26,122,110,0.5)" stroke-width="1.8"/>
    <text x="723" y="133" text-anchor="middle" font-family="Fraunces, serif" font-size="13" font-weight="600" fill="#1a7a6e">CSS Custom Props</text>
    <text x="723" y="149" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#1a7a6e">--theme-* on :root</text>
    <text x="723" y="163" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#1a7a6e">✓ runtime switch works</text>
  </g>

  <!-- Arrow from CSS vars to ThemeContext -->
  <g class="svga5">
    <line x1="803" y1="141" x2="835" y2="141" stroke="#1a7a6e" stroke-width="1.8" class="fl4"/>
    <polygon points="835,136 850,141 835,146" fill="#1a7a6e"/>
  </g>

  <!-- Step 5: ThemeContext -->
  <g class="svgb5">
    <rect x="850" y="108" width="160" height="66" rx="9" fill="white" stroke="rgba(26,122,110,0.5)" stroke-width="1.8"/>
    <text x="930" y="133" text-anchor="middle" font-family="Fraunces, serif" font-size="13" font-weight="600" fill="#1c1510">ThemeContext</text>
    <text x="930" y="149" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#7d6b5a">applyThemeTokens()</text>
    <text x="930" y="163" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#1a7a6e">instant repaint</text>
  </g>

  <!-- X mark on Tailwind path -->
  <g class="svga4">
    <circle cx="820" cy="50" r="12" fill="rgba(192,57,43,0.15)" stroke="rgba(192,57,43,0.5)" stroke-width="1.5"/>
    <text x="820" y="55" text-anchor="middle" font-family="sans-serif" font-size="14" fill="#c0392b" font-weight="700">✕</text>
  </g>

  <!-- Labels -->
  <text x="85"  y="20" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#a8957f">① design</text>
  <text x="292" y="20" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#a8957f">② export</text>
  <text x="492" y="20" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#a8957f">③ generate</text>
  <text x="723" y="8"  text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#c0392b">✕ first attempt</text>
  <text x="723" y="185" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#1a7a6e">✓ final approach</text>
  <text x="930" y="185" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#1a7a6e">⑤ runtime</text>
</svg>

<div class="a6" style="display:flex;gap:16px;margin-top:14px">
  <div class="card card-coral" style="flex:1;padding:12px 18px">
    <div class="label" style="color:var(--coral)">What we designed in Figma</div>
    <p style="margin:0;font-size:14px">15 semantic colour tokens · 12 spacing tokens · 2 roundness tokens · 6 themes</p>
  </div>
  <div class="card card-teal" style="flex:1;padding:12px 18px">
    <div class="label" style="color:var(--teal)">What we ended up with</div>
    <p style="margin:0;font-size:14px">CSS custom properties on <code>:root</code> · Tailwind bridge via <code>@theme inline</code> · ThemeContext for runtime switching</p>
  </div>
</div>

---

## Designing in Figma — What's in the Variables Panel

<div class="g2" style="gap:20px;margin-top:4px">

<div class="a1">
  <div class="label" style="color:var(--coral);margin-bottom:10px">15 Colour Tokens — semantic names, not hex values</div>
  <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:14px">
    <span class="token-pill">Primary</span>
    <span class="token-pill">Text</span>
    <span class="token-pill">Secondary-Text</span>
    <span class="token-pill">Alt-Text</span>
    <span class="token-pill">Secondary-Alt-Text</span>
    <span class="token-pill">Card</span>
    <span class="token-pill">Banner</span>
    <span class="token-pill">Button-highlight</span>
    <span class="token-pill">Alt-Card</span>
    <span class="token-pill">Line</span>
    <span class="token-pill">Symbol-BG</span>
    <span class="token-pill">Background</span>
    <span class="token-pill">Enter-Mode</span>
    <span class="token-pill" style="border-color:rgba(0,200,80,0.3);color:var(--teal)">Success</span>
    <span class="token-pill" style="border-color:rgba(200,0,0,0.3);color:var(--red)">Warning</span>
  </div>
  <div class="card card-gold" style="padding:12px 16px">
    <p style="margin:0;font-size:13px">Every component uses token <em>names</em> — not hex values. Swap the theme and the whole palette changes. No component code touches.</p>
  </div>
</div>

<div class="a2" style="display:flex;flex-direction:column;gap:14px">

  <div>
    <div class="label" style="color:var(--gold);margin-bottom:8px">12 Spacing Tokens</div>
    <div style="display:flex;flex-wrap:wrap;gap:5px">
      <span class="token-pill">General-padding</span>
      <span class="token-pill">General-Space-between</span>
      <span class="token-pill">Header-Banner-padding</span>
      <span class="token-pill">Modal-padding</span>
      <span class="token-pill">Categories-folder-padding</span>
      <span class="token-pill">Modal-Space-between</span>
      <span class="token-pill">Large-buttons-padding</span>
      <span class="token-pill">Item-padding</span>
      <span class="token-pill">Header-Talker-padding</span>
      <span class="token-pill">Elements-Space-between</span>
      <span class="token-pill">Symbol-card-padding</span>
      <span class="token-pill">Buttons-y-padding</span>
    </div>
  </div>

  <div>
    <div class="label" style="color:var(--purple);margin-bottom:8px">2 Roundness Tokens</div>
    <div style="display:flex;gap:5px">
      <span class="token-pill">Roundness</span>
      <span class="token-pill">Modal-Roundness</span>
    </div>
  </div>

  <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
    <div class="label" style="color:var(--muted);margin-bottom:0;line-height:28px">6 themes:</div>
    <span class="badge" style="background:#314158;color:#E4E4E7;border:none">Default</span>
    <span class="badge" style="background:#024A70;color:#B8E6FE;border:none">Sky</span>
    <span class="badge" style="background:#7B3306;color:#FEE685;border:none">Amber</span>
    <span class="badge" style="background:#1a3a1a;color:#a0e080;border:none">Lime</span>
    <span class="badge" style="background:#4a0070;color:#e0b0ff;border:none">Fuchsia</span>
    <span class="badge" style="background:#6a0020;color:#ffb0c0;border:none">Rose</span>
  </div>

</div>
</div>

---

## From Figma to CSS — The Naming Bridge

<p style="margin-bottom:16px">Figma exports to JSON with the same variable names. Claude Code then applies a simple transformation to create CSS custom properties.</p>

<svg viewBox="0 0 1060 224" style="width:100%;height:auto">
  <rect x="0"   y="0" width="300" height="26" rx="6" fill="rgba(201,75,42,0.1)"/>
  <rect x="380" y="0" width="300" height="26" rx="6" fill="rgba(154,112,0,0.1)"/>
  <rect x="760" y="0" width="300" height="26" rx="6" fill="rgba(26,122,110,0.1)"/>
  <text x="150" y="17" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="600" fill="#c94b2a">Figma Variable</text>
  <text x="530" y="17" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="600" fill="#9a7000">JSON Key</text>
  <text x="910" y="17" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="600" fill="#1a7a6e">CSS Custom Property</text>
  <line x1="300" y1="13" x2="375" y2="13" stroke="#888" stroke-width="1.5" class="fl" stroke-dasharray="5 3"/>
  <polygon points="372,9 380,13 372,17" fill="#888"/>
  <line x1="680" y1="13" x2="755" y2="13" stroke="#888" stroke-width="1.5" class="fl2" stroke-dasharray="5 3"/>
  <polygon points="752,9 760,13 752,17" fill="#888"/>
  <g class="svgb1">
    <rect x="0"   y="34" width="300" height="28" rx="6" fill="white" stroke="rgba(201,75,42,0.2)" stroke-width="1"/>
    <text x="20"  y="53" font-family="JetBrains Mono,monospace" font-size="12" fill="#1c1510">Primary</text>
    <rect x="380" y="34" width="300" height="28" rx="6" fill="white" stroke="rgba(154,112,0,0.2)" stroke-width="1"/>
    <text x="400" y="53" font-family="JetBrains Mono,monospace" font-size="12" fill="#7d6b5a">Primary</text>
    <rect x="760" y="34" width="300" height="28" rx="6" fill="white" stroke="rgba(26,122,110,0.2)" stroke-width="1"/>
    <text x="780" y="53" font-family="JetBrains Mono,monospace" font-size="12" fill="#1a7a6e">--theme-primary</text>
  </g>
  <g class="svgb2">
    <rect x="0"   y="70" width="300" height="28" rx="6" fill="white" stroke="rgba(201,75,42,0.2)" stroke-width="1"/>
    <text x="20"  y="89" font-family="JetBrains Mono,monospace" font-size="12" fill="#1c1510">Secondary-Alt-Text</text>
    <rect x="380" y="70" width="300" height="28" rx="6" fill="white" stroke="rgba(154,112,0,0.2)" stroke-width="1"/>
    <text x="400" y="89" font-family="JetBrains Mono,monospace" font-size="12" fill="#7d6b5a">Secondary-Alt-Text</text>
    <rect x="760" y="70" width="300" height="28" rx="6" fill="white" stroke="rgba(26,122,110,0.2)" stroke-width="1"/>
    <text x="780" y="89" font-family="JetBrains Mono,monospace" font-size="12" fill="#1a7a6e">--theme-secondary-alt-text</text>
  </g>
  <g class="svgb3">
    <rect x="0"   y="106" width="300" height="28" rx="6" fill="white" stroke="rgba(201,75,42,0.2)" stroke-width="1"/>
    <text x="20"  y="125" font-family="JetBrains Mono,monospace" font-size="12" fill="#1c1510">Button-highlight</text>
    <rect x="380" y="106" width="300" height="28" rx="6" fill="white" stroke="rgba(154,112,0,0.2)" stroke-width="1"/>
    <text x="400" y="125" font-family="JetBrains Mono,monospace" font-size="12" fill="#7d6b5a">Button-highlight</text>
    <rect x="760" y="106" width="300" height="28" rx="6" fill="white" stroke="rgba(26,122,110,0.2)" stroke-width="1"/>
    <text x="780" y="125" font-family="JetBrains Mono,monospace" font-size="12" fill="#1a7a6e">--theme-button-highlight</text>
  </g>
  <g class="svgb4">
    <rect x="0"   y="142" width="300" height="28" rx="6" fill="white" stroke="rgba(201,75,42,0.2)" stroke-width="1"/>
    <text x="20"  y="161" font-family="JetBrains Mono,monospace" font-size="12" fill="#1c1510">Roundness</text>
    <rect x="380" y="142" width="300" height="28" rx="6" fill="white" stroke="rgba(154,112,0,0.2)" stroke-width="1"/>
    <text x="400" y="161" font-family="JetBrains Mono,monospace" font-size="12" fill="#7d6b5a">Roundness</text>
    <rect x="760" y="142" width="300" height="28" rx="6" fill="white" stroke="rgba(26,122,110,0.2)" stroke-width="1"/>
    <text x="780" y="161" font-family="JetBrains Mono,monospace" font-size="12" fill="#1a7a6e">--theme-roundness</text>
  </g>
  <g class="svgb5">
    <rect x="0"   y="178" width="300" height="28" rx="6" fill="white" stroke="rgba(201,75,42,0.2)" stroke-width="1"/>
    <text x="20"  y="197" font-family="JetBrains Mono,monospace" font-size="12" fill="#1c1510">General-padding</text>
    <rect x="380" y="178" width="300" height="28" rx="6" fill="white" stroke="rgba(154,112,0,0.2)" stroke-width="1"/>
    <text x="400" y="197" font-family="JetBrains Mono,monospace" font-size="12" fill="#7d6b5a">General-padding</text>
    <rect x="760" y="178" width="300" height="28" rx="6" fill="white" stroke="rgba(26,122,110,0.2)" stroke-width="1"/>
    <text x="780" y="197" font-family="JetBrains Mono,monospace" font-size="12" fill="#1a7a6e">--theme-general-padding</text>
  </g>
  <line x1="300" y1="48"  x2="380" y2="48"  stroke="rgba(201,75,42,0.4)" stroke-width="1.2" class="fl"  stroke-dasharray="4 3"/>
  <line x1="680" y1="48"  x2="760" y2="48"  stroke="rgba(26,122,110,0.4)" stroke-width="1.2" class="fl2" stroke-dasharray="4 3"/>
  <line x1="300" y1="84"  x2="380" y2="84"  stroke="rgba(201,75,42,0.4)" stroke-width="1.2" class="fl"  stroke-dasharray="4 3"/>
  <line x1="680" y1="84"  x2="760" y2="84"  stroke="rgba(26,122,110,0.4)" stroke-width="1.2" class="fl2" stroke-dasharray="4 3"/>
  <line x1="300" y1="120" x2="380" y2="120" stroke="rgba(201,75,42,0.4)" stroke-width="1.2" class="fl"  stroke-dasharray="4 3"/>
  <line x1="680" y1="120" x2="760" y2="120" stroke="rgba(26,122,110,0.4)" stroke-width="1.2" class="fl2" stroke-dasharray="4 3"/>
  <line x1="300" y1="156" x2="380" y2="156" stroke="rgba(201,75,42,0.4)" stroke-width="1.2" class="fl"  stroke-dasharray="4 3"/>
  <line x1="680" y1="156" x2="760" y2="156" stroke="rgba(26,122,110,0.4)" stroke-width="1.2" class="fl2" stroke-dasharray="4 3"/>
  <line x1="300" y1="192" x2="380" y2="192" stroke="rgba(201,75,42,0.4)" stroke-width="1.2" class="fl"  stroke-dasharray="4 3"/>
  <line x1="680" y1="192" x2="760" y2="192" stroke="rgba(26,122,110,0.4)" stroke-width="1.2" class="fl2" stroke-dasharray="4 3"/>
  <text x="530" y="216" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#9a7000">JSON key = Figma name exactly</text>
  <text x="910" y="216" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#1a7a6e">lowercase · kebab-case · --theme- prefix added</text>
</svg>

---

## First Attempt — Tailwind Tokens

<p style="margin-bottom:16px">Looked clean on paper. Broke at runtime.</p>

<svg viewBox="0 0 1060 210" style="width:100%;height:auto">

  <!-- Column 1: @theme config -->
  <g class="svgb1">
    <rect x="0" y="0" width="230" height="110" rx="9" fill="rgba(192,57,43,0.05)" stroke="rgba(192,57,43,0.35)" stroke-width="1.8"/>
    <text x="115" y="24" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="600" fill="#c0392b">@theme config</text>
    <line x1="10" y1="34" x2="220" y2="34" stroke="rgba(192,57,43,0.15)" stroke-width="1"/>
    <text x="115" y="54" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">Token name mapped to</text>
    <text x="115" y="70" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">a static hex value</text>
    <rect x="12" y="80" width="206" height="22" rx="4" fill="rgba(192,57,43,0.08)"/>
    <text x="115" y="95" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#c0392b">Tailwind resolves at BUILD time</text>
  </g>

  <!-- Arrow -->
  <g class="svga1">
    <line x1="230" y1="55" x2="270" y2="55" stroke="#888" stroke-width="1.5" class="fl"/>
    <polygon points="270,50 285,55 270,60" fill="#888"/>
    <text x="257" y="47" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#a8957f">build</text>
  </g>

  <!-- Column 2: Generated CSS (baked) -->
  <g class="svgb2">
    <rect x="285" y="0" width="240" height="110" rx="9" fill="white" stroke="rgba(0,0,0,0.15)" stroke-width="1.5"/>
    <text x="405" y="24" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="600" fill="#1c1510">Generated CSS utility</text>
    <line x1="295" y1="34" x2="515" y2="34" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>
    <text x="405" y="55" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">The hex value is written</text>
    <text x="405" y="71" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">directly into the utility class</text>
    <rect x="295" y="82" width="220" height="20" rx="4" fill="rgba(192,57,43,0.1)"/>
    <text x="405" y="96" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#c0392b">hardcoded — not a reference</text>
  </g>

  <!-- Arrow from ThemeContext -->
  <g class="svga2">
    <line x1="740" y1="150" x2="610" y2="150" stroke="#888" stroke-width="1.5" stroke-dasharray="6 3"/>
    <line x1="610" y1="150" x2="610" y2="60" stroke="#888" stroke-width="1.5" stroke-dasharray="6 3"/>
    <polygon points="605,80 610,60 615,80" fill="#888"/>
    <text x="672" y="144" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#a8957f">ThemeContext tries to switch…</text>
  </g>

  <!-- ThemeContext box -->
  <g class="svgb3">
    <rect x="740" y="120" width="240" height="66" rx="9" fill="rgba(94,44,165,0.07)" stroke="rgba(94,44,165,0.35)" stroke-width="1.5"/>
    <text x="860" y="148" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="600" fill="#5e2ca5">ThemeContext</text>
    <text x="860" y="166" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">writes new value to :root var</text>
    <text x="860" y="180" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#5e2ca5">style.setProperty()</text>
  </g>

  <!-- NO EFFECT circle -->
  <g class="svgb4 err">
    <circle cx="530" cy="85" r="38" fill="rgba(192,57,43,0.08)" stroke="rgba(192,57,43,0.5)" stroke-width="2"/>
    <text x="530" y="78" text-anchor="middle" font-family="Fraunces,serif" font-size="14" font-weight="800" fill="#c0392b">NO</text>
    <text x="530" y="96" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#c0392b">EFFECT</text>
  </g>

  <text x="530" y="194" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="12" fill="#7d6b5a">The utility already has the literal hex baked in — the :root variable is invisible to it.</text>
</svg>

<div class="card card-red a6" style="margin-top:14px;padding:12px 20px">
  <p style="margin:0;font-size:14px"><strong style="color:var(--red)">Root cause:</strong> <code>@theme</code> without <code>inline</code> resolves tokens at build time. The generated utility gets a literal hex string, not a CSS variable reference. Changing the variable at runtime has nothing to cascade into.</p>
</div>

---

## Why @theme inline Fixes It

<p style="margin-bottom:14px">One keyword changes everything — it tells Tailwind to keep the <code>var()</code> reference alive instead of resolving it.</p>

<svg viewBox="0 0 1060 260" style="width:100%;height:auto">
  <g class="svgb1">
    <rect x="0" y="0" width="480" height="250" rx="10" fill="rgba(192,57,43,0.04)" stroke="rgba(192,57,43,0.3)" stroke-width="1.8"/>
    <rect x="0" y="0" width="480" height="34" rx="10" fill="rgba(192,57,43,0.1)"/>
    <rect x="0" y="24" width="480" height="10" fill="rgba(192,57,43,0.1)"/>
    <text x="240" y="23" text-anchor="middle" font-family="Fraunces,serif" font-size="14" font-weight="600" fill="#c0392b">@theme — static (broken)</text>
    <rect x="16" y="48" width="448" height="44" rx="6" fill="rgba(192,57,43,0.06)"/>
    <text x="240" y="67" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="12" fill="#7d6b5a">You write a token pointing to a</text>
    <text x="240" y="83" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="12" fill="#c0392b">static hex value</text>
    <text x="240" y="112" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#a8957f">▼ Tailwind builds</text>
    <rect x="16" y="120" width="448" height="44" rx="6" fill="rgba(192,57,43,0.06)"/>
    <text x="240" y="139" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="12" fill="#7d6b5a">Generated utility class contains</text>
    <text x="240" y="155" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="12" fill="#c0392b">a baked-in hex value — no var()</text>
    <text x="240" y="184" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#a8957f">▼ ThemeContext calls setProperty()</text>
    <rect x="16" y="192" width="448" height="44" rx="6" fill="rgba(192,57,43,0.1)"/>
    <text x="240" y="211" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="12" font-weight="600" fill="#c0392b">✗ No cascade — utility ignores the update</text>
    <text x="240" y="228" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#c0392b">UI stays frozen on the old colour</text>
  </g>
  <g class="svgb3">
    <line x1="530" y1="10" x2="530" y2="245" stroke="rgba(0,0,0,0.1)" stroke-width="1.5" stroke-dasharray="5 4"/>
    <circle cx="530" cy="125" r="20" fill="var(--bg)" stroke="rgba(0,0,0,0.15)" stroke-width="1.5"/>
    <text x="530" y="130" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="800" fill="#7d6b5a">vs</text>
  </g>
  <g class="svgb2">
    <rect x="580" y="0" width="480" height="250" rx="10" fill="rgba(26,122,110,0.04)" stroke="rgba(26,122,110,0.3)" stroke-width="1.8"/>
    <rect x="580" y="0" width="480" height="34" rx="10" fill="rgba(26,122,110,0.1)"/>
    <rect x="580" y="24" width="480" height="10" fill="rgba(26,122,110,0.1)"/>
    <text x="820" y="23" text-anchor="middle" font-family="Fraunces,serif" font-size="14" font-weight="600" fill="#1a7a6e">@theme inline — runtime (working)</text>
    <rect x="596" y="48" width="448" height="44" rx="6" fill="rgba(26,122,110,0.06)"/>
    <text x="820" y="67" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="12" fill="#7d6b5a">You write a token pointing to a</text>
    <text x="820" y="83" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="12" fill="#1a7a6e">CSS variable reference  var(--theme-primary)</text>
    <text x="820" y="112" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#a8957f">▼ Tailwind builds</text>
    <rect x="596" y="120" width="448" height="44" rx="6" fill="rgba(26,122,110,0.06)"/>
    <text x="820" y="139" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="12" fill="#7d6b5a">Generated utility class contains</text>
    <text x="820" y="155" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="12" fill="#1a7a6e">the var() reference — preserved</text>
    <text x="820" y="184" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#a8957f">▼ ThemeContext calls setProperty()</text>
    <rect x="596" y="192" width="448" height="44" rx="6" fill="rgba(26,122,110,0.1)"/>
    <text x="820" y="211" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="12" font-weight="600" fill="#1a7a6e">✓ Cascade fires — utility picks up new value</text>
    <text x="820" y="228" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#1a7a6e">Browser repaints instantly</text>
  </g>
</svg>

---

## globals.css — Three Blocks

<p style="margin-bottom:16px">Three distinct sections in one file — each with a different job.</p>

<div class="g3" style="gap:18px;margin-top:4px">

<div class="a1 card card-coral" style="padding:20px 22px">
  <div style="font-family:var(--mono);font-size:11px;color:var(--coral);font-weight:500;margin-bottom:10px">Block ① — :root { }</div>
  <div class="label" style="color:var(--text);font-size:13px;text-transform:none;letter-spacing:0;margin-bottom:8px;font-weight:600">All default theme values</div>
  <p style="font-size:13px;margin:0 0 10px">Every <code>--theme-*</code> variable starts here with the Default theme values. This is the only block ThemeContext touches at runtime — it overwrites these when a theme changes.</p>
  <div style="background:rgba(201,75,42,0.07);border-radius:8px;padding:10px 12px;font-family:var(--mono);font-size:10.5px;color:var(--muted);line-height:1.8">
    --theme-primary<br>
    --theme-banner<br>
    --theme-card<br>
    --theme-roundness<br>
    <span style="color:var(--subtle)">…29 more vars</span>
  </div>
</div>

<div class="a2 card card-teal" style="padding:20px 22px">
  <div style="font-family:var(--mono);font-size:11px;color:var(--teal);font-weight:500;margin-bottom:10px">Block ② — @theme inline { }</div>
  <div class="label" style="color:var(--text);font-size:13px;text-transform:none;letter-spacing:0;margin-bottom:8px;font-weight:600">The Tailwind bridge</div>
  <p style="font-size:13px;margin:0 0 10px">Maps every <code>--theme-*</code> var to a Tailwind utility name using <code>var()</code> references. The <code>inline</code> keyword is the critical part — it stops Tailwind from resolving the value at build time.</p>
  <div style="background:rgba(26,122,110,0.07);border-radius:8px;padding:10px 12px;font-family:var(--mono);font-size:10.5px;color:var(--muted);line-height:1.8">
    <span style="color:var(--teal)">--color-theme-primary</span><br>
    <span style="color:var(--subtle)">→ var(--theme-primary)</span><br>
    <span style="color:var(--teal)">--spacing-theme-general-padding</span><br>
    <span style="color:var(--subtle)">→ var(--theme-general-padding)</span>
  </div>
</div>

<div class="a3 card" style="padding:20px 22px;border-left:3px solid var(--muted)">
  <div style="font-family:var(--mono);font-size:11px;color:var(--muted);font-weight:500;margin-bottom:10px">Block ③ — [data-locale] { }</div>
  <div class="label" style="color:var(--text);font-size:13px;text-transform:none;letter-spacing:0;margin-bottom:8px;font-weight:600">Font switching</div>
  <p style="font-size:13px;margin:0 0 10px">Completely separate from theming. Driven by the <code>data-locale</code> attribute set by the layout, not by ThemeContext. Theme never touches fonts.</p>
  <div style="background:rgba(0,0,0,0.04);border-radius:8px;padding:10px 12px;font-family:var(--mono);font-size:10.5px;color:var(--muted);line-height:1.8">
    [data-locale] → Noto Sans<br>
    [data-locale="hi"] → Noto Devanagari
  </div>
</div>

</div>

<div class="a4 card" style="margin-top:16px;padding:12px 18px;border-left:3px solid var(--teal);display:flex;align-items:center;gap:12px">
  <p style="margin:0;font-size:13px">Result: write <code>bg-theme-primary</code> anywhere in JSX. Tailwind generates the utility with <code>var(--theme-primary)</code> inside. ThemeContext swaps the var. The browser repaints.</p>
</div>

---

## ThemeContext — The Runtime Switcher

<p style="margin-bottom:14px">Three moving parts — a catalogue, a mapper, and a one-line DOM write.</p>

<svg viewBox="0 0 1060 270" style="width:100%;height:auto">

  <!-- Box 1: THEME_TOKENS catalogue -->
  <g class="svgb1">
    <rect x="0" y="20" width="280" height="230" rx="10" fill="rgba(94,44,165,0.05)" stroke="rgba(94,44,165,0.3)" stroke-width="1.8"/>
    <rect x="0" y="20" width="280" height="32" rx="10" fill="rgba(94,44,165,0.1)"/>
    <rect x="0" y="42" width="280" height="10" fill="rgba(94,44,165,0.1)"/>
    <text x="140" y="42" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="600" fill="#5e2ca5">THEME_TOKENS catalogue</text>
    <text x="140" y="78" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">6 theme objects</text>
    <text x="140" y="96" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">each containing 15 colour tokens</text>
    <text x="140" y="114" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">+ optional spacing / roundness overrides</text>
    <line x1="16" y1="126" x2="264" y2="126" stroke="rgba(94,44,165,0.15)" stroke-width="1"/>
    <text x="20" y="145" font-family="JetBrains Mono,monospace" font-size="10" fill="#5e2ca5">default · sky · amber</text>
    <text x="20" y="161" font-family="JetBrains Mono,monospace" font-size="10" fill="#5e2ca5">lime · fuchsia · rose</text>
    <line x1="16" y1="172" x2="264" y2="172" stroke="rgba(94,44,165,0.15)" stroke-width="1"/>
    <text x="140" y="192" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10.5" fill="#a8957f">ThemeContext.tsx : 107</text>
  </g>

  <!-- Arrow 1 -->
  <g class="svga1">
    <line x1="280" y1="135" x2="340" y2="135" stroke="#5e2ca5" stroke-width="1.8" class="fl"/>
    <polygon points="340,130 355,135 340,140" fill="#5e2ca5"/>
    <text x="315" y="126" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#a8957f">setTheme()</text>
  </g>

  <!-- Box 2: applyThemeTokens -->
  <g class="svgb2">
    <rect x="355" y="20" width="300" height="230" rx="10" fill="rgba(201,75,42,0.05)" stroke="rgba(201,75,42,0.3)" stroke-width="1.8"/>
    <rect x="355" y="20" width="300" height="32" rx="10" fill="rgba(201,75,42,0.1)"/>
    <rect x="355" y="42" width="300" height="10" fill="rgba(201,75,42,0.1)"/>
    <text x="505" y="42" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="600" fill="#c94b2a">applyThemeTokens()</text>
    <text x="505" y="78" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">Loops through TOKEN_TO_CSS map</text>
    <text x="505" y="96" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">For each token key, calls</text>
    <text x="505" y="114" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10.5" fill="#c94b2a">style.setProperty(cssVar, value)</text>
    <line x1="370" y1="126" x2="640" y2="126" stroke="rgba(201,75,42,0.15)" stroke-width="1"/>
    <text x="505" y="146" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">on</text>
    <text x="505" y="164" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="11" fill="#c94b2a">document.documentElement</text>
    <line x1="370" y1="175" x2="640" y2="175" stroke="rgba(201,75,42,0.15)" stroke-width="1"/>
    <text x="505" y="194" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10.5" fill="#a8957f">ThemeContext.tsx : 174</text>
  </g>

  <!-- Arrow 2 -->
  <g class="svga2">
    <line x1="655" y1="135" x2="715" y2="135" stroke="#1a7a6e" stroke-width="1.8" class="fl2"/>
    <polygon points="715,130 730,135 715,140" fill="#1a7a6e"/>
    <text x="688" y="126" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#a8957f">cascade</text>
  </g>

  <!-- Box 3: Result -->
  <g class="svgb3">
    <rect x="730" y="20" width="330" height="230" rx="10" fill="rgba(26,122,110,0.05)" stroke="rgba(26,122,110,0.3)" stroke-width="1.8"/>
    <rect x="730" y="20" width="330" height="32" rx="10" fill="rgba(26,122,110,0.1)"/>
    <rect x="730" y="42" width="330" height="10" fill="rgba(26,122,110,0.1)"/>
    <text x="895" y="42" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="600" fill="#1a7a6e">:root updates · browser repaints</text>
    <text x="895" y="78" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">All --theme-* vars now hold new values</text>
    <text x="895" y="96" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">Every bg-theme-* utility resolves</text>
    <text x="895" y="114" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">the new var at paint time</text>
    <line x1="745" y1="126" x2="1045" y2="126" stroke="rgba(26,122,110,0.15)" stroke-width="1"/>
    <text x="895" y="150" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="13" font-weight="600" fill="#1a7a6e">Zero React re-renders</text>
    <text x="895" y="170" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#1a7a6e">The CSS cascade does all the work</text>
    <line x1="745" y1="182" x2="1045" y2="182" stroke="rgba(26,122,110,0.15)" stroke-width="1"/>
    <text x="895" y="204" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#a8957f">globals.css : 41 · ThemeContext.tsx : 107</text>
  </g>
</svg>

---

## Token Flow — From Switch to Screen

<p style="margin-bottom:16px">What happens the moment a user taps a theme button</p>

<svg viewBox="0 0 1060 230" style="width:100%;height:auto">

  <!-- Step 1: User taps -->
  <g class="svgb1">
    <rect x="0" y="80" width="140" height="70" rx="9" fill="white" stroke="rgba(0,0,0,0.15)" stroke-width="1.5"/>
    <text x="70" y="108" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="600" fill="#1c1510">User</text>
    <text x="70" y="126" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#7d6b5a">taps "Sky" button</text>
    <text x="70" y="142" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#7d6b5a">in DevTestPanel</text>
  </g>

  <g class="svga1">
    <line x1="140" y1="115" x2="178" y2="115" stroke="#5e2ca5" stroke-width="1.8" class="fl"/>
    <polygon points="178,110 193,115 178,120" fill="#5e2ca5"/>
  </g>

  <!-- Step 2: ThemeContext -->
  <g class="svgb2">
    <rect x="193" y="65" width="180" height="100" rx="9" fill="rgba(94,44,165,0.07)" stroke="rgba(94,44,165,0.4)" stroke-width="1.8"/>
    <text x="283" y="95" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="600" fill="#5e2ca5">ThemeContext</text>
    <text x="283" y="112" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#7d6b5a">setTheme('sky',</text>
    <text x="283" y="127" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#7d6b5a">THEME_TOKENS.sky)</text>
    <text x="283" y="146" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9" fill="#5e2ca5">applyThemeTokens()</text>
  </g>

  <g class="svga2">
    <line x1="373" y1="115" x2="411" y2="115" stroke="#5e2ca5" stroke-width="1.8" class="fl2"/>
    <polygon points="411,110 426,115 411,120" fill="#5e2ca5"/>
  </g>

  <!-- Step 3: :root -->
  <g class="svgb3">
    <rect x="426" y="55" width="200" height="120" rx="9" fill="rgba(201,75,42,0.06)" stroke="rgba(201,75,42,0.4)" stroke-width="1.8"/>
    <text x="526" y="80" text-anchor="middle" font-family="Fraunces,serif" font-size="12" font-weight="600" fill="#c94b2a">:root (document)</text>
    <line x1="436" y1="90" x2="616" y2="90" stroke="rgba(201,75,42,0.2)" stroke-width="1"/>
    <text x="526" y="106" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#c94b2a">--theme-primary: #00A6F4</text>
    <text x="526" y="121" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#c94b2a">--theme-banner: #0084D1</text>
    <text x="526" y="136" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#c94b2a">--theme-card: #024A70</text>
    <text x="526" y="154" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9" fill="#a8957f">…all 15 colour tokens</text>
  </g>

  <g class="svga3">
    <line x1="626" y1="115" x2="664" y2="115" stroke="#1a7a6e" stroke-width="1.8" class="fl3"/>
    <polygon points="664,110 679,115 664,120" fill="#1a7a6e"/>
  </g>

  <!-- Step 4: CSS cascade -->
  <g class="svgb4">
    <rect x="679" y="65" width="188" height="100" rx="9" fill="rgba(26,122,110,0.07)" stroke="rgba(26,122,110,0.4)" stroke-width="1.8"/>
    <text x="773" y="90" text-anchor="middle" font-family="Fraunces,serif" font-size="12" font-weight="600" fill="#1a7a6e">CSS Cascade</text>
    <line x1="689" y1="98" x2="857" y2="98" stroke="rgba(26,122,110,0.2)" stroke-width="1"/>
    <text x="773" y="115" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10.5" fill="#7d6b5a">bg-theme-primary resolves</text>
    <text x="773" y="131" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10.5" fill="#7d6b5a">to new var value</text>
    <text x="773" y="150" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#1a7a6e">automatically</text>
  </g>

  <g class="svga4">
    <line x1="867" y1="115" x2="905" y2="115" stroke="#1a7a6e" stroke-width="1.8" class="fl4"/>
    <polygon points="905,110 920,115 905,120" fill="#1a7a6e"/>
  </g>

  <!-- Step 5: repaint -->
  <g class="svgb5">
    <rect x="920" y="80" width="140" height="70" rx="9" fill="rgba(26,122,110,0.1)" stroke="rgba(26,122,110,0.5)" stroke-width="1.8"/>
    <text x="990" y="106" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="600" fill="#1a7a6e">Repaint</text>
    <text x="990" y="124" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#1a7a6e">instant ✓</text>
    <text x="990" y="140" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#7d6b5a">no React render</text>
  </g>

  <!-- Timing strip -->
  <line x1="0" y1="195" x2="1060" y2="195" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>
  <text x="70"  y="212" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#a8957f">① tap</text>
  <text x="283" y="212" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#a8957f">② JS call</text>
  <text x="526" y="212" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#a8957f">③ var rewrite</text>
  <text x="773" y="212" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#a8957f">④ cascade</text>
  <text x="990" y="212" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#1a7a6e">⑤ done</text>
</svg>

<div class="card a6" style="margin-top:10px;padding:12px 18px;border-left:3px solid var(--teal);display:flex;align-items:center;gap:12px">
  <span style="font-size:18px">⚡</span>
  <p style="margin:0;font-size:13px">Steps ③–⑤ happen in a single browser paint cycle. From the user's perspective it is truly instant — no animation, no transition, no loading state needed.</p>
</div>

---

## Adding a New Theme

<p style="margin-bottom:16px">The whole architecture pays off here. Adding a theme is purely additive — no existing code changes.</p>

<div class="g2" style="gap:20px">

<div class="a1" style="display:flex;flex-direction:column;gap:12px">

  <div class="card card-coral" style="padding:16px 20px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <span style="font-family:var(--mono);font-size:18px;color:var(--coral);font-weight:700">①</span>
      <div class="label" style="color:var(--coral);margin:0">Add to THEME_TOKENS</div>
    </div>
    <p style="margin:0;font-size:14px">Open <code>ThemeContext.tsx</code> and add a new entry to the <code>THEME_TOKENS</code> object. Use any of the 6 existing themes as a template.</p>
  </div>

  <div class="card card-gold" style="padding:16px 20px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <span style="font-family:var(--mono);font-size:18px;color:var(--gold);font-weight:700">②</span>
      <div class="label" style="color:var(--gold);margin:0">Fill the 15 colour tokens</div>
    </div>
    <p style="margin:0;font-size:14px">Supply values for all 15 required colour tokens. Spacing and roundness are optional — they inherit the defaults from <code>globals.css</code>.</p>
  </div>

</div>

<div class="a2" style="display:flex;flex-direction:column;gap:12px">

  <div class="card card-teal" style="padding:16px 20px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <span style="font-family:var(--mono);font-size:18px;color:var(--teal);font-weight:700">③</span>
      <div class="label" style="color:var(--teal);margin:0">Add to DevTestPanel</div>
    </div>
    <p style="margin:0;font-size:14px">Add a button in the theme switcher panel. The button calls <code>setTheme()</code> with the new slug. That's the only UI change needed.</p>
  </div>

  <div class="card card-purple" style="padding:16px 20px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
      <span style="font-family:var(--mono);font-size:18px;color:var(--purple);font-weight:700">④</span>
      <div class="label" style="color:var(--purple);margin:0">Hot reload — done</div>
    </div>
    <p style="margin:0;font-size:14px">No new CSS. No Tailwind config change. No rebuild. The theme is just a data object — <code>applyThemeTokens()</code> is already generic.</p>
  </div>

  <div class="card" style="border-left:3px solid var(--muted);padding:14px 18px">
    <p style="margin:0;font-size:13px">In Mo Speech, each student profile stores a <code>themeSlug</code> in Convex. When their profile loads, <code>setTheme()</code> is called once — the whole UI reflects their preferences.</p>
  </div>

</div>
</div>
