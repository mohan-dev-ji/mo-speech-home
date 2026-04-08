# Themes and Design System

## Overview

Mo Speech Home uses a JSON-driven theme system rather than a simple light/dark toggle. Themes define the full visual palette of the app — backgrounds, surfaces, symbol cards, navigation, talker bar, and more. Each theme is a named, curated set of CSS tokens.

Themes are stored in a Convex table managed by the Mo Speech admin team. New themes can be published without a code deploy. Themes can be free, premium, or purchasable. Seasonal and animated themes can be added over time.

Each student profile has its own theme — a student who loves space gets a different look to a sibling who loves flowers.

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

Type is stored on the theme record and shown as a badge in the picker UI. The type field also drives tier gating — flat themes are free, tiled are Max, animated may be individually purchasable.

---

## Token Architecture

Every colour and visual property in the app is a CSS custom property — no component ever hard-codes a value. Switching a theme is updating the custom properties on the root element. The component tree never changes.

A token value can be any valid CSS value:
- Flat theme: `bgPrimary: "#1a1f3a"`
- Tiled theme: `bgPrimary: "url('https://r2.mospeech.app/themes/space/stars-tile.svg') repeat"`
- Animated theme: `bgPrimary: "#0a0a1a"` with `bgAnimation: "twinkle"`

The component consuming `--bg-primary` doesn't know or care which type it is.

---

## Full Token Set

```typescript
tokens: {
  // Backgrounds
  bgPrimary: string           // main app background — hex or CSS background value
  bgSurface: string           // cards, panels, modals
  bgSurfaceAlt: string        // nav bar, alternate surfaces

  // Brand / interactive
  brandPrimary: string        // primary buttons, active states, links
  brandSecondary: string      // secondary actions, accents
  brandTertiary: string       // highlights, special elements

  // Text
  textPrimary: string         // main body text
  textSecondary: string       // labels, captions, placeholders
  textOnBrand: string         // text on brandPrimary backgrounds

  // Symbol cards
  symbolCardBg: string        // default card background — hex or CSS background value
  symbolCardText: string      // label colour
  symbolCardBorder?: string   // e.g. "2px solid rgba(255,255,255,0.2)"
  symbolCardRadius?: string   // e.g. "16px" — can vary per theme
  symbolCardShadow?: string   // e.g. "0 4px 12px rgba(0,0,255,0.3)"
  symbolCardGlow?: string     // e.g. "0 0 16px rgba(100,200,255,0.6)"

  // Modelling mode
  modellingGlowRing: string   // glow ring on the active modelling target

  // Talker bar
  talkerBg: string
  talkerText: string
  talkerBorder: string
  talkerGlow?: string         // optional glow on the talker bar

  // Navigation
  navBg: string
  navText: string
  navTextActive: string
  navIndicator: string        // active nav item indicator
  navShadow?: string          // subtle drop shadow on nav

  // Utility
  success: string
  warning: string
  error: string
  overlay: string             // modelling mode overlay — usually #000000

  // Animation (tiled / animated themes only)
  bgAnimation?: string        // keyframe name — "twinkle" | "shimmer" | "drift" | null
  bgAnimationDuration?: string  // "4s" | "8s" — controls speed
  cardAnimation?: string      // keyframe name — "pulse-glow" | "float" | null
}
```

---

## Animation Keyframes

Animation keyframes are defined once in `globals.css` — a small library of named animations that any theme can activate by name. Themes do not define their own CSS. They reference these shared keyframes via the `bgAnimation` and `cardAnimation` token values.

```css
/* globals.css */
@keyframes twinkle {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

@keyframes shimmer {
  0% { background-position: -200% center; }
  100% { background-position: 200% center; }
}

@keyframes drift {
  0% { background-position: 0% 0%; }
  100% { background-position: 100% 100%; }
}

@keyframes pulse-glow {
  0%, 100% { box-shadow: var(--symbol-card-glow); }
  50% { box-shadow: none; }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
```

A Space theme activates `twinkle` on the background and `pulse-glow` on symbol cards. A Diwali theme might use `shimmer` on the talker bar. No new CSS is needed when a new theme is published — only new token values and tile assets.

---

## Tile Assets

Tile images for tiled themes are stored in R2 under a `themes/` folder:

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

The admin sets the full CSS background value in the theme token when creating the theme in the dashboard. For example:

```
symbolCardBg: "url('https://r2.mospeech.app/themes/space/stars-tile.svg') repeat, #0a0a2a"
```

The tile image overlays on the flat background colour — if the image fails to load, the colour shows as fallback.

---

## Reduced Motion — Accessibility Critical

Some non-verbal children are highly sensitive to visual motion. Animations must never run without respecting this.

Two layers of protection:

**1. OS-level** — the app checks `prefers-reduced-motion` at the CSS level. All animations are wrapped:

```css
@media (prefers-reduced-motion: no-preference) {
  .animated-bg { animation: var(--bg-animation) var(--bg-animation-duration) infinite; }
  .animated-card { animation: var(--card-animation) 2s infinite; }
}
```

If the student's device has reduced motion enabled in system accessibility settings, all animations are disabled regardless of theme.

**2. In-app state flag** — a `reduce_motion` flag on `studentProfile.stateFlags` (default: false) lets the instructor disable animations within the app even if the OS setting is not set:

```typescript
reduce_motion: boolean   // default: false
```

When `reduce_motion` is true, the app ignores `bgAnimation` and `cardAnimation` token values entirely. The theme still applies — all colours, shadows, tiles — but nothing moves.

Add `reduce_motion` to `12-convex-schema.md` stateFlags.

---

## Theme Picker in Settings

Settings → Appearance → Theme shows a grid of theme swatches. Each swatch shows:
- The theme's preview colour or tile image thumbnail
- The theme name
- A type badge (Animated / Tiled)
- A lock icon if it requires a higher tier or purchase

Tabs or filter chips in the picker: **All** | **Free** | **Seasonal** | **Animated**

Seasonal themes appear and disappear automatically based on `publishedAt` and `expiresAt`.

---

## Starter Theme Set (Free, Flat)

Six flat colour themes ship at launch:

| Name | Character |
|---|---|
| Classic Blue | Navy + bright blue — the original Mo Speech palette |
| Soft Green | Calm, nature-inspired greens |
| Warm Coral | Friendly oranges and pinks |
| Deep Purple | Rich purples and lilacs |
| Sunny Yellow | Warm yellows and amber |
| Cool Grey | Neutral, minimal, highly accessible |

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

## Convex Schema

```typescript
themes: {
  _id: Id<"themes">
  name: { eng: string, hin: string }
  slug: string                           // "space-animated" — unique identifier
  description?: { eng: string, hin: string }
  type: "flat" | "tiled" | "animated"   // drives picker badge and tier logic
  previewColour: string                  // hex — always present for fallback swatch
  coverImagePath?: string                // R2 path — richer picker preview
  tileAssets?: string[]                  // R2 paths of tile images used (admin reference)
  tier: "free" | "premium"              // premium = Max tier or purchasable
  purchasable: boolean                   // true = can be bought individually
  price?: number                         // pence — if purchasable
  season?: string
  featured: boolean
  publishedAt?: number
  expiresAt?: number
  createdBy: string
  updatedAt: number
  tokens: ThemeTokens                    // full token object as above
}
```

### Addition to studentProfile

```typescript
// studentProfiles additions
themeId?: Id<"themes">     // null = Classic Blue default
purchasedThemeIds?: Array<Id<"themes">>  // individually purchased themes
```

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
