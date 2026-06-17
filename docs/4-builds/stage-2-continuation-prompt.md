# Stage 2 continuation — Figma design-system component binding

> Paste the section below into a new session to continue. Self-contained; points to the
> two living docs (inventory + the original staged plan) and the auto-memory for detail.

---

We're continuing **Stage 2** of porting the Figma "Mo Speech — Finals" design system into this app
(`/Users/mohanveraitch/Projects/mo-speech-home`). Stage 0/1 (tokens) and a big chunk of Stage 2 are done.

**Read first (in order):**
1. `docs/4-builds/stage-2-component-inventory.md` — the master Figma↔code component map (24 root components, status, specs). **This is the sync contract** (Code Connect is plan-gated/unavailable, so this doc + shared tokens ARE the contract).
2. Auto-memory `project_theme_token_semantics.md` — every decision, rule, and gotcha from Stage 1→2 so far. Don't re-litigate these.
3. `docs/4-builds/code-design-system-migration.md` — the original staged plan.

**Figma:** file `3DAZYuK3A1TrkeZnyGwE1o`, Components page node `3004:2218`. Load the `figma-use` skill and run `whoami` before any `use_figma`; re-auth via the OAuth URL if it fails. Recon a component's spec with `use_figma` before binding it.

**Dev server:** already running (was `:3000` last session — check the port, the project plan says `:3001`). **Do NOT start a second one.** Validate live by driving the signed-in app via the Claude-in-Chrome MCP (the session carries over), then `npx tsc --noEmit`. Work on `main`.

## Done so far in Stage 2
- **Button consolidated** — one variant-driven `shared/ui/Button.tsx` on theme tokens (`primary|secondary|ghost|destructive|toggle|edit-mode|create`, `icon`/`active` props). `EditButton`/`CreateButton`/`ToggleButton` are thin wrappers over it. **`primary` = `button-primary` whitish fill + `button-secondary` dark text** (NOT theme-primary — follow the Figma Button component literally). `edit-mode` (orange) is the active-state highlight only.
- **Dropdown atom** built (`bg-theme-surface` + `border-theme-line` + chevron); `PackFilterDropdown` wraps it; the BannerEdit `ColourPicker` uses the look + shows tailwind-500 colours as **stacked rectangular strips** (no hover).
- **Banner family** — `PageBanner` = `card` translucent (minimal, no border, owner's call); category-detail banner (`CategoryPageHeader` + edit wrapper) bg = **category tailwind-500 @ 30% opacity**; all banner buttons = `primary`; Model button uses the `Pointer` (tap-hand) icon.
- **Everything tokenised + height-aligned** — controls use `px-theme-btn-x py-theme-btn-y gap-theme-elements rounded-theme-button` + 1px `border-theme-line`; all 38–39px. `Button` `size` scales font only.
- **Fixes:** tailwind-merge was stripping `text-theme-*` font-sizes (fixed in `lib/utils.ts`); orange-flash on category navigation (neutral-while-loading instead of `?? 'orange'`); refresh FOUC for theme colours + talker/banner mode (cookie + localStorage pre-paint).

## Rules to honour (already decided)
- **Tokens, never hardcode** — use `--spacing-theme-*` / `--radius-theme-*` / `--theme-*` utilities, not raw `px`/hex (CLAUDE.md #5). I previously slipped on this; don't repeat it.
- **Never `?? '<concrete colour>'` for async-loaded data** — it flashes. Fall back to neutral/transparent until loaded.
- **Naming:** same words, platform-native casing (Figma kebab ↔ code Pascal); the inventory's "code target" column is canonical.
- `altText`/`secondaryAltText` = main per-theme text; `text`/`secondaryText` = rare inverted-surface ink (kept dark — symbol-card legibility). `card` = translucent overlay; `surface` = solid raised.

## Next components (from the inventory — pick up here)
1. **NavTabButton** — the approved sidebar change: inactive = transparent + `secondary-alt-text`; active = `bg-theme-surface` pill + `rounded-theme-button` + `alt-text` + `elevation-subtle`. Completes the `surface` cohesion trio (Dropdown + active nav + search bar).
2. **IconButton** (new atom) — Primary/Neutral/Ghost, icon-only, 48², `rounded-theme-button`, `elevation-subtle`. Unblocks `Edit-panel`, talker controls, Topbar.
3. **Category-tile** (big rebind of `categories/ui/CategoryTile.tsx`) — simplified: drop the folder shape; bg = **category colour @ 20%**, thumb = category colour @ 100%; edit-mode pops to a card with `IconButton`s + dashed line; **width unchanged** to honour grid settings. Apply the neutral-while-loading rule here too.
4. Then: Logo no-text variant, SearchBar (extract from search page), VoiceCard, ThemeSwatch, Tab/TabBar (Stage 2.5 settings rewrite), Home-card, Pack-card (home), Topbar (transparent + view-mode dropdown on `surface`), Talker (`primary-25/50` + full-width dropdown), and the full Banner consolidation (fold `BannerEdit`/`AdminPackEditingBanner` in).

Suggested next task: **NavTabButton** (small, approved, completes the surface family), then **IconButton**.
