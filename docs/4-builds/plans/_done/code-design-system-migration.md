# Code Design-System Migration — bring the app up to the Figma "Finals" file

> **Self-contained plan for a fresh session.** All facts needed for a cold start are embedded.
> This is the **code** sequel to `docs/4-builds/figma-design-system-buildout.md` (the Figma file
> is now final). **Target = the app codebase**; the Figma file is the visual source of truth.

## Context
The Figma file **"Mo Speech — Finals"** (`fileKey 3DAZYuK3A1TrkeZnyGwE1o`) is the finalised, owner-approved
source of truth for **UI polish / visual design**. The **codebase owns the real copy and layout**. This
effort ports the Figma visual system into the app at `/Users/mohanveraitch/Projects/mo-speech-home`
(Next.js 16 / React 19 / Tailwind 4 / Convex) so the live app matches the designs.

**Owner decisions (locked):**
- **Full Figma parity** — Amber/Fuchsia/Lime flip to genuinely *light* (cream/white bg, dark text, white
  surfaces); Default/Sky/Rose stay dark. Re-derive every theme's full colour set from Figma values.
- **Staged rollout** — owner reviews each stage.
- **Settings** — adopt Figma's tabbed-page + section-card layout (a real rewrite; Stage 2.5).

## Setup each session
- **Re-auth the Figma connector** (`plugin:figma:figma` MCP) if Stage 0 extraction is needed: run `whoami`;
  if it errors, open the OAuth URL and paste the `localhost/callback` URL back as text.
- **Dev server is already running on port 3001** — do NOT start another (`npm run dev` is live for the worktree).
- Work on `main` (don't auto-branch unless asked).

## Theme architecture (how theming flows — don't fight it)
`convex/data/themes/types.ts` (`ThemeTokens` type) → `app/contexts/ThemeContext.tsx` (`TOKEN_TO_CSS` map +
`applyThemeTokens()`: `root.style.setProperty('--theme-x', v)`, px-suffixes numbers unless in `UNITLESS_TOKENS`,
and `removeProperty` when a theme omits a token → falls back to `globals.css` `:root`) → `app/globals.css`
(`:root` defaults + `@theme inline` block mapping `--theme-*` to Tailwind utilities). 6 builtin theme JSONs in
`convex/data/themes/*.json` + premium `midnight_glass.json`. Profiles store `themeSlug`; `app/contexts/ProfileContext.tsx`
resolves via `lib/themes/registry.ts`. **Adding a token = edit 3 places** (type + `TOKEN_TO_CSS` + `globals.css`);
no change to `applyThemeTokens` (numbers auto-px, strings pass through).

**Current divergence to fix:** all 6 themes currently sit on dark `background:#18181B` and only override accent
tokens; the light themes are not actually light yet. `card` is currently the *solid* main surface; Figma inverts
this (`Surface` = solid raised, `Card` = translucent overlay).

---

## Stage 0 — Extract authoritative Figma values (read-only)
Owner manually tuned Figma — pull values fresh, don't rely on memory. Via Figma MCP, dump the **Full Build**
collection: every variable resolved per mode (Default/Sky/Rose/Fuchsia/Amber/Lime) for all colour tokens +
roundness vars, and the 3 `Elevation/*` effect styles. Build a Figma-token → value×6-modes table = the data source.

## Stage 1 — Token foundation
**New `ThemeTokens` fields** (`types.ts`): `pillBg: string`; optional `buttonRoundness?/cardRoundness?/packCardRoundness?/modalRoundness?/chipRoundness?` (px numbers); optional `elevationSubtle?/elevationSurface?/elevationModal?` (box-shadow strings). `surface?` already exists — **it is now the solid raised surface for every theme** (not glass-only); update its doc.

**`TOKEN_TO_CSS`** (`ThemeContext.tsx`): add `--theme-pill-bg`, `--theme-button-roundness`, `--theme-card-roundness`, `--theme-pack-card-roundness`, `--theme-modal-roundness`, `--theme-chip-roundness`, `--theme-elevation-subtle/-surface/-modal`.

**`globals.css`**: `:root` defaults for all new vars (roundness 8/16/20/16/999; 3 elevation shadow strings from Figma; `--theme-pill-bg` light default; constants `--theme-button-primary:#FAFAFA`, `--theme-button-secondary:<zinc>`); keep `--theme-surface: var(--theme-card)` only as fallback; **repoint bridge alias `--theme-bg-surface` → `--theme-surface`**. In `@theme inline` (additive — don't touch existing `--radius-theme`/`-sm`): add `--radius-theme-button/-card/-pack/-modal/-chip`, `--color-theme-pill-bg`, `--color-theme-surface`. Elevation → semantic utility classes `.elevation-subtle/-surface/-modal { box-shadow: var(--theme-elevation-*) }` (matches the file's `.glass-*`/`.symbol-card` convention).

**Figma → code token mapping (key rows):**
| Figma | code field | CSS var | note |
|---|---|---|---|
| Surface (solid) | `surface` | `--theme-surface` | stop aliasing to card; real per-theme value |
| Card (translucent) | `card` | `--theme-card` | **meaning flips to overlay** — audit consumers |
| Line | `line` | `--theme-line` | retint subtle per theme |
| Pill-bg | `pillBg` | `--theme-pill-bg` | new |
| Button-primary/secondary | — | `--theme-button-primary/-secondary` | `:root` constants, not per-theme |
| roundness ×5 / elevation ×3 | new optional fields | as above | per Figma |

(Background/Primary/Text/Alt-Text/Secondary-Text/Secondary-Alt-Text/Symbol-BG/Enter-Mode/Success/Warning map 1:1 to existing fields.)

**Re-derive all 6 builtin JSONs (the flip):** each JSON carries its FULL colour set from Figma. Copy light/dark `text`/`altText` polarity **verbatim from Figma** — never derive. `symbolBg` stays near-white (AAC legibility). `card` = translucent overlay; `surface` = solid. `midnight_glass`: add `pillBg`, keep its glass rgba `surface`/`card`; roundness/elevation inherit `:root`.

**Verify:** on :3001 switch all 7 themes — light themes show light bg + dark text + white surface + subtle overlays; dark themes unchanged; no undefined `--theme-*`; contrast ≥4.5:1 on a NavTabButton + symbol-card in the lightest theme. `npx tsc --noEmit`.

## Stage 2 — Components (token rebinds + targeted polish; keep copy/layout)
1. **New `app/components/app/shared/ui/IconButton.tsx`** — variants Primary/Neutral/Ghost (+ Success/Warning for talker), icon-only, `rounded-theme-button`/`-chip`, `elevation-subtle` on raised; mirror `Button.tsx`. Adopt in `Header.tsx` talker controls (replace 3 bespoke buttons), minimal navbar (`TopBar.tsx`), edit affordances (`CategoryTile` delete/move, `Banner` model button).
2. **`NavTabButton.tsx`** — active = `bg-theme-surface` pill + `border-theme-line` + bold text + `elevation-subtle`; inactive transparent/muted; add `style?: 'pill'|'underline'` (Sidebar=pill, mobile=underline).
3. **Surface/card remap** — audit every `bg-theme-card` / `var(--theme-card)` consumer (`SettingsContent`, `Banner`, `--theme-bg-surface` alias); repoint solid-surface ones to `bg-theme-surface`; leave true overlays on `card`.
4. **Per-component roundness + elevation** — migrate call sites deliberately (don't mass-rename ~73 `rounded-theme*` sites): Banner image card `rounded-2xl`→`rounded-theme-card`; talker chips/container → `-button`/`-card`; modals (`Dialog`) → `rounded-theme-modal` + `elevation-modal`; raised cards get `elevation-surface`.
5. **Tier pills** — in-shell tier UI (`PlanTierPicker`, `PlanModal`, settings): `bg-theme-pill-bg border border-theme-line rounded-theme-chip`. Marketing `Badge`/`SubscriptionBadge`/`LibraryPackCard` use the *marketing* token system → **out of scope** (flag only).

## Stage 2.5 — Settings tabbed layout (Figma parity rewrite)
`SettingsContent.tsx` is a grid of modal-opening tiles; Figma is a tabbed page with section cards. Rebuild:
Tab-bar with **Primary-underline active tab**; each section (Languages, Voices, Theme, Grid, Symbols, Text size) in its own `Card`-token block; **text-size boxes = label + sized "Aa" sample**, equal height, selected = Primary bg. Keep existing settings content/copy + data wiring (reflow modal logic into the tabbed page; decide inline vs drill-in).

## Stage 3 — QA
Per-screen sweep in a dark (Default) + light (Lime) theme across Home, Search, Categories (grid+edit), Category detail, Lists, Sentences, Talker, Settings (+tabs), Library. No white-on-white/dark-on-dark; symbol cards keep near-white bg + dark label; active nav pill legible; theme-switch flat↔glass clears optional tokens (no stale pillBg/shadow); reduced-motion + en/hi unaffected. `npx tsc --noEmit` + lint. Run on :3001.

## Critical files
- `convex/data/themes/types.ts` · `app/contexts/ThemeContext.tsx` · `app/globals.css`
- `convex/data/themes/{default,sky,rose,amber,fuchsia,lime,midnight_glass}.json`
- `app/components/app/shared/ui/NavTabButton.tsx`, `Header.tsx`, `TalkerBar.tsx`, `Banner.tsx`, `Button.tsx`, `Dialog.tsx`, `PlanTierPicker.tsx` + **new** `IconButton.tsx`
- `app/components/app/categories/ui/CategoryTile.tsx`, `SymbolCard.tsx`
- `app/components/app/settings/sections/SettingsContent.tsx` (Stage 2.5)

## Biggest risks
1. **Light-theme text contrast** (highest) — copy Figma `text`/`altText` per theme verbatim; contrast-check every light theme.
2. **surface/card semantic remap** — `card` flips solid→overlay; audit all consumers before changing the value.
3. **Settings rewrite scope** — keep content/copy + data wiring intact while changing layout.
4. **Global vs per-component roundness** — add new utilities, migrate sites intentionally.
5. **Marketing vs themed token systems are separate** — don't cross them.
