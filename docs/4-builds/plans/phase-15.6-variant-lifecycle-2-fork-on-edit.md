# Variant Lifecycle — Stage 2: fork-on-edit (composed content) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` checkboxes.
> **Design spec:** [`docs/superpowers/specs/2026-07-18-language-variant-lifecycle-design.md`](../../superpowers/specs/2026-07-18-language-variant-lifecycle-design.md) (§2 fork-on-edit, §2a word-unit defects).
> **Stage 2 of 4.** Roadmap: (1) block-voice ✅ · **(2) fork-on-edit ← this** · (3) revert · (4) delete→whole-item.
> ⚠️ **Behaviour-changing on a live app.** Each task ships one surface; verify (tsc + manual) before the next.

**Goal:** Editing a composed item (sentence/phrase) on a board where no board-language variant exists must **fork** a board-language variant (seeded from the source) and apply the edit to the fork — never mutate the source across boards. Also fixes the word-unit **stale-audio** bug (§2a).

**Architecture:** Reuse the existing "author-variant" pattern (`handleAuthorVariant` `SentencesModeContent.tsx:911` / `handlePhraseAuthorVariant` `TalkerDropdown.tsx:433` already do *create variant → get id → write to it*). Trigger it from any content edit instead of the badge. One choke-point per surface: wrap `persistUnits` (sequences), a `resolvePhraseTargetId` helper (phrases), and `SentenceAudioModal.handleSave` (fluent). Fork check = `(collapsedRow.authoredLanguage ?? DEFAULT_LOCALE) !== language`. `createSentenceVariant`/`createPhraseVariant` are **idempotent per (group, language)** and return the fork id.

**Tech Stack:** Next.js 16 / React 19 / TS / Convex. One small Convex arg change (fluent `text` accepts a record).

## Global Constraints (verbatim)
- **No test harness.** Verify each task: `npx tsc --noEmit 2>&1 | grep -E "^(app|lib|convex)/" | grep -v "lib/stripe.ts"` clean AND `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json --noEmit` clean. Manual matrix on the running app is the OWNER's (needs audio + board switching). Do NOT start a dev server / `npx convex dev`.
- **No hard-coded UI copy** (none new here). **Theme tokens only.** **Commit per task.**
- **Board-accent model:** a forked variant's `authoredLanguage === language`, so text keyed under `[language]` is correct; do NOT add a separate "keying" fix (spec §2a item 1 — de-scoped).

## Reuse map (exact, verified)
- Collapse: `collapseVariants` / `variantGroupKey` → `lib/languages/variants.ts`. Every UI list (`sentences`, `phraseList`) is already collapsed, so `row.authoredLanguage` + `row._id` are in scope in handlers.
- Fork mutations (idempotent, return fork id): `api.profileSentences.createSentenceVariant` (bound as `createVariant`, `SentencesModeContent.tsx:792`), args `{sourceSentenceId, authoredLanguage, text?}`; `api.profilePhrases.createPhraseVariant` (bound as `createPhraseVariant`, `TalkerDropdown.tsx:158`), args `{sourcePhraseId, authoredLanguage}`.
- Sequence write choke-point: `persistUnits(sentenceId, units)` `SentencesModeContent.tsx:1029-1032` → `updateUnits` (`updateProfileSentenceUnits`).
- Word-unit save: `handleUnitSave` `SentencesModeContent.tsx:1071-1090`; `ListItemSaveResult` carries `activeAudioSource: 'default'|'generate'|'record'` and `audioPath`.
- Fluent edit: `SentenceAudioModal.handleSave` `app/components/app/sentences/modals/SentenceAudioModal.tsx:170-207` (non-override branch: `renameSentence` + `updateAudio`).
- Phrase edits: `TalkerDropdown.tsx` handlers `:368` `handleRenamePhrase`, `:374` `handleRemovePhraseWord`, `:383` `handleReorderPhraseWord`, `:392` `handlePhraseWordSave`, plus phrase-audio `saveOverride` `:847`. All resolve `p._id` from the collapsed `phraseList` via `findPhrase` `:342`.

## File structure
- **Modify** `app/components/app/sentences/sections/SentencesModeContent.tsx` — `persistUnits` fork wrap + `handleUnitSave` audio invalidation.
- **Modify** `app/components/app/shared/ui/TalkerDropdown.tsx` — `resolvePhraseTargetId` + 5 handlers.
- **Modify** `app/components/app/sentences/modals/SentenceAudioModal.tsx` — fluent fork + record text; **Modify** `convex/profileSentences.ts` — `updateProfileSentenceAudio.text` accepts a record.
- **Modify** `docs/4-builds/decisions/ADR-016-composed-content-language-variants.md` — Addendum I.

---

### Task 1: Sequence-sentence fork-on-edit + word-unit audio invalidation

**Files:** Modify `app/components/app/sentences/sections/SentencesModeContent.tsx`.

- [ ] **Step 1 — wrap `persistUnits` to fork.** Replace `persistUnits` (`:1029-1032`) with an async version that forks when the target row isn't a board variant, then writes to the fork:
```tsx
async function persistUnits(sentenceId: Id<'profileSentences'>, units: CompositionUnitClient[]) {
  const row = sentences?.find((s) => s._id === sentenceId);
  // Fork-on-edit: editing a fallback (source/other-language) row on this board
  // creates/reuses the board-language variant (idempotent) and writes to IT, so
  // the source is never mutated from another board.
  const targetId =
    row && (row.authoredLanguage ?? DEFAULT_LOCALE) !== language
      ? await createVariant({ sourceSentenceId: row._id, authoredLanguage: language })
      : sentenceId;
  const reindexed = units.map((u, i) => ({ ...u, order: i }));
  await updateUnits({ profileSentenceId: targetId, units: reindexed });
}
```
(Callers `handleRemoveUnit`/`handleReorderUnits`/`handleAddPhrase`/`handlePhraseChange`/`handleUnitSave` call `persistUnits` fire-and-forget — leave them as-is; `async` is compatible. `DEFAULT_LOCALE` + `createVariant` + `updateUnits` are already in scope.)
- [ ] **Step 2 — word-unit audio invalidation** in `handleUnitSave` (`:1071-1090`). Drop a carried-forward stale clip when the text changed and the user didn't deliberately set audio this edit. Replace the `audioPath` spread:
```tsx
    const prev = unitsOf(unitEditTarget.sentenceId)[unitEditTarget.unitIndex];
    const prevLabel = prev?.kind === 'word' ? displayString(prev.label, language, DEFAULT_LOCALE) : '';
    const textChanged = !!label && label !== prevLabel;
    // A carried-forward clip (activeAudioSource 'default') no longer matches new
    // text → drop it so playback re-synthesizes the new text in the board voice
    // (§2a). Deliberately recorded/generated audio this edit is kept.
    const keepAudio = result.activeAudioSource === 'record' || result.activeAudioSource === 'generate';
    const audioField = result.audioPath && (!textChanged || keepAudio) ? { audioPath: result.audioPath } : {};
    const wordUnit: CompositionUnitClient = {
      kind: 'word',
      order: 0,
      ...(result.imagePath ? { imagePath: result.imagePath } : {}),
      ...audioField,
      ...(label ? { label: { [language]: label } } : {}),
    };
```
(Removes the old `...(result.audioPath ? { audioPath: result.audioPath } : {})` line. `displayString`/`DEFAULT_LOCALE` already imported.)
- [ ] **Step 3 — verify.** tsc (app + convex) clean. Manual: on a HI board, a sequence sentence with no HI variant → edit a unit (reorder / add / edit word text) → a HI variant is created, the EN source is unchanged on the EN board. Editing a word's text → it now speaks the new text in the HI voice (no stale "raat ko khana"). Commit: `git commit -am "feat(variant-lifecycle): sequence fork-on-edit + word-unit stale-audio invalidation"`.

---

### Task 2: Standalone-phrase fork-on-edit (TalkerDropdown)

**Files:** Modify `app/components/app/shared/ui/TalkerDropdown.tsx`.

- [ ] **Step 1 — shared target resolver.** Add near `findPhrase` (`:342`):
```tsx
// Fork-on-edit (Variant Lifecycle Stage 2): editing a phrase whose collapsed row
// isn't a board-language variant creates/reuses the board variant (idempotent) and
// returns its id, so edits never mutate the source across boards.
async function resolvePhraseTargetId(phrase: { _id: Id<'profilePhrases'>; authoredLanguage?: string }) {
  return (phrase.authoredLanguage ?? DEFAULT_LOCALE) !== language
    ? await createPhraseVariant({ sourcePhraseId: phrase._id, authoredLanguage: language })
    : phrase._id;
}
```
- [ ] **Step 2 — route the 4 word/name handlers through it.** Make each async and resolve the target first. `handleRenamePhrase` (`:368`):
```tsx
async function handleRenamePhrase(id: Id<'profilePhrases'>, current: Record<string, string>, next: string) {
  const phrase = findPhrase(id); if (!phrase) return;
  const targetId = await resolvePhraseTargetId(phrase);
  updateProfilePhraseName({ profilePhraseId: targetId, name: { ...current, [language]: next } })
    .catch((e) => console.error('[TalkerDropdown] rename phrase failed', e));
}
```
`handleRemovePhraseWord` (`:374`), `handleReorderPhraseWord` (`:383`), `handlePhraseWordSave` (`:392`): after the existing `const phrase = findPhrase(...)` guard, add `const targetId = await resolvePhraseTargetId(phrase);` and change the `updateProfilePhraseWords({ profilePhraseId: <phraseId>, ... })` call to use `targetId` (make the function `async`). Word arrays are already derived from `phrase.words` (the collapsed row = source), so they seed the fork correctly.
- [ ] **Step 3 — phrase-audio override.** In the phrase-audio `saveOverride` (`:847`), resolve the target the same way before its `updateProfilePhraseName`/`updateProfilePhraseAudio` calls (it already has the phrase in scope; add `const targetId = await resolvePhraseTargetId(phrase);` and use `targetId`).
- [ ] **Step 4 — verify.** tsc clean. Manual: HI board, a phrase with no HI variant → rename / edit a word → a HI variant is created; the EN source is unchanged on the EN board; badge/collapse behave (existing `reconcileVariantOrder` handles the representative-id swap). Commit: `git commit -am "feat(variant-lifecycle): phrase fork-on-edit (TalkerDropdown)"`.

---

### Task 3: Fluent-sentence fork-on-edit + record text

**Files:** Modify `convex/profileSentences.ts`, `app/components/app/sentences/modals/SentenceAudioModal.tsx`, and its open site in `SentencesModeContent.tsx`.

- [ ] **Step 1 — accept a record for fluent `text`.** In `convex/profileSentences.ts` `updateProfileSentenceAudio` (`:284-307`), widen the `text` arg and keep the patch as-is (the field is `localisedStringMigration`, so a record is valid):
```ts
    text: v.optional(v.union(v.string(), v.record(v.string(), v.string()))),
```
- [ ] **Step 2 — thread the source row into the modal.** Where `SentenceAudioModal` is opened for a fluent sentence (`SentencesModeContent.tsx:1451-1459`, from `sentenceEditTarget`), also pass the collapsed row's `authoredLanguage` and `_id`. Add to the `sentenceEditTarget` shape (set in `onEditSentence` `:1260-1272`) `authoredLanguage: s.authoredLanguage` and pass `authoredLanguage={sentenceEditTarget.authoredLanguage}` to the modal. Add the prop to `SentenceAudioModal`'s props type: `authoredLanguage?: string`.
- [ ] **Step 3 — fork + record write in `handleSave`.** In `SentenceAudioModal.handleSave` non-override branch (`:190-202`), bind `const createVariant = useMutation(api.profileSentences.createSentenceVariant)` at the top of the component, then replace the branch body:
```tsx
      } else if (sentenceId) {
        // Fork-on-edit: if this row isn't a board-language variant, create/reuse the
        // board variant (idempotent) and write to it — never the source.
        const targetId =
          (authoredLanguage ?? DEFAULT_LOCALE) !== language
            ? await createVariant({ sourceSentenceId: sentenceId, authoredLanguage: language })
            : sentenceId;
        if (trimmedValue) {
          await renameSentence({ profileSentenceId: targetId, name: { [language]: trimmedValue } });
        }
        await updateAudio({
          profileSentenceId: targetId,
          // Record-shaped per the variant model (§2a) — this fork's language.
          text: trimmedValue ? { [language]: trimmedValue } : undefined,
          ...(recordedAudioPath !== undefined ? { recordedAudioPath } : {}),
        });
      }
```
(Import `DEFAULT_LOCALE` from `@/lib/languages/registry` and `api` if not already; `language` is already used in this file at `:195`.)
- [ ] **Step 4 — verify.** tsc (app + convex) clean. Manual: HI board, a fluent sentence with no HI variant → edit its text → a HI variant is created (EN source unchanged on EN board), the HI text is stored as a record, and it plays in the HI voice. Commit: `git commit -am "feat(variant-lifecycle): fluent fork-on-edit + record text"`.

---

### Task 4: Docs + final verify

- [ ] **Step 1 — ADR Addendum I** in `docs/4-builds/decisions/ADR-016-composed-content-language-variants.md`: fork-on-edit — editing a composed item on a non-origin board forks a board-language variant (seeded from source) via the existing `create*Variant` idempotent mutations and writes to the fork; the source is edited only on its own board; reuses the author-variant pattern; word-unit text edits drop a stale carried-forward clip so playback re-synthesizes in the board voice (§2a); Stage 2 of the Language Variant Lifecycle.
- [ ] **Step 2 — full verify.** `npx tsc --noEmit` (excl. known-stale) + `npx tsc -p convex/tsconfig.json --noEmit` clean.
- [ ] **Step 3 — matrix walk (owner, running app).** Per HI/ES on sequence + fluent sentences and standalone phrases: (a) editing on a non-origin board forks (source unchanged on origin board); (b) an already-board-variant edit does NOT double-fork (idempotent); (c) word text edit re-synthesizes new text in board voice; (d) fork then board-switch shows source+"Made in" on origin, variant on board; (e) rapid consecutive edits land on one fork (no dup rows).
- [ ] **Step 4 — commit** docs: `git commit -am "docs(variant-lifecycle): ADR-016 Addendum I — fork-on-edit (Stage 2)"`.

## Self-review notes
- **Coverage vs spec §2/§2a:** sequences (T1) · phrases (T2) · fluent + record text (T3) · word-audio invalidation (T1 Step 2) · docs (T4). Keying de-scoped per §2a item 1 (correct under board-accent).
- **Idempotency:** every fork calls `create*Variant`, which returns the existing sibling per (group, language) — safe to call on each first edit; no dup rows.
- **Known risk (flag, don't fix here):** rapid consecutive edits before the query re-collapses read the source snapshot each time; the fork is idempotent so no dup rows, but a second edit computed from the stale source could drop the first edit's change. Pre-existing race (persistUnits was already fire-and-forget); acceptable for now — note in matrix step (e).
- **No new schema/migration.** One widened mutation arg (fluent `text` record) — back-compatible (field already `localisedStringMigration`).
