# Variant Lifecycle — Stage 2: fork-on-edit + audio integrity — Implementation Plan

> **Status:** ✅ SHIPPED (archived 2026-07-22). Every task in the Status Ledger below is ✅ with a commit hash.
>
> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use `- [ ]` checkboxes.
> **Design spec:** [`docs/superpowers/specs/2026-07-18-language-variant-lifecycle-design.md`](../../superpowers/specs/2026-07-18-language-variant-lifecycle-design.md).
> **⚠️ SELF-CONTAINED FOR A NEW SESSION — fully shipped. Read the Status Ledger + Model Summary first.**
> **Branch:** `claude/phase-15.6-variant-lifecycle` (worktree). App runs on the worktree's dev server (owner-managed; verify audio changes on the running app — do NOT start a server or `npx convex dev`).

---

## Status ledger (what's done vs pending)

Stage 2 belongs to the 4-stage Variant Lifecycle: (1) block-voice · **(2) fork-on-edit + audio ← here** · (3) revert · (4) delete→whole-item.

| | Item | Commit |
|---|---|---|
| ✅ | **Stage 1** — block voice = the variant's one `authoredLanguage` (board-accent, no per-block split) | `d46aebe`, ADR `0b2c640` |
| ✅ | **Task 1** — sequence fork-on-edit (`persistUnits` wrap) + word-unit stale-audio invalidation | `86a122b` (reviewed clean) |
| ✅ | **Literal-TTS for composed words** — playback bypasses the SymbolStix default-audio lookup so a word says its authored text in the board voice ("breakfast" in a Hindi accent), not the symbol's canonical translated word ("nashta") | `994038a` (verified live) |
| ✅ | **Board-accent = FINAL voice model** + spec resolution | `480da3a` |
| ✅ | **Task 2** — standalone-phrase fork-on-edit (`TalkerDropdown`) | `c2a69eb` |
| ✅ | **Task 3** — fluent-sentence fork-on-edit + record-shaped `text` | `9bac603` |
| ✅ | **Task 5 (NEW)** — extend literal-TTS to **list-item** playback (1-word descriptions still translate) | `f649b9a` |
| ✅ | **Task 4** — ADR addendum (I) + full tsc verify. Owner does the manual matrix walk. | (docs commit) |
| ✅ | **Perf follow-up (shipped on `main`, 2026-07-19)** — `skipSymbolstix` on `ttsCache.lookup` so literal clips cache instead of re-generating each play. Verified via `/api/tts` payloads (literal `breakfast`: generated→cache same key; plain: symbolstix) | (this commit) |

**Lists fork-on-edit: already done** (Phase 15.5 per-language key merge — single-record model, origin preserved). No task.

---

## Model summary (board-accent, verified working)

- **Board-accent voice (final):** on a board of language L, a **localized/forked** item speaks its **literal authored text in the L voice** (e.g. English text on a Hindi board → Hindi voice, Hindi accent — NOT translated). An **un-translated** item (origin fallback, "Made in" badge) speaks in the **origin** voice. (The owner considered native-voice mid-way, then reverted to board-accent after hearing it — do not re-litigate.)
- **Literal audio:** composed/authored content (sentence blocks ✅, list items ✅ Task 5) must speak the **exact typed text** via TTS, bypassing the SymbolStix per-language default (which swaps a known word for its canonical board-language word = a translation). Phrases already worked because their multi-word names match no single symbol.
- **fork-on-edit (board-true editing):** editing a composed item on a board where **no board-language variant exists yet** must **fork** a board-language variant (seeded from the source, via the existing idempotent `create*Variant` mutations) and write to the fork — never mutate the shared source. This protects other boards' integrity.
  - **These are deviant-but-valid edge cases** (owner note): the normal path is the **"Made in" badge** → author-variant, which already forks correctly. But a user CAN enter edit mode and directly edit a *fallback* (not-yet-translated) item, and today that **clobbers the origin board** (confirmed by owner retest). Task 2/3 close that gap. The badge flow and fork-on-edit share the SAME `create*Variant` mutations — this is not duplicate code.

**Fork check everywhere:** `(collapsedRow.authoredLanguage ?? DEFAULT_LOCALE) !== language`. `createSentenceVariant`/`createPhraseVariant` are **idempotent per (group, language)** and return the fork id.

---

## Global Constraints (verbatim)
- **No test harness.** Verify each task: `npx tsc --noEmit 2>&1 | grep -E "^(app|lib|convex)/" | grep -v "lib/stripe.ts"` clean AND `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json --noEmit` clean. Manual audio/board matrix is the OWNER's. Do NOT start a dev server / `npx convex dev`.
- **No hard-coded UI copy; theme tokens only. Commit per task.**
- Board-accent: a forked variant's `authoredLanguage === language`, so text keyed under `[language]` is correct — no separate "keying" fix.

## Reuse map (verified)
- Fork mutations (idempotent, return fork id): `api.profileSentences.createSentenceVariant` (bound `createVariant`), args `{sourceSentenceId, authoredLanguage, text?}`; `api.profilePhrases.createPhraseVariant` (bound `createPhraseVariant`, `TalkerDropdown.tsx:158`), args `{sourcePhraseId, authoredLanguage}`.
- **Pattern already shipped (copy it):** `persistUnits` (`SentencesModeContent.tsx`, Task 1) = the sequence choke-point that forks then writes; `handleAuthorVariant`/`handlePhraseAuthorVariant` = the badge flow (create variant → write to it).
- Literal audio: `resolveTtsKey(text, voiceId, tone?, opts?: { literal?: boolean })` (`lib/audio/playTts.ts`) — **already has the `literal` param**; sends it to `POST /api/tts`, which skips the symbolstix branch when `literal` (already implemented, `app/api/tts/route.ts`). `playTts(text, voiceId, tone?)` — **needs the `literal` param added** (Task 5).
- Phrase edit handlers (target `p._id` from the collapsed `phraseList`, `findPhrase` `:342`): `handleRenamePhrase:368`, `handleRemovePhraseWord:374`, `handleReorderPhraseWord:383`, `handlePhraseWordSave:392`, phrase-audio `saveOverride` `:851`.
- Fluent edit: `SentenceAudioModal.handleSave` (`app/components/app/sentences/modals/SentenceAudioModal.tsx:170-207`) — non-override branch does `renameSentence` + `updateAudio`. `updateProfileSentenceAudio` (`convex/profileSentences.ts:284`) writes `text` as a plain string (arg `text: v.optional(v.string())` at `:287`).
- List playback: `ListDetailDisplay.tsx:101` `playTts(item.description, voiceId)`.

---

### ✅ Task 2: standalone-phrase fork-on-edit (TalkerDropdown)

**File:** Modify `app/components/app/shared/ui/TalkerDropdown.tsx`.

- [ ] **Step 1 — shared target resolver.** Add near `findPhrase` (`:342`):
```tsx
// Fork-on-edit (Stage 2): editing a phrase whose collapsed row isn't a board-language
// variant creates/reuses the board variant (idempotent) and returns its id, so a direct
// edit of a fallback never mutates the source across boards.
async function resolvePhraseTargetId(phrase: { _id: Id<'profilePhrases'>; authoredLanguage?: string }) {
  return (phrase.authoredLanguage ?? DEFAULT_LOCALE) !== language
    ? await createPhraseVariant({ sourcePhraseId: phrase._id, authoredLanguage: language })
    : phrase._id;
}
```
- [ ] **Step 2 — route the 4 name/word handlers through it.** Make each `async` and resolve the target FIRST. `handleRenamePhrase` (`:368`):
```tsx
async function handleRenamePhrase(id: Id<'profilePhrases'>, current: Record<string, string>, next: string) {
  const phrase = findPhrase(id); if (!phrase) return;
  const targetId = await resolvePhraseTargetId(phrase);
  updateProfilePhraseName({ profilePhraseId: targetId, name: { ...current, [language]: next } })
    .catch((e) => console.error('[TalkerDropdown] rename phrase failed', e));
}
```
For `handleRemovePhraseWord` (`:374`), `handleReorderPhraseWord` (`:383`), `handlePhraseWordSave` (`:392`): after the existing `const phrase = findPhrase(...)` guard, add `const targetId = await resolvePhraseTargetId(phrase);` and change the `updateProfilePhraseWords({ profilePhraseId: <phraseId>, … })` call to use `targetId` (make each function `async`). Word arrays are already derived from `phrase.words` (the collapsed row) so they seed the fork correctly.
- [ ] **Step 3 — phrase-audio override.** In the phrase-audio `saveOverride` (`:851`), before its `updateProfilePhraseName`/`updateProfilePhraseAudio` calls, resolve the target the same way (`const targetId = await resolvePhraseTargetId(<phrase in scope>);`) and use `targetId`.
- [ ] **Step 4 — verify.** tsc clean. Manual: on a HI board, a phrase with no HI variant (shows "Made in EN") → **without tapping the badge**, rename it or reorder its words → a HI variant is created; switch to the EN board → the English phrase is UNCHANGED. Commit: `git commit -am "feat(variant-lifecycle): phrase fork-on-edit (protect origin board on direct edit)"`.

---

### ✅ Task 3: fluent-sentence fork-on-edit + record `text`

**Files:** Modify `convex/profileSentences.ts`, `app/components/app/sentences/modals/SentenceAudioModal.tsx`, `app/components/app/sentences/sections/SentencesModeContent.tsx`.

- [ ] **Step 1 — accept a record for fluent `text`.** In `updateProfileSentenceAudio` (`convex/profileSentences.ts:284-307`) widen the arg (field is `localisedStringMigration`, so a record is valid; patch stays as-is):
```ts
    text: v.optional(v.union(v.string(), v.record(v.string(), v.string()))),
```
- [ ] **Step 2 — thread the source row into the modal.** Where `SentenceAudioModal` opens for a fluent sentence (`SentencesModeContent.tsx`, from `sentenceEditTarget` set in `onEditSentence`), add the collapsed row's `authoredLanguage` to `sentenceEditTarget` and pass `authoredLanguage={sentenceEditTarget.authoredLanguage}` to the modal. Add `authoredLanguage?: string` to `SentenceAudioModal`'s props.
- [ ] **Step 3 — fork + record write in `handleSave`.** Bind `const createVariant = useMutation(api.profileSentences.createSentenceVariant)` at the top of `SentenceAudioModal`; import `DEFAULT_LOCALE` from `@/lib/languages/registry`. Replace the non-override branch (`:190-202`):
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
          text: trimmedValue ? { [language]: trimmedValue } : undefined,
          ...(recordedAudioPath !== undefined ? { recordedAudioPath } : {}),
        });
      }
```
- [ ] **Step 4 — verify.** tsc (app + convex) clean. Manual: HI board, a fluent sentence with no HI variant → **directly edit its text** (not via badge) → a HI variant is created (EN source unchanged on EN board), the HI text is a record, plays in the HI voice. Commit: `git commit -am "feat(variant-lifecycle): fluent fork-on-edit + record text (protect origin board)"`.

---

### ✅ Task 5 (NEW): list-item literal-TTS

List item descriptions are authored text, and 1-word descriptions (e.g. "breakfast") currently resolve the SymbolStix default → the translated word. Make list playback literal like sentence blocks.

**Files:** Modify `lib/audio/playTts.ts`, `app/components/app/lists/sections/ListDetailDisplay.tsx`.

- [ ] **Step 1 — `playTts` accepts `literal`.** In `lib/audio/playTts.ts`, add the opt and pass it to `resolveTtsKey`:
```ts
export async function playTts(
  text: string,
  voiceId: string,
  tone?: string,
  opts?: { literal?: boolean }
): Promise<string | undefined> {
  const r2Key = await resolveTtsKey(text, voiceId, tone, opts);
  if (!r2Key) return undefined;
  playKey(r2Key);
  return r2Key;
}
```
- [ ] **Step 2 — list playback passes `literal:true`.** In `ListDetailDisplay.tsx` (`ListItemPlayModal`, ~`:101`), change `playTts(item.description, voiceId)` to `playTts(item.description, voiceId, undefined, { literal: true })`. (Grep the repo for other `playTts(` list-item call sites and give them `{ literal: true }` too; do NOT change symbol/talker `playTts` calls — symbols SHOULD use the SymbolStix default.)
- [ ] **Step 3 — verify.** tsc clean. Manual: HI board, a list item whose description is a single symbol word (e.g. "breakfast") → plays "breakfast" in the HI voice (accented), NOT the translated word. Multi-word descriptions unchanged (already literal). Commit: `git commit -am "feat(variant-lifecycle): list-item playback speaks literal text (bypass symbol default)"`.

---

### ✅ Task 4: docs + final verify

- [ ] **Step 1 — ADR Addendum I** in `docs/4-builds/decisions/ADR-016-composed-content-language-variants.md`: fork-on-edit (editing a fallback on a non-origin board forks a board variant via the idempotent `create*Variant` mutations, protecting the origin board — a guardrail for the deviant direct-edit path; the badge remains the normal path); board-accent + literal-TTS for all authored content (sentence blocks + list items); word-unit stale-audio invalidation. Note the deferred `ttsCache.lookup` `skipSymbolstix` caching optimization.
- [ ] **Step 2 — full verify.** app tsc + convex tsc clean.
- [ ] **Step 3 — matrix walk (owner).** Per HI/ES: (a) directly editing a fallback sequence sentence / fluent sentence / standalone phrase forks and leaves the origin board unchanged; (b) already-variant edits don't double-fork; (c) a 1-word list item speaks literal (board accent), not translated; (d) fork ↔ board-switch shows source+"Made in" on origin, variant on board.
- [ ] **Step 4 — commit** docs.

## Self-review notes
- **No duplicate code:** fork-on-edit reuses `create*Variant` (same mutations the "Made in" badge uses); Task 5 reuses the existing `literal` route flag.
- **No new schema/migration.** One widened mutation arg (fluent `text` record, back-compatible).
- **Shipped (2026-07-19, on `main`):** `ttsCache.lookup` `skipSymbolstix` so literal clips cache instead of regenerating each play — the last deploy-dependent Stage 2 leftover.
