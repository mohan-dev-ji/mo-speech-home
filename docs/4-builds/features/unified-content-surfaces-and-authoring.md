# Unified Content Surfaces & Authoring — Design Doc

**Status:** Draft for review (read slowly, not ready to build) · **Date:** 2026-07-02
**Relates to:** [ADR-014 (content modules + three trees)](../decisions/ADR-014-content-modules-and-three-tree-organisation.md) · [ADR-015 (composition primitive + phrase tree)](../decisions/ADR-015-composition-primitive-and-phrase-tree.md) · builds on the shipped Phase 14 dropdown edit modes.

> **One-line vision:** every place a user organises content — the Categories board, Lists, Sentences, and the talker dropdown's Core words and Phrases — is the *same* thing: a grid of **groups** (GroupTile) you drill into to reach **items**, with *one* editing flow and *one* admin authoring system (Defaults → Publish → Republish) behind all of it.

This doc is a **design/vision** doc, not a step-by-step plan. It captures the model, the decisions still open, and a rough build order so we can talk it through before committing to a phased plan. Nothing here is built yet unless the "What already exists" section says so.

---

## 1. The north star: sameness

Today we have five content surfaces that *look* related but were built at different times with slightly different mechanics:

| Surface | Tree | Group primitive | Item | Where it lives |
|---|---|---|---|---|
| Categories board | `categories` | GroupTile (folder) | symbol | Categories page |
| Lists | `lists` | GroupTile (folder) | list item | Lists page |
| Sentences | `sentences` | GroupTile (folder) | sentence | Sentences page |
| Core words | `categories` + `surface:"core"` | GroupTile *(as of Phase 14)* | symbol | Talker dropdown |
| Phrases | `phrases` | *(N top-level tabs — inconsistent)* | phrase | Talker dropdown |

The goal is to make **all five identical in shape**:

> **tab / page → grid of GroupTiles (groups) → drill into a group → items** — with the same rename / image / delete / reorder / add / create gestures, and the same admin authoring system underneath.

When every surface is the same, there is *one* thing to learn (for users), *one* set of components to maintain (for us), and *one* authoring pipeline (for you). That's the whole bet.

---

## 2. The dropdown, simplified to two tabs

**Today:** the dropdown has a *Core words* tab plus **one tab per phrase bank** (`Phrases 1`, `Phrases 2`, …). Bank tabs don't scale (they eat horizontal space) and they're structurally different from the core tab.

**Proposed:** exactly **two tabs**, symmetric:

```
┌ Core words ─┬─ Phrases ─┐
│  [Edit] [Create Group] [Load defaults]        ← same chrome both tabs
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐
│  │Group │ │Group │ │Group │ │Group │          ← GroupTiles
│  │tile  │ │tile  │ │tile  │ │tile  │
│  └──────┘ └──────┘ └──────┘ └──────┘
```

- **Core words tab** → GroupTiles for core groups (General, Pronouns, …, Numbers, Letters). Drill in → the group's **symbols**.
- **Phrases tab** → GroupTiles for phrase groups (the old "banks" — a `tree:"phrases"` folder is now just a *group*). Drill in → the group's **phrases**.

Both tabs are the **same component** parameterised by surface. The only difference is what an *item* is (a symbol vs a phrase) and what happens on tap (insert a word-unit vs a phrase-unit into the talker bar).

### Interaction model (identical both tabs)

| Mode | Tap a GroupTile | Tap an item (drilled in) |
|---|---|---|
| **Normal** | drill into the group | insert the item into the talker bar |
| **Edit** | drill into the group (to edit its items) | open the item editor (symbol editor / phrase editor) |

Group-level editing (rename, image, delete, reorder, **create group**) lives on the GroupTile / edit chrome, exactly as it does on the Categories board today. This is already how Phase 14 core words behave — we're extending the *same* behaviour to phrases and collapsing the bank tabs into one Phrases tab.

### What this changes vs. today
- `TalkerDropdown`'s `activeTab` goes from `'core' | 'bank-<folderId>'` to just `'core' | 'phrases'`.
- The Phrases tab renders a **GroupTile grid** (phrase groups) instead of a flat card list; drilling into a group shows that group's phrases (insert cards in normal mode, editable phrase cards in edit mode — both already exist from Phase 14).
- "Create Group" on the Phrases tab creates a phrase **group** (folder); "Create Phrase" moves *inside* a group's drill-in (you create a phrase where it lives, not at the tab root).

---

## 3. One authoring system for everything

There are two distinct roles, and keeping them on separate surfaces is the key architectural decision:

- **Instructor** edits *their own installed copy* of a group/item — in place (dropdown, Categories page, etc.). Already built for core words in Phase 14.
- **Admin (you)** authors the *source modules* that ship to everyone — via **Defaults → Publish → Republish**, the same flow categories/lists/sentences already use (`PublishModuleModal`, `RepublishButton`, `librarySourceId` linkage, `sync*ToPackIfPublished`).

> **Do not** put admin publish/republish controls on the instructor dropdown. It clutters the instructor surface and blurs "am I editing my copy or the canonical default?". Route all default authoring through the library/module surface.

The authoring system is **uniform across all module types**:

| Module type | Tree | Authorable as default today? | Gap |
|---|---|---|---|
| Categories | `categories` | ✅ full publish/republish | — |
| Lists | `lists` | ✅ | — |
| Sentences | `sentences` | ✅ | — |
| **Core words** | `categories` + `surface:"core"` | ⚠️ installs carry `surface`; **publish direction unverified** | confirm publish preserves `surface:"core"` |
| **Phrases** | `phrases` | ❌ newer (post-ADR-010, no pack propagation) | **needs a publish/republish path** — the main net-new backend work |

So "authoring for everything" mostly *already exists* for the category-shaped surfaces. The real work is: (a) confirm core-word publish preserves `surface`, and (b) give the **phrases tree** the same publish/republish/default machinery the other trees have.

---

## 4. The Resource Library gets a section per type

The library browse UI filters by **class** (Default/Free/Pro/Max) today. Add **type sections** so each surface is discoverable and authorable in one place:

- **Categories** (existing)
- **Lists** (existing)
- **Sentences** (existing)
- **Core words** — a **`surface:"core"` filter over the categories tree**, *not* a new tree. Core groups are structurally categories (a folder of symbols); a new tree would fork all the install/reload/publish machinery for no benefit. A surface-filtered section gives browse + author + publish for free while keeping them distinct (zinc, "default" class, dropdown-pinned).
- **Phrase groups** — the existing `phrases` tree. **Granularity = the group (bank), not the individual phrase.** A phrase group (folder + its phrases) is the analogue of a category module; individual phrases are *items inside*, exactly like symbols inside a category. Installing atomised single phrases would break the pattern (install-management, dedup, ordering) and fight the group model.

---

## 5. Reload defaults, per group (instructor-facing)

Once source modules are first-class for every surface, the instructor complement is **reload defaults on a single group in edit mode** — restore a group's items from its module source (`reloadCategoryFromLibrary` already does this for categories; each installed core category carries `librarySourceId` = its module slug). Phrases would get the equivalent once they have a module source.

We shipped a first piece of this already: a **"Load defaults"** button in the core edit chrome that backfills *missing* default modules (install-only). Per-group *reload* (re-sync an existing group) is the next increment, with a confirm dialog + toast matching the category detail page.

---

## 6. Open decisions (your call — flagged for the slow read)

1. **Core colour lock.** Core groups are zinc-locked today (no swatch), for motor-planning consistency. Now that they're full groups, do we (a) keep the zinc lock, or (b) allow colour like other groups? *Recommendation: keep the lock — core's value is visual consistency.*
2. **Phrase group images/colour.** Phrase groups as GroupTiles *can* have a folder image + colour. Do we want that, or keep phrase groups plain? *Recommendation: allow both — they're just groups.*
3. **Phrase module granularity.** Confirm: modules are **phrase groups (banks)**, not individual phrases. *Recommendation: groups.*
4. **Numbers/Letters as editable defaults.** Already done — but note the domain caution (§8): editable ≠ should-diverge. Keep the canonical default curated.
5. **Where "Create Phrase" lives.** Inside a phrase group's drill-in (create-where-it-lives), vs. at the Phrases tab root with a group picker. *Recommendation: inside the drill-in, for symmetry with symbols.*

---

## 7. Rough build order (not a commitment)

Small, shippable phases, each independently verifiable:

1. **Dropdown → 2 tabs.** Collapse bank tabs into one *Phrases* tab of phrase-group GroupTiles + drill-in. Reuses the Phase 14 phrase edit cards inside the drill-in. *(Front-end only; no schema change.)*
2. **Phrases publish/republish.** Give the phrases tree the default/publish/republish machinery the other trees have (the main backend piece).
3. **Confirm core publish preserves `surface`.** Small backend check + fix if needed.
4. **Library sections.** Add *Core words* (surface filter) + *Phrase groups* (tree) to the library browse/author UI.
5. **Per-group reload defaults** in dropdown edit mode (confirm dialog + toast).

Order rationale: (1) is pure UX simplification and de-risks the dropdown; (2)–(3) unlock authoring; (4) makes it discoverable; (5) is the instructor complement.

---

## 8. Domain caution (worth keeping in view)

Core vocabulary's value in AAC is **consistency** — same words, same positions, for motor planning. Making cores *editable* is on-brand for Mo Speech's customisability, and per-account tweaks are good. The thing to protect is the **canonical default**: a new user's core layout should be predictable. The module model gives you exactly this — one curated source + per-account snapshots that may diverge. So: author defaults deliberately; let instructors customise on top; don't let "editable" quietly mean "every account's core is different from day one."

---

## 9. What already exists (grounding)

- **Phase 14 (shipped):** core words render as GroupTiles in both modes with full edit (rename/image/delete/reorder/create); editable symbol drill-in board; phrase edit cards (word chips, name, audio, delete/move/reorder); talker Save → sentence composition; Numbers/Letters converted to `surface:"core"` modules; a "Load defaults" backfill button.
- **Authoring infra (shipped, category-shaped):** `PublishModuleModal`, `RepublishButton`, `setCategoryInLibrary`, `reloadCategoryFromLibrary`, `librarySourceId`/`librarySourceCategoryKey` linkage, module `class` (Default/Free/Pro/Max), install via `installContentModule` (propagates `surface`).
- **Phrases (shipped, but authoring-light):** `profilePhrases` table, `getPhraseBanks`, phrase CRUD + `moveProfilePhraseToFolder`; **no** publish/republish path yet.

---

## 10. Summary

- **Two dropdown tabs** (Core words, Phrases), each a GroupTile grid → drill-in. Symmetric, scalable, one component.
- **Every surface is the same shape** and the same edit flow.
- **One authoring system** (Defaults/Publish/Republish) for all module types; instructors edit copies, admins author sources.
- **Library sections:** Core words (surface filter on categories) + Phrase groups (existing phrases tree) — no new trees.
- **Main net-new work:** publish/republish for the phrases tree; a small check that core publish preserves `surface`.
- **Keep core defaults curated** even though they're editable.
