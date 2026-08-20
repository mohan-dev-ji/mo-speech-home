# Library sentence previews render blocks — design

**Status:** approved design (brainstorming complete) · **Owner:** Mo · **Written:** 2026-08-17
**Context:** MOS-13 (Phase 4 · rebuild defaults for marketing). Found while fixing the library's
sentence-variant collapse: sentences are the only tree whose module carries structure the public
library page throws away.
**Touches:** ADR-014 (content modules), ADR-015 (`slots[]` vs `units[]`)

---

## 1. Problem

**Sentences are the only tree whose module carries information the library page discards.**

Categories and lists are flat by nature — a row of symbol tiles is a faithful preview of what an
installer gets. A sentence is not necessarily flat: a talker-saved sentence groups words into phrase
units, and ADR-015 is explicit that `units[]` is the real shape while `slots[]` is the flattened
mirror kept for back-compat.

Two visible symptoms, one cause — `getModuleDetail`'s sentences branch returns less than the other
two trees:

- **Block sentences render flat.** The module *stores* `units` and `playback`
  (`convex/schema.ts:269-270`), the query returns neither, and the page renders `slots`. Measured on
  the published `everyday-phrases` module: "I want to go to sleep" shows as **5 loose tiles**. In the
  app it is one phrase block ("I want to go") plus `to` and `sleep`.
- **Sentence tiles render empty captions.** The branch calls
  `resolveSymbolRef(ctx, slot.symbolId, undefined, slot.imagePath, undefined)` — no label — and
  published slots carry `imagePath` rather than `symbolId`, so the label resolves to `""`. Categories
  pass `labelOverride`, lists pass the item description; checked against `lists/self-help`, whose
  tiles read "lift up toilet seat", "use toilet". The sentences section renders empty `<span>`s that
  still occupy layout space.

**Not a problem, so nobody chases it:** only sentences and phrases carry `variantGroupId`. Categories
and lists have no variant concept, and that is ADR-016 working as designed — composed content is
re-authored per language, flat content translates in place.

## 2. Decision

### 2.1 Block sentences render as blocks

A sentence with `playback === "sequence"` and non-empty `units` renders through the **same
`CompositionBlock` the app uses**: phrase units as the grouped zinc box with its name pill, word
units as image-over-label cards.

`CompositionBlock` without `onTap` or `active` renders as plain `div`s — no play glow, no button
semantics — so it is already usable as a static preview. `blocksFromUnits` is a pure function that
builds `/api/assets` URLs, which the marketing page already uses for its own tiles.

### 2.2 Fluent sentences keep flat tiles, minus the empty caption

Fluent sentences have no `units`, and the app renders them image-only (`ThumbnailStrip`), so flat
tiles are already a faithful preview. What goes is the empty caption: `SymbolTile` renders its
`<span>` only when the label is non-empty. Categories and lists always have a label, so they are
unaffected.

The authoring-only `label` phase-25 added to slots is **not** used here. That decision was explicit —
stored to seed the editor's symbol search, never rendered — and this is not the place to reverse it.

### 2.3 Styling is deliberately provisional

Reuse `CompositionBlock` as it is. Its `var(--theme-*)` references resolve to the `:root` Defaults on
marketing (`globals.css` is imported by the **root** layout, while `ThemeProvider` mounts only inside
`AppProviders`), and the phrase box's zinc palette is already a plain JS constant from
`getCategoryColour('zinc')`. So no new colour values are needed.

Where something does need a value, a hex literal or an existing marketing background class is
acceptable **on this surface**. CLAUDE.md rule 5 governs AAC UI, where `ThemeContext` rewrites the
tokens per student profile; the marketing site has no such runtime theming and gets its own design
system in a later pass. Recorded here so a reviewer does not read it as a rule-5 violation.

**Dark mode:** blocks stay light in both modes. `--theme-symbol-bg` is `#FAFAFA` and does not follow
the marketing dark toggle. That is the deliberate choice, not an oversight: SymbolStix art is line
drawing that needs a light ground to read, and the preview should look like what the installer
actually gets. In light mode `#FAFAFA` sits against the page's existing `#F5F5F5` tiles — 2% apart.

### 2.4 Blocks resolve against `authoredLanguage`, not the page locale

`blocksFromUnits(units, sent.authoredLanguage ?? DEFAULT_LOCALE)`.

This is the app's rule (ADR-015/016): a block sentence's structure is language-specific and resolves
against the language it was authored in, never a viewer's language. Because the page already
collapses to the locale's variant these are normally the same value — but they diverge exactly when a
locale has no variant and the collapse falls back to another, and there the authored language is the
correct one.

## 3. Code shape

**Changed — `convex/contentModules/detail.ts`**
Return two more fields per sentence: `units` and `playback`. Both already stored; the query simply
never passed them. No schema change, no publish change, no new symbol resolution — published units
carry `imagePath` directly.

**Changed — `app/components/marketing/sections/ModuleDetailContent.tsx`**
- Widen the sentence item type with `units` and `playback`.
- Branch: sequence + non-empty units → `blocksFromUnits(...).map(b => <CompositionBlock block={b} />)`;
  otherwise today's flat `slots` tiles.
- `SymbolTile`: render the caption only when the label is non-empty.

Already `"use client"`, so importing `CompositionBlock` (also client) is a plain import.

**Unchanged**: `publishFolderAsModule`, the install path, `CompositionBlock` itself, `blocksFromUnits`,
the schema, and the categories/lists branches.

## 4. Edge cases

| Case | Behaviour |
|---|---|
| Fluent sentence | Flat tiles, no captions — matches `ThumbnailStrip` in the app |
| Block sentence | Blocks |
| `units` present but `playback` unset | Flat. Requires **both**, mirroring the app's `isSequenceRow` |
| `playback: "sequence"` but `units` empty | Flat — same guard |
| Phrase unit with no words | `CompositionBlock` already renders one empty tile |
| Unit with no `imagePath` | `CompositionBlock`'s existing placeholder |
| Category / list tiles | Unchanged — they always have a label, so the caption still renders |
| Long block sentence | `CompositionBlock`'s phrase box already wraps rather than overflowing |

## 5. Verification

No test runner (see the phase-24 spec §6; phase-17 forbids adding one). Gate is
`npx tsc --noEmit -p tsconfig.json` grep-filtered to the touched files — the baseline carries 4
pre-existing unrelated errors — plus `npx eslint`, then signed-in Chrome on `:3000`.

| Do this | Expected |
|---|---|
| `/en/library/modules/sentences/everyday-phrases` | "I want to go to sleep" renders as a phrase block + 2 word cards, **not** 5 loose tiles |
| Same page, the other three sentences | Fluent: flat tiles with **no** empty caption gap under them |
| `/es/...` same module | Still 4 sentences, Spanish titles — the variant collapse is not disturbed |
| Toggle marketing dark mode | Blocks stay light and legible; page chrome inverts |
| `/en/library/modules/lists/self-help` | Unchanged — captions still read "lift up toilet seat" etc. |
| A categories module | Unchanged |

## 6. Out of scope

- A marketing design system, or making blocks follow the marketing palette (§2.3 — later pass).
- Rendering the authoring-only slot `label` (§2.2).
- Playback or tap-to-play on the marketing site.
- Anything in the publish or install paths.
