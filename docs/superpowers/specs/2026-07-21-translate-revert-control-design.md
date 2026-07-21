# Translate/Revert Control — edit-mode-only translation affordances — Design Spec

**Date:** 2026-07-21
**Status:** Approved (design) — ready for implementation planning
**Relates to:** [ADR-016 Composed-Content Language Variants](../../4-builds/decisions/ADR-016-composed-content-language-variants.md) (incl. Addendum J) · [Variant Delete + Revert design](2026-07-19-variant-delete-revert-design.md)
**Figma:** GroupTile edit/view states — `Mo Speech — Finals`, node `3017-2352`

---

## Context / problem

Three problems with today's translation affordances:

1. **Student-permissions leak (the important one).** The "Made in ⟨LANG⟩" badge is a `<button>` ([`TranslateBadge.tsx:19`](../../../app/components/app/shared/ui/TranslateBadge.tsx)) that **renders on the student surface**. Of the 7 render sites, 5 show outside edit mode — so a student with no edit permission sees, and can tap, an authoring action on their own board. The badge was only ever useful to the owner while testing.
2. **It doesn't fit the UI.** On `GroupTile` the badge is absolutely positioned outside the tile (`top-2 right-2`) and reads as clunky.
3. **Inconsistent affordances.** Translation entry points differ per surface (a badge here, a modal there), and the ↩ Revert shipped in the Variant Lifecycle work lives in a *different* place again (the `EditPanel`), so one logical concept has two controls.

### Governing principle

> **Nothing translation-related renders outside edit mode.** The student surface shows content only.

---

## Decision

### 1. Two components, both edit-mode only

**`TranslateRevertControl`** — the actionable mini-icon (see Figma): a small rounded icon button rendered **inline, immediately right of the title/label**. State is derived from the item's language data + the board language:

| State | When | Glyph | Action |
|---|---|---|---|
| `untranslated` | no board-language version; showing an origin fallback | translate glyph (`Languages`) | fires `onTranslate` |
| `translated` | a board-language version exists **and** an origin survives | `RotateCcw` (↺) | fires `onRevert` |
| `none` | single-language item (nothing to translate from/to) | — | renders nothing |

**`MadeInLabel`** — the "Made in ⟨LANG⟩" pill, demoted to a **non-actionable label** (a `<span>`, not a `<button>`). Purely informational: it names the origin language being fallen back to.

**Pairing rule:** `MadeInLabel` renders **iff** the control is in the `untranslated` state — that is exactly when a fallback origin exists to name. In the `translated` state the content is native to the board, so no label. This keeps the pair coherent and avoids redundant chrome.

### 2. The contract — component renders state, surface supplies the verb

The control must not hard-code semantics, because "translate" means different things per content type:

```ts
type TranslateRevertState = 'untranslated' | 'translated' | 'none';

<TranslateRevertControl
  state={state}                 // derived by the caller (helpers below)
  onTranslate={() => …}         // surface-specific verb
  onRevert={() => …}            // surface-specific verb
  translateLabel={t('…')}       // a11y labels, en.json only
  revertLabel={t('…')}
/>
```

State derivation reuses existing helpers — **no new predicates**:
- **Label content** (single record, per-language keys): `untranslated` = `needsTranslation(record, language)`; `translated` = `record[language] != null && Object.keys(record).some(k => k !== language)`.
- **Composed content** (sibling-row variants): `untranslated` = the collapsed row's `authoredLanguage !== boardLanguage` (the existing badge condition); `translated` = [`isRevertableVariant(row)`](../../../lib/languages/variants.ts) — `variantGroupId != null && variantGroupId !== _id`.

### 3. Per-surface verbs

| Surface | translate → | revert → |
|---|---|---|
| Folder / category title (`GroupTile`) | MT the title via `translateTexts()` → existing rename mutation | strip `name[lang]` (client-side `stripLocaleKey` → existing rename) |
| List row title (`ListsModeContent`) | MT the title → `updateProfileListName` | `revertProfileListLanguage` (already exists) |
| List detail item (`Edit*` renderers) | MT that description → `updateProfileListItems` | strip `description[lang]` → `updateProfileListItems` |
| **Sentence / phrase** | **open the variant-authoring flow** — never MT | `POST /api/delete-composed` `scope:'variant'` (already exists) |

**Hard rule for the last row:** ADR-016's governing principle is that structure-bound content (phrases, all sentence types) is **re-authored per language, never machine-translated in place** — word order and morphology are language-specific. The shared control must never be wired to `translateTexts()` for compositions. This preserves the badge's current job (ADR-016 §3: the badge is the entry point to author a native variant) while making the badge itself non-actionable.

### 4. Consolidation — the control replaces the EditPanel ↩

The ↩ Revert shipped in the Variant Lifecycle work currently lives in the `EditPanel` / `BlockEditControls` for sentences, phrases and list rows. With the control handling revert, that becomes a duplicate. **It moves** out of the EditPanel and into the control beside the title/label. Net result: one control, one location, every surface.

No mutation changes — the revert verbs above already exist and keep their current semantics (including reference-aware R2 cleanup).

### 5. Placement

- **`GroupTile`** — inline, right of the editable title input, matching the Figma. **Toggle only, no `MadeInLabel`** (no room on a tile; the label is the clunkiness being removed). The existing translate *modal* is dropped: in edit mode the title is already an input, so the modal's "manual" branch is redundant → one tap, no dialog.
- **List row / sentence row / phrase card** — control + `MadeInLabel` beside the title/name, where the badge sits today.
- **List detail items** — control in the **`EditRows`/`EditColumns`/`EditGrid`** renderers (edit mode). The `Display*` renderers are view-only (student-facing) and lose their badges entirely.
- **No confirm on revert.** One field / one variant, trivially reversible (tap translate again, or retype). A dialog would defeat a mini-icon. (Whole-item **Delete** keeps its heavy confirm — unchanged.)

---

## Staging

One coherent feature, four shippable slices, ordered value-to-risk. Each stage leaves the app working.

### Stage A — Edit-mode gating (ships alone; highest value, lowest risk)
Gate all 7 existing badge sites on edit mode. No new components. Closes the student-permissions leak immediately.

Sites: [`GroupTile.tsx:256`](../../../app/components/app/shared/ui/GroupTile.tsx) (currently `!isEditing` → **invert** the gate), [`ListsModeContent.tsx:249`](../../../app/components/app/lists/sections/ListsModeContent.tsx), [`ListDetailDisplay.tsx:185,234,263`](../../../app/components/app/lists/sections/ListDetailDisplay.tsx) (view-only renderers → **remove**), [`SentencesModeContent.tsx:731-745`](../../../app/components/app/sentences/sections/SentencesModeContent.tsx), [`TalkerDropdown.tsx:677-679`](../../../app/components/app/shared/ui/TalkerDropdown.tsx).

Two deliberate consequences of doing A first, both temporary and accepted:
- **GroupTile's badge is inverted into edit mode in A, then replaced outright by the control in B.** A is intentionally a standalone safety fix that must not depend on B.
- **Per-item translation is unavailable between A and C.** Removing the `Display*` badges removes the only trigger for the per-item translate modal ([`ListDetailContent.tsx:339-380,411`](../../../app/components/app/lists/sections/ListDetailContent.tsx)). It is bridged by the list-row **"whole"** translate (title + all item descriptions), which is untouched; Stage C restores per-item control in the `Edit*` renderers. If this gap is unacceptable, do C immediately after A.

**Acceptance:** on a non-origin board in **view** mode, no badge/translate/revert affordance appears anywhere (sentences, phrases, lists, list items, folders, categories). All still reachable in edit mode.

### Stage B — Shared components + GroupTile
Build `TranslateRevertControl` + `MadeInLabel`; adopt in `GroupTile` (folder groups **and** categories — one shared component). Remove GroupTile's badge and translate modal; add an `onRevert?: () => void` prop (today's `onRename(value: string)` can't express key removal) implemented by `GroupsView` and `CategoriesContent` via `stripLocaleKey` + their existing rename mutations.

**Acceptance:** matches Figma `3017-2352` — view mode is title + cover only; edit mode shows the dashed title input with the mini-icon inline right. Translate one-tap fills the board-language title; ↺ strips it and the origin title returns. Never strips the last remaining key.

### Stage C — Lists
Adopt the control on the list **row** (retiring its EditPanel ↩) and add the **per-item** control in the `Edit*` renderers. Remove the per-item badges from `Display*`.

**Acceptance:** a single translated item can be reverted without touching the rest of the list; the row-level revert still reverts title + all items; students see no translation chrome in the list detail view.

### Stage D — Sentences & phrases
Adopt the control on sentence rows and phrase cards, retiring their EditPanel/`BlockEditControls` ↩. `MadeInLabel` becomes non-actionable; the control's `untranslated` state opens the **variant-authoring flow** (the badge's former job).

**Acceptance:** on a fallback sentence/phrase in edit mode, the label names the origin and the translate icon opens variant authoring; once a variant exists the same slot reverts it and the origin returns. Machine translation is never invoked for composed content.

---

## Non-goals

- No MT for composed content (ADR-016), now or later.
- No change to whole-item **Delete** or its heavy confirm.
- No change to the revert mutations' semantics or the reference-aware R2 cleanup.
- No new Convex mutations: every verb reuses an existing mutation/route. (Folder/category revert is a client-side `stripLocaleKey` + existing rename.)
- No trash/undo infrastructure.

## Verification

No unit-test runner exists in this repo — verify with `tsc` + live Claude-in-Chrome checks, per stage:

1. **Student-surface check (the critical one, Stage A):** on a non-origin board in view mode, assert zero translate/revert/badge elements render across all six surfaces. Structurally verifiable by querying the DOM for the control's `aria-label`s and the label text.
2. **GroupTile (Stage B):** compare edit/view against Figma `3017-2352`; exercise translate → ↺ revert → origin title returns; confirm the last key can't be stripped.
3. **Lists (Stage C):** per-item revert affects only that item; row revert still does title + all items.
4. **Sentences/phrases (Stage D):** translate state opens variant authoring (assert no `/api/translate-text` call fires); revert removes only the board variant and the "Made in" label returns.
5. **Regression:** a single-language item shows no control; whole-item Delete unchanged.

## Deploy ordering

No new Convex functions are required, so there is no validator-skew gate. If implementation discovers a needed mutation, land and confirm the Convex deploy **before** the client calls it (the standing rule on `main`).

## Docs on completion

Amend ADR-016 §3 (badge-as-entry-point) to record that the entry point moved to `TranslateRevertControl` and the badge is now a non-actionable label, and note the edit-mode-only principle.
