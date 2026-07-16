# Phase 15.6 — "Revert translation" — Design Spec

- **Date:** 2026-07-16
- **Status:** Approved (brainstorm) → ready for implementation plan
- **Author:** brainstormed with owner
- **Relates to:** ADR-016 (composed-content language variants) Addendum D/E; Phase 15.5 live-translation badge system.

---

## Context of discovery

Phase 15.5 shipped the unified **"Made in `<lang>`" badge** system: order-free labels
(folder/group names, list titles, list item descriptions) and composed content
(sentence/phrase variants) show a view-mode badge when the record lacks a
board-language version, opening a modal to translate (MT-fill) or author manually.

During live acceptance testing on HI and ES boards the owner surfaced two things:

1. **A legacy-string badge bug (already fixed, commit `87ce54b`).** Un-migrated list
   items stored their description as a plain string. Phase 15.5 hydration keyed a
   plain string under the *board* language, so on a non-English board the English
   text was mislabelled as the board language and `needsTranslation` returned false —
   the badge never appeared for those items. Fixed by keying legacy plain strings
   under `DEFAULT_LOCALE` (origin) instead. **This is done; not part of 15.6.**

2. **The gap this spec addresses: translation is one-way.** Once a field is
   translated for a board, there is **no way back** to the origin-language fallback,
   and therefore no way to get the "Made in…" badge back. The owner wants selective,
   per-field control — especially valuable for **bilingual students**, where an
   instructor may want some items in the origin language and some translated on the
   same board. The Phase 15.5 flow (translate-all vs manual) doesn't support removing
   a translation.

## Problem

There is no affordance to **remove** the active board's version of an order-free
label or composed-content variant and fall back to the origin language. Translation
is a one-way door.

## Goal

Add a **Revert** control — the exact mirror of Translate — that removes the *active
board's* version of a field, restoring the origin-language fallback and making the
"Made in…" badge reappear. Available **in edit mode only**, in every place the
"Made in…" badge appears (folder names, list titles, list items, sentence/phrase
variants).

---

## Design

### 1. State model (per field, per board)

A field is in exactly one of two states on a given board; the two badges are never
shown together:

| State | Condition | View mode | Edit mode |
|---|---|---|---|
| **Untranslated** | no board-language version | "Made in `<origin>`" badge → translate (Phase 15.5, unchanged) | (unchanged) |
| **Translated** | board-language version exists | plain translated text, no badge | **"Revert to `<origin>`" badge → revert** |

Reverting flips *Translated → Untranslated*, so the "Made in…" badge reappears in
view mode. `<origin>` = the locale the field falls back to once the board version is
removed (`resolvedLocale` of the record with the board key removed; typically
`DEFAULT_LOCALE`).

### 2. What "revert" removes (per data model)

The two surfaces use different data models, so revert is two operations under one
concept:

- **Order-free labels** (folder name, list title, list item description) — a single
  localised **record** with per-language keys. Revert deletes the **active board's
  key**: `{ en, es } → { en }` on an ES board. Origin and all other languages are
  untouched.
- **Composed content** (sentence / phrase **variants**) — sibling **rows**, one per
  authored language, linked by `variantGroupId` (ADR-016). Revert deletes the
  **board-language sibling row** (`deleteProfileSentence` on that row). The
  source/origin row and any other-language siblings survive; the collapsed group
  falls back to source.

### 3. Affordance & flow

- A **Revert badge** — visually distinct from the "Made in…" pill (e.g. a muted /
  outline treatment with an undo/rotate icon) to read as a management action, not a
  call-to-action. Implemented either as a new `RevertBadge` component or a `variant`
  prop on `TranslateBadge`; the plan decides. Renders **only in edit mode**, and only
  when the field is Translated **and** revert is permitted (see Guardrails).
- Tapping the badge opens the **existing generic `TranslateChoiceModal`** as a
  **scope-picker that doubles as the "always confirm" gate** — choosing a destructive
  option inside a modal *is* the confirmation, so there is **no second dialog**.
- **Always confirm:** there is no one-tap-execute path; every revert goes through the
  modal.

Scope options per surface (mirroring the translate scopes, minus "manual"):

| Surface | Revert options |
|---|---|
| List title | "Revert whole list" (title + every item, **board key only**) · "Revert just the title" |
| List item | "Revert whole list" (title + every item, **board key only**) · "Revert this item" |
| Folder / group name | "Revert this name" (single option) |
| Sentence / phrase variant | "Revert this one" (single option) |

**Whole-list revert removes only the active board's language** across the title and
every item — it never touches other languages.

### 4. Guardrails / edge cases

- **Never leave a field empty.** Offer revert only when a fallback survives: for
  labels, the record must have **≥1 non-board key**; for variants, a **source or
  other-language sibling** must exist.
- **No revert on the origin board.** Removing the origin's own key/row is nonsensical
  (nothing to fall back to) — the badge does not appear there.
- **Active board only.** Revert removes exactly the board-language version; all other
  languages are preserved.
- **Whole-list revert is per-item conditional.** Items already untranslated for the
  board (or empty) are skipped — no-op, no error.
- **Free tier:** lists/sentences edit is already Pro-gated; revert lives in edit mode
  and inherits that gate. No new gating logic.

### 5. Surfaces & components

Phase 15.5 rendered the "Made in…" badge in **view-mode** components. Revert lives in
**edit-mode** renders, which are different components — the plan's first job per
surface is to place the badge there:

- `GroupTile` (`app/components/app/shared/ui/GroupTile.tsx`) — edit-mode title area
  (already hosts the rename input). Covers folder/group names (lists, sentences, and
  categories, since `GroupTile` is shared).
- List title — the edit-mode title input in `ListsModeContent`
  (`SortableListRow`) / `ListDetailContent` banner input.
- List items — `ListDetailEdit` (`EditRows` / `EditColumns` / `EditGrid`) — the
  item edit rows (NOT `ListDetailDisplay`, which is view-mode).
- Sentence / phrase variants — the sentence/phrase **edit-mode** surface that hosts
  the variant badge today (plan step: locate exactly; `VariantAuthorModal` is the
  view-mode counterpart).

Reused as-is:

- `TranslateChoiceModal` (`app/components/app/shared/modals/TranslateChoiceModal.tsx`)
  — generic mode-picker; add revert option sets + handlers.
- `needsTranslation` / `resolvedLocale` / `displayString`
  (`lib/languages/variants.ts`, `lib/languages/displayValue.ts`) — drive badge state
  and the origin-fallback label. A small pure helper (e.g. `stripLocaleKey(record,
  lang)` returning a new record without that key) is likely worth adding next to
  them.

### 6. Convex

**No new mutations expected.** Revert writes the pruned record through existing
mutations:

- Labels: `profileLists.updateProfileListName` (list title), `profileLists.updateProfileListItems`
  (items), `profileFolders.renameFolder` (folder name) — each caller merges/prunes the
  record client-side and sends the full replacement, as Phase 15.5 already does.
- Variants: `profileSentences.deleteProfileSentence` (`convex/profileSentences.ts:309`)
  — delete the board-language sibling row by id.

If a surface can't cleanly identify the board-language sibling row client-side, the
plan may add a thin query/helper — but the default is no schema and no new mutation.

### 7. i18n

New keys in the `translate` namespace (**`messages/en.json` only**), e.g.
`revertBadge` ("Revert to {lang}"), `revertTitle`, `revertWholeList`,
`revertWholeListHint`, `revertThisTitle`, `revertThisItem`, `revertThisName`,
`revertThisOne`, `revertChooseDescription`. Exact keys finalised in the plan.

---

## Out of scope

- **No change to Translate** (Phase 15.5 flow untouched).
- **No "delete whole sentence across all languages" action** — that remains the
  existing per-row delete; revert only removes the board-language variant row.
- **No view-mode revert** — revert is an edit-mode authoring action only.
- The legacy-string hydration fix (`87ce54b`) is already shipped; not part of this
  work.

## Acceptance (matrix walk, per board EN/ES/HI)

For folder name, list title, list item, and sentence/phrase variant:

1. On a **translated** field, edit mode shows "Revert to `<origin>`"; view mode shows
   no badge.
2. Revert (single scope) → confirm via modal → field falls back to origin; "Made in
   `<origin>`" badge reappears in view mode; other languages unchanged.
3. "Revert whole list" → title + every item fall back to origin for the **board
   language only**; other languages retained.
4. On the **origin board**, no Revert badge appears.
5. On a field with **only** the board version (no fallback), no Revert badge appears.
6. Sentence/phrase: reverting deletes the **board variant row**; the source and other
   siblings survive; the group falls back to source.
7. Translate ↔ Revert round-trips cleanly and survives a board switch.

## Follow-up docs

On implementation, extend **ADR-016** (Addendum F) noting Revert as the mirror of the
Phase 15.5 translate badge, and the two-model semantics (label key-delete vs variant
row-delete).
