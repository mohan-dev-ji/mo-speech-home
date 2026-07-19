# Variant Delete + Revert (Lifecycle Stages 3 & 4) + 1-word phrases — Design Spec

**Date:** 2026-07-19
**Status:** Approved (design) — ready for implementation planning
**Relates to:** [ADR-016 Composed-Content Language Variants](../../4-builds/decisions/ADR-016-composed-content-language-variants.md) · [Language Variant Lifecycle design](2026-07-18-language-variant-lifecycle-design.md)
**Supersedes:** ADR-016 §5 "Delete semantics" (delete-one-variant + promote-source) — folded in as an ADR-016 addendum on implementation.

---

## Context / problem

Composed content (sentences, phrases) supports **per-language variants**: sibling rows linked by `variantGroupId` (`variantGroupId ?? _id` = the group key; the source row's `_id` is the group id). The client `collapseVariants` shows one row per group for the current board language — the board-language variant, else the source ([`lib/languages/variants.ts:89-113`](../../../lib/languages/variants.ts), key at `:27-29`).

**The bug (owner-reported, root-caused):** the trash button deletes only the **single collapsed row** it's showing ([`convex/profileSentences.ts:309-321`](../../../convex/profileSentences.ts), [`convex/profilePhrases.ts:200-209`](../../../convex/profilePhrases.ts)). After deleting the board variant, `collapseVariants` re-picks the **next** sibling (the source), which re-appears — so the user must delete again, once per language, to clear the item. **Lists** are a single localised record (no sibling rows, never collapsed — [`app/components/app/lists/sections/ListsModeContent.tsx:313-318`](../../../app/components/app/lists/sections/ListsModeContent.tsx)), so one delete clears every language. That difference is why lists "feel right" and sentences/phrases don't.

This is **Stage 4 (delete → whole-item)** and **Stage 3 (revert)** of the Language Variant Lifecycle, both already owner-decided in the lifecycle design (§4) and left outstanding by [ADR-016 Addendum I](../../4-builds/decisions/ADR-016-composed-content-language-variants.md) ("Stages 3 (revert) and 4 (delete→whole-item) remain"). A third, adjacent fix (1-word phrases) surfaced during brainstorming.

### Data-model facts this design leans on

- `profileSentences.variantGroupId` ([`convex/schema.ts:747`](../../../convex/schema.ts)) / `profilePhrases.variantGroupId` (`:799`), both `v.optional(v.string())`. **No index** on `variantGroupId` — group members are collected via `by_account_id` + in-memory filter, the same pattern `createSentenceVariant`/`createPhraseVariant` already use ([`convex/profileSentences.ts:173-224`](../../../convex/profileSentences.ts), [`convex/profilePhrases.ts:114-149`](../../../convex/profilePhrases.ts); helpers in [`convex/lib/variantAuthoring.ts`](../../../convex/lib/variantAuthoring.ts)).
- **`ttsCache` is GLOBAL and content-addressed** by `(text, voiceId, tone)` — shared across every profile and user, explicit "never deleted" contract ([`convex/schema.ts:657-671`](../../../convex/schema.ts), [`convex/ttsCache.ts`](../../../convex/ttsCache.ts)). Deleting a clip because one item was removed would break other users still speaking that text. **Out of bounds for any delete path here.**
- **Personal recordings** live under `accounts/<id>/audio/…` and are per-item. `isPersonalAssetKey` ([`convex/lib/contentModuleDelete.ts:23-26`](../../../convex/lib/contentModuleDelete.ts)) returns true only for `accounts/…`/`profiles/…` keys; `collectSentenceOrphanKeys`/`collectListOrphanKeys` (`:29-63`) already collect exactly these and skip all shared TTS. The server-side R2 delete precedent is [`app/api/delete-profile-symbol/route.ts`](../../../app/api/delete-profile-symbol/route.ts) (mutation returns orphan keys → route runs `DeleteObjectsCommand`).

---

## Scope

Three independent threads. **In scope:** Delete (whole-item), Revert (this-board), 1-word phrases, personal-recording cleanup on both delete paths.

**Non-goals:**
- No trash/undo infrastructure (delete is permanent, gated by confirm — owner decision).
- No shared-TTS garbage collection / reference counting (shared clips are never deleted).
- No MT-as-assist. No change to fork-on-edit, badges, or collapse beyond what's stated.

---

## Thread 1 — Delete = whole item across all languages (Stage 4)

The **trash button** is redefined to delete the entire logical item (source + every sibling in the group), in one action, behind a heavy confirm.

**Server (`convex/`):** new `deleteSentenceGroup` / `deletePhraseGroup` mutations. Each:
1. Auth-check (`accountId` ownership). Argument: the collapsed row's `_id` (the mutation resolves the group from it, so the client passes exactly what the trash button already has).
2. Resolve the group key `variantGroupId ?? _id`; collect all account rows whose `(variantGroupId ?? _id)` equals it (via `by_account_id`), mirroring `createSentenceVariant`'s collect.
3. `ctx.db.delete` every sibling.
4. Return the collected **personal-recording R2 keys** now orphaned (via `isPersonalAssetKey` / `collectSentenceOrphanKeys`), for the caller to delete from R2. Never returns shared `audio/<voice>/tts/…` keys.

The existing single-row `deleteProfileSentence`/`deleteProfilePhrase` stay (Revert uses them) but the **trash UI stops calling them**.

**Lists:** already whole-item (single record). `deleteProfileList` unchanged; covered by a verification pass only.

**Confirm copy (heavy):** *"This removes it on every board and can't be undone."* Distinct from Revert's light confirm.

**Data flow / R2 cleanup wiring:** R2 deletes need server credentials, so — following the `delete-profile-symbol` precedent — the client's delete-confirm handler calls a **thin API route** that (a) invokes the group-delete mutation, (b) `DeleteObjectsCommand`s the returned personal keys. (Today the confirm handlers call `useMutation` directly — [`SentencesModeContent.tsx:965`](../../../app/components/app/sentences/sections/SentencesModeContent.tsx), [`TalkerDropdown.tsx:429`](../../../app/components/app/shared/ui/TalkerDropdown.tsx); they switch to the route.) One route with a `scope` param serves both Delete and Revert (below); exact endpoint shape settled in the plan. Re-render is automatic via the reactive `useQuery`.

**Acceptance:**
- Deleting a multi-language sentence/phrase clears it from **every** board in **one** action (no re-appearing sibling).
- The heavy confirm is shown before deletion.
- A deleted item's personal recordings are gone from R2; shared TTS clips remain (other items/users unaffected).
- Lists still clear in one action (unchanged).

---

## Thread 2 — Revert = remove this board's version (Stage 3)

An **edit-mode toolbar icon** (↩) that removes only the current board's variant, returning the board to its origin fallback (+ "Made in ⟨origin⟩" badge); other languages untouched.

**Visibility predicate (the crux):** show Revert **iff the collapsed row is a non-source sibling** — `variantGroupId` set **and** `variantGroupId !== _id`. This single test yields all three spec rules:
- Origin board → viewing the source (`_id === groupKey`) → hidden.
- Untranslated fallback board (Made-in badge, no variant yet) → also viewing the source → hidden (nothing to revert; use Delete or author a variant).
- A real board variant over a surviving origin → shown.

**Mechanism:**
- **Sentences/phrases:** delete the collapsed **variant row** via the existing single-row `deleteProfileSentence` / `deleteProfilePhrase`. The source + other siblings remain; re-collapse falls back to origin with the badge.
- **Lists** (single record, no siblings): `stripLocaleKey(boardLanguage)` on the label + each item description record — show Revert when a board-language key exists over a surviving origin key. (Small update mutation, or reuse an existing label-update path — decided in plan.)

**Audio cleanup:** symmetric with Delete — the single-row deletes return orphaned **personal-recording** keys, cleaned via the same route; shared TTS untouched. (A reverted variant with its own recording gets that recording cleaned.)

**Confirm (light):** *"Show the ⟨ORIGIN⟩ version here instead? You can re-author anytime."* Kept low-friction because Revert is reversible (re-author) and is a primary testing affordance.

**Placement:** the ↩ icon in the existing edit-mode toolbars — sentence edit strip, phrase card edit controls, list label edit. Exact position pinned in the plan.

**Rejected alternative:** Revert in a per-item "⋯" overflow menu — hides a testing-useful action behind an extra tap and breaks the spec's edit-mode framing. Edit-toolbar icon chosen.

**Acceptance:**
- Revert shows **only** on a board displaying a real variant of a grouped item; never on the origin board or an untranslated fallback.
- Reverting removes just that board's variant; the board shows the origin + "Made in ⟨origin⟩" badge; other-language boards are unchanged.
- The reverted variant is re-authorable afterward (fork-on-edit still works).
- Lists: reverting strips the board-language key; the origin label/description shows.

---

## Thread 3 — Allow 1-word phrases

Relax the phrase minimum from 2 words to **1**, so a variant whose natural board-language form is a single word (e.g. a Hindi form of a multi-word English phrase) persists, renders, and is tappable — instead of being silently filtered out.

**Root cause:** the tappable phrase bank filters `words.length >= 2` ([`TalkerDropdown.tsx:610`](../../../app/components/app/shared/ui/TalkerDropdown.tsx)); the bank is already language-collapsed (`:307`), so a 1-word board variant disappears even though the source has 2+ words. The `incomplete` warning (`words.length < 2`) marks such phrases as broken ([`TalkerDropdown.tsx:577`](../../../app/components/app/shared/ui/TalkerDropdown.tsx), [`InlinePhraseEditor.tsx:68`](../../../app/components/app/sentences/sections/InlinePhraseEditor.tsx)).

**Change:**
- Tappable filter `>= 2` → `>= 1`.
- `incomplete` threshold `< 2` → `< 1` (only a **0-word/empty** phrase is incomplete; a deliberate 1-word phrase is valid and un-warned).
- **Plan task:** audit every phrase min-word guard (builder save button, any `createProfilePhrase`/save-path validation) and relax `>= 2`/`< 2` → `>= 1`/`< 1` consistently. A 1-word phrase is a labelled single-symbol chip that speaks its name — rendering/playback/sentence-expansion all handle it already.

**Scope:** applies **generally** (any 1-word phrase), not variant-only — simplest and harmless. (Flagged and accepted in brainstorming.)

**Acceptance:**
- A phrase edited/authored down to one word persists and remains tappable in the phrase bank on the board where it's one word.
- No "incomplete" warning border on a 1-word phrase; an empty (0-word) phrase is still treated as incomplete.
- Existing 2+-word phrases behave exactly as before.

---

## Verification approach

Per-thread, on the running app (`localhost:3000`), using Claude-in-Chrome to drive the UI + inspect network/Convex, then an owner confirmation of durable state:

1. **Delete (whole-item):** author a sentence with EN + HI variants; on the EN board, delete once → confirm it's gone on **both** EN and HI boards (single action). Check Convex: all group siblings gone. Check R2: the item's personal recordings removed, a shared TTS clip for the same text still present.
2. **Revert:** author an EN sentence, fork a HI variant; on the HI board confirm the ↩ shows, Revert once → HI board shows EN source + "Made in EN" badge, EN board unchanged, group source + EN remain in Convex. Confirm ↩ is **absent** on the origin (EN) board and on an untranslated fallback board.
3. **1-word phrase:** on a HI board, edit a phrase variant down to one word → confirm it stays visible/tappable in the phrase bank with no incomplete warning; the EN 2-word sibling is unaffected.
4. **Regression:** a singleton (no-variant) sentence/phrase still deletes in one action; lists still delete/label-revert correctly.

---

## Deploy ordering

Convex is deployed from `main` (auto-push via `convex dev`). New mutations (`deleteSentenceGroup`/`deletePhraseGroup`, any list `stripLocaleKey`) must be **deployed before** the client/route calls them (same `ArgumentValidationError`-avoidance rule as the tts-cache fix): land the Convex mutations first, confirm the push, then wire the route + UI.

## Docs on completion

Add an ADR-016 addendum recording Stages 3 & 4 (superseding §5), flip the lifecycle-spec stage tracker, and note the 1-word-phrase relaxation.
