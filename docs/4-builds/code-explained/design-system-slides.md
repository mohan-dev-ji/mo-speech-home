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

/* Grain texture overlay */
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

pre {
  background: #1c1510 !important;
  border: 1px solid rgba(0,0,0,0.2) !important;
  border-radius: 12px !important;
  padding: 18px 22px !important;
  font-family: var(--mono) !important;
  font-size: 12px !important;
  line-height: 1.75 !important;
  margin: 0;
}

pre code {
  background: none !important;
  border: none !important;
  padding: 0 !important;
  color: #a5b4fc !important;
  font-size: 12px !important;
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
@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
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
.svgb7 { animation: box-in 0.4s ease 1.9s both; }
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
    <span style="font-family:var(--mono);font-size:11px;color:var(--coral)">Designed in Figma</span>
  </div>
  <div class="card" style="padding:12px 18px;display:flex;align-items:center;gap:10px">
    <span style="font-size:18px">📦</span>
    <span style="font-family:var(--mono);font-size:11px;color:var(--muted)">Exported to JSON</span>
  </div>
  <div class="card card-red" style="padding:12px 18px;display:flex;align-items:center;gap:10px">
    <span style="font-size:18px">✗</span>
    <span style="font-family:var(--mono);font-size:11px;color:var(--red)">Tailwind tokens broke</span>
  </div>
  <div class="card card-teal" style="padding:12px 18px;display:flex;align-items:center;gap:10px">
    <span style="font-size:18px">✓</span>
    <span style="font-family:var(--mono);font-size:11px;color:var(--teal)">CSS vars + ThemeContext</span>
  </div>
</div>

---

## The Full Journey

<!-- Horizontal workflow SVG -->
<svg viewBox="0 0 1060 200" style="width:100%;height:auto;overflow:visible">

  <!-- Step 1: Figma -->
  <g class="svgb1">
    <rect x="0" y="55" width="140" height="70" rx="9" fill="white" stroke="rgba(201,75,42,0.5)" stroke-width="1.8"/>
    <rect x="0" y="55" width="140" height="8" rx="9" fill="rgba(201,75,42,0.15)"/>
    <rect x="0" y="59" width="140" height="4" fill="rgba(201,75,42,0.15)"/>
    <text x="70" y="88" text-anchor="middle" font-family="Fraunces, serif" font-size="14" font-weight="600" fill="#1c1510">Figma</text>
    <text x="70" y="105" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#7d6b5a">Variables panel</text>
    <text x="70" y="118" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#a8957f">color · space · type · radius</text>
  </g>

  <!-- Arrow 1 -->
  <g class="svga1">
    <line x1="140" y1="90" x2="178" y2="90" stroke="#c94b2a" stroke-width="1.8" class="fl"/>
    <polygon points="178,85 193,90 178,95" fill="#c94b2a"/>
  </g>

  <!-- Step 2: JSON Export -->
  <g class="svgb2">
    <rect x="193" y="55" width="140" height="70" rx="9" fill="white" stroke="rgba(154,112,0,0.5)" stroke-width="1.8"/>
    <text x="263" y="88" text-anchor="middle" font-family="Fraunces, serif" font-size="14" font-weight="600" fill="#1c1510">JSON Export</text>
    <text x="263" y="105" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#7d6b5a">tokens.json</text>
    <text x="263" y="118" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#a8957f">raw design values</text>
  </g>

  <!-- Arrow 2 -->
  <g class="svga2">
    <line x1="333" y1="90" x2="371" y2="90" stroke="#9a7000" stroke-width="1.8" class="fl2"/>
    <polygon points="371,85 386,90 371,95" fill="#9a7000"/>
  </g>

  <!-- Step 3: Claude Code -->
  <g class="svgb3">
    <rect x="386" y="55" width="140" height="70" rx="9" fill="white" stroke="rgba(94,44,165,0.4)" stroke-width="1.8"/>
    <text x="456" y="88" text-anchor="middle" font-family="Fraunces, serif" font-size="14" font-weight="600" fill="#1c1510">Claude Code</text>
    <text x="456" y="105" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#7d6b5a">generates tokens</text>
    <text x="456" y="118" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#a8957f">CSS vars + Tailwind</text>
  </g>

  <!-- Arrow 3 — splits into two paths -->
  <g class="svga3">
    <line x1="526" y1="90" x2="558" y2="90" stroke="#888" stroke-width="1.8" class="fl3"/>
    <!-- Fork up -->
    <line x1="558" y1="90" x2="558" y2="48" stroke="#888" stroke-width="1.4"/>
    <line x1="558" y1="48" x2="586" y2="48" stroke="#888" stroke-width="1.4"/>
    <polygon points="586,43 601,48 586,53" fill="#888"/>
    <!-- Fork down -->
    <line x1="558" y1="90" x2="558" y2="132" stroke="#888" stroke-width="1.4"/>
    <line x1="558" y1="132" x2="586" y2="132" stroke="#888" stroke-width="1.4"/>
    <polygon points="586,127 601,132 586,137" fill="#888"/>
  </g>

  <!-- Step 4a: Tailwind tokens (FAILED) -->
  <g class="svgb4 err">
    <rect x="601" y="15" width="152" height="66" rx="9" fill="rgba(192,57,43,0.07)" stroke="rgba(192,57,43,0.5)" stroke-width="1.8" stroke-dasharray="5 3"/>
    <text x="677" y="43" text-anchor="middle" font-family="Fraunces, serif" font-size="13" font-weight="600" fill="#c0392b">Tailwind Tokens</text>
    <text x="677" y="59" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#c0392b">@theme static values</text>
    <text x="677" y="73" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#c0392b">✗ runtime switch fails</text>
  </g>

  <!-- Step 4b: CSS vars (SUCCESS) -->
  <g class="svgb4">
    <rect x="601" y="99" width="152" height="66" rx="9" fill="rgba(26,122,110,0.07)" stroke="rgba(26,122,110,0.5)" stroke-width="1.8"/>
    <text x="677" y="128" text-anchor="middle" font-family="Fraunces, serif" font-size="13" font-weight="600" fill="#1a7a6e">CSS Custom Props</text>
    <text x="677" y="144" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#1a7a6e">--theme-* on :root</text>
    <text x="677" y="158" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#1a7a6e">✓ runtime switch works</text>
  </g>

  <!-- Arrow from CSS vars to ThemeContext -->
  <g class="svga5">
    <line x1="753" y1="132" x2="793" y2="132" stroke="#1a7a6e" stroke-width="1.8" class="fl4"/>
    <polygon points="793,127 808,132 793,137" fill="#1a7a6e"/>
  </g>

  <!-- Step 5: ThemeContext -->
  <g class="svgb5">
    <rect x="808" y="99" width="150" height="66" rx="9" fill="white" stroke="rgba(26,122,110,0.5)" stroke-width="1.8"/>
    <text x="883" y="128" text-anchor="middle" font-family="Fraunces, serif" font-size="13" font-weight="600" fill="#1c1510">ThemeContext</text>
    <text x="883" y="144" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#7d6b5a">applyThemeTokens()</text>
    <text x="883" y="158" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#1a7a6e">instant repaint</text>
  </g>

  <!-- X mark on Tailwind path -->
  <g class="svga4">
    <circle cx="775" cy="48" r="12" fill="rgba(192,57,43,0.15)" stroke="rgba(192,57,43,0.5)" stroke-width="1.5"/>
    <text x="775" y="53" text-anchor="middle" font-family="Bricolage Grotesque,sans-serif" font-size="14" fill="#c0392b" font-weight="700">✕</text>
  </g>

  <!-- Labels above/below -->
  <text x="70" y="22" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#a8957f">① design</text>
  <text x="263" y="22" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#a8957f">② export</text>
  <text x="456" y="22" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#a8957f">③ generate</text>
  <text x="677" y="8" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#c0392b">✕ first attempt</text>
  <text x="677" y="178" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#1a7a6e">✓ final approach</text>
  <text x="883" y="178" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#1a7a6e">⑤ runtime</text>
</svg>

<div class="a6" style="display:flex;gap:16px;margin-top:18px">
  <div class="card card-coral" style="flex:1;padding:14px 18px">
    <div class="label" style="color:var(--coral)">What we designed in Figma</div>
    <p style="margin:0;font-size:14px">Colour tokens across 5 themes · 4-step spacing scale · Typography size ramp · Single border-radius token</p>
  </div>
  <div class="card card-teal" style="flex:1;padding:14px 18px">
    <div class="label" style="color:var(--teal)">What we ended up with</div>
    <p style="margin:0;font-size:14px">CSS custom properties on <code>:root</code> · Tailwind utilities via <code>@theme inline</code> · ThemeContext for runtime switching</p>
  </div>
</div>

---

## Designing in Figma — The 4 Pillars

<div class="g2" style="gap:20px">

<div class="a1" style="display:flex;flex-direction:column;gap:16px">

  <div class="card card-coral" style="padding:18px 22px">
    <div class="label" style="color:var(--coral)">01 — Colour</div>
    <p style="margin:0 0 10px;font-size:14px">Each theme is a named set of semantic colour tokens, not raw hex values.</p>
    <!-- Mini colour swatches -->
    <div style="display:flex;gap:6px;flex-wrap:wrap">
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="width:32px;height:32px;border-radius:6px;background:#62748E;border:1px solid rgba(0,0,0,0.1)"></div>
        <span style="font-family:var(--mono);font-size:9px;color:var(--muted)">primary</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="width:32px;height:32px;border-radius:6px;background:#4A5568;border:1px solid rgba(0,0,0,0.1)"></div>
        <span style="font-family:var(--mono);font-size:9px;color:var(--muted)">alt</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="width:32px;height:32px;border-radius:6px;background:#F8F9FA;border:1px solid rgba(0,0,0,0.1)"></div>
        <span style="font-family:var(--mono);font-size:9px;color:var(--muted)">bg</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="width:32px;height:32px;border-radius:6px;background:#00A6F4;border:1px solid rgba(0,0,0,0.1)"></div>
        <span style="font-family:var(--mono);font-size:9px;color:var(--muted)">sky →</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="width:32px;height:32px;border-radius:6px;background:#E94560;border:1px solid rgba(0,0,0,0.1)"></div>
        <span style="font-family:var(--mono);font-size:9px;color:var(--muted)">rose →</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="width:32px;height:32px;border-radius:6px;background:#2E7D32;border:1px solid rgba(0,0,0,0.1)"></div>
        <span style="font-family:var(--mono);font-size:9px;color:var(--muted)">forest →</span>
      </div>
    </div>
  </div>

  <div class="card card-gold" style="padding:18px 22px">
    <div class="label" style="color:var(--gold)">02 — Spacing</div>
    <p style="margin:0 0 10px;font-size:14px">4-step scale derived from a base unit. Components reference the scale, not raw pixel values.</p>
    <div style="display:flex;align-items:flex-end;gap:10px">
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="width:8px;height:8px;background:var(--gold);border-radius:2px"></div>
        <span style="font-family:var(--mono);font-size:9px;color:var(--muted)">xs</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="width:12px;height:12px;background:var(--gold);border-radius:2px"></div>
        <span style="font-family:var(--mono);font-size:9px;color:var(--muted)">sm</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="width:20px;height:20px;background:var(--gold);border-radius:2px"></div>
        <span style="font-family:var(--mono);font-size:9px;color:var(--muted)">md</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="width:32px;height:32px;background:var(--gold);border-radius:2px"></div>
        <span style="font-family:var(--mono);font-size:9px;color:var(--muted)">lg</span>
      </div>
    </div>
  </div>

</div>

<div class="a2" style="display:flex;flex-direction:column;gap:16px">

  <div class="card card-teal" style="padding:18px 22px">
    <div class="label" style="color:var(--teal)">03 — Typography</div>
    <p style="margin:0 0 10px;font-size:14px">Size ramp mapped to semantic roles — not hardcoded <code>font-size: 14px</code> everywhere.</p>
    <div style="font-family:var(--mono);font-size:11px;color:var(--muted);line-height:2">
      <span style="font-size:22px;color:var(--text);font-family:var(--display);font-weight:600">Aa</span>
      <span style="margin-left:8px">heading</span><br>
      <span style="font-size:16px;color:var(--text)">Aa</span>
      <span style="margin-left:8px">body</span><br>
      <span style="font-size:12px;color:var(--text)">Aa</span>
      <span style="margin-left:8px">caption</span>
    </div>
  </div>

  <div class="card card-purple" style="padding:18px 22px">
    <div class="label" style="color:var(--purple)">04 — Roundness</div>
    <p style="margin:0 0 10px;font-size:14px">Single token controls the "personality" of the UI. Themes can opt for sharp corners or pill shapes.</p>
    <div style="display:flex;align-items:center;gap:16px">
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <div style="width:48px;height:32px;background:var(--purple);border-radius:2px;opacity:0.5"></div>
        <span style="font-family:var(--mono);font-size:9px;color:var(--muted)">sharp</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <div style="width:48px;height:32px;background:var(--purple);border-radius:8px;opacity:0.65"></div>
        <span style="font-family:var(--mono);font-size:9px;color:var(--muted)">default</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <div style="width:48px;height:32px;background:var(--purple);border-radius:16px;opacity:0.8"></div>
        <span style="font-family:var(--mono);font-size:9px;color:var(--muted)">soft</span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <div style="width:48px;height:32px;background:var(--purple);border-radius:100px"></div>
        <span style="font-family:var(--mono);font-size:9px;color:var(--muted)">pill</span>
      </div>
    </div>
  </div>

</div>

</div>

---

## Export to JSON — The Bridge File

<div class="g2" style="gap:28px;align-items:start">

<div class="a1">
<div class="label" style="margin-bottom:10px">Figma variables export (tokens.json)</div>

```json
{
  "color": {
    "primary":    { "value": "#62748E" },
    "altText":    { "value": "#4A5568" },
    "background": { "value": "#F8F9FA" },
    "highlight":  { "value": "#FFD166" }
  },
  "spacing": {
    "xs": { "value": "4px"  },
    "sm": { "value": "8px"  },
    "md": { "value": "16px" },
    "lg": { "value": "32px" }
  },
  "radius": {
    "default": { "value": "12px" },
    "sm":      { "value": "6px"  }
  }
}
```

</div>

<div class="a2" style="display:flex;flex-direction:column;gap:14px">

<div class="card card-coral">
  <div class="label" style="color:var(--coral)">Semantic, not literal</div>
  <p style="margin:0;font-size:14px">Tokens are named by <em>role</em> — <code>primary</code>, <code>background</code>, <code>highlight</code> — not by colour name like <code>slate-600</code>. This means a theme switch can swap the whole palette without touching any component code.</p>
</div>

<div class="card card-gold">
  <div class="label" style="color:var(--gold)">What Claude Code did with this</div>
  <p style="margin:0;font-size:14px">Read the JSON structure and generated both CSS custom properties and Tailwind token config. Two outputs from one source file.</p>
</div>

<div class="card" style="border-left:3px solid var(--muted)">
  <div class="label">One JSON per theme</div>
  <p style="margin:0;font-size:14px"><code>tokens-default.json</code>, <code>tokens-sky.json</code>, <code>tokens-rose.json</code>… Same keys, different values. The structure is the contract.</p>
</div>

</div>

</div>

---

## First Attempt — Tailwind Tokens

<p style="margin-bottom:16px">Looked clean on paper. Broke at runtime.</p>

<!-- Tailwind failure diagram -->
<svg viewBox="0 0 1060 210" style="width:100%;height:auto">

  <!-- Column 1: Tailwind config -->
  <g class="svgb1">
    <rect x="0" y="0" width="230" height="110" rx="9" fill="rgba(192,57,43,0.05)" stroke="rgba(192,57,43,0.35)" stroke-width="1.8"/>
    <text x="115" y="22" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="600" fill="#c0392b">@theme (no inline)</text>
    <text x="115" y="42" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#7d6b5a">--color-primary: #62748E;</text>
    <text x="115" y="58" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#7d6b5a">--color-bg: #F8F9FA;</text>
    <text x="12" y="82" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">Tailwind generates at build time:</text>
    <text x="12" y="100" font-family="JetBrains Mono,monospace" font-size="10.5" fill="#c0392b">.bg-primary &#123; background: #62748E &#125;</text>
  </g>

  <!-- Arrow: build time → baked in -->
  <g class="svga1">
    <line x1="230" y1="55" x2="270" y2="55" stroke="#888" stroke-width="1.5" class="fl"/>
    <polygon points="270,50 285,55 270,60" fill="#888"/>
    <text x="254" y="48" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#a8957f">build</text>
  </g>

  <!-- Column 2: Generated CSS (baked) -->
  <g class="svgb2">
    <rect x="285" y="0" width="240" height="110" rx="9" fill="white" stroke="rgba(0,0,0,0.15)" stroke-width="1.5"/>
    <text x="405" y="22" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="600" fill="#1c1510">Generated CSS</text>
    <text x="405" y="44" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10.5" fill="#1c1510">.bg-primary &#123;</text>
    <text x="405" y="60" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10.5" fill="#c0392b">  background: <tspan font-weight="600">#62748E</tspan>;</text>
    <text x="405" y="76" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10.5" fill="#1c1510">&#125;</text>
    <rect x="295" y="84" width="220" height="18" rx="4" fill="rgba(192,57,43,0.1)"/>
    <text x="405" y="97" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10.5" fill="#c0392b">value is HARDCODED at build time</text>
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
    <text x="860" y="146" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="600" fill="#5e2ca5">ThemeContext</text>
    <text x="860" y="163" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#7d6b5a">style.setProperty(</text>
    <text x="860" y="178" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#5e2ca5">'--color-primary', '#00A6F4')</text>
  </g>

  <!-- Big X / NO EFFECT -->
  <g class="svgb4 err">
    <circle cx="530" cy="85" r="38" fill="rgba(192,57,43,0.08)" stroke="rgba(192,57,43,0.5)" stroke-width="2"/>
    <text x="530" y="78" text-anchor="middle" font-family="Fraunces,serif" font-size="14" font-weight="800" fill="#c0392b">NO</text>
    <text x="530" y="96" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#c0392b">EFFECT</text>
  </g>

  <!-- Explanation text bottom -->
  <text x="530" y="194" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="12" fill="#7d6b5a">The utility class already has the literal colour value baked in — changing the CSS variable has nothing to overwrite.</text>

</svg>

<div class="card card-red a6" style="margin-top:16px;padding:14px 20px">
  <p style="margin:0;font-size:14px"><strong style="color:var(--red)">Root cause:</strong> <code>@theme</code> without <code>inline</code> resolves token values at build time. The generated utility contains a literal hex string — <code>#62748E</code> — not a variable reference. Overwriting the variable at runtime has nothing to cascade into.</p>
</div>

---

## Why Tailwind Alone Couldn't Do Runtime Theming

<p style="margin-bottom:16px">A closer look at what Tailwind generates in each mode</p>

<svg viewBox="0 0 1060 220" style="width:100%;height:auto">

  <!-- LEFT SIDE: @theme static (broken) -->
  <g class="svgb1">
    <rect x="0" y="0" width="480" height="205" rx="10" fill="rgba(192,57,43,0.04)" stroke="rgba(192,57,43,0.3)" stroke-width="1.8"/>
    <rect x="0" y="0" width="480" height="32" rx="10" fill="rgba(192,57,43,0.1)"/>
    <rect x="0" y="22" width="480" height="10" fill="rgba(192,57,43,0.1)"/>
    <text x="240" y="22" text-anchor="middle" font-family="Fraunces,serif" font-size="14" font-weight="600" fill="#c0392b">@theme  (static — broken for runtime)</text>

    <text x="16" y="52" font-family="JetBrains Mono,monospace" font-size="11" fill="#c0392b">@theme &#123;</text>
    <text x="16" y="68" font-family="JetBrains Mono,monospace" font-size="11" fill="#7d6b5a">  --color-primary: <tspan fill="#c0392b">#62748E</tspan>;</text>
    <text x="16" y="84" font-family="JetBrains Mono,monospace" font-size="11" fill="#1c1510">&#125;</text>

    <line x1="16" y1="100" x2="464" y2="100" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>
    <text x="240" y="118" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">Tailwind generates →</text>

    <text x="16" y="140" font-family="JetBrains Mono,monospace" font-size="11" fill="#1c1510">.bg-primary &#123;</text>
    <text x="16" y="156" font-family="JetBrains Mono,monospace" font-size="11" fill="#7d6b5a">  background-color: </text>
    <tspan font-family="JetBrains Mono,monospace" font-size="11" fill="#c0392b" font-weight="600">#62748E</tspan>
    <text x="16" y="172" font-family="JetBrains Mono,monospace" font-size="11" fill="#1c1510">&#125;</text>

    <rect x="10" y="182" width="460" height="16" rx="4" fill="rgba(192,57,43,0.1)"/>
    <text x="240" y="194" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10.5" fill="#c0392b">literal value — ThemeContext can't touch it</text>
  </g>

  <!-- Divider + VS -->
  <g class="svgb3">
    <line x1="530" y1="10" x2="530" y2="200" stroke="rgba(0,0,0,0.1)" stroke-width="1.5" stroke-dasharray="5 4"/>
    <circle cx="530" cy="105" r="18" fill="var(--bg)" stroke="rgba(0,0,0,0.15)" stroke-width="1.5"/>
    <text x="530" y="110" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="800" fill="#7d6b5a">vs</text>
  </g>

  <!-- RIGHT SIDE: @theme inline (working) -->
  <g class="svgb2">
    <rect x="580" y="0" width="480" height="205" rx="10" fill="rgba(26,122,110,0.04)" stroke="rgba(26,122,110,0.3)" stroke-width="1.8"/>
    <rect x="580" y="0" width="480" height="32" rx="10" fill="rgba(26,122,110,0.1)"/>
    <rect x="580" y="22" width="480" height="10" fill="rgba(26,122,110,0.1)"/>
    <text x="820" y="22" text-anchor="middle" font-family="Fraunces,serif" font-size="14" font-weight="600" fill="#1a7a6e">@theme inline  (working)</text>

    <text x="596" y="52" font-family="JetBrains Mono,monospace" font-size="11" fill="#1a7a6e">@theme inline &#123;</text>
    <text x="596" y="68" font-family="JetBrains Mono,monospace" font-size="11" fill="#7d6b5a">  --color-primary: </text>
    <tspan font-family="JetBrains Mono,monospace" font-size="11" fill="#1a7a6e">var(--theme-primary)</tspan>
    <text x="596" y="84" font-family="JetBrains Mono,monospace" font-size="11" fill="#1c1510">&#125;</text>

    <line x1="596" y1="100" x2="1044" y2="100" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>
    <text x="820" y="118" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="11" fill="#7d6b5a">Tailwind generates →</text>

    <text x="596" y="140" font-family="JetBrains Mono,monospace" font-size="11" fill="#1c1510">.bg-theme-primary &#123;</text>
    <text x="596" y="156" font-family="JetBrains Mono,monospace" font-size="11" fill="#7d6b5a">  background-color: </text>
    <tspan font-family="JetBrains Mono,monospace" font-size="11" fill="#1a7a6e" font-weight="600">var(--theme-primary)</tspan>
    <text x="596" y="172" font-family="JetBrains Mono,monospace" font-size="11" fill="#1c1510">&#125;</text>

    <rect x="590" y="182" width="460" height="16" rx="4" fill="rgba(26,122,110,0.1)"/>
    <text x="820" y="194" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10.5" fill="#1a7a6e">var reference preserved — ThemeContext can overwrite it ✓</text>
  </g>

</svg>

<div class="card a6" style="margin-top:12px;padding:12px 18px;border-left:3px solid var(--teal)">
  <p style="margin:0;font-size:13px">The fix is <code>@theme inline</code> + a separate <code>:root &#123; --theme-primary: … &#125;</code> block. Tailwind utilities reference the CSS var — ThemeContext overwrites the var — the cascade propagates everywhere, instantly.</p>
</div>

---

## `globals.css` — The Token Declaration

<div class="g2" style="gap:24px;align-items:start">

<div class="a1">
<div class="label" style="margin-bottom:10px">Structure of globals.css</div>

```css
/* 1. Default theme values — runtime-switchable */
:root {
  --theme-primary:    #62748E;
  --theme-alt-text:   #4A5568;
  --theme-background: #F8F9FA;
  --theme-highlight:  #FFD166;
  --theme-radius:     12px;
  --theme-space-sm:   8px;
  --theme-space-md:   16px;
}

/* 2. Bridge to Tailwind utilities */
@theme inline {
  --color-theme-primary:    var(--theme-primary);
  --color-theme-alt-text:   var(--theme-alt-text);
  --color-theme-background: var(--theme-background);
  --color-theme-highlight:  var(--theme-highlight);
  --radius-theme:           var(--theme-radius);
  --spacing-theme-sm:       var(--theme-space-sm);
  --spacing-theme-md:       var(--theme-space-md);
}

/* 3. Font driven by locale, not theme */
[data-locale="hi"] {
  font-family: var(--font-noto-devanagari),
               var(--font-noto-sans), Arial;
}
```

</div>

<div class="a2" style="display:flex;flex-direction:column;gap:14px">

<div class="card card-coral">
  <div class="label" style="color:var(--coral)">Block ① — :root vars</div>
  <p style="margin:0;font-size:14px">These are the actual runtime values. ThemeContext's <code>applyThemeTokens()</code> overwrites these. This is the only place that needs to change when a theme switches.</p>
</div>

<div class="card card-teal">
  <div class="label" style="color:var(--teal)">Block ② — @theme inline</div>
  <p style="margin:0;font-size:14px">Maps the runtime vars to Tailwind's naming convention. The <code>inline</code> keyword is what makes it work — it preserves the <code>var()</code> reference instead of resolving the value.</p>
</div>

<div class="card" style="border-left:3px solid var(--muted)">
  <div class="label">Result in components</div>
  <p style="margin:0;font-size:13px">Write <code>bg-theme-primary</code> in JSX. At runtime, that resolves to <code>var(--theme-primary)</code>. When the theme switches, the browser repaints with zero JS involvement.</p>
</div>

</div>

</div>

---

## ThemeContext — The Runtime Switcher

<div class="g2" style="gap:28px;align-items:start">

<div class="a1">

```ts
// contexts/ThemeContext.tsx (simplified)

const THEME_TOKENS = {
  default: {
    '--theme-primary':    '#62748E',
    '--theme-background': '#F8F9FA',
    '--theme-highlight':  '#FFD166',
    '--theme-radius':     '12px',
  },
  sky: {
    '--theme-primary':    '#00A6F4',
    '--theme-background': '#EFF9FF',
    '--theme-highlight':  '#FFD166',
    '--theme-radius':     '12px',
  },
  // … rose, forest, sunset …
};

function applyThemeTokens(tokens) {
  const root = document.documentElement;
  Object.entries(tokens).forEach(
    ([key, value]) => root.style.setProperty(key, value)
  );
}
```

</div>

<div class="a2" style="display:flex;flex-direction:column;gap:14px">

<div class="card card-coral">
  <div class="label" style="color:var(--coral)">THEME_TOKENS</div>
  <p style="margin:0;font-size:14px">A plain object of objects. Each key is a CSS custom property name. Each value is the colour/size for that theme. No magic — just a lookup table.</p>
</div>

<div class="card card-teal">
  <div class="label" style="color:var(--teal)">applyThemeTokens</div>
  <p style="margin:0;font-size:14px">Loops through the token object and calls <code>style.setProperty()</code> on <code>document.documentElement</code> (the <code>:root</code>). One pass, all tokens updated.</p>
</div>

<div class="card card-purple">
  <div class="label" style="color:var(--purple)">No re-render</div>
  <p style="margin:0;font-size:14px">React doesn't know the theme changed. The CSS cascade handles it. Every <code>bg-theme-primary</code> in the app resolves to the new value on the next paint — immediately.</p>
</div>

</div>

</div>

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

  <!-- Arrow 1 -->
  <g class="svga1">
    <line x1="140" y1="115" x2="178" y2="115" stroke="#5e2ca5" stroke-width="1.8" class="fl"/>
    <polygon points="178,110 193,115 178,120" fill="#5e2ca5"/>
  </g>

  <!-- Step 2: ThemeContext.setTheme -->
  <g class="svgb2">
    <rect x="193" y="65" width="180" height="100" rx="9" fill="rgba(94,44,165,0.07)" stroke="rgba(94,44,165,0.4)" stroke-width="1.8"/>
    <text x="283" y="95" text-anchor="middle" font-family="Fraunces,serif" font-size="13" font-weight="600" fill="#5e2ca5">ThemeContext</text>
    <text x="283" y="112" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#7d6b5a">setTheme('sky',</text>
    <text x="283" y="127" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#7d6b5a">THEME_TOKENS.sky)</text>
    <text x="283" y="146" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9" fill="#5e2ca5">applyThemeTokens()</text>
  </g>

  <!-- Arrow 2 -->
  <g class="svga2">
    <line x1="373" y1="115" x2="411" y2="115" stroke="#5e2ca5" stroke-width="1.8" class="fl2"/>
    <polygon points="411,110 426,115 411,120" fill="#5e2ca5"/>
  </g>

  <!-- Step 3: document.documentElement -->
  <g class="svgb3">
    <rect x="426" y="55" width="200" height="120" rx="9" fill="rgba(201,75,42,0.06)" stroke="rgba(201,75,42,0.4)" stroke-width="1.8"/>
    <text x="526" y="80" text-anchor="middle" font-family="Fraunces,serif" font-size="12" font-weight="600" fill="#c94b2a">:root (document)</text>
    <line x1="436" y1="90" x2="616" y2="90" stroke="rgba(201,75,42,0.2)" stroke-width="1"/>
    <text x="526" y="106" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#c94b2a">--theme-primary: #00A6F4</text>
    <text x="526" y="121" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#c94b2a">--theme-background: #EFF9FF</text>
    <text x="526" y="136" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#c94b2a">--theme-radius: 12px</text>
    <text x="526" y="154" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9" fill="#a8957f">… all tokens updated</text>
  </g>

  <!-- Arrow 3 -->
  <g class="svga3">
    <line x1="626" y1="115" x2="664" y2="115" stroke="#1a7a6e" stroke-width="1.8" class="fl3"/>
    <polygon points="664,110 679,115 664,120" fill="#1a7a6e"/>
  </g>

  <!-- Step 4: CSS cascade -->
  <g class="svgb4">
    <rect x="679" y="65" width="188" height="100" rx="9" fill="rgba(26,122,110,0.07)" stroke="rgba(26,122,110,0.4)" stroke-width="1.8"/>
    <text x="773" y="90" text-anchor="middle" font-family="Fraunces,serif" font-size="12" font-weight="600" fill="#1a7a6e">CSS Cascade</text>
    <line x1="689" y1="98" x2="857" y2="98" stroke="rgba(26,122,110,0.2)" stroke-width="1"/>
    <text x="773" y="114" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#1a7a6e">.bg-theme-primary &#123;</text>
    <text x="773" y="129" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#7d6b5a">  background:</text>
    <text x="773" y="144" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#1a7a6e">  var(--theme-primary)</text>
    <text x="773" y="157" font-family="JetBrains Mono,monospace" font-size="9.5" fill="#7d6b5a">&#125;</text>
  </g>

  <!-- Arrow 4 -->
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

  <!-- Timing label -->
  <line x1="0" y1="195" x2="1060" y2="195" stroke="rgba(0,0,0,0.08)" stroke-width="1"/>
  <text x="70"  y="212" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#a8957f">① tap</text>
  <text x="283" y="212" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#a8957f">② JS call</text>
  <text x="526" y="212" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#a8957f">③ var rewrite</text>
  <text x="773" y="212" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#a8957f">④ cascade</text>
  <text x="990" y="212" text-anchor="middle" font-family="Plus Jakarta Sans,sans-serif" font-size="10" fill="#1a7a6e">⑤ done</text>

</svg>

<div class="card a6" style="margin-top:10px;padding:12px 18px;border-left:3px solid var(--teal);display:flex;align-items:center;gap:12px">
  <span style="font-size:18px">⚡</span>
  <p style="margin:0;font-size:13px">Steps ③–⑤ happen in a single browser paint cycle. From the user's perspective it is truly instant — there is no animation, no transition, no loading state needed.</p>
</div>

---

## Adding a New Theme

<div class="g2" style="gap:28px;align-items:start">

<div class="a1">

```ts
// Add to THEME_TOKENS in ThemeContext.tsx
const THEME_TOKENS = {
  // … existing themes …
  forest: {
    '--theme-primary':    '#2E7D32',
    '--theme-alt-text':   '#1B5E20',
    '--theme-background': '#F1F8E9',
    '--theme-highlight':  '#AED581',
    '--theme-radius':     '12px',
    '--theme-space-sm':   '8px',
    '--theme-space-md':   '16px',
  },
};
```

</div>

<div class="a2" style="display:flex;flex-direction:column;gap:14px">

<div class="card card-teal">
  <div class="label" style="color:var(--teal)">That's it</div>
  <p style="margin:0;font-size:14px">No new CSS. No new Tailwind config. No rebuilding the app. The theme is a data object — same keys as every other theme, different values. Add a button in <code>DevTestPanel</code> and it works.</p>
</div>

<div class="card card-gold">
  <div class="label" style="color:var(--gold)">Why this scales</div>
  <p style="margin:0;font-size:14px">Because every component uses semantic token names — <code>bg-theme-primary</code>, not <code>bg-slate-600</code>. The components are theme-agnostic. The tokens do all the work.</p>
</div>

<div class="card" style="border-left:3px solid var(--muted)">
  <div class="label">Per student profile</div>
  <p style="margin:0;font-size:13px">Each student in Mo Speech can have their own theme. The theme ID is stored on their profile in Convex. When their profile loads, <code>setTheme()</code> is called once — and the whole UI reflects their preferences.</p>
</div>

</div>

</div>
