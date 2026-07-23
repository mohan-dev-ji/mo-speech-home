# Phase 15.5 — Composed-content language variants + versioning bug-fix pass

> **Status:** ✅ SHIPPED (archived 2026-07-22). [ADR-016](../../decisions/ADR-016-composed-content-language-variants.md) marks this plan "Implemented by"; the variant model (`variantGroupId`, `createSentenceVariant`) lives in `convex/profileSentences.ts` / `profilePhrases.ts`. **Prep authored:** 2026-07-11 (end of the Phase 15 session).
> **Predecessor:** Phase 15 shipped (bilingual symbols, Tone TTS, language-switch foundation). Its plans are archived in [`_done/phase-15-language-design.md`](phase-15-language-design.md) (design + spike findings + the *Deferred* section this plan expands), [`_done/phase-15-implementation.md`](phase-15-implementation.md), [`_done/phase-15-figma-companion.md`](phase-15-figma-companion.md).
>
> **This is a self-contained plan for a fresh session.** It is a SCAFFOLD: the variant data model is deliberately left to a brainstorm (see "Open design question") — do that FIRST, before any schema change.

## Goal

Let an instructor author **per-language variants** of composed content (phrases, sentences) so each language has correct **symbol order, text, and audio** — not machine-translated word order. Prove the app **retains a distinct version per language** for every content type, in **all switch directions** (en↔es↔hi). Along the way, fix the versioning/i18n bugs surfaced in the Phase 15 review and rebuild the mis-translated default sentences natively.

This is a **test-and-fix session**: build fixtures → switch languages → observe → fix code → re-test. The [Test matrix](#test-matrix) is the tracker.

## Governing principle (unchanged from Phase 15)

Order-free content (symbols/words) translates live. **Structure-bound content (phrases, block/sequence sentences) is re-authored per language, never machine-translated in place** — word order + morphology are language-specific. Fluent whole-text sentences hold one translated string and keep resolving live.

## Open design question — RESOLVED by [ADR-016](../../decisions/ADR-016-composed-content-language-variants.md) (2026-07-12)

The brainstorm is done. See **[ADR-016 — Composed-Content Language Variants](../../decisions/ADR-016-composed-content-language-variants.md)** for the full contract. Summary of the decisions:

1. **Data model** — **Option A: `variantGroupId` sibling rows.** A variant is another `profileSentences`/`profilePhrases` row of the identical shape, tagged with its own `authoredLanguage`, linked by a shared `variantGroupId`. The group id **is the source row's `_id`**. Lazy grouping (a group materialises only when a 2nd language is authored) → **zero migration**; legacy rows are singletons. Siblings copy the source's `folderId`/`order` and stay in sync on reorder.
2. **Resolution** — **client-side group collapse** (board `language` is client context; same reactive mechanism as live text translation / the search page). Show the sibling whose `authoredLanguage === boardLanguage`, else the source. Switching language re-collapses instantly, **no Convex re-query**.
3. **Badge** — **uniform across all composed types:** show "Made in <lang>" iff the shown row's `authoredLanguage !== boardLanguage`. This **supersedes** the Phase 15 `isSequenceRow`-only condition — fluent sentences + phrases now show the badge too.
4. **Scope** — variants apply to **phrases + all sentence types** (per-language re-arranged symbols). Fluent sentences also get a symbol-arrangement variant; their audio stays one whole-utterance translated string (unchanged, keyed off `playback`). Lists translate live (no variants).
5. **Authoring entry** — badge → **modal** (see ADR-016 Addendum B), reusing the composition builder, source shown as reference. Two paths: **(1) Edit manually** (type target text — full audio pipeline: generate TTS / record), **(2) Translate to <lang>** (MT text + target-voice audio, then human re-orders symbols). On save: create sibling with shared `variantGroupId`, copied `folderId`/`order`.
6. **MT-as-assist** — **IN scope for 15.5** (ADR-016 Addendum C reverses the original deferral). It is the *accessibility path*: an instructor who can't type the target script authors by re-ordering symbols while MT supplies text+audio. Human always re-orders/reviews — MT never ships unreviewed.
7. **Labels vs structures** (ADR-016 Addendum D) — folder/group/module **names** are order-free labels: one multi-key record, translate live. Default module names ship pre-translated (bug #3). User-created folder names get a **one-tap "Translate name"** auto-fill. **Modules do NOT get variants** — only the composed content inside them does.

> **Bug #1 seam (see ADR §Consequences):** fix "stamp `authoredLanguage` on every create path" in the standalone bug pass; the "fluent should also show the badge" half lands with the §2 resolution work — don't touch badge scope in the bug pass.

## Known bugs to fix (triaged 2026-07-11 — hypotheses, verify before fixing)

Use `superpowers:systematic-debugging` on each — reproduce, find root cause, then fix.

1. **"Made in HI" badge missing** on an instructor-made HI sentence (EN badge works).
   - *Hypotheses:* (a) the HI sentence never got `authoredLanguage: "hi"` stamped (created before Task 4 stamping, or a create path that doesn't pass it); (b) it's a *fluent* sentence — the badge is block/sequence-only by design. Check the row's `authoredLanguage` + `playback` in Convex first.

2. **Block sentence audio persona split** — on a HI **female** board, an EN block sentence plays the *whole-block* clip in English **female** but the *stepped units* in English **male**.
   - *Hypothesis:* the per-unit steps play a **stored authoring-time `audioKey`** (English male = the default at creation) while the fluent/whole path **re-resolves to the current persona** (female). Two voice paths disagree. Look at `CompositionPlayModal.playOne` (uses `b.audioKey` if present) vs the fluent/`voiceForLanguage` path. Likely fix: re-resolve unit voice to persona when the stored clip's persona ≠ current, or stop trusting a stale `audioKey` across persona changes.

3. **List group/folder names stuck in English** — list *items* flip languages correctly; the **folder/group name** does not (e.g. "Going to school" in the Going Places module stays EN while siblings flip).
   - *Hypothesis:* the list/folder **name** isn't a localised record (or that folder was seeded EN-only) while items carry localised records. Check `profileLists.name` / `profileFolders` name typing + how defaults are seeded. Likely small.

## Follow-up findings (2026-07-12 owner test on HI board) — triage

Surfaced while eyeballing the bug-pass fixes. C/E are standalone; C/D feed the variant/dropdown work.

- **A — bug #3 resolved as designed.** Only `source:"module"` folders flip (all now carry es/hi, verified on `wandering-marmot-955`); the owner's `source:"user"` "Going Places"/"Life skills" folders stay EN — correct, they're user content and covered by the edit-mode **Translate name** action (ADR-016 Addendum D, refined 2026-07-12: no auto-translate on create; translate icon in edit mode when the current-language key is empty, value stays keyboard-editable).

- **C — talker dropdown phrases: wrong voice ✅ + no variant affordance (→ phrase-side work).** Split into two on testing:
  - **C-2 voice ✅ FIXED (2026-07-13):** clip-less phrases were TTS'd in the board `voiceId`. Fixed on BOTH paths — `blocksFromTalker` now carries each block's resolved `locale` (sequence play), and `PersistentTalker.playItem` resolves the phrase name's locale for the immediate tap-play. EN-only phrase on a HI/ES board now speaks English in an English voice.
  - **C-1 "no label / no translate affordance":** confirmed = phrases render their **English** name (EN-only default content) with **no "Made in EN" badge and no author entry** on non-EN boards. This is not a render bug — it's that **phrases have no variant support yet**. Fold into the **phrase-side variant build** (mirror the sentence flow: `variantGroupId` on `profilePhrases`, collapse-by-board-language in the dropdown, badge→modal authoring, translate name + word labels).

- **D — core-word symbol labels: es gap. VERIFIED real (2026-07-12).** In a 300-row `profileSymbols` sample: 285 have en+es+hi, **12 have en+hi only** (missing es, e.g. `{en:"is",hi:"है"}`), 3 have en only. So the stuck core words carry Hindi but not Spanish → correct EN fallback on an es board. **Not a code bug** — the resolution is right; the data is missing `es`. Fix = an `es` symbol-translation run on the missing-es rows via the existing pipeline (ADR-012/013 language ops / `symbols.applyTranslationsBatch`). Separate from the variant model (symbols translate live). Deferred unless owner wants it now.

- **E — dropdown overlay traps the talker (blocking).** When the Core-words dropdown has multiple rows, its absolutely-positioned content overlays the talker bar while open, so the talker (incl. the close affordance) can't be reached → **can't close the dropdown**. Standalone layout/z-index/positioning bug in `TalkerDropdown`. Blocking UX — fix early.

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

1. ✅ **Brainstorm** the variant data model → **ADR-016** (+ Addendum: MT-assist, labels vs structures).
2. Fix the three standalone bugs. Each: systematic-debug → fix → verify.
   - ✅ **Bug #2** (audio persona split) — fixed in `blocks.ts` (`recordingKey`: stepped units re-resolve to current persona; only recordings play verbatim).
   - ✅ **Bug #1 (stamping half)** — unstamped create paths fixed (`HomeContent` sentence, `TalkerDropdown` phrase + `createProfilePhrase` arg). Badge-visibility half → step 4 (coupled to variant resolution, ADR-016 §Consequences).
   - 🟡 **Bug #3** (module names EN-only) — root cause confirmed (17 EN-only `libraryModules` names). Fix = backup → migrate `libraryModules` + backfill installed `profileFolders`/`profileCategories` → re-export JSON. Translations owner-approved 2026-07-12.
3. Schema + resolution for linked variants (per ADR §1/§2). Backup before schema change.
4. Badge → **modal** authoring (ADR-016 Addendum B): manual path + **MT-assist** (translate text + target-voice audio → human re-orders). Broaden badge to all composed types (fluent included — bug #1 visibility half). Reactive switch (search-page pattern).
5. **Labels**: one-tap "Translate name" auto-fill for user folder/group names (ADR-016 Addendum D).
6. Backup → nuke old MT sentences → rebuild native defaults (doubles as fixtures 1–12).
7. Walk the test matrix in all directions; fix as bugs surface; sign off each cell.

## Verify / working constraints (same as Phase 15)

- Work on `main`, commit per step. `convex dev` auto-pushes on `main`; dev server already running — don't start `npm run dev`/`npx convex dev`.
- No test harness: `tsc` (`npx tsc --noEmit`, ignore pre-existing `lib/stripe.ts`; `npx tsc -p convex/tsconfig.json --noEmit`) + lint + manual on the running app.
- i18n: new UI keys → `messages/en.json` only. Theme tokens, never hard-coded colours/spacing.
- Backup before the schema change (step 3) AND the sentence nuke (step 5).
