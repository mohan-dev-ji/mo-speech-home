# Figma Design-System Build-Out — Mo Speech "Finals" (staged plan for a fresh session)

> **Self-contained.** This plan is for a NEW session that has no memory of the review that
> produced it — all the file facts it needs are embedded below. **Target = the Figma file
> only** (code implementation is a separate, later effort). Deliverable across sessions: build
> the Figma file out into a complete, *functioning* (variable-bound, variant-complete)
> tokenised design system — **atoms → components → screens** — adopting the Claude Design
> refinements **filtered through the owner's notes** (below).

## Context

A Claude Design pass enriched the Figma file **"Mo Speech — Finals"** into a full "pro" design
system. The owner wants the **Figma file itself** rebuilt into a complete, properly-tokenised,
working design system — keeping **their** layouts and the scoped **themes** model, and taking
only Claude Design's *visual* wins (radius, elevation, warmth, more primary-colour
highlighting, and the specific items in the reconciliation table). This is **multi-session,
Phase-10-sized** work; build one stage per session.

## The file (facts for a cold start)

- **fileKey:** `3DAZYuK3A1TrkeZnyGwE1o` (file "Mo Speech — Finals").
- **Pages:** `Components` (node `3004:2218`) — one master frame with the kit; and `Screens`
  (node `1068:2118`) — 15 frames at 1728×1117 (Home, Search, Categories, Category-items,
  Lists(/edit), Sentences(/edit), List-items(/edit), Settings–Instructor profile ×2,
  Edit-modal, New-Category-modal).
- **Libraries:** **Myna UI** (Tailwind + shadcn/ui + Radix) is the component source; **Material
  3** is linked but unused (ignore).
- **Export collection:** the **`Full Build`** variable collection is the canonical one (the
  one used for export). Add/reconcile all new tokens **in `Full Build`**.
- **`Banner` variable is DELETED** (made redundant) — banner/header surfaces now use the
  **`Card`** token. Do not reference a `Banner` variable anywhere.
- **Current variable system (summary):** AAC theme tokens (`Background`, `Primary`,
  `Card #fafafa0a` (translucent), `Symbol-BG`, `Text`, `Alt-Text`, `Line`,
  **`Enter-Mode #ff6900`**, `Success`, `Warning`); **`Button-primary #fafafa`** &
  **`Button-secondary #52525c`** (constant, theme-independent); `opacity/50·100`,
  `Primary-25·50`; Tailwind **Zinc** neutrals as the grey base; Noto Sans type scale
  (`h2 48 / h3 36 / h4 24 / large 20 / p 16 / p-bold`); roundness `Roundness 16 /
  Small-Roundness 8` + shadcn `radius/sm 4 · md 6`; a single `shadow/xs`. Also a vestigial
  **semantic *colour* layer** to be dropped (this is the "semantics" the owner means — NOT
  the token *naming* convention, which stays semantic per-component). The 6 themes are now
  **light *or* dark by aesthetic** (Default/Sky/Rose dark; Amber/Fuchsia/Lime light), names
  intact.
- **Components (local to the file — instance via `getNodeByIdAsync(nodeId)`, NOT
  `importComponentSetByKey`, which is library-only and fails here):** Navbar (Full/Minimal),
  Topbar, Banner, Talker, grid-symbol (Symbol/Search/Save/Edit), Category-folder, List-item,
  Tab/Tab-bar, Theme-picker-module, Button, Pack-card, Home-card, voice, Logo, etc.

## Source of truth & what to IGNORE from Claude Design

- **Authoritative = the owner's Figma file + the notes.** The owner's **layouts/structure are
  correct**; Claude Design diverged structurally — adopt only its *visual* refinements.
- **Ignore from CD:** its index/manifest (own system in code), its logo (keep existing), its
  semantic-token layer (superseded by the themes system), and its search bar (keep owner's).

## Reconciliation — owner's notes → concrete decisions

| Note | Decision |
|---|---|
| Noto Sans for romanised + non-romanised | Type tokens stay Noto Sans (reference only) |
| Index/manifest — own system in code | **Ignore** CD's manifest/index |
| Logo — use existing | **Ignore** CD logo |
| Zinc neutrals for most button states; edit-mode has its own orange | Button states → zinc ramp; **edit-mode = `Enter-Mode #ff6900`** |
| Semantics not relevant (stepping stone) | **Drop** the semantic colour layer; the scoped **themes** system is the model |
| Talker control icon buttons (CD) are good | **Adopt** CD's talker control icon buttons |
| Navbar (CD) great | **Adopt** CD's navbar |
| Search bar (CD) not right | **Keep** the owner's search component |
| Radius + elevation (CD) — like the introduction | **Introduce roundness & elevation tokens** (semantic naming) as variables / effect styles, adjusted |
| Settings layout (CD) great, with caveats | **Adopt** CD **block-sectioned** layout (not line separators) + **tab bar = primary-colour underline**; BUT **mute** the non-selected options (they stand out too much), and the selected option's **text = `Button-primary` (always zinc-50)** |
| Home (CD) good, with caveats | **Adopt** CD warmth + **load-pack buttons = primary bg** + **pack-card radius (CD)**; BUT **top banner bg = `Card` token** (keep owner's) |
| Warmer via radius + more primary highlighting; my layouts correct | Adopt **warmth + primary-highlight**; **keep the owner's layouts/structure** |

## Stage A — Atoms (variables / foundations) — DO FIRST

Establish the token bedrock everything binds to, **in the `Full Build` collection**; document
on a new **"Foundations"** page.
1. **Re-inspect** the live `Full Build` collection first (names, modes, scopes) before changing.
2. **Roundness tokens** — add **semantic, per-component** roundness variables continuing the
   owner's naming convention (Title-Case-hyphenated, like the existing `Roundness` /
   `Small-Roundness`): e.g. **`Button-roundness`, `Card-roundness`, `Pack-card-roundness`,
   `Modal-roundness`, `Chip-roundness`**. **Not** a generic `xs·sm·md` t-shirt scale. Set
   their values from CD's radii where the owner liked them (warmer pack cards etc.).
3. **Elevation** — add elevation as **effect styles** (only `shadow/xs` exists today); name
   semantically too if naming as variables (e.g. `Card-elevation`, `Modal-elevation`); bind
   components to these, not ad-hoc shadows.
4. **Colour / button tokens** — keep the scoped **themes** model (6 themes, **light/dark by
   aesthetic**, as variable **modes** → a theme = a mode swap). Confirm `Button-primary`
   (constant **zinc-50**), `Button-secondary` (zinc), **Enter-Mode orange**, `Primary`
   (per-theme highlight), `opacity/50·100`, `Primary-25·50`. **`Banner` is deleted** — banner
   surfaces resolve to `Card`. **Remove the semantic *colour* layer** (the bridge tokens).
5. **Spacing & type** — keep Noto Sans scale + spacing; tidy only.

## Stage B — Components (variant-complete, variable-bound)

"Functioning" = every colour/radius/elevation **bound to a variable**; all states as variants.
Rebind/rebuild to Stage-A tokens + the CD refinements, priority order:
- **Talker** — adopt CD's **control icon buttons** (play / clear / save).
- **Navbar** — adopt CD's navbar.
- **Buttons** — zinc state ramp; **edit-mode = orange**; primary's **text = zinc-50**.
- **Tab / Tab-bar** — settings variant uses **primary-colour underline** for the active tab.
- **Settings blocks** — section/block cards (not line separators); **muted** non-selected
  option style; selected option text = `Button-primary` (zinc-50).
- **Pack card** — CD radius; **load-pack button = primary bg**.
- **Search** — keep owner's existing component (do NOT adopt CD's).
- **Rebind** Category-folder, List-item, grid-symbol, Topbar, and the Banner *component* to
  the new roundness/elevation tokens; the Banner component's bg resolves to **`Card`** (the
  `Banner` *variable* is deleted).
- Validate each across 2–3 theme modes (mode swap recolours correctly).

## Stage C — Screens (compose from updated components; KEEP owner's layouts)

- **Home** — banner bg = **`Card` token**; load-pack buttons primary bg; pack cards CD radius.
- **Settings** (Instructor + nested Student-Profiles tabs) — block-sectioned, primary-underline
  tab bar, muted non-select options, zinc-50 highlight text.
- **Categories / Category-items, Lists(/edit), Sentences(/edit), Talker surfaces.**
- Validate each in light + dark themes; AAC checks (symbol/talker legibility, contrast,
  large hit targets). Layouts match the owner's structure, not CD's.

## Tooling & setup (every session)

- **Re-authenticate the Figma connector first** — the remote `plugin:figma:figma` MCP needs a
  fresh OAuth each session; open the auth URL, then paste the `localhost/callback?...` URL
  **as text** to complete (the redirect page failing to load is expected).
- **Skills (load before `use_figma`):** `figma-generate-library` (variables + components —
  the design-system builder), `figma-use` (Plugin API rules), `figma-generate-design` (screens).
- **Instance local components via `getNodeByIdAsync(nodeId)`** (not `importComponentSetByKey`).
- **Load each instance's fonts** (Noto Sans / Inter styles) before `appendChild`.

## Verification (per stage)

- **Atoms:** `get_metadata` on collections (counts, modes, scopes); a test node bound to a
  roundness/elevation var resolves; switching the theme **mode** recolours it.
- **Components:** screenshot each variant set; confirm `boundVariables` present (no hardcoded
  hex); edit-mode shows orange, primary text shows zinc-50; mode-swap recolours.
- **Screens:** screenshot in light + dark; AAC legibility/contrast; layouts match the owner's.

## Sequencing

1. **Session 1 — Stage A** (atoms/variables + Foundations page).
2. **Session 2–3 — Stage B** (components in the priority order above).
3. **Session 4–5 — Stage C** (screens, starting Home + Settings).

Each session: re-auth connector → re-inspect live state → build one stage → validate → stop.
After Figma is final, a **separate code effort** brings the finalised variables into the app
(`globals.css` `--theme-*` + `ThemeContext` + components).
