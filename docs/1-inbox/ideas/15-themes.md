# Themes and Design System

## Overview

Mo Speech Home uses a JSON-driven, token-based theme system. Every colour, spacing value, and roundness is a CSS custom property derived from Figma design tokens — no component ever hard-codes a value. Switching a theme is a single update to custom properties on the root element; the component tree never changes.

Themes are stored in a Convex table managed by the Mo Speech admin team. New themes can be published without a code deploy. Themes can be free, premium, or purchasable. Seasonal and animated themes can be added over time.

Each student profile has its own theme.

**Source of truth for token values:** `docs/3-design/design-system/Themes/*.tokens.json`

**Implementation files:**
| File | Role |
|---|---|
| `app/globals.css` (`@theme inline` block) | Tailwind v4 utility mapping — `bg-theme-primary`, `text-theme-text`, `rounded-theme`, `p-theme-general`, etc. No `tailwind.config.ts` exists. |
| `app/globals.css` | CSS custom property defaults (Default/Slate theme), component classes, animations |
| `app/contexts/ThemeContext.tsx` | Runtime token application, all 6 theme catalogues, `ThemeTokens` type |

---

## Why Themes Instead of Dark/Light Mode

Dark and light mode is a binary system built for productivity tools. Mo Speech is a communication device for children — the visual experience matters deeply. A student who feels ownership over their device's appearance is more likely to engage with it. A theme that reflects a student's favourite colour or current obsession (space, dinosaurs, flowers) adds personality and connection to the device.

Themes also create a natural premium feature pathway — a growing library of curated, seasonal, tiled, and animated themes that families can unlock or purchase.

---

## Three Theme Types

| Type | Description | Tier |
|---|---|---|
| **Flat** | Solid colour palette — clean, minimal, fast | Free |
| **Tiled** | CSS tiled images as backgrounds and card textures — space stars, flower petals, dinosaur scales | Premium / Max |
| **Animated** | Subtle looping CSS animations — twinkling stars, floating particles, shimmering gradients | Purchasable / Max |

Type is stored on the theme record and shown as a badge in the picker UI. Flat themes are free, tiled are Max, animated may be individually purchasable.

---

## Design Token System

All design tokens come directly from Figma. There are three categories:

- **Colour tokens** — unique per theme (Primary, Background, etc.)
- **Spacing tokens** — shared across all themes (General-padding, Modal-padding, etc.)
- **Roundness tokens** — shared across all themes (Roundness, Small-Roundness)

Token names use the exact Figma names. CSS custom properties follow the pattern `--theme-[figma-name-kebab]`.

---

## Colour Token Reference

| Figma Token | CSS Variable | Semantic Role |
|---|---|---|
| `Background` | `--theme-background` | App background — zinc/900 (`#18181B`) across all flat themes |
| `Primary` | `--theme-primary` | Primary buttons, active states, interactive elements |
| `Banner` | `--theme-banner` | Header/nav banner background (theme-600 or theme-700 shade) |
| `Card` | `--theme-card` | Symbol card and deep panel background (theme-900 shade) |
| `Alt-Card` | `--theme-alt-card` | Light neutral card background — zinc/200 (`#E4E4E7`) across all flat themes |
| `Symbol-BG` | `--theme-symbol-bg` | Symbol image area background — zinc/50 (`#FAFAFA`) across all flat themes |
| `Button-highlight` | `--theme-button-highlight` | Active / selected button background (theme-200 pastel shade) |
| `Text` | `--theme-text` | Body text on light surfaces — zinc/700 (`#3F3F46`) across all flat themes |
| `Secondary-Text` | `--theme-secondary-text` | Captions, labels, placeholders on light surfaces — zinc/500 (`#71717B`) |
| `Alt-Text` | `--theme-alt-text` | Text on dark or coloured surfaces — zinc/50 (`#FAFAFA`) |
| `Secondary-Alt-Text` | `--theme-secondary-alt-text` | Secondary text on dark surfaces — zinc/300 (Default) or zinc/100 (all others) |
| `Line` | `--theme-line` | Borders, dividers, separators (darkest shade of theme colour) |
| `Enter-Mode` | `--theme-enter-mode` | Edit mode outline — orange/500 across most themes; amber/500 for Sky |
| `Success` | `--theme-success` | Positive feedback — green/500 (`#00C951`) across all themes |
| `Warning` | `--theme-warning` | Errors, destructive actions — red/500 (`#FB2C36`) across all themes |

---

## Interactive UI Model

### Button States

Buttons communicate both action and navigation state through two distinct visual modes:

**Default (inactive) state:**
- Background: `--theme-primary` (the theme's medium accent colour)
- Text: `--theme-alt-text` (zinc/50 — white/light, readable on the coloured background)

**Active / selected / on state:**
- Background: `--theme-button-highlight` (the theme's light pastel variant, the 200-shade)
- Text: `--theme-text` (zinc/700 — dark, readable on the light pastel background)

The active state doubles as a **navigation tracker** — the user always knows which screen they are on and which options are currently enabled. Large student-facing buttons, nav items, and toggle controls all follow this pattern.

> **Note on contrast:** `Button-highlight` is always a light pastel (the 200-shade). Use `--theme-text` (dark) for text in the active state, not `--theme-alt-text` (white). The `--theme-alt-text` token is reserved for text on dark or coloured backgrounds (`Card`, `Banner`, `Primary` button default state).

### Navigation Tracking

Nav items use the same token pair. The active route uses `Button-highlight` bg + `Text`. Inactive nav items use `Primary` bg + `Alt-Text`. No additional active indicator tokens are needed — the button state model handles this.

---

## Edit Mode

When an instructor enters edit mode, editable elements are outlined using `--theme-enter-mode` (orange/500). This creates an immediate, unmistakable visual signal distinguishing "edit mode" from normal use.

**What gets the Enter-Mode outline:**
- Symbol cards that can be edited
- Category folders that can be reordered or renamed
- Board cells that accept new symbols
- Any element with edit permissions enabled in the current context

Enter-Mode is orange/500 across all themes (amber/500 for Sky). It is intentionally not part of the theme's primary colour family — it must stand apart as a clear mode indicator.

---

## Button Size Hierarchy

Two button sizes are used throughout the UI:

**Large buttons — student-facing:**
- Used for: symbol cards, main navigation, primary AAC interactions
- Padding: `--theme-large-buttons-padding` (16px horizontal) × `--theme-buttons-y-padding` (8px vertical)
- Radius: `--theme-roundness` (16px)

**Small buttons — instructor-facing:**
- Used for: edit controls, management actions, settings UI
- Radius: `--theme-small-roundness` (8px)
- Padding matches item or modal context

---

## Flat Theme Catalogue

Six flat themes ship at launch. All are free. Background (`#18181B`), Symbol-BG (`#FAFAFA`), Alt-Card (`#E4E4E7`), Text (`#3F3F46`), Secondary-Text (`#71717B`), Alt-Text (`#FAFAFA`), Success (`#00C951`), and Warning (`#FB2C36`) are shared across all flat themes.

### Default (Slate)

| Token | Value | Tailwind reference |
|---|---|---|
| `Primary` | `#62748E` | slate/500 |
| `Banner` | `#45556C` | slate/600 |
| `Card` | `#314158` | slate/700 |
| `Button-highlight` | `#E2E8F0` | slate/200 |
| `Line` | `#0F172B` | slate/900 |
| `Secondary-Alt-Text` | `#D4D4D8` | zinc/300 |
| `Enter-Mode` | `#FF6900` | orange/500 |

### Sky

| Token | Value | Tailwind reference |
|---|---|---|
| `Primary` | `#00A6F4` | sky/500 |
| `Banner` | `#0084D1` | sky/600 |
| `Card` | `#024A70` | sky/900 |
| `Button-highlight` | `#B8E6FE` | sky/200 |
| `Line` | `#052F4A` | sky/950 |
| `Secondary-Alt-Text` | `#F4F4F5` | zinc/100 |
| `Enter-Mode` | `#FD9A00` | amber/500 |

### Amber

| Token | Value | Tailwind reference |
|---|---|---|
| `Primary` | `#E17100` | amber/600 |
| `Banner` | `#BB4D00` | amber/700 |
| `Card` | `#7B3306` | amber/900 |
| `Button-highlight` | `#FEE685` | amber/200 |
| `Line` | `#7B3306` | amber/900 |
| `Secondary-Alt-Text` | `#F4F4F5` | zinc/100 |
| `Enter-Mode` | `#FF6900` | orange/500 |

### Fuchsia

| Token | Value | Tailwind reference |
|---|---|---|
| `Primary` | `#E12AFB` | fuchsia/500 |
| `Banner` | `#A800B7` | fuchsia/700 |
| `Card` | `#721378` | fuchsia/900 |
| `Button-highlight` | `#F6CFFF` | fuchsia/200 |
| `Line` | `#8A0194` | fuchsia/800 |
| `Secondary-Alt-Text` | `#F4F4F5` | zinc/100 |
| `Enter-Mode` | `#FF6900` | orange/500 |

### Lime

| Token | Value | Tailwind reference |
|---|---|---|
| `Primary` | `#5EA500` | lime/600 |
| `Banner` | `#497D00` | lime/700 |
| `Card` | `#35530E` | lime/900 |
| `Button-highlight` | `#D8F999` | lime/200 |
| `Line` | `#3D6300` | lime/800 |
| `Secondary-Alt-Text` | `#F4F4F5` | zinc/100 |
| `Enter-Mode` | `#FF6900` | orange/500 |

### Rose

| Token | Value | Tailwind reference |
|---|---|---|
| `Primary` | `#FF2056` | rose/500 |
| `Banner` | `#C70036` | rose/700 |
| `Card` | `#8B0836` | rose/900 |
| `Button-highlight` | `#FFCCD3` | rose/200 |
| `Line` | `#A50036` | rose/800 |
| `Secondary-Alt-Text` | `#F4F4F5` | zinc/100 |
| `Enter-Mode` | `#FF6900` | orange/500 |

---

## Shared Spacing & Roundness Tokens

These values are identical across all flat themes. Future themes (tiled, animated, or specialty) may override them.

| Figma Token | CSS Variable | Value | Used for |
|---|---|---|---|
| `General-padding` | `--theme-general-padding` | 32px | Main layout padding |
| `General-Space-between` | `--theme-general-space-between` | 32px | Layout section spacing |
| `Header-Banner-padding` | `--theme-header-banner-padding` | 32px | Banner / header inner padding |
| `Modal-padding` | `--theme-modal-padding` | 24px | Modal inner padding |
| `Categories-folder-padding` | `--theme-categories-folder-padding` | 20px | Category folder card padding |
| `Modal-Space-between` | `--theme-modal-space-between` | 16px | Spacing between modal elements |
| `Large-buttons-padding` | `--theme-large-buttons-padding` | 16px | Horizontal padding on large buttons |
| `Item-padding` | `--theme-item-padding` | 16px | List item and row padding |
| `Header-Talker-padding` | `--theme-header-talker-padding` | 16px | Talker bar inner padding |
| `Roundness` | `--theme-roundness` | 16px | Standard border radius (large buttons, cards, panels) |
| `Small-Roundness` | `--theme-small-roundness` | 8px | Small button and badge radius |
| `Elements-Space-between` | `--theme-elements-space-between` | 8px | Spacing between inline elements |
| `Symbol-card-padding` | `--theme-symbol-card-padding` | 8px | Symbol card inner padding |
| `Buttons-y-padding` | `--theme-buttons-y-padding` | 8px | Vertical padding on buttons |

---

## CSS Custom Properties — Full Default Set

Applied to `:root` (flat Default theme). ThemeContext updates these when a student's theme loads.

```css
:root {
  /* Colours — updated per theme */
  --theme-background:          #18181B;  /* zinc/900 — all flat themes */
  --theme-primary:             #62748E;  /* slate/500 — Default */
  --theme-banner:              #45556C;  /* slate/600 — Default */
  --theme-card:                #314158;  /* slate/700 — Default */
  --theme-alt-card:            #E4E4E7;  /* zinc/200 — all flat themes */
  --theme-symbol-bg:           #FAFAFA;  /* zinc/50 — all flat themes */
  --theme-button-highlight:    #E2E8F0;  /* slate/200 — Default */
  --theme-text:                #3F3F46;  /* zinc/700 — all flat themes */
  --theme-secondary-text:      #71717B;  /* zinc/500 — all flat themes */
  --theme-alt-text:            #FAFAFA;  /* zinc/50 — all flat themes */
  --theme-secondary-alt-text:  #D4D4D8;  /* zinc/300 — Default; zinc/100 others */
  --theme-line:                #0F172B;  /* slate/900 — Default */
  --theme-enter-mode:          #FF6900;  /* orange/500 — all flat themes except Sky */
  --theme-success:             #00C951;  /* green/500 — all themes */
  --theme-warning:             #FB2C36;  /* red/500 — all themes */

  /* Spacing — shared across all themes */
  --theme-general-padding:             32px;
  --theme-general-space-between:       32px;
  --theme-header-banner-padding:       32px;
  --theme-modal-padding:               24px;
  --theme-categories-folder-padding:   20px;
  --theme-modal-space-between:         16px;
  --theme-large-buttons-padding:       16px;
  --theme-item-padding:                16px;
  --theme-header-talker-padding:       16px;
  --theme-roundness:                   16px;
  --theme-small-roundness:              8px;
  --theme-elements-space-between:       8px;
  --theme-symbol-card-padding:          8px;
  --theme-buttons-y-padding:            8px;

  /* Animation — populated by animated themes only */
  --theme-bg-animation:          none;
  --theme-bg-animation-duration: 4s;
  --theme-card-animation:        none;
}
```

---

## Component Usage Patterns

```tsx
// Large student button — default (inactive) state
// globals.css: .btn-large  or  Tailwind utilities:
<button className="btn-large">Label</button>
// equivalent with Tailwind tokens:
<button className="bg-theme-primary text-theme-alt-text rounded-theme px-theme-btn-x py-theme-btn-y">
  Label
</button>

// Large student button — active/on state
<button className="btn-large btn-large--active">Label</button>
// equivalent:
<button className="bg-theme-button-highlight text-theme-text rounded-theme px-theme-btn-x py-theme-btn-y">
  Label
</button>

// Symbol card (uses globals.css class)
<div className="symbol-card">
  <div className="symbol-card__image">{/* symbol image */}</div>
  <span>word</span>
</div>

// Edit mode — editable element
<div className="editable">{/* editable content */}</div>
<div className="editable--small">{/* small editable */}</div>

// Header banner
<header className="app-banner">...</header>

// Talker bar
<div className="talker-bar">...</div>
```

---

## Convex Schema

```typescript
themes: {
  _id: Id<"themes">
  name: { eng: string, hin: string }
  slug: string                           // "sky" | "rose" | "space-animated" etc.
  description?: { eng: string, hin: string }
  type: "flat" | "tiled" | "animated"
  previewColour: string                  // hex — always present for swatch fallback
  coverImagePath?: string                // R2 path — richer picker preview
  tileAssets?: string[]                  // R2 paths of tile images (admin reference)
  tier: "free" | "premium"
  purchasable: boolean
  price?: number                         // pence — if purchasable
  season?: string
  featured: boolean
  publishedAt?: number
  expiresAt?: number
  createdBy: string
  updatedAt: number
  tokens: ThemeTokens
}

// ThemeTokens — maps directly from Figma token names
type ThemeTokens = {
  // Colours — required
  background:         string   // app bg — hex or CSS background value (url() for tiled)
  primary:            string   // buttons, active states
  banner:             string   // header/nav bg
  card:               string   // symbol card and deep panel bg
  altCard:            string   // light neutral card bg
  symbolBg:           string   // symbol image area bg
  buttonHighlight:    string   // active/selected button bg
  text:               string   // body text on light surfaces
  secondaryText:      string   // captions, labels on light surfaces
  altText:            string   // text on dark/coloured surfaces
  secondaryAltText:   string   // secondary text on dark surfaces
  line:               string   // borders, dividers
  enterMode:          string   // edit mode outline colour
  success:            string
  warning:            string

  // Spacing — optional overrides (flat themes omit; inherits CSS default)
  generalPadding?:            number
  generalSpaceBetween?:       number
  headerBannerPadding?:       number
  modalPadding?:              number
  categoriesFolderPadding?:   number
  modalSpaceBetween?:         number
  largeButtonsPadding?:       number
  itemPadding?:               number
  headerTalkerPadding?:       number
  roundness?:                 number
  smallRoundness?:            number
  elementsSpaceBetween?:      number
  symbolCardPadding?:         number
  buttonsYPadding?:           number

  // Animation (tiled / animated themes only)
  bgAnimation?:          string   // "twinkle" | "shimmer" | "drift" | null
  bgAnimationDuration?:  string   // "4s" | "8s"
  cardAnimation?:        string   // "pulse-glow" | "float" | null
}
```

### Addition to studentProfile

```typescript
themeId?: Id<"themes">                   // null = Default (Slate)
purchasedThemeIds?: Array<Id<"themes">>  // individually purchased themes
```

---

## Animation Keyframes

Keyframes are defined once in `globals.css`. Themes reference them by name via `bgAnimation` and `cardAnimation` tokens. Themes do not define their own CSS.

```css
@keyframes twinkle {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1;   }
}

@keyframes shimmer {
  0%   { background-position: -200% center; }
  100% { background-position:  200% center; }
}

@keyframes drift {
  0%   { background-position: 0%   0%;   }
  100% { background-position: 100% 100%; }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: var(--theme-symbol-card-glow); }
  50%       { box-shadow: none; }
}

@keyframes float {
  0%, 100% { transform: translateY(0);    }
  50%       { transform: translateY(-4px); }
}
```

No new CSS is needed when a theme is published — only new token values and tile assets.

---

## Tile Assets

Tile images for tiled themes are stored in R2 under `themes/`:

```
themes/
  space/
    stars-tile.svg
    nebula-tile.svg
  dinosaurs/
    scales-tile.svg
  flowers/
    petal-tile.svg
```

The admin sets the full CSS background value in the `background` or `card` token:

```
background: "url('https://r2.mospeech.app/themes/space/stars-tile.svg') repeat, #0a0a2a"
```

If the image fails to load, the fallback colour shows.

---

## Reduced Motion — Accessibility Critical

Some non-verbal children are highly sensitive to visual motion. Animations must never run without respecting this.

**Layer 1 — OS level:**

```css
@media (prefers-reduced-motion: no-preference) {
  .animated-bg   { animation: var(--theme-bg-animation) var(--theme-bg-animation-duration) infinite; }
  .animated-card { animation: var(--theme-card-animation) 2s infinite; }
}

[data-reduce-motion="true"] .animated-bg,
[data-reduce-motion="true"] .animated-card {
  animation: none !important;
}
```

**Layer 2 — In-app flag** on `studentProfile.stateFlags`:

```typescript
reduce_motion: boolean   // default: false
```

When `true`, ThemeContext sets `data-reduce-motion="true"` on the app root and ignores `bgAnimation` / `cardAnimation` token values entirely. All colours, spacing, and tile backgrounds still apply — only motion is disabled.

---

## Theme Picker in Settings

Settings → Appearance → Theme shows a grid of theme swatches. Each swatch shows:
- Preview colour or tile thumbnail (uses `previewColour` hex as fallback)
- Theme name
- Type badge (Animated / Tiled)
- Lock icon if it requires a higher tier or purchase

Filter tabs: **All** | **Free** | **Seasonal** | **Animated**

Seasonal themes appear and disappear automatically based on `publishedAt` and `expiresAt`.

---

## Starter Theme Set (Free, Flat)

Six flat colour themes ship at launch:

| Slug | Name | Primary colour |
|---|---|---|
| `default` | Slate | `#62748E` — neutral blue-grey |
| `sky` | Sky | `#00A6F4` — bright sky blue |
| `amber` | Amber | `#E17100` — warm amber/orange |
| `fuchsia` | Fuchsia | `#E12AFB` — vivid magenta |
| `lime` | Lime | `#5EA500` — bold lime green |
| `rose` | Rose | `#FF2056` — deep rose red |

---

## Premium and Animated Theme Roadmap

**Seasonal (free, time-limited):**
- Halloween — dark purples, orange, twinkling glow animations
- Christmas — deep red, forest green, shimmer on the talker
- Diwali — warm gold, jewel tones, shimmer animations
- Spring — pastels, soft petal tiles

**Tiled Premium (Max tier):**
- Space — dark navy, tiled star field, constellation card borders
- Ocean — teal, tiled wave texture, seafoam card glow
- Dinosaurs — earthy greens, tiled scale texture
- Flowers — soft pastels, tiled floral tile

**Animated Premium (purchasable or Max):**
- Space Animated — twinkling stars, pulsing card glows
- Northern Lights — drifting gradient background
- Fireflies — subtle floating particle effect on cards

---

## Admin Management

Themes are managed in the Mo Speech admin dashboard. Admins can:
- Create, preview, and publish themes
- Upload tile assets to R2 and reference them in token values
- Set type, tier, and whether the theme is individually purchasable
- Set season and expiry for seasonal themes
- Mark as featured
- Preview the theme applied to a mock app screen before publishing
- Unpublish or delete at any time

No code deploy required for any theme change.
