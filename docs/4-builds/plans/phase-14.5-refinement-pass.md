# Phase 14.5 — Refinement Pass (pre-Phase 15)

Refinement backlog captured after Phase 14 (Sentence Builder + Talker Renovation) and
before Phase 15 (Bilingual Symbols + Tone TTS). Surfaced by hands-on testing and
content-making in the admin account.

Organised into workstreams by theme, ordered roughly by dependency and effort. Quick
wins first, the publishing-model overhaul as the architectural anchor, then independent
polish batches. One item (content taxonomy / reseed) is **blocked on decisions**, not code.

Status legend: ☐ todo · ◐ in progress · ☑ done

---

## Workstream 1 — Marketing / library-site cleanup
_Small, independent, mostly copy + routing. Warm-up batch._

- ◐ **1.1 Retire `/library`, promote `/library/modules`** as the canonical URL.
  **Minimal redirect done:** `/library` + `/library/[slug]` now 308-redirect to
  `/library/modules`; Navbar + sitemap repointed. Dormant packs code/backend/admin
  (LibraryGrid, PackDetailContent, resourcePacks queries, `/admin/library`,
  `library_packs/` data, in-app home `LibraryPacksSection`) left in place for a
  **later dedicated teardown** — see follow-up below.
- ☑ **1.2 Remove the Themes tab** from `/library/modules`. Themes get marketed
  separately; not content, so it doesn't belong here. _(9b76ceb)_
- ☑ **1.3 Fix card copy** — a category card read "1 categories"; now shows "# symbols"
  (symbol total across the module's grids) on card + detail page, ICU-pluralised.
  _(cca39fa)_

## Workstream 2 — Publishing model: move to module-level
_The architectural anchor. Deserves its own feature spec + likely a branch before coding.
Changes admin publishing surface across categories / lists / sentences._

Intent: publishing belongs at the **module** level, not on individual items. The dropdown
refurb captured this correctly — **Core words** and **Phrases** are experiments and only
keep a simple "publish default" button (we only seed refined SLP selections of these on
sign-up). Every **other** module carries marketing value in the resource library and needs
a full publish control.

- ☐ **2.1 Strip per-item publishing** — remove "Republish" and "Save to pack" from
  individual list items and individual sentences, across all module pages.
- ☐ **2.2 Remove the stray inactive "Republish to JSON" button** in sentence modules.
- ☐ **2.3 Add module-level "Publish" control** to list & sentence modules — choose
  default / free / pro / max, mirroring the pattern category details already has. Core
  words & phrases keep their simple "publish default" button.
- ☐ **2.4 Add "Reload defaults" button** to list & sentence modules for instructors
  (exists in category details today, missing in lists/sentences).

> Note: the "reload defaults exists in category details but not lists/sentences" gap and
> WS4.2 both suggest lists/sentences drifted from a shared pattern. Confirm whether a
> shared component can unify these rather than patching twice.

## Workstream 3 — Admin label consistency
_Same admin surface as WS2 — best done alongside/after it._

Current state is inconsistent:
- **Categories** (e.g. Action): "Default" on the group tile **and** the details banner;
  "From pack" on the details banner.
- **Lists**: no label on the group tile; both "Default" and "From pack" on the list, and
  "Default" in the list-items banner.
- **Sentences**: both labels on the sentence; nothing on the group tile.

- ☐ **3.1 Normalize** — labels appear **only on group tiles**, **only in admin view**.
  No labels on banners or on content. Apply consistently across categories, lists,
  sentences.

## Workstream 4 — Edit-mode UI consistency

- ☐ **4.1 Category-details symbol edit state → match the core-words dropdown.** Replace
  the edit-toolbar layout (which forces symbols small and awkward) with: dashed border,
  per-symbol ✕ delete, drag-to-reposition. Nice touch: `move` cursor on symbol hover.
- ☐ **4.2 Fix phrases-dropdown audio indicator** stuck on "Tap to add audio" in edit mode
  even when audio is ready. Should read "Audio ready" like the sentence-module phrase
  builder — expected to share a component, so track down the divergence.

## Workstream 5 — Sentence playback & display

- ☐ **5.1 Revamp the single-symbol sentence play modal** (sentences built from single
  symbols on the sentence page): smaller sentence text; symbols grouped on the
  module-color background; yellow glow animating while audio plays; add the replay button
  from the other sentence play modal. **Extract as a shared component.**
- ☐ **5.2 Block sentences saved from the talker** — show the full sentence text to the
  right of the symbols, like other sentences.

## Workstream 6 — Responsive polish

- ☐ **6.1 Small-screen sentence & list content** — shrink to fit the container better;
  consider stacking the title below the symbols.

---

## 🚧 Blocked on decisions — content strategy (not yet)
_Deferred: still editing/making content in the admin account, and want to understand the
pipeline before acting._

- ☐ **C.1 Generalize the module taxonomy.** Drop category-specific modules (religion, fun,
  christmas — too specific, look out of place). Keep **Life Skills** + **Starter Language**
  for launch. Rationale: specialized topics belong in **categories**; **lists** = task
  analysis; **sentences** = learning how to talk.
- ☐ **C.2 Decide reseed strategy** for the `libraryModules` table: burn-and-reseed the
  whole table vs. publish modules back one-by-one from the admin account (checking
  visibility on the marketing site as we go).
- ☐ **C.3 (enabler, non-destructive, can do anytime)** Document how the
  modules → `libraryModules` → marketing-site pipeline works end to end, so the reseed
  decision (C.2) is made from knowledge. Blocked on nothing.

---

## Suggested order

1. **WS1** — quick wins, build momentum.
2. **WS2 + WS3** together — one coherent admin-publishing pass. Biggest item; write a
   feature spec and consider a branch before coding.
3. **WS4**, **WS5**, **WS6** — independent polish batches, any order.
4. **C.3** — do the pipeline write-up whenever; unblocks the content strategy.

## Follow-ups (spawned from this pass)

- ☐ **Full packs-system teardown** (deferred from WS1.1). Once content is settled and a
  `convex export` backup is taken, rip out the dormant packs ecosystem: `/library` +
  `/library/[slug]` routes, `LibraryGrid` / `PackDetailContent` / `LibraryPackCard` /
  `LoadPackButton`, the `resourcePacks` public queries, `/admin/library` + `pack-publish`
  route, the in-app home `LibraryPacksSection`, and `convex/data/library_packs/`. Crosses
  backend + admin → its own plan (+ possibly an ADR superseding ADR-010).

## Completed

- WS1.2 — Themes tab removed from `/library/modules` _(9b76ceb)_
- WS1.3 — category cards + detail show symbol count, ICU plurals _(cca39fa)_
- WS1.1 (partial) — `/library` minimal redirect + Navbar/sitemap repoint
