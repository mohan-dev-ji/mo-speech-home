# Phase 28 — Library sentence previews render blocks

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A talker-saved sentence previews on the public library page as the phrase blocks an installer actually gets, instead of a flat row of loose tiles with empty captions.

**Architecture:** Two fields the module already stores — `units` and `playback` — start being returned by `getModuleDetail`, and the marketing page renders them through the app's own `CompositionBlock`. No schema change, no publish change, no new component: `blocksFromUnits` is a pure function that already builds `/api/assets` URLs, and `CompositionBlock` with no `onTap`/`active` renders as plain divs.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Convex 1.x · next-intl v4

**Spec:** `docs/superpowers/specs/2026-08-17-library-sentence-blocks-design.md`
**Relevant ADRs:** ADR-014 (content modules), ADR-015 (`slots[]` vs `units[]`), ADR-016 (variants)

## Global Constraints

- **No test runner exists in this repo, and you must not add one.** The gate is `npx tsc --noEmit -p tsconfig.json` filtered to the touched files, `npx eslint <files>`, then browser verification.
- **`tsc` has 4 pre-existing unrelated errors** — three stale `.next/types/validator.ts` module-not-found entries and one `lib/stripe.ts` API-version mismatch. Never expect a clean exit; grep for the files you touched and expect **no output**.
- **`convex/contentModules/detail.ts` has 1 pre-existing eslint error** — `no-assign-module-variable` at its `const module = ...`. Not yours; do not fix it.
- **UI copy:** never hard-code strings; keys go in `messages/en.json` only. This task needs no new keys.
- **Styling is deliberately provisional on this surface.** Reuse `CompositionBlock` as-is. Its `var(--theme-*)` resolve to the `:root` Defaults on marketing (`globals.css` is imported by the root layout; `ThemeProvider` mounts only inside `AppProviders`), and the phrase box's zinc is already a plain JS constant. **CLAUDE.md rule 5 governs AAC UI, not the marketing site** — a hex literal or an existing marketing background class would be acceptable here, though this plan needs neither. The marketing design system comes in a later pass.
- **Blocks stay light in dark mode.** That is the decision, not an oversight: SymbolStix art is line drawing that needs a light ground, and the preview should look like what the installer gets. Do not add dark-mode variants.
- **Do not modify `CompositionBlock`, `blocksFromUnits`, the schema, or anything in the publish/install paths.**
- **The owner keeps a dev server on http://localhost:3000.** Do **not** start your own with `npm run dev`. If `:3000` is not responding, stop and ask rather than starting one — this repo's Convex env is wired to the running deployment. **Never run `npx convex dev`** — verify Convex types with `npx tsc -p convex/tsconfig.json`.
- **Browser verification uses signed-in Chrome** (the `claude-in-chrome` tools). The library pages are public, but use the same browser for consistency.
- **Work on `main`.** Do not create a branch. Stage only the two paths the commit lists — never `git add -A`.

---

### Task 1: Return the composition, and render it as blocks

**Files:**
- Modify: `convex/contentModules/detail.ts` (the `sentences` array type ~line 89; the sentences branch ~line 156)
- Modify: `app/components/marketing/sections/ModuleDetailContent.tsx` (imports ~line 23; `SymbolTile` ~line 61; the sentences item type ~line 50; the sentences section ~line 225)

**Interfaces:**
- Consumes: `blocksFromUnits(units: CompositionUnitClient[], resolveLang: string): PlayBlock[]` and `type CompositionUnitClient`, both exported from `@/app/components/app/shared/ui/composition/blocks`. `CompositionBlock({ block, active?, onTap?, size? })` from `@/app/components/app/shared/ui/composition/CompositionBlock`. `ContentItems["sentences"]` is `LibraryPackSentence[]` (`convex/data/_shared/types.ts:182`), whose `units?: CompositionUnit[]` matches the schema's `compositionUnit` field-for-field — so it assigns to `CompositionUnitClient[]` with no adapter.
- Produces: nothing downstream — single-task plan.

---

- [ ] **Step 1: Widen the query's return type**

In `convex/contentModules/detail.ts`, the `sentences` accumulator is declared as:

```ts
    let sentences: Array<{
      name: Record<string, string>;
      text: Record<string, string> | string | null;
      // ADR-016 variant metadata. A module ships EVERY language variant (that is
      // how install seeds each board), so the library page has to collapse them
      // to one row per logical sentence — and it cannot without these two.
      authoredLanguage: string | null;
      variantGroupKey: string | null;
      slots: Array<{ order: number } & ResolvedSymbol>;
    }> = [];
```

Add two fields after `variantGroupKey`:

```ts
      // ADR-015 — the real shape of a talker-saved sentence. `slots` is the flat
      // back-compat mirror; a block sentence's phrase grouping lives only here,
      // so without these the library previews it as a row of loose tiles.
      units: NonNullable<ContentItems["sentences"][number]["units"]> | null;
      playback: NonNullable<ContentItems["sentences"][number]["playback"]> | null;
```

- [ ] **Step 2: Return them**

In the same file's sentences branch, the mapper currently opens:

```ts
        (module.items as ContentItems["sentences"]).map(async (sent) => ({
          name: sent.name,
          text: sent.text ?? null,
          authoredLanguage: sent.authoredLanguage ?? null,
          variantGroupKey: sent.variantGroupKey ?? null,
```

Add the two fields directly below `variantGroupKey`:

```ts
          units: sent.units ?? null,
          playback: sent.playback ?? null,
```

Change nothing else — the `slots` resolution below stays exactly as it is, because fluent sentences still render from it.

- [ ] **Step 3: Type-check Convex**

```bash
npx tsc -p convex/tsconfig.json --noEmit
```

Expected: no errors.

- [ ] **Step 4: Import the block renderer on the marketing page**

In `app/components/marketing/sections/ModuleDetailContent.tsx`, add below the existing `collapseModuleVariants` import:

```tsx
import { CompositionBlock } from "@/app/components/app/shared/ui/composition/CompositionBlock";
import { blocksFromUnits, type CompositionUnitClient } from "@/app/components/app/shared/ui/composition/blocks";
```

The file is already `"use client"`, so importing another client component is a plain import.

- [ ] **Step 5: Widen the client-side sentence type**

The `sentences` entry in the `ModuleDetail` type reads:

```tsx
  sentences: Array<{
    name: LocalisedString;
    text: LocalisedString | string | null;
    // ADR-016 variant metadata — a module ships every language variant.
    authoredLanguage: string | null;
    variantGroupKey: string | null;
    slots: Symbol[];
  }>;
```

Add the two fields after `variantGroupKey`:

```tsx
    // ADR-015 — a block sentence's phrase grouping. `slots` is the flat mirror.
    units: CompositionUnitClient[] | null;
    playback: "sequence" | "fluent" | null;
```

- [ ] **Step 6: Stop rendering empty captions**

Still in the same file, `SymbolTile` ends with an unconditional caption:

```tsx
      <span className="text-caption text-foreground text-center line-clamp-2 leading-tight">
        {label}
      </span>
```

Replace it with:

```tsx
      {/* Fluent sentence slots carry no label — the app renders them image-only
          too. Rendering the span anyway left an empty element reserving layout
          space under every sentence tile. Categories and lists always have a
          label, so they are unaffected. */}
      {label && (
        <span className="text-caption text-foreground text-center line-clamp-2 leading-tight">
          {label}
        </span>
      )}
```

- [ ] **Step 7: Render blocks for block sentences**

The sentences section currently maps straight to slot tiles:

```tsx
            {sentences.map((sent, si) => (
              <div key={si} className="flex flex-col gap-3">
                <h3 className="text-body font-medium text-foreground">
                  {sentenceTitle(sent)}
                </h3>
                <div className="flex flex-wrap gap-3">
                  {sent.slots.map((slot) => (
                    <div key={slot.order} className="w-20 shrink-0">
                      <SymbolTile symbol={slot} locale={locale} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
```

Replace that whole `{sentences.map(...)}` expression with:

```tsx
            {sentences.map((sent, si) => {
              // A talker-saved sentence groups words into phrase units. Requires
              // BOTH playback and non-empty units, mirroring the app's
              // isSequenceRow — a legacy row with one but not the other falls
              // back to flat rather than rendering something half-formed.
              //
              // The language is the SENTENCE's authoredLanguage, not the page
              // locale. Collapsing already picked this locale's variant where one
              // exists, so they normally match; they differ exactly when a locale
              // has no variant, and there the authored language is correct — the
              // alternative resolves an English variant's units against `es` and
              // yields a half-Spanish sentence in English word order.
              const blocks =
                sent.playback === "sequence" && sent.units && sent.units.length > 0
                  ? blocksFromUnits(sent.units, sent.authoredLanguage ?? DEFAULT_LOCALE)
                  : null;
              return (
                <div key={si} className="flex flex-col gap-3">
                  <h3 className="text-body font-medium text-foreground">
                    {sentenceTitle(sent)}
                  </h3>
                  {blocks ? (
                    <div className="flex flex-wrap items-end gap-3">
                      {blocks.map((b, i) => (
                        <CompositionBlock key={i} block={b} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {sent.slots.map((slot) => (
                        <div key={slot.order} className="w-20 shrink-0">
                          <SymbolTile symbol={slot} locale={locale} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
```

`CompositionBlock` is passed neither `onTap` nor `active`, so it renders as plain `div`s with no play glow and no button semantics — correct for a static preview.

- [ ] **Step 8: Type-check the app**

```bash
npx tsc --noEmit -p tsconfig.json 2>&1 | grep -E "ModuleDetailContent|contentModules/detail|composition/blocks|CompositionBlock"
```

Expected: **no output**. (The 4 pre-existing unrelated errors are filtered out — see Global Constraints.)

- [ ] **Step 9: Lint**

```bash
npx eslint app/components/marketing/sections/ModuleDetailContent.tsx convex/contentModules/detail.ts
```

Expected: clean on `ModuleDetailContent.tsx`; on `detail.ts` expect **exactly the 1 pre-existing `no-assign-module-variable` error** and nothing else.

- [ ] **Step 10: Browser verification**

In signed-in Chrome on **http://localhost:3000**. The published `everyday-phrases` module has one block sentence ("I want to go to sleep" — a phrase block plus `to` and `sleep`) and three fluent ones.

| Do this | Expected |
|---|---|
| `/en/library/modules/sentences/everyday-phrases` | "I want to go to sleep" renders as a **phrase block** (grouped zinc box with a name pill) plus **2 word cards** — not 5 loose tiles |
| Same page, the other three sentences | Flat tiles as before, with **no empty caption gap** beneath them |
| `/es/library/modules/sentences/everyday-phrases` | Still **4** sentences with Spanish titles — the variant collapse is undisturbed |
| Toggle the marketing dark mode (moon icon, top right) | Page chrome inverts; the blocks stay light and the symbols stay legible |
| `/en/library/modules/lists/self-help` | Unchanged — captions still read "lift up toilet seat", "use toilet", "flush toilet" |
| Any categories module | Unchanged — tiles still captioned |

A quick way to confirm the first row without eyeballing:

```js
Array.from(document.querySelectorAll('h3')).map(h => h.textContent.trim() + ' → ' + h.parentElement.querySelectorAll('img').length + ' imgs')
```

"I want to go to sleep" should still report 5 images — the same five symbols — but they must now be **grouped**: three inside the phrase box and two as separate cards.

If you cannot reach the pages, say so and mark NOT VERIFIED — do not infer results.

- [ ] **Step 11: Commit**

```bash
git add convex/contentModules/detail.ts app/components/marketing/sections/ModuleDetailContent.tsx
git commit -F- <<'MSG'
feat(library): preview block sentences as blocks, not loose tiles

Sentences were the only tree whose module carried structure the public page
discarded. It stores units + playback — ADR-015's real shape for a
talker-saved sentence — but the query returned neither, so the page rendered
the flat slots mirror and a phrase block came out as loose tiles.

The same branch passed no label to resolveSymbolRef and published slots carry
imagePath rather than symbolId, so every sentence tile rendered an empty
caption span. Categories and lists pass one; now the span only renders when
there is a label, which also matches the app rendering fluent slots
image-only.

Blocks resolve against the sentence's authoredLanguage, not the page locale:
collapsing already picked this locale's variant where one exists, and where
none does the authored language is what keeps the fallback coherent.

Reuses the app's CompositionBlock as-is — no onTap or active, so it renders
as plain divs.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
```

---

## Done criteria

- A block sentence previews as its phrase blocks plus word cards, matching what the app shows an installer.
- Fluent sentences keep flat tiles with no empty caption gap.
- The Spanish page still shows 4 sentences with Spanish titles.
- Lists and categories sections are untouched, captions intact.
- `npx tsc --noEmit -p tsconfig.json` reports nothing beyond the 4 known pre-existing errors.

## Follow-ups (explicitly out of scope)

- A marketing design system, or making blocks follow the marketing palette in dark mode.
- Rendering the authoring-only slot `label` phase-25 added.
- Playback or tap-to-play on the marketing site.
- Anything in the publish or install paths.
