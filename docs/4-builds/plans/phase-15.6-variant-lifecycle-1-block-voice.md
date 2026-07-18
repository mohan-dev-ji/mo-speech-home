# Variant Lifecycle — Stage 1: Block-voice consistency — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement task-by-task. Steps use `- [ ]` checkboxes.
> **Design spec:** [`docs/superpowers/specs/2026-07-18-language-variant-lifecycle-design.md`](../../superpowers/specs/2026-07-18-language-variant-lifecycle-design.md).
> **This is Stage 1 of 4.** Roadmap: **(1) block-voice consistency ← this plan** · (2) fork-on-edit (composed content) · (3) revert (edit-toolbar icon, all surfaces) · (4) delete → whole-item + confirm. Stages 1 & 3 are the low-risk pair the spec ships/validates before the behaviour-changing Stages 2 & 4.

**Goal:** Make a saved composition (block/sequence sentence) speak **entirely in its collapsed row's one authored language** (board-accent), instead of resolving each block's voice independently — which today makes word blocks speak the translation while phrase blocks speak the origin text in the board accent.

**Architecture:** A one-line-per-block change in `blocks.ts`: each play block carries the **composition's single `authoredLanguage`** (`resolveLang`) as its `locale`, rather than its own per-field `resolvedLocale`. `CompositionPlayModal` already voices each block via `voiceForLanguage(block.locale)`, so this alone fixes the split. The live talker bar (`blocksFromTalker`), which legitimately mixes languages, is untouched.

**Tech Stack:** Next.js 16 / React 19 / TypeScript. No Convex, schema, or i18n changes. No MT.

## Global Constraints (verbatim from project rules)
- **No test harness.** Verify with `npx tsc --noEmit` (ignore pre-existing `lib/stripe.ts` + `.next/dev/types` generated staleness) AND `npx tsc -p convex/tsconfig.json --noEmit`, plus manual on the running app (dev server owner-managed — do NOT start it; do NOT run `npx convex dev`). Node 20 for any convex CLI: `source ~/.nvm/nvm.sh && nvm use 20.17.0`.
- **Theme tokens only**; **no hard-coded UI copy** (N/A this stage — no new strings).
- **Commit per task.**

## Background / decisions (owner-approved in brainstorm)
- **Board-accent voice model:** a forked/localised item speaks in ITS board's voice; an un-forked origin fallback speaks in the origin voice + shows "Made in". A saved composition is one authored language per variant row → all its blocks share that voice.
- **Retroactive by design:** existing partially-translated variants will now speak entirely in their board accent. No migration (spec §6).
- **Root cause fixed here:** `blocksFromUnits` set each block's `locale` from its own field's `resolvedLocale`, so within one Hindi variant a word unit translated to Hindi resolved to `hi` (Hindi voice) while a phrase name still in English resolved to `en` (English voice) — the word-vs-phrase split the owner observed.

## Reuse map (existing code — DO NOT reinvent)
- `blocksFromUnits(units, resolveLang)` → `app/components/app/shared/ui/composition/blocks.ts:88` — builds play blocks from saved units; **the only function this plan changes**.
- `blocksFromTalker(items, resolveLang)` → same file `:55` — live talker bar; **leave as-is** (mixed-language board content keeps per-item `resolvedLocale`).
- `CompositionPlayModal` → `app/components/app/shared/modals/CompositionPlayModal.tsx:57,106` — voices each block via `b.locale ? voiceForLanguage(b.locale, personaOf(voiceId)) : voiceId`. **No change needed.**
- Play call site: `SentencesModeContent.tsx:1466` — `blocksFromUnits(playTarget.units!, playTarget.authoredLanguage ?? DEFAULT_LOCALE)`. So at play time `resolveLang` IS the collapsed row's `authoredLanguage`.
- Inert call sites (do NOT play through `CompositionPlayModal`, so `locale` is unused there): `SentencesModeContent.tsx:384` (edit strip render) and `:553` (read-only `seqFullText`). Safe to let `locale` change.

## File structure
- **Modify** `app/components/app/shared/ui/composition/blocks.ts` — `blocksFromUnits` block `locale`.
- **Modify** `docs/4-builds/decisions/ADR-016-composed-content-language-variants.md` — short addendum note.

---

### Task 1: Block voice follows the composition's one authored language

**Files:** Modify `app/components/app/shared/ui/composition/blocks.ts`.

- [ ] **Step 1 — phrase block `locale`.** In `blocksFromUnits`, the phrase branch currently sets:
```ts
        locale: resolvedLocale(u.name, resolveLang, DEFAULT_LOCALE),
```
Change it to carry the composition's single authored language:
```ts
        // Board-accent (Variant Lifecycle Stage 1): every block in a saved
        // composition shares the row's one authoredLanguage, so the whole
        // utterance speaks in one voice — no per-block word/phrase split.
        locale: resolveLang,
```
- [ ] **Step 2 — word block `locale`.** In the same function, the word branch currently sets:
```ts
      locale: resolvedLocale(u.label, resolveLang, DEFAULT_LOCALE),
```
Change it to:
```ts
      locale: resolveLang,
```
- [ ] **Step 3 — update the function doc comment.** Above `blocksFromUnits` (the `⚠️ Phase 15 (3c)` block), append a sentence so the intent is clear:
```
// Voice (Variant Lifecycle Stage 1): every block carries the composition's ONE
// `authoredLanguage` as its `locale` — a saved variant is a single language, so
// the whole utterance is voiced in that language's voice (board-accent), never a
// per-block mix. (Live talker blocks keep per-item locale; they mix languages.)
```
- [ ] **Step 4 — confirm `resolvedLocale` is still used.** `blocksFromTalker` still calls `resolvedLocale` (lines ~61, ~72), so the import stays. Verify no unused-import error appears in Step 5.
- [ ] **Step 5 — verify.** Run `npx tsc --noEmit 2>&1 | grep -E "^(app|lib|convex)/" | grep -v "lib/stripe.ts"` → expect no output (clean). Then the **manual matrix** on the running app (block/sequence sentences only):
  - A block sentence **translated** to the board language → plays **entirely** in the board voice (word + phrase blocks agree). ✓ the fix.
  - A block sentence **partially** translated (some units translated, some still origin) → now plays **entirely** in the board voice (previously mixed). Confirm this matches the board-accent decision.
  - A block sentence shown as **origin fallback** on a non-origin board (no variant) → `resolveLang` = source `authoredLanguage` → plays in the **origin** voice + keeps its "Made in" badge. ✓ unchanged.
  - **Fluent** sentences and **list** playback → unchanged (this task doesn't touch them).
  - Live **talker bar** playback with mixed-language items → still voices each item in its own language. ✓ unchanged.
- [ ] **Step 6 — commit.** `git commit -am "fix(variant-lifecycle): block voice follows the composition's authored language (board-accent, no per-block split)"`.

---

### Task 2: ADR note + final verify

**Files:** Modify `docs/4-builds/decisions/ADR-016-composed-content-language-variants.md`.

- [ ] **Step 1 — ADR addendum.** Append a short **Addendum H** noting: block/sequence composition playback now voices every block in the collapsed row's single `authoredLanguage` (board-accent), fixing the word-vs-phrase voice split; this is Stage 1 of the Language Variant Lifecycle model (see the design spec); retroactive, no migration.
- [ ] **Step 2 — full verify.** `npx tsc --noEmit` (excl. known-stale) + `npx tsc -p convex/tsconfig.json --noEmit` both clean.
- [ ] **Step 3 — commit.** `git commit -am "docs(variant-lifecycle): ADR-016 Addendum H — board-accent block voice (Stage 1)"`.

## Self-review notes
- **Coverage vs spec:** implements spec §3 "block-voice fix" (Stage 1 of the staging in §7). Other stages are separate plans.
- **Scope guard:** only `blocksFromUnits` block `locale` changes. `blocksFromTalker`, `CompositionPlayModal`, fluent, and list playback are untouched. No Convex/i18n/schema changes.
- **Risk:** retroactive audio change (partially-translated variants now fully board-accent) — an accepted, owner-approved consequence; verify in the manual matrix that it sounds right before moving on.
- **Next:** Stage 3 (revert, edit-toolbar icon) is the other low-risk piece and is the natural next plan; Stages 2 & 4 (fork-on-edit, delete-redefine) follow after these validate on the live app.
