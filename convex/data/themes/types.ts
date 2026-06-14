/**
 * Theme module JSON shape.
 *
 * Each theme in the catalogue is a single JSON file in this directory, slug-keyed
 * (`<slug>.json`). The bundled `_index.ts` barrel imports them all and exposes a
 * typed `THEME_MODULES` map. See `convex/lib/themes.ts` for the readers and
 * `lib/themes/registry.ts` for the client-side token lookup.
 *
 * Per ADR-011 §2: themes are a pluggable content module mirroring resource packs
 * (ADR-010). A profile stores only a `themeSlug`; the token definition is resolved
 * live from this catalogue at render (dynamic resolution — ADR-012 §7), so an
 * admin's edit to a theme reaches every existing user with no migration.
 *
 * **Source of truth:** the token *values* live in these JSON files (content →
 * code deploy to change, same constraint as pack JSON). A theme's *lifecycle*
 * (published / tier / featured / scheduled) lives in the `themeLifecycle` overlay
 * table and is deploy-free.
 *
 * **Localisation:** user-visible strings are ISO-keyed open records
 * (`LocalisedString`) per ADR-009 §2. Display reads through
 * `lib/languages/displayValue.ts`.
 */

export type ThemeTier = "free" | "pro" | "max";

/**
 * ISO-keyed open record for localised strings. e.g. { en: "Sky", hi: "आसमानी" }.
 * Adding a language is adding a key, not a type change.
 */
export type LocalisedString = Record<string, string>;

/**
 * The canonical theme token map. Mirrors the Figma design system and the
 * `--theme-*` CSS custom properties declared in `app/globals.css`. Applied to
 * the document root by `app/contexts/ThemeContext.tsx` (`TOKEN_TO_CSS`).
 *
 * This is the single source of truth for the token shape — `ThemeContext`
 * re-exports it for back-compat.
 */
export type ThemeTokens = {
  // Colours — required, unique per theme
  background: string; // --theme-background
  primary: string; // --theme-primary
  banner: string; // --theme-banner
  card: string; // --theme-card
  altCard: string; // --theme-alt-card
  symbolBg: string; // --theme-symbol-bg
  buttonHighlight: string; // --theme-button-highlight
  text: string; // --theme-text
  secondaryText: string; // --theme-secondary-text
  altText: string; // --theme-alt-text
  secondaryAltText: string; // --theme-secondary-alt-text
  line: string; // --theme-line
  enterMode: string; // --theme-enter-mode
  success: string; // --theme-success
  warning: string; // --theme-warning

  // ── Figma "Finals" tokens (code-design-system-migration Stage 1) ──────────
  // Pill background — translucent fill behind in-shell tier pills / chips.
  // Required so every theme declares its own (dark themes ~white/40, light
  // themes ~white/80). Maps to --theme-pill-bg.
  pillBg: string; // --theme-pill-bg

  // Pack-card fill — translucent near-white wash behind library pack cards.
  // Optional (inherits the :root default); dark themes ~/.25, light ~/.5.
  packBg?: string; // --theme-pack-bg

  // Per-component roundness (px) — optional; omitted themes inherit the
  // :root defaults in globals.css (button 6 / card 16 / pack 20 / modal 16 /
  // chip 999). Distinct from the global `roundness`/`smallRoundness` above.
  buttonRoundness?: number; // --theme-button-roundness
  cardRoundness?: number; // --theme-card-roundness
  packCardRoundness?: number; // --theme-pack-card-roundness
  modalRoundness?: number; // --theme-modal-roundness
  chipRoundness?: number; // --theme-chip-roundness

  // Elevation — optional box-shadow strings; omitted themes inherit the
  // :root defaults. Surfaced as utility classes (.elevation-subtle/-surface/
  // -modal) that read these vars.
  elevationSubtle?: string; // --theme-elevation-subtle
  elevationSurface?: string; // --theme-elevation-surface
  elevationModal?: string; // --theme-elevation-modal

  // Spacing — optional overrides (flat themes inherit CSS defaults)
  generalPadding?: number; // --theme-general-padding
  generalSpaceBetween?: number; // --theme-general-space-between
  headerBannerPadding?: number; // --theme-header-banner-padding
  modalPadding?: number; // --theme-modal-padding
  categoriesFolderPadding?: number; // --theme-categories-folder-padding
  modalSpaceBetween?: number; // --theme-modal-space-between
  largeButtonsPadding?: number; // --theme-large-buttons-padding
  itemPadding?: number; // --theme-item-padding
  headerTalkerPadding?: number; // --theme-header-talker-padding
  roundness?: number; // --theme-roundness
  smallRoundness?: number; // --theme-small-roundness
  elementsSpaceBetween?: number; // --theme-elements-space-between
  symbolCardPadding?: number; // --theme-symbol-card-padding
  buttonsYPadding?: number; // --theme-buttons-y-padding

  // Animation (animated themes only)
  bgAnimation?: string; // --theme-bg-animation
  bgAnimationDuration?: string; // --theme-bg-animation-duration
  cardAnimation?: string; // --theme-card-animation

  // ── Four-layer model (ADR-011 §2.1) — all optional, additive ──────────────
  // Flat themes omit these; they default to no-ops in globals.css so the six
  // builtins render pixel-identically. Premium themes opt in.

  // Background layer — full CSS background value painted by the fixed
  // `.theme-bg-layer` div behind the app shell. Falls back to `background`.
  bgLayer?: string; // --theme-bg-layer  (e.g. "linear-gradient(...)")

  // Texture layer — a procedural grain. `textureImage` is an inline SVG
  // feTurbulence data-URI string (no asset file). Applied by the fixed
  // `.theme-texture-layer` div with a blend mode + opacity.
  textureImage?: string; // --theme-texture-image   (url("data:image/svg+xml,..."))
  textureBlend?: string; // --theme-texture-blend   (overlay | soft-light | …)
  textureOpacity?: number; // --theme-texture-opacity (UNITLESS, ~0.04–0.10)

  // Surface — the SOLID raised surface for every theme (Figma "Finals":
  // Surface = solid raised panel, Card = translucent overlay). Each builtin
  // now declares its own value (dark themes a near-black/tinted solid, light
  // themes #FFFFFF). The `--theme-bg-surface` bridge alias points here.
  // Premium glass themes still set it to a translucent rgba for frosted
  // chrome. `surfaceBar` remains the bar-like chrome variant (top bar, talker
  // header); flat themes inherit it from `banner`. Falls back to
  // var(--theme-card) only when a theme omits it.
  surface?: string; // --theme-surface         (default var(--theme-card))
  surfaceBar?: string; // --theme-surface-bar     (default var(--theme-banner))
  surfaceBlur?: number; // --theme-surface-blur    (px; 0 = no glass)
  surfaceSaturate?: string; // --theme-surface-saturate (e.g. "170%"; default "100%")
  surfaceBorder?: string; // --theme-surface-border  (hairline; default var(--theme-line))
};

/**
 * A theme in the catalogue.
 *
 * `builtin: true` marks the original launch themes — they are always visible in
 * the picker without a `themeLifecycle` row, so the base set can never vanish
 * and depends on no migration. Additional themes need an admin publish (a
 * lifecycle row within its window) to appear.
 */
export type ThemeModule = {
  slug: string; // 'default' | 'sky' | … — MUST stay stable; profiles store it
  name: LocalisedString; // { en, hi? }
  description?: LocalisedString;
  previewColour: string; // swatch hex shown in the picker
  coverImagePath?: string; // R2 path — richer picker preview (optional)
  type: "flat" | "tiled" | "animated";
  defaultTier: ThemeTier; // beaten by themeLifecycle.tierOverride
  builtin?: boolean; // true → always visible, no lifecycle row required
  tokens: ThemeTokens;
};
