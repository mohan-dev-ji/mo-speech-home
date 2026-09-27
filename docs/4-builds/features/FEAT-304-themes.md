# FEAT-304 · Themes

**Layer 3 · Modes & looks** · [Back to the index](README.md)

> **Status:** themes work today with seven looks. The big step is **M4 Pro &
> Max themes**: animated, looping, textured backgrounds based on special
> interests (water, sky, space, abstract), made in code, plus a review of the
> themes admin page
> ([MOS-63](https://linear.app/mo-intelligence/issue/MOS-63),
> [MOS-64](https://linear.app/mo-intelligence/issue/MOS-64),
> [MOS-65](https://linear.app/mo-intelligence/issue/MOS-65)). This spec
> describes today and is extended when M4 lands.

- A theme sets the whole look: backgrounds, cards, symbol tiles, text and
  buttons
- Chosen **per profile**: the instructor has one, and each student has their
  own
- Seven themes today: **Classic**, **Amber**, **Fuchsia**, **Lime**, **Rose**
  and **Sky** (free), and **Midnight Glass** (Max)
- Grouped in the picker as **Dark**, **Light** and premium
- Switching to a student's view switches to their theme
- Premium themes are part of Max

---

## What it does

Every colour in Mo Speech comes from the active **theme**: the page
background, the cards, the symbol tiles, the text, the buttons, the lines, and
the "now playing" glow. Change the theme and the whole app changes with it,
consistently, everywhere.

### Choosing a theme

Themes are chosen in **Settings**: for the instructor under **Instructor
Profile**, and for each student under **Student Profiles**. See
[FEAT-106](FEAT-106-settings.md). The picker shows each theme as a swatch,
grouped into **Dark**, **Light** and the premium themes, with locked ones
marked.

Because a theme belongs to a profile, switching the view switcher to a student
changes the app into **their** theme at once, and back again for the
instructor. See [FEAT-301](FEAT-301-instructor-and-student-views.md).

### The themes today

| Theme | Plan | Look |
|---|---|---|
| **Classic** | Free | The default Mo Speech look |
| **Amber**, **Fuchsia**, **Lime**, **Rose**, **Sky** | Free | Colour themes, each built around one colour |
| **Midnight Glass** | Max | A deep midnight gradient with frosted-glass panels and a fine grain |

### What a theme doesn't change

A theme never changes **category colours**. A category's own colour (Food,
Animals and so on) runs through its tile and board whatever the theme is, so
the colour coding a student has learned stays put. See
[FEAT-103](FEAT-103-categories.md).

## Why it helps

- **Comfort.** Some students do better with a dark, calm screen, others with a
  bright one. Each student can have what suits them.
- **Ownership.** A student's own look makes the device feel like theirs.
- **Motivation (M4).** Animated backgrounds based on a student's special
  interest (water, space and so on) are meant to make time in the app
  something to look forward to.
- **Clear separation.** Different themes for the instructor and the student
  make it obvious at a glance which view is showing.

## Audio

Themes don't affect sound.

## Edge cases

- **Plans.** Free themes are for everyone. Premium themes are Max. On other
  plans they show as locked, and choosing one opens the "Max feature" prompt
  ("Premium themes — tiled and animated backgrounds — are part of Max"). See
  [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **No flash on load.** Themes are part of the app itself, so the right theme
  is there from the first moment, without a flash of the default.
- **An unknown theme** (for example one that has been retired) falls back to
  Classic.
- **Reduced motion.** Animation in the app (the tap pulse, modelling pointers,
  and animated backgrounds in M4) respects the device's "reduce motion"
  accessibility setting. The app also has its own per-profile reduce-motion
  setting, but no switch for it in Settings yet. A **Reduce motion** switch
  per profile is being added with the animated themes in M4
  ([MOS-64](https://linear.app/mo-intelligence/issue/MOS-64)).
- **Admin control.** Mo Speech's admins decide which themes exist and which
  plan each belongs to. See [FEAT-407](FEAT-407-themes-admin.md).

## Where it lives

- The themes themselves (one file each): `convex/data/themes/`
- Looking a theme up in the app: `lib/themes/registry.ts`
- Applying a theme to the page: `app/contexts/ThemeContext.tsx`, with all
  theme colours declared in `app/globals.css`
- The picker in Settings: `app/components/app/settings/ui/ThemePicker.tsx`

## Links

- **Applies to:** every page
- **Related:** [FEAT-106 Settings](FEAT-106-settings.md) ·
  [FEAT-108 Pricing & tiers](FEAT-108-pricing-and-tiers.md) ·
  [FEAT-301 Instructor & student views](FEAT-301-instructor-and-student-views.md)
  · [FEAT-407 Themes admin](FEAT-407-themes-admin.md)
