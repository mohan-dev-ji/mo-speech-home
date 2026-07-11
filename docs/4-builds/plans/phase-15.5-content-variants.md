# Phase 15.5 — Composed-content language variants + versioning bug-fix pass

> **Status:** planned, not started. **Prep authored:** 2026-07-11 (end of the Phase 15 session).
> **Predecessor:** Phase 15 shipped (bilingual symbols, Tone TTS, language-switch foundation). Its plans are archived in [`_done/phase-15-language-design.md`](_done/phase-15-language-design.md) (design + spike findings + the *Deferred* section this plan expands), [`_done/phase-15-implementation.md`](_done/phase-15-implementation.md), [`_done/phase-15-figma-companion.md`](_done/phase-15-figma-companion.md).
>
> **This is a self-contained plan for a fresh session.** It is a SCAFFOLD: the variant data model is deliberately left to a brainstorm (see "Open design question") — do that FIRST, before any schema change.

## Goal

Let an instructor author **per-language variants** of composed content (phrases, sentences) so each language has correct **symbol order, text, and audio** — not machine-translated word order. Prove the app **retains a distinct version per language** for every content type, in **all switch directions** (en↔es↔hi). Along the way, fix the versioning/i18n bugs surfaced in the Phase 15 review and rebuild the mis-translated default sentences natively.

This is a **test-and-fix session**: build fixtures → switch languages → observe → fix code → re-test. The [Test matrix](#test-matrix) is the tracker.

## Governing principle (unchanged from Phase 15)

Order-free content (symbols/words) translates live. **Structure-bound content (phrases, block/sequence sentences) is re-authored per language, never machine-translated in place** — word order + morphology are language-specific. Fluent whole-text sentences hold one translated string and keep resolving live.

## Open design question — BRAINSTORM FIRST (blocks schema work)

The deferred design (from the Phase 15 spec) sketches **linked per-language variants**: one logical "sentence/phrase slot" holds a separately-authored composition per language (`en` comp + `es` comp + `hi` comp), linked by a shared slot id; `authoredLanguage` is the per-variant tag. Viewing a language shows its native variant if one exists, else the working source asset + a "Made in <lang>" badge (a valid, permanent bilingual state — not an error).

**Decisions to make in the brainstorm before touching `convex/schema.ts`:**
1. **Data model** — a `variantGroupId` on `profileSentences`/`profilePhrases` linking sibling variants? Or a parent "slot" table with child comps per language? Trade-offs: query cost, migration of existing rows, how "no variant yet" is represented.
2. **Resolution** — on language switch, how the view picks `variant[lang]` else falls back to the source asset + badge. Reference the **search page's** reactive re-query-on-`language`-change pattern (the proof it works).
3. **Authoring entry** — badge/disclaimer → **edit mode**, reusing the composition-builder components, English original visible as reference while authoring the target-language order. (Preferred over a bespoke remake modal.)
4. **MT as assist (optional, Pro+)** — offer a machine-translated fluent text as a *starting suggestion* inside the rebuild flow; instructor arranges symbols in correct order. MT never ships unreviewed. Likely out of V15.5 scope — confirm.
5. **ADR** — capture the chosen variant model as an ADR in `docs/4-builds/decisions/` before building.

## Known bugs to fix (triaged 2026-07-11 — hypotheses, verify before fixing)

Use `superpowers:systematic-debugging` on each — reproduce, find root cause, then fix.

1. **"Made in HI" badge missing** on an instructor-made HI sentence (EN badge works).
   - *Hypotheses:* (a) the HI sentence never got `authoredLanguage: "hi"` stamped (created before Task 4 stamping, or a create path that doesn't pass it); (b) it's a *fluent* sentence — the badge is block/sequence-only by design. Check the row's `authoredLanguage` + `playback` in Convex first.

2. **Block sentence audio persona split** — on a HI **female** board, an EN block sentence plays the *whole-block* clip in English **female** but the *stepped units* in English **male**.
   - *Hypothesis:* the per-unit steps play a **stored authoring-time `audioKey`** (English male = the default at creation) while the fluent/whole path **re-resolves to the current persona** (female). Two voice paths disagree. Look at `CompositionPlayModal.playOne` (uses `b.audioKey` if present) vs the fluent/`voiceForLanguage` path. Likely fix: re-resolve unit voice to persona when the stored clip's persona ≠ current, or stop trusting a stale `audioKey` across persona changes.

3. **List group/folder names stuck in English** — list *items* flip languages correctly; the **folder/group name** does not (e.g. "Going to school" in the Going Places module stays EN while siblings flip).
   - *Hypothesis:* the list/folder **name** isn't a localised record (or that folder was seeded EN-only) while items carry localised records. Check `profileLists.name` / `profileFolders` name typing + how defaults are seeded. Likely small.

## Data cleanup — nuke + rebuild default sentences (DESTRUCTIVE)

The old default sentences were machine-translated on the previous architecture **without rearranging symbol order per language** — wrong by our governing principle. Plan:
- **BACKUP FIRST** (CLAUDE.md → Backups): `npx convex export --path backups/<date>-pre-15.5-sentence-nuke.zip` before any delete.
- **Keep** all symbol categories/vocabulary. **Delete** only the mis-translated default sentences.
- **Rebuild** new default sentences natively per language as part of the test-fixture creation below (correct order/text/audio, stamped `authoredLanguage`).
- Do the nuke as its own reviewed step with the backup confirmed — not casually.

## Test matrix (the tracker)

Fill the fixture column with the specific item you create, then walk each board-language column and record: **badge** (Made in <lang> shown iff cross-language), **text** (correct symbols + order for the resolved variant), **audio** (correct language + persona: gender/age), and whether a built **variant is retained** after switching away and back.

> Consider generating an `.xlsx` version at session start for live ticking (xlsx skill) — this markdown table is the version-controlled source of truth.

### Fixtures to create (1 per type per language = 12)

| # | Type | Authored language | Fixture (fill in) |
|---|------|-------------------|-------------------|
| 1 | Phrase | EN | |
| 2 | Phrase | ES | |
| 3 | Phrase | HI | |
| 4 | Fluent sentence | EN | |
| 5 | Fluent sentence | ES | |
| 6 | Fluent sentence | HI | |
| 7 | Block/sequence sentence | EN | |
| 8 | Block/sequence sentence | ES | |
| 9 | Block/sequence sentence | HI | |
| 10 | List (+ group/folder) | EN | |
| 11 | List (+ group/folder) | ES | |
| 12 | List (+ group/folder) | HI | |

### Per-fixture checks (repeat for board = EN / ES / HI)

| Fixture | Board EN | Board ES | Board HI | Variant built? | Retained on switch-away-and-back? | Bug/notes |
|---------|----------|----------|----------|----------------|-----------------------------------|-----------|
| (1…12)  | badge / text / audio | badge / text / audio | badge / text / audio | y/n per lang | y/n | |

**Expected behaviour reference:**
- Board = authored language → **no badge**, native text/order, native voice.
- Board ≠ authored, **no variant yet** → source asset shown + **"Made in <authoredLang>"** badge; voice follows the *resolved text's* language + profile persona (Phase 15 3e/3f).
- Board ≠ authored, **variant exists** → the native variant for the board language shows (no badge), its own order/text/audio.
- **Audio persona** consistent across whole-utterance AND stepped units (bug #2).
- **Lists:** items AND group/folder name both flip (bug #3).

## Build sequence (draft — refine after brainstorm)

1. **Brainstorm** the variant data model → write the ADR.
2. Fix the three standalone bugs (independent of the variant model) — badge, audio persona, list group name. Each: systematic-debug → fix → verify.
3. Schema + resolution for linked variants (per ADR).
4. Badge → edit-mode authoring flow (reuse composition builder); reactive switch (search-page pattern).
5. Backup → nuke old MT sentences → rebuild native defaults (doubles as fixtures 1–12).
6. Walk the test matrix in all directions; fix as bugs surface; sign off each cell.

## Verify / working constraints (same as Phase 15)

- Work on `main`, commit per step. `convex dev` auto-pushes on `main`; dev server already running — don't start `npm run dev`/`npx convex dev`.
- No test harness: `tsc` (`npx tsc --noEmit`, ignore pre-existing `lib/stripe.ts`; `npx tsc -p convex/tsconfig.json --noEmit`) + lint + manual on the running app.
- i18n: new UI keys → `messages/en.json` only. Theme tokens, never hard-coded colours/spacing.
- Backup before the schema change (step 3) AND the sentence nuke (step 5).
