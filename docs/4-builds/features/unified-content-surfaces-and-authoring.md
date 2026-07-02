# Talker Dropdown as a Fringe Board — & Unified Authoring

**Status:** Draft for review (read slowly, not ready to build) · **Date:** 2026-07-02 · **Supersedes:** the folder-drill-in version of this doc.
**Relates to:** [ADR-014 (content modules + three trees)](../decisions/ADR-014-content-modules-and-three-tree-organisation.md) · [ADR-015 (composition primitive + phrase tree)](../decisions/ADR-015-composition-primitive-and-phrase-tree.md) · builds on the shipped Phase 14 dropdown edit modes.

> **One-line vision:** the talker dropdown is a **flat fringe board** — up to six instructor-curated tabs of loose, mixed **words and phrases**, one tap to insert. It is deliberately *not* the same shape as the organised library pages (Categories / Lists / Sentences), which keep folders. What's shared across everything is the **editing vocabulary** and the **authoring pipeline** — not the structure.

This is a **design/vision** doc, not a step-by-step plan. Read it slowly, mark it up; once the open decisions (§9) are settled I'll turn it into a phased build plan.

---

## 1. The correction: speed beats sameness

An earlier draft of this doc tried to make *every* surface identical — folders and drill-in everywhere, including the dropdown. That was wrong for one reason:

> **The dropdown's only job is to communicate *now*, in the fewest taps.** Every folder you nest inside it is another tap between a user and the word they need mid-utterance. `tab → folder → word` is two levels deeper than what's already on the market, and it makes a fast AAC feel slow.

The fix is the classic AAC distinction we'd blurred:

| | **Fringe board** (the dropdown) | **Library** (the pages) |
|---|---|---|
| Job | say it *now* | organise, teach, build |
| Shape | **flat** — tab → item → done | **foldered** — browse → folder → items |
| When | mid-conversation | between conversations |
| Content | high-frequency words + phrases, mixed | the long tail, by topic |
| Layout owner | the SLP/instructor (motor-planned) | the instructor, loosely |

So **sameness moves from structure to two things that genuinely should be uniform**:
- the **editing gestures** (create a symbol, create a phrase, edit an item, reorder), and
- the **authoring pipeline** (Defaults → Publish → Republish).

The dropdown stays flat. The pages keep folders. That's the whole correction — and flat is *less* to build, not more.

---

## 2. The dropdown model: flat tabs of mixed items

```
┌ Core words ─┬─ Phrases ─┬─ (＋) ─┐        ← up to 6 tabs; “＋” adds one (edit mode)
│  [Edit]                                    ← Edit toggles create/reorder/delete
│  ┌────┐ ┌────────┐ ┌────┐ ┌────┐ ┌────────┐
│  │word│ │ phrase │ │word│ │word│ │ phrase │  ← loose, mixed, one tap = insert
│  └────┘ └────────┘ └────┘ └────┘ └────────┘
│  ┌────┐ ┌────┐ ┌────────┐ ┌────┐
│  │word│ │word│ │ phrase │ │word│              ← stable grid slots (motor planning)
│  └────┘ └────┘ └────────┘ └────┘
└─────────────────────────────────────┘
```

- **Up to 6 tabs.** Ships with **2 seed tabs** ("Core words", "Phrases") as a starting point; the instructor renames/adds up to four more. There is nothing special about the seed names — they're a default the SLP reshapes.
- **Each tab is a flat, ordered grid of items.** Each item is **either a single symbol or a phrase**, mixed freely. No folders, no drill-in.
- **One tap inserts** the item into the talker bar. Then: close drop → back to categories or search. That's the entire fast path: *open drop → choose → close.*
- **Edit mode** (per the Phase 14 chrome): reorder items, delete items, rename/add/delete tabs, and **"Create symbol" / "Create phrase"** to add a new item to the current tab — reusing the existing symbol editor and phrase editor.
- **Motor planning = stable slots** (see §3): an item holds its position; adding or removing another item must **not** reflow the board, or the muscle memory that makes fringe boards fast is destroyed.

### Interaction (dead simple)

| Mode | Tap an item | Tap "＋ / Create" |
|---|---|---|
| **Normal** | insert word/phrase into the bar | — |
| **Edit** | open that item's editor | create a new symbol or phrase in this tab |

No group-tap, no drill-in, no back button. The dropdown never goes more than one level deep.

---

## 3. What is an item? (data model)

A dropdown item is exactly an **ADR-015 `compositionUnit`** — the `word | phrase` primitive we already defined for sentences:

- **word unit:** `{ kind:"word", slot, imagePath, audioPath?, label? }` — a snapshot of a symbol (image frozen, label resolves live per ADR-014 §4).
- **phrase unit:** `{ kind:"phrase", slot, name, audioPath?, words[] }` — carries its decomposition + its own clip, so tapping it inserts a phrase-unit into the bar exactly as today.

So **a tab is a named, ordered list of composition units.** That's the same shape as a saved sentence's `units[]`, just persisted as a reusable board instead of a finished sentence — we've already designed and shipped this primitive.

**Model options (a decision for §9):**

- **A — units array per tab (lean).** A `dropbarTabs` row: `{ accountId, name, order, slots: compositionUnit[] }`. Mixed words+phrases fall out for free; self-contained; minimal new surface area. Snapshot semantics (like sentence slots) — editing an item edits the tab's copy.
- **B — tab references library entities by id.** Each item points at a `profileSymbol` / `profilePhrase`. More normalised, keeps board + library in sync, but mixing reference-types is fiddlier and heavier.

**Lean: Option A.** A fringe board is a curated, self-contained artefact; snapshotting matches how sentence slots already work and keeps the primitive simple. Phrases that need to be *reused* live in the phrases library separately.

**Stable slots.** Store a fixed `slot` index (a grid position), not just array order. Deleting an item leaves a gap rather than repacking; the instructor decides whether to fill it. This is the one thing worth designing in from day one rather than retrofitting.

---

## 4. Move reference content to Categories

Not everything belongs on a speed surface:

- **Numbers, Letters, clock/date → Categories.** These are *lookup/reference* content — you rarely need "the letter q" or "17" mid-sentence at speed, and when you do, a folder is fine. They become ordinary `categories`-tree folders on the Categories board (fully editable there like any category).
- **The core fringe words → seed the flat tabs.** General, Pronouns, Joining words, Position words are exactly the high-frequency vocabulary a fringe board is *for*. Their symbols become seed items in the default dropdown tabs (mixed with a few starter phrases) — they stop being dropdown *folders*.
- **Split "Time".** The calendar/clock half → a Categories folder; a few high-frequency **time adverbs** ("now", "today", "soon", "later") earn a place *as items* in a tab. "Time" isn't one thing.

Net effect: the dropdown holds only what you reach for *while talking*; everything else is a tap-slower in the library, which is correct.

---

## 5. Seed content & the SLP curation loop

The board's quality *is* the product here, and it's a **content/research problem, not an engineering one**:

- Ship **opinionated, science-backed defaults** tuned for the **median user** — not a blank grid. Most instructors won't heavily customise, so the out-of-the-box tab set has to already be good (evidence-based core vocabulary, sensible motor-planned positions).
- **Field loop:** ship a small, showcase-quality starter (a handful of core words + a couple of phrases across the 2 seed tabs) → SLPs test → collect their best tab/item/position suggestions → fold the strongest, evidence-backed selection back into the shipped default.
- Pair the default with **short guidelines** (keep positions consistent for motor planning; group by function; don't overfill) so a customising SLP stays on the rails.

This decouples cleanly: engineering builds the flat-board mechanism + authoring; the *content* of the default board is curated over time from field feedback.

---

## 6. One authoring system (unchanged from before)

Two roles, two surfaces — keep them separate:

- **Instructor** edits *their own* board in place (the dropdown edit mode). Already partly built in Phase 14.
- **Admin (you)** authors the *shipped default* — the **starter tab set** — via **Defaults → Publish → Republish**, the same pipeline categories/lists/sentences use (`PublishModuleModal`, `RepublishButton`, `librarySourceId` linkage).

The only shift from the previous draft: the publishable "core" default is now a **starter dropbar tab set** (an ordered set of tabs, each a list of composition units) rather than a set of core-category folders. Everything else about the authoring pipeline is reused. Instructors who've customised keep their board; "reload defaults" restores the shipped starter.

> Still **do not** put admin publish/republish controls on the instructor dropdown — author defaults from the library/admin surface.

---

## 7. The library pages stay foldered

Categories / Lists / Sentences keep GroupTile folders and drill-in — that's right for organising and teaching. What they **share** with the dropdown:

- the **item editors** (symbol editor, phrase editor, audio modal),
- the **create gestures** (create symbol / create phrase),
- the **authoring pipeline** (Defaults/Publish/Republish, `librarySourceId`, reload-defaults).

What they **don't** share: structure. Pages nest; the dropdown is flat. That's intentional, not an inconsistency.

---

## 8. What Phase 14 gives us / what changes

**Reused as-is (backend + editors all stand):**
- `compositionUnit` (word|phrase), the talker bar's phrase-units, the symbol editor, the phrase editor, the generalised audio modal, `profilePhrases` CRUD, `surface` propagation, talker Save → sentence composition.

**Superseded / simplified in the dropdown:**
- The **folder drill-in** (core groups as GroupTiles you tap into) is *removed* from the dropdown — the dropdown flattens to tabs of loose items. GroupTile stays for the library pages.
- The **N-bank-tabs** model collapses; phrases become loose items in tabs.
- **Numbers/Letters** stop being `surface:"core"` dropdown categories and become ordinary Categories folders (a content migration, not a schema fight).

**Net:** Phase 14 was the right groundwork — the primitives and editors carry over; the dropdown *structure* gets simpler.

---

## 9. Open decisions (your call — flagged for the slow read)

1. **Data model:** Option A (units[] per tab, snapshot) vs Option B (references). *Lean: A.*
2. **Stable slots:** fixed grid positions with gaps, vs simple reorderable list. *Lean: fixed slots — motor planning.*
3. **Max tabs:** 6 total (2 seed + 4). Confirm the cap, or make it soft.
4. **Phrase reuse:** are phrases on a tab self-contained snapshots, or linked to a reusable phrases library? *Lean: snapshot for v1; library linkage later if needed.*
5. **Default board content:** owned by the SLP field loop (§5) — engineering ships the mechanism + a showcase starter, not the final vocabulary.
6. **What happens to General/Pronouns/etc. as categories:** do they survive on the Categories board too, or fully dissolve into the fringe tabs? *Lean: dissolve — they're fringe, not topical.*

---

## 10. Rough build order (not a commitment)

1. **Flatten the dropdown** to tabs-of-loose-items: remove folder drill-in; render each tab as a flat grid of composition units; tap = insert. *(Front-end; introduces the tab/units store.)*
2. **Tab CRUD + item CRUD:** add/rename/delete/reorder tabs; create-symbol / create-phrase into a tab; reorder/delete items; stable slots.
3. **Content migration:** Numbers/Letters/clock → Categories; seed the 2 starter tabs from the core fringe words + a couple of phrases.
4. **Authoring:** make the starter tab set a publishable default (Defaults/Publish/Republish) + per-board "reload defaults."
5. **(Content, parallel track):** SLP field loop → science-backed default board.

---

## 11. Domain notes / cautions

- **Fringe vs category is evidence-based**, not just tidiness — high-frequency core vocabulary always-available is a core AAC principle; the flat board honours it.
- **Motor-planning stability** is a real clinical requirement — protect item positions.
- **Opinionated defaults win** — a blank-canvas-with-guidelines fails the median instructor; ship a genuinely good board and let SLPs refine.
- **Editable ≠ should-diverge** — customisation is on-brand, but a good curated default is what most users actually live with.

---

## 12. Summary

- The dropdown becomes a **flat fringe board**: up to 6 tabs, loose mixed words+phrases, one tap to insert, no folders. *open drop → choose → close.*
- An item is an **ADR-015 composition unit**; a tab is an ordered list of them (lean model: a units array per tab, with stable slots).
- **Numbers/Letters/clock → Categories**; core fringe words + a few phrases + a few time adverbs **seed the tabs**.
- **Pages keep folders.** Shared across everything: editors, create gestures, and the **Defaults/Publish/Republish** authoring pipeline — not structure.
- The **default board content** is a science-backed, SLP-field-tested curation effort, decoupled from the engineering.
