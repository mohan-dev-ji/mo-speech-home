# ADR-016 — Composed-Content Language Variants

**Date:** 2026-07-12
**Status:** Accepted

---

## Context

Phase 15 shipped the bilingual foundation: symbols/words translate live (order-free), and **structure-bound content** (phrases, block/sequence sentences) is tagged with `authoredLanguage` so it resolves its text + voice against the language it was authored in, never the board language ([`phase-15-language-design.md`](../plans/_done/phase-15-language-design.md)). A block sentence authored in English keeps English word order and English voice even on a Hindi board, and shows a **"Made in EN"** badge — a valid, permanent bilingual state, not an error.

What Phase 15 left deferred: an instructor can only author *one* composition per logical item. There is no way to author a **native Hindi version** of that English sentence — correct Hindi symbol order, Hindi text, Hindi audio — and have the app show it on a Hindi board while still showing the English version on an English board. Word order and morphology are language-specific; machine-translating a composition in place produces wrong order. The governing principle (unchanged since Phase 15):

> Order-free content (symbols/words) translates live. **Structure-bound content (phrases, all sentence types) is re-authored per language, never machine-translated in place.**

This ADR defines the data model, resolution, and authoring flow for **per-language variants** of composed content. It is the contract for Phase 15.5.

### Scope clarification (owner-decided, 2026-07-12)

A variant is fundamentally **a per-language authored symbol arrangement**. It exists for *every composed type*; playback mode is orthogonal:

| Type | Per-language variant? | Audio resolution |
|---|---|---|
| **Phrase** | yes (re-arranged symbols) | phrase clip / TTS |
| **Fluent sentence** | yes (re-arranged symbols) | one translated string, TTS'd whole, resolves live |
| **Block/sequence sentence** | yes (re-arranged symbols) | stepped per-unit clips |
| **List** | no — items + folder name translate live | per-item, live |

Fluent sentences were previously "one translated string, live" only. They now **also** get a per-language symbol arrangement: the instructor writes the sentence in the board language and re-arranges its symbols, while audio remains a single whole-utterance TTS of the translated string. Audio behaviour is unchanged and stays keyed off the existing `playback: "fluent" | "sequence"` field.

**Out of scope for 15.5:** MT-as-assist (auto-suggesting a machine-translated starting string inside the authoring flow). Deferred to a future ADR. Note: this excludes only the *auto-translate suggestion* — variant authoring retains the **full composition-builder audio pipeline** (write the new text in the board language, then **generate TTS or record** voice, exactly as normal authoring).

---

## Decision

### 1. Storage — `variantGroupId` sibling rows

A variant is **another `profileSentences` / `profilePhrases` row of the identical shape**, tagged with its own `authoredLanguage`, linked to its siblings by a shared `variantGroupId`. One new optional field per table:

```ts
// profileSentences AND profilePhrases
variantGroupId: v.optional(v.string()),
```

- **The group id IS the source row's `_id`.** The *source* variant is the first-authored one. Source row: `variantGroupId` unset **or** `variantGroupId === _id`. A sibling variant: `variantGroupId === sourceId`.
- **Lazy grouping, zero migration.** A normal new sentence/phrase has no `variantGroupId` — a singleton group of one, source = itself. A group only materialises when a *second* language is authored: patch the source (`variantGroupId = source._id`), then insert the sibling with `variantGroupId = source._id`. Every legacy row is already a valid singleton. No backfill, no migration.
- **Siblings copy the source's `folderId` and `order`** and stay in sync on reorder, so a group occupies one stable slot in the list regardless of which language is showing. Reordering a group reorders all its siblings together.

**Why sibling rows, not a parent-slot table or an embedded variants map:** the entire composition stack — render, edit, playback, audio — is already per-row and already language-tagged (`authoredLanguage`, Phase 15). Option A treats a variant as exactly what it is (a sibling composition), so a single variant renders/plays/edits through unchanged code. The new logic is confined to two narrow places: the list collapse and the authoring entry point. A parent-slot table would force rewriting every query/render/edit path to route through the slot; an embedded `variants` map would fight the per-row playback/edit/audio plumbing and grow the doc unbounded.

### 2. Resolution — client-side group collapse

The board `language` is client context, so resolution is client-side — the same mechanism live text translation already uses, and the same reactive re-render-on-language-change proven by the search page.

- The `useQuery` returns all rows as today (all siblings included).
- The client **collapses each group** by current `language`: show the sibling whose `authoredLanguage === boardLanguage`; else show the **source** row (`_id === variantGroupId`, or the singleton).
- Only the collapsed row renders; siblings for other languages are hidden.
- Switching language re-collapses instantly — **no Convex re-query**.

**Badge rule (uniform across all composed types):** show the **"Made in <lang>"** badge iff the shown row's `authoredLanguage !== boardLanguage` — i.e. we fell back to the source because no variant exists for the board language. This **supersedes** the Phase 15 `isSequenceRow`-only badge condition ([`SentencesModeContent.tsx:698`](../../../app/components/app/sentences/sections/SentencesModeContent.tsx)); fluent sentences and phrases now show the badge too.

| Board vs authored | Variant for board lang? | Shows |
|---|---|---|
| Board = authored | — | native text/order, native voice, **no badge** |
| Board ≠ authored | no | source composition + **"Made in <authoredLang>"** badge; text/audio still live-resolve meanwhile |
| Board ≠ authored | yes | the native variant (its own order/text/audio), **no badge** |

### 3. Authoring entry — badge → edit mode

The badge is the entry point to author a native variant.

- Tapping it opens the **existing composition-builder edit flow**, pre-seeded from the source composition (source shown as reference while the instructor re-arranges), with `authoredLanguage = boardLanguage`.
- The full audio pipeline is available: write the new text in the board language, then **generate TTS (in the board language) or record** — standard authoring, no MT.
- **On save:** create a sibling row with the shared `variantGroupId`, copied `folderId` / `order`. Reuses the `SentencesModeContent` and `PersistentTalker` save paths (both already stamp `authoredLanguage = language`). The new work is: set `variantGroupId` on save + seed the builder from the source.

### 4. Audio — unchanged, orthogonal

Audio resolution is untouched by this ADR and stays keyed off `playback`: `fluent` → whole translated string TTS; `sequence` → stepped per-unit clips. (The Phase 15-review persona-split defect in the sequence path is a separate bug, fixed independently.)

### 5. Delete semantics

- Deleting a variant removes **just that row**.
- If the **source** is deleted while siblings remain, **promote** the lowest-`order` sibling to source: patch its `variantGroupId = its own _id` and re-point the other siblings to it.
- A singleton delete is unchanged.

### 6. MT-as-assist — deferred

Out of scope for 15.5. A future ADR may add an optional (Pro+) machine-translated **starting suggestion** inside the authoring flow. MT never ships unreviewed — the instructor always arranges symbol order and confirms text. This exclusion does **not** touch the generate/record audio pipeline, which is in scope.

---

## Consequences

- **Bug #1 seam.** The Phase 15-review "Made in HI badge missing" bug has two halves: (a) *stamp `authoredLanguage` on every create path* — an independent bug fix; (b) *fluent sentences should also show the badge* — a decision of this ADR that lands with the §2 resolution work. Fix (a) in the standalone bug pass; do not also touch the badge scope there — it changes here.
- **Query cost.** Returning all siblings and collapsing client-side means the list query fetches (up to) 3× rows for fully-tri-lingual items. Acceptable at our scale; groups are small (≤ one row per supported language).
- **Order coupling.** Keeping siblings' `order`/`folderId` in sync on every reorder/move is required for stable positioning — the reorder mutation must fan out across the group.
- **No migration.** Legacy rows are singletons; the model is additive.

---

## Addendum (2026-07-12) — Cross-script authoring: MT-assist + the label/structure split

An owner review surfaced a hole in the original §3/§6: **manual authoring assumes the instructor can type the target script.** An instructor whose OS/keyboard is Latin-only cannot hand-type Devanagari (or any script they lack an IME for), so "badge → edit mode → type the target-language text" is unusable for the very cross-language case variants exist to serve — including the owner, who cannot type/read Hindi and therefore could not author the Hindi fixtures to test this phase at all. This addendum amends the decision.

### A. The division of labour (the governing insight)

Authoring a variant splits into two jobs:

- **The human owns the symbol ORDER** — visual, drag-and-drop, **script-independent**. Anyone can do it in any language.
- **Machine translation owns the TEXT + AUDIO** — the part that requires knowing/typing the script.

MT here is a **starting point that the human re-authors structurally**, so it does *not* violate the governing principle ("never machine-translated in place"). That rule forbade shipping an auto-translation with wrong word order, unreviewed. Here the human always re-orders the symbols; MT only removes the script-typing requirement. Display was never the blocker — browsers render every script from system fonts; only *input* was.

### B. §3 amended — badge opens a MODAL, not straight into edit mode

Tapping the **"Made in <lang>"** badge opens a modal with two paths:

1. **Edit manually** — the existing composition-builder edit flow (for instructors who can type the target script). Unchanged from original §3.
2. **Translate to <lang>** — MT translates the fluent text and generates TTS **audio in the target-language voice**, pre-fills a new variant, then drops the instructor into the builder to **re-order the symbols to match the target-language structure** (an explicit warning states this is required). On save: the §1 sibling row is created exactly as before.

Both paths produce an ordinary sibling variant row (§1); only the seeding differs.

### C. §6 reversed — MT-assist is IN scope for 15.5

MT-assist is no longer deferred. It is the **accessibility path**, load-bearing (without it the target-script fixtures cannot be authored or tested). It reuses existing translation + TTS infrastructure. What §6 still forbids stands: MT output is never shipped unreviewed — the human always confirms/re-orders the structure.

### D. Labels translate; structures get variants (answers "do modules have variants?")

A module / folder / group has **no structure to re-order** — it is only a **name**, an order-free label. Labels are **not** variants. A label is **one localised record carrying every language** (`{en, es, hi}`) and translates live (ADR-009). Therefore:

| Thing | Model | How it gets the target language |
|---|---|---|
| Folder / group / module **name** | one multi-key label record | live translation; MT may **auto-fill a missing language key on demand** (safe — no re-ordering) |
| Composed content **inside** (phrase, sentence) | per-language **variant** (§1) | badge → modal → MT text+audio, **human re-orders symbols** |

- **Default modules** ship pre-translated (their names must carry all languages — the gap fixed in the Phase 15.5 bug pass; see [`phase-15.5-content-variants.md`](../plans/phase-15.5-content-variants.md) bug #3).
- **User-created folder/group names are NEVER auto-translated on create** (owner decision 2026-07-12: at N languages, auto-filling every key on every create is O(N) waste for a label most instructors never switch board-language on). Instead the name stays single-key until the instructor asks. In **folder/group edit mode**, when the **current board language's key is empty**, a **translate icon** appears next to the rename field; tapping it MT-fills *that one key* and drops the value into the still-editable rename input so the instructor can **correct it on their OS-language keyboard**. Lazy, per-language, on demand — never a bulk fan-out.
  - This is why an instructor's own EN folder (`{en:"Going Places"}`) correctly stays English on an es/hi board until they translate it — distinct from a *default module* folder, which ships pre-translated.
- **Modules never gain the variant machinery.** Only the structure-bound composed content *inside* them does.

### E. Scope note

This enlarges the 15.5 build surface (translate-API + target-voice TTS wiring, the badge modal, the "Translate name" action). It is justified: the manual-only flow cannot be exercised by the owner and does not serve the product's cross-script users.

---

## Addendum (2026-07-13) — Model reaffirmed; badge = translation state; dedupe

Owner testing of the shipped authoring flow prompted a review of whether fluent
sentences and phrases really need the sibling-row model (their symbol order is
*visual only* — they play as one whole-utterance clip; only sequence sentences
play stepped). **Decision: keep the sibling-row model for all three types.** A
different per-language symbol *arrangement* is a genuine requirement (English vs
Hindi word order/combination differ), and "Edit manually → straight into edit
mode" is the desired UX for authoring it. Live-translation-on-one-row was
rejected because it cannot hold a per-language arrangement.

Cleanups made under this decision:

- **Badge reflects translation STATE, not the `authoredLanguage` tag.** The old
  condition (`authoredLanguage !== board`) suppressed the "Made in <lang>" badge
  for a *manually*-created but untranslated variant (a row tagged with the board
  language but still holding source-language content), stranding the instructor
  in the source language with no way back to the translate modal. New shared
  helper `needsTranslation(primary, boardLang)` (`lib/languages/variants.ts`)
  drives the badge off whether the primary localised field (fluent → `text`,
  phrase → `name`) actually has a board-language entry — so a junk/partial
  variant still shows the badge, and re-translating reuses the row (idempotency)
  and fills its keys. Sequence sentences remain tag-based.
- **Translate applies without forcing edit mode.** Only *manual* authoring drops
  into edit mode; *translate* produces complete content and leaves the item in
  place (refine later if wanted).
- **Variant records merge source + target keys** (e.g. name `{en, hi}`) — the
  source-language keys are an intentional fallback so a partial variant shows
  source text + the badge rather than blank. The fluent `text` path was made
  consistent with the phrase `name` path (previously wrote target-only).
- **De-duplicated the near-identical machinery:** shared `findVariantInGroup`
  (`convex/lib/variantAuthoring.ts`) for group materialisation + idempotency;
  shared `makeRecordFiller` (`lib/languages/translateClient.ts`) for the batched
  MT gap-fill used by both unit and phrase translation; shared
  `reconcileVariantOrder` (`lib/languages/variants.ts`) for the collapse
  order-sync. Behaviour preserved (block-sentence translate output unchanged).

---

## Addendum E — Phase 15.5: unified live-translation badge for order-free labels

The variant machinery above (sibling rows, per-language *arrangements*) is for
**composed** content — sentences and phrases. **Order-free labels** — folder /
group names, list titles, list item descriptions — have no arrangement to hold
per language; they are plain localised records (`{en, hi, …}`) that just need
the board-language key filled. Phase 15.5 gives them the same *discoverable*
translation UX as variants, without the sibling-row model:

- **One `TranslateBadge`** (`app/components/app/shared/ui/TranslateBadge.tsx`) —
  the view-mode "Made in <lang>" pill, rendered iff `needsTranslation(record,
  boardLang)`. Reused for folder names, list titles and list item descriptions.
- **One generic `TranslateChoiceModal`**
  (`app/components/app/shared/modals/TranslateChoiceModal.tsx`) — a data-driven
  mode-picker; the parent runs the work and persists. Folder modal = translate
  name / manual. List title + item modals = whole list / just this one / manual.
  `VariantAuthorModal` is deliberately **left as-is** for sentences/phrases (no
  refactor of working code); a minor two-modal overlap is accepted.
- **Translate applies silently** (fills the missing key via the shared
  `makeRecordFiller` / `translateTexts`, then persists — no forced edit mode),
  mirroring Addendum D. **Manual** opens the field's existing edit affordance.
- **Folder edit-icon (slice 3) superseded.** The earlier edit-mode translate
  icon on `GroupTile` (Addendum D) is replaced by the view-mode badge + modal,
  unifying folders with lists/sentences. `GroupTile` is shared by categories,
  list groups and sentence groups, so all three get the badge uniformly.
- **Lists made multi-language-safe (prerequisite).** List items now carry the
  full `descriptionRecord` (not just a board-resolved string) through hydration,
  edit and persist, and both list renames merge under the board language —
  otherwise editing a multilingual list on one board flattened every other
  language's text, clobbering translations.
- **Audio: no work.** List playback is voice-follows-text
  (`ListItemPlayModal` re-resolves TTS from the board-language description), so a
  translated item simply plays in the board language; human recordings keep
  theirs (expected).

Implemented by [`phase-15.5-list-translation.md`](../plans/phase-15.5-list-translation.md).

---

## Addendum H — Stage 1 of the Variant Lifecycle: board-accent block voice

Block/sequence composition playback now voices every block in the **collapsed row's
single `authoredLanguage`** (board-accent), fixing the Phase 15-review word-vs-phrase
voice split. Before: within one Hindi-authored variant, a translated phrase-name
played in Hindi while a still-English word played English-in-Hindi-accent (two voices,
one utterance). Now: all blocks in the same saved variant carry `locale: resolveLang`
(the composition's `authoredLanguage`), so the whole utterance speaks in one
board-accent voice. This is **Stage 1 of the Language Variant Lifecycle model**
(see [`2026-07-18-language-variant-lifecycle-design.md`](../../superpowers/specs/2026-07-18-language-variant-lifecycle-design.md)).

Retroactive, no migration. Applies to §1 sibling variants and live talker blocks (which
retain per-item `locale` and continue to mix languages at the talker bar level).

---

## Addendum I — Stage 2 of the Variant Lifecycle: fork-on-edit + audio integrity

Stage 2 closes the remaining integrity gaps behind the board-accent model. Three
decisions, all additive (one widened mutation arg; no schema change, no migration).

### A. Fork-on-edit — a direct edit of a fallback never mutates the source

The **normal** authoring path is unchanged: the "Made in <lang>" badge → the variant
author modal, which creates a §1 sibling and writes to it. But a user *can* enter edit
mode and directly edit a **fallback** item — a source composition showing on a
non-origin board because no board-language variant exists yet (the badge state). Doing
so previously wrote straight to the shared source row, **clobbering the origin board**
(owner-confirmed on retest). This is a deviant-but-valid path, and it must be safe.

**Rule (uniform across all composed types):** before any edit write, if the collapsed
row's `authoredLanguage` (defaulting to `DEFAULT_LOCALE`) differs from the board
`language`, **fork** — create/reuse the board-language variant via the existing
**idempotent** `create*Variant` mutations (`createSentenceVariant` /
`createPhraseVariant`, keyed per `(group, language)`, returning the fork id) — and write
to the fork. Otherwise write to the row directly. This reuses the *same* mutations the
badge flow uses, so it is **not** duplicate code — only the entry point differs (an
in-place edit vs. the badge tap). Applied at:

- **Sequence sentences** — the `persistUnits` choke-point (Stage 1 / Task 1).
- **Standalone phrases** — `resolvePhraseTargetId` in `TalkerDropdown`, routing the four
  name/word handlers and the phrase-audio override through the fork check.
- **Fluent sentences** — `SentenceAudioModal.handleSave`, forking then writing the
  board-language-keyed `text` record (see C).

Lists need no fork logic: they are single-record localised labels (Addendum E), so a
per-language edit merges under the board key without touching other languages.

### B. Board-accent literal-TTS for all authored content

A **composed/authored** item speaks its **exact typed text** via TTS, bypassing the
SymbolStix per-language default-audio lookup (which swaps a known word for the board
language's canonical word — a translation). So a localized/forked item speaks its literal
authored text **in the board voice** (e.g. English text on a Hindi board → Hindi accent,
NOT the translated "nashta"); an un-translated fallback (badge) speaks in the origin
voice. Carried by the `literal` flag on `resolveTtsKey`/`playTts` → `POST /api/tts`
(skips the symbolstix branch). Applied to **sentence blocks** (Stage 1) and now
**list-item descriptions** (Task 5 — a 1-word description like "breakfast" no longer
translates). Phrases already worked (their multi-word names match no single symbol).

### C. Fluent fork `text` is written as a plain string (deploy-free)

A forked fluent variant carries `authoredLanguage === boardLanguage`, and the fluent
badge normalises a plain-string `text` under that tag (`SentencesModeContent`'s
`fluentPrimary`: `typeof text === 'string' ? { [authoredLang]: text } : …`). So writing
`text` as a **plain string** already yields correct board-accent playback and badge
suppression — no record needed. `updateProfileSentenceAudio`'s `text` arg is therefore
kept as `v.optional(v.string())`. (An earlier draft widened it to a record; that was
reverted because Convex is deployed from `main` — the worktree can't deploy a widened
validator, so the client must match the live `v.string()` contract. `createSentenceVariant`
still seeds the fork's `text` as a record from the source, which read paths handle.)

### D. Word-unit stale-audio invalidation

Editing a word unit in a sequence composition invalidates its cached per-unit clip so the
next play re-resolves audio for the new text (Stage 1 / Task 1).

**✅ Shipped on `main` (2026-07-19):** `skipSymbolstix` on `ttsCache.lookup` so literal
clips **cache** (keyed as literal) instead of regenerating on every play. Needed a `main`
Convex deploy, so it rode the merge rather than the worktree. Verified end-to-end via the
`/api/tts` payloads: a literal known word (`breakfast`) returns `source:"generated"` on
first play then `source:"cache"` (same `r2Key`) on replay, while a plain (non-literal)
request still returns `source:"symbolstix"` — the skip is scoped to literal only.

This is **Stage 2 of the Language Variant Lifecycle model**
(see [`2026-07-18-language-variant-lifecycle-design.md`](../../superpowers/specs/2026-07-18-language-variant-lifecycle-design.md)).
Stages 3 (revert) and 4 (delete→whole-item) remain.

---

## Addendum J — Stages 3 & 4 of the Variant Lifecycle: Revert + whole-item Delete

**✅ Shipped on `main` (2026-07-19).** Stages 3 and 4 close out the Language Variant
Lifecycle model (Addenda H/I were Stages 1/2). This addendum **supersedes §5** ("Delete
semantics — delete-one-variant + promote-source"): Delete no longer removes a single
variant with source-promotion. Delete and Revert are now two distinct, differently-scoped
operations.

### A. Delete = whole item, across every language

The trash button now deletes the **entire logical item** — the source row and every
`variantGroupId` sibling, in one action — not just the collapsed row showing on the
current board. New Convex mutations `deleteSentenceGroup` / `deletePhraseGroup`
(`convex/profileSentences.ts`, `convex/profilePhrases.ts`) resolve `variantGroupId ?? _id`
and delete every sibling, returning the personal-recording R2 keys freed by the group. A
thin route, `POST /api/delete-composed` (`app/api/delete-composed/route.ts`), runs the
mutation for `{ kind: 'sentence' | 'phrase', id, scope: 'group' }` then deletes those keys
from R2 (mirrors `delete-profile-symbol`). The delete confirm copy was upgraded to a
**heavy confirm** stating the removal spans every board language and cannot be undone —
matching the "Delete safety" owner decision in the lifecycle spec (permanent, explicit,
no trash/undo). Lists are unchanged: a list item/list delete was already whole-item (lists
have no per-language sibling rows), so no list-side change was needed.

### B. Revert = this board's variant only

A new edit-mode **↩ (Revert)** icon removes just the current board's forked/authored
variant and falls back to the origin — the opposite scope from Delete, and the "clean way
back" the lifecycle spec's owner decisions called for. Shown only when the collapsed row
on the current board is a real, revertable variant (`variantGroupId` set and
`!== _id` for composed content; a board-language key present alongside a surviving origin
key for lists). Gated behind a **light confirm** (no "every board" language, since only
one board is affected).

- **Composed content** (sentences via `PhraseEditCard` / `BlockEditControls`, standalone
  phrases via `TalkerDropdown`): Revert calls the same `/api/delete-composed` route with
  `scope: 'variant'`, deleting only that one sibling row (plus its personal-recording R2
  keys). The group's other siblings and the source are untouched; the board falls back to
  showing the origin with its "Made in `<lang>`" badge again.
- **Lists**: Revert has no sibling row to delete — a list item/title is one localised
  record (Addendum E). New mutation `revertProfileListLanguage` (`convex/profileLists.ts`)
  strips the current board's language key from the list `name` and every item
  `description` via a new helper `stripLocaleKey` (`lib/languages/variants.ts`), leaving
  the origin key(s) intact.

### C. R2 cleanup stays personal-recording-only

Both Delete (group scope) and Revert (variant scope) route through `/api/delete-composed`,
which only ever deletes R2 keys passing `isPersonalAssetKey` (prefix `accounts/` or
`profiles/`) — an instructor's own uploaded images or recorded audio. **Shared assets are
never deleted by either operation**: generated TTS clips under `audio/<voice>/tts/…`,
`symbols/…`, and `ai-cache/…` are cross-user/cross-profile and outlive any single item's
deletion or revert, exactly as the collectors already guaranteed for the single-row delete
paths this addendum extends.

### D. 1-word phrases now valid

A standalone phrase (and, by extension, a per-language phrase variant) may legitimately be
a single word — e.g. a Hindi variant that is one symbol where the English source is two.
The `>= 2` / `< 2` word-count guards that treated a 1-word phrase as not-yet-ready or
incomplete were relaxed to `>= 1` / `< 1` throughout the tappable-bank filter and the
incomplete/warning threshold (`TalkerDropdown.tsx`, `InlinePhraseEditor.tsx`); only a
0-word phrase is now "incomplete."

This is **Stage 3 & 4 of the Language Variant Lifecycle model**
(see [`2026-07-18-language-variant-lifecycle-design.md`](../../superpowers/specs/2026-07-18-language-variant-lifecycle-design.md)).
All four stages of the lifecycle model are now shipped.

---

## Addendum K — Edit-mode-only translation affordances

**✅ Shipped on `main` (2026-07-22).** An owner audit found the "Made in `<lang>`"
badge was a tappable `<button>` rendering on the **student** surface at 5 of 7
adoption sites — the variant-authoring entry point (§3) was reachable outside
edit mode. This is a **student-permissions fix**, not cosmetics: **nothing
translation-related renders outside edit mode**, full stop.

### A. Three shared components replace the badge-as-button

- **`TranslateRevertControl`** — a single state-swapping icon: `untranslated` →
  translate glyph (opens the surface's translate verb, see table below);
  `translated` → ↺ revert glyph; `none` → renders nothing. Edit-mode only.
- **`MadeInLabel`** — a non-actionable `<span>` rendering "Made in `<lang>`".
  Replaces the old tappable badge everywhere. Edit-mode only, same as
  `TranslateRevertControl` — no adoption site renders it in view mode; that is
  the entire point of the fix in the paragraph above, so nothing licenses
  reintroducing view-mode chrome here.
- **`UseOriginalConfirmDialog`** — the shared "Use original" confirm; Revert is
  **always** confirmed (light confirm, per Addendum J §B — only one board is
  affected, unlike Delete's heavy confirm).

`TranslateBadge.tsx` is deleted (zero importers remained once every adoption
site moved to the two-component split).

### B. §3's badge-as-entry-point is SUPERSEDED

§3 ("Authoring entry — badge → edit mode") described the "Made in `<lang>`"
badge itself as the tappable entry point into variant authoring. That is
superseded: the entry point is now the **translate state of
`TranslateRevertControl`**, available only in edit mode, and only in the edit
toolbar or inline beside the title (placement below) — never as a tap target
on the "Made in" text. The "Made in `<lang>`" pill is now purely informational
(`MadeInLabel`), rendered inside the toolbar's own right-hand column on
list/sentence rows and inside the phrase card's `controls` row (placement and
Figma nodes in §C); `GroupTile` shows no pill at all. Addendum D (2026-07-12)'s "translate icon next
to the rename field" and Addendum E's badge/modal ("Folder edit-icon (slice 3)
superseded") are folded into this same edit-mode-only shape; nothing about
those decisions' verbs changed, only where the control lives and that it is
never actionable outside edit mode.

### C. Adoption + placement

- **`GroupTile`** (folders + categories) — control inline right of the title,
  no pill (Figma `3017-2352`).
- **List rows, list-detail items (edit renderers only), sentence rows** —
  control lives IN the edit toolbar, with the `MadeInLabel` pill inside the
  toolbar's own right-hand column, right-aligned (Figma `3025-2325`).
- **Phrase cards** — control lives IN the edit toolbar, with `MadeInLabel`
  inside the phrase card's `controls` row (Figma `3233-6978`).

### D. The verb is surface-specific (never MT for composed content)

| Surface | Content kind | Translate verb |
|---|---|---|
| `GroupTile` (folder/category name) | order-free label | machine translation (fills missing board-language key) |
| List row / list title | order-free label | machine translation |
| List-detail item description | order-free label | machine translation |
| Sentence row (fluent/sequence) | composed content | **opens the variant-authoring flow** (§3/Addendum B modal) — **never MT** |
| Phrase card | composed content | **opens the variant-authoring flow** — **never MT** |

This is unchanged doctrine (ADR-016 §2's governing principle, Addendum D:
"labels translate; structures get variants") — Addendum K only relocates
*where* the verb is reachable from, not *what* the verb does. Verified live on
`main`: tapping translate on a sentence opens the "Make a हिन्दी version" modal
and fires **zero** `/api/translate-text` requests.

### E. State precedence: `untranslated` beats `revertable`

Owner decision: when a row is *both* revertable (has a `variantGroupId` sibling
on this board) *and* still untranslated (its primary localised field has no
board-language entry — e.g. a variant row created manually but abandoned
mid-edit, still holding source-language text), `TranslateRevertControl` shows
the **`untranslated`** state, not `revertable`. A half-finished variant keeps
its one-tap route back into authoring rather than being routed into Revert
(which would only delete the row and fall back to the source, destroying the
in-progress work without offering the completion path). Revert is reachable
once the row is genuinely translated.

### F. No new Convex mutations

Every verb reuses an existing mutation or route: `renameFolder` / category
rename / `updateProfileListName` / `updateProfileListItems` /
`revertProfileListLanguage` / `/api/delete-composed` (`scope: 'variant'`) /
the existing variant-authoring entry points (`createSentenceVariant` /
`createPhraseVariant`) and their save paths.

This is **Stage 5** of the Language Variant Lifecycle model in effect, though
it sits outside that model's original four numbered stages (Addenda H–J) —
it is a permissions/UX correction over the already-shipped affordances, not a
new lifecycle capability.

Implemented by [`phase-15.7-translate-revert-control.md`](../plans/_done/phase-15.7-translate-revert-control.md).

---

## Supersedes / relates

- Extends **ADR-015** (composition primitive) — variants are sibling compositions, same `units[]`/`words[]` shape.
- Builds on **Phase 15** `authoredLanguage` ([`_done/phase-15-language-design.md`](../plans/_done/phase-15-language-design.md)); broadens the badge rule beyond block/sequence.
- Implemented by [`phase-15.5-content-variants.md`](../plans/phase-15.5-content-variants.md).
- Addendum J (Stages 3 & 4) implemented by [`phase-15.6-variant-lifecycle-3-4-delete-revert.md`](../plans/_done/phase-15.6-variant-lifecycle-3-4-delete-revert.md); **supersedes §5.**
- Addendum K implemented by [`phase-15.7-translate-revert-control.md`](../plans/_done/phase-15.7-translate-revert-control.md); **supersedes §3's badge-as-entry-point.**
