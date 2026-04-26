# Mo Speech — Design System: From Figma to Runtime
## YouTube Video Script — Revised

**Estimated runtime:** ~13–14 minutes  
**Format:** Screen recording — slides + Figma + live localhost + code  
**Audience:** Developers and designers interested in design tokens, Tailwind CSS 4, and runtime theming

---

> **Before you record — have these open:**
> - `design-system-slides.html` fullscreen in browser (advance with arrow keys / spacebar)
> - Figma — Mo Speech design file, Variables panel visible
> - `localhost:3000` running, DevTestPanel accessible
> - VS Code — `app/globals.css` and `app/contexts/ThemeContext.tsx` open in tabs
>
> **Marker key:**
> - `[→]` advance slide · `[PAUSE]` breath beat · `[~Xs]` approx speaking time
> - ### 🎨 FIGMA — switch to Figma
> - ### 💻 CODE — switch to VS Code at that file and line
> - ### 🌐 LIVE — switch to localhost
> - ### ← SLIDES — switch back to slide deck

---

## INTRO (before title slide)

[~25s]

Hey — this video is about the design system behind Mo Speech, and specifically the journey from designing it in Figma all the way to getting it working in code at runtime.

It's not a straightforward path. I hit a wall with Tailwind that I didn't expect, and the reason why is actually a really useful thing to understand about how Tailwind CSS 4 works under the hood.

So let's go through the whole thing — design, export, the first attempt, the failure, the fix, and how it all works now.

[→ advance to title slide]

---

## SLIDE 1 — Title

[~20s]

The design system covers six themes, four design pillars — colour, spacing, typography, and roundness — and it switches between themes at runtime, instantly, without reloading the page.

Getting to that point took a few tries. Here's how it happened.

[→]

---

## SLIDE 2 — The Full Journey

[~65s]

Here's the whole story in one diagram. Let it animate through and then I'll walk you back through each step.

So — it starts in Figma, where I designed the variables. Those got exported to a JSON file — one file per theme. I then gave those JSON files to Claude Code and asked it to generate both CSS custom properties and Tailwind token config from the same source.

Now here's where the path forks. You can see the diagram splits into two branches.

The top branch — the one marked with an X — was the first attempt. Tailwind tokens defined as static values. It looked great on paper. It did not work at runtime.

The bottom branch — the one that flows cleanly through to ThemeContext — is what we actually ended up with. CSS custom properties as the source of truth, with a thin bridge to Tailwind utilities, and a context object that handles the runtime switching.

[PAUSE]

I'll explain exactly why the first branch failed in a few slides. It's a specific behaviour of Tailwind CSS 4 that isn't obvious until you hit it.

[→]

---

## SLIDE 3 — Designing in Figma — What's in the Variables Panel

[~75s]

So the design work started in Figma's Variables panel. Let me show you what that looks like.

### 🎨 FIGMA — Variables panel · Colour section · Default theme column selected

You can see the 15 colour tokens here. None of these are hex values at this stage — they're semantic names. **Primary**, **Banner**, **Card**, **Button-highlight**, **Alt-Card**, **Line**, **Symbol-BG**, **Background** — and then fixed tokens like **Success**, **Warning**, and **Enter-Mode** that stay the same across every theme.

The naming is the whole point. These names describe *what the thing is* in the UI — not what colour it happens to be. That's what makes theme switching possible.

### 🎨 FIGMA — scroll right to show all 6 theme columns (Default · Sky · Amber · Lime · Fuchsia · Rose)

Six themes. Same 15 token names in every column. Different values in each. The Sky column has a blue Primary, Amber has a deep orange, Lime has a green. But they all have a Primary, a Banner, a Card — the structure is the contract.

### 🎨 FIGMA — scroll down to Spacing section

Then spacing. Twelve named tokens — **General-padding**, **Modal-padding**, **Symbol-card-padding** and so on. Same idea — semantic names, not raw pixel values.

### 🎨 FIGMA — scroll down to Roundness section

And two roundness tokens: **Roundness** and **Modal-Roundness**. One token controls the personality of every button, card, and input in the entire app.

### ← SLIDES

[→]

---

## SLIDE 4 — From Figma to CSS — The Naming Bridge

[~55s]

So the table on this slide shows exactly how the names travel from Figma through to the CSS.

When you export variables from Figma, you get a JSON file — one per theme — and the keys in that JSON are identical to the variable names you defined. **Primary** in Figma becomes the `Primary` key in the JSON. **Secondary-Alt-Text** stays **Secondary-Alt-Text**.

### 💻 CODE — docs/3-design/design-system/Themes/Default.tokens.json · top of file · "Primary" key

You can see here — the key is exactly what I named it in Figma, and the value is the hex colour plus all the Figma metadata.

### 💻 CODE — docs/3-design/design-system/Themes/Sky.tokens.json · same "Primary" key, different hex

Same key name, different value. That's the whole schema contract.

### ← SLIDES

Then Claude Code read those JSON files and generated the CSS variables. The transformation is simple: lowercase, replace spaces and capitals with kebab-case, add a `--theme-` prefix. So **Button-highlight** becomes `--theme-button-highlight`. **General-padding** becomes `--theme-general-padding`. That naming convention stays consistent all the way through the codebase.

[PAUSE]

And that's the bridge. Figma names are human-readable and semantic. CSS custom properties use the same words, just formatted for code.

[→]

---

## SLIDE 5 — First Attempt — Tailwind Tokens

[~60s]

Now here's where it got interesting. Claude Code generated a Tailwind token config alongside the CSS variables. The idea was: define the tokens in Tailwind's `@theme` block, let Tailwind generate the utility classes at build time — things like `bg-theme-primary`, `text-theme-alt-text` — and then when a user switches theme, ThemeContext would overwrite the underlying CSS variables and everything would update.

Except it didn't. Watch the diagram — particularly the circle in the middle that says "NO EFFECT."

ThemeContext was calling `setProperty` on the root element. It was changing the variable. But nothing in the UI was changing.

The new value was being written to the DOM. It just wasn't connected to anything visible.

[PAUSE]

And that took a while to figure out. Let me show you exactly why.

[→]

---

## SLIDE 6 — Why @theme inline Fixes It

[~80s]

This slide shows the root cause. Look at both columns.

On the left — `@theme` without the `inline` keyword. You define your token pointing to a static hex value. Tailwind reads that at build time and generates a utility class. But the critical thing: Tailwind *resolves* the value at build time. It writes the literal hex string directly into the generated CSS. Not a reference — the actual colour.

So when ThemeContext later calls `setProperty`, there's nothing to cascade into. The utility class doesn't know the variable exists. It has the colour baked in.

[PAUSE]

On the right — `@theme inline`. Now you define the token pointing to a `var()` reference. Because of the `inline` keyword, Tailwind preserves that reference in the generated output. The utility class contains `var(--theme-primary)` — not the resolved colour.

Now when ThemeContext calls `setProperty`, the utility *does* cascade. The browser resolves the var at paint time, finds the new value, and repaints.

[PAUSE]

The `inline` keyword is the fix. Without it, Tailwind treats your tokens as build-time constants. With it, they become runtime-switchable.

### 💻 CODE — app/globals.css:140 · @theme inline block · scroll up briefly to :root at line 41 for context

You can see it here — the `@theme inline` block maps every `--theme-*` variable to a Tailwind utility name using `var()` references throughout. This is the bridge that makes runtime switching possible.

### ← SLIDES

[→]

---

## SLIDE 7 — globals.css — Three Blocks

[~65s]

So `globals.css` has three distinct sections, each doing a completely separate job.

**Block one** — the `:root` declaration.

### 💻 CODE — app/globals.css:41 · :root block · scroll slowly through the --theme-* variables

This is where the actual runtime values live. Every `--theme-*` variable is defined here with the Default theme as the starting value. This is the only block ThemeContext needs to touch when a theme switches — it just overwrites these.

**Block two** — `@theme inline`.

### 💻 CODE — app/globals.css:140 · @theme inline block

This is the bridge to Tailwind. Each entry maps a Tailwind colour name to one of our runtime vars. You write `bg-theme-primary` in your JSX. Tailwind generates a utility with `var(--theme-primary)` inside it. ThemeContext changes `--theme-primary`. The browser repaints.

**Block three** — `[data-locale]`.

### 💻 CODE — app/globals.css:254 · [data-locale] font rules

This is completely separate from theming — it's driven by locale, not by the theme system. When the layout sets `data-locale="hi"`, the Devanagari font-family kicks in. Theme has no effect on fonts.

### ← SLIDES

[→]

---

## SLIDE 8 — ThemeContext — The Runtime Switcher

[~65s]

ThemeContext has three parts: the token catalogue, the function that applies them, and the React context that makes it available app-wide.

**THEME_TOKENS** is the catalogue. Six objects — one per theme — each containing all 15 colour values. Spacing and roundness are optional overrides; flat themes inherit the defaults from `globals.css`.

### 💻 CODE — app/contexts/ThemeContext.tsx:107 · THEME_TOKENS object · scroll through default and sky entries

You can see here — default, sky, amber, lime, fuchsia, rose. Same keys, different values.

**applyThemeTokens** is the function that does the switching.

### 💻 CODE — app/contexts/ThemeContext.tsx:174 · applyThemeTokens function

It loops through the TOKEN_TO_CSS map and calls `style.setProperty` on `document.documentElement` — which is the `:root` element. One pass, all tokens updated simultaneously.

[PAUSE]

The fact that this works without triggering a React re-render is worth dwelling on. React has no idea anything changed. The CSS cascade handles all of it. The browser sees that the custom property values changed and repaints the affected elements in the next frame. It's genuinely instant.

### 🌐 LIVE — localhost:3000 · open DevTestPanel · switch Default → Sky → Amber → Fuchsia · go slowly

Watch this. Tap Sky. Tap Amber. Tap Fuchsia. Every colour, every component, every shadow — updated in a single frame. No reload, no flash, no delay.

### ← SLIDES

[→]

---

## SLIDE 9 — Token Flow — From Switch to Screen

[~65s]

Let me walk you through the full sequence once more with the diagram.

The user taps "Sky" in the DevTestPanel.

The panel calls `setTheme` on the ThemeContext, passing the sky token set.

ThemeContext calls `applyThemeTokens`. That function loops through the object and calls `setProperty` for each key — `--theme-primary` gets `#00A6F4`, `--theme-banner` gets `#0084D1`, `--theme-card` gets `#024A70`, and so on for all 15 colour tokens.

Those property writes update `:root`. The CSS cascade immediately picks them up.

Every utility class that references one of those vars — `bg-theme-primary`, `text-theme-alt-text` — now resolves to the new value. The browser repaints.

[PAUSE]

Look at the timing strip at the bottom. Steps three, four, and five — the property write, the cascade, and the repaint — happen in a single browser paint cycle. From the user's perspective, it's instantaneous.

[→]

---

## SLIDE 10 — Adding a New Theme

[~50s]

Here's the payoff of the whole architecture. Adding a new theme is adding one object to `THEME_TOKENS`.

Same 15 colour keys as every other theme. Different values. That's it.

### 💻 CODE — app/contexts/ThemeContext.tsx:107 · end of THEME_TOKENS · show where a new entry goes

You'd add a new slug here — let's say `ocean` — fill in all 15 colour tokens, and that's the data side done.

### 💻 CODE — app/contexts/ThemeContext.tsx:174 · applyThemeTokens · show it's completely generic

`applyThemeTokens` is completely generic — it takes whatever object you give it and writes those vars to the root. It doesn't know about specific theme names.

### ← SLIDES

No new CSS file. No Tailwind config change. No rebuild required. Add a button in DevTestPanel, hot reload, and it works.

[PAUSE]

And the reason this scales is that every component in the app is theme-agnostic. They use `bg-theme-primary`, not `bg-slate-600`. They describe what role the colour plays, not what colour it is.

In Mo Speech, every student profile has its own theme slug stored in Convex. When the profile loads, `setTheme()` is called once, and the entire UI reflects their preferences.

---

## OUTRO

[~35s]

So the short version: design in Figma with 15 semantic colour tokens across 6 themes. Export to JSON — one file per theme, same keys in each. Use CSS custom properties as your runtime source of truth. Bridge to Tailwind with `@theme inline` so the utilities reference the variables instead of baking in the values. And use a ThemeContext to rewrite the variables whenever the theme changes.

The `inline` keyword is the thing that ties it all together — without it, Tailwind resolves your tokens at build time and runtime switching becomes impossible.

Thanks for watching. If you build something with this pattern, let me know in the comments. See you in the next one.

---

## Quick reference

| Slide | Topic | Time |
|---|---|---|
| 1 | Title | 0:00 |
| 2 | The full journey | 0:45 |
| 3 | Designing in Figma | 1:50 |
| 4 | Naming bridge — Figma → JSON → CSS | 3:05 |
| 5 | First attempt — Tailwind tokens | 4:00 |
| 6 | Why @theme inline fixes it | 5:00 |
| 7 | globals.css — three blocks | 6:20 |
| 8 | ThemeContext — the runtime switcher | 7:25 |
| 9 | Token flow — switch to screen | 8:30 |
| 10 | Adding a new theme | 9:35 |
| Outro | Recap | 10:25 |

**Total: ~11 min**

---

## Screen switches at a glance

| Slide | 🎨 Figma | 💻 Code | 🌐 Live |
|---|---|---|---|
| 3 | Colour tokens · All 6 themes · Spacing · Roundness | — | — |
| 4 | — | Default.tokens.json · Sky.tokens.json | — |
| 6 | — | globals.css:140 | — |
| 7 | — | globals.css:41 → :140 → :254 | — |
| 8 | — | ThemeContext.tsx:107 → :174 | DevTestPanel theme switching |
| 10 | — | ThemeContext.tsx:107 → :174 | — |
