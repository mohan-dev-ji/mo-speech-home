# Phase 14.5 — Refinement Pass (pre-Phase 15)

Refinement backlog captured after Phase 14 (Sentence Builder + Talker Renovation) and
before Phase 15 (Bilingual Symbols + Tone TTS). Surfaced by hands-on testing and
content-making in the admin account.

Organised into workstreams by theme, ordered roughly by dependency and effort. Quick
wins first, the publishing-model overhaul as the architectural anchor, then independent
polish batches. One item (content taxonomy / reseed) is **blocked on decisions**, not code.

Status legend: ☐ todo · ◐ in progress · ☑ done

---

## 📌 Status (updated 2026-07-06)

**Dedicated worktree:** `claude/wizardly-noyce-054294` — **kept live until Phase 14.5
completes** (Stage 2 teardown + any follow-up run from it or from `main`).

| Workstream | State |
|---|---|
| WS1.2 / WS1.3 | ☑ done _(9b76ceb, cca39fa)_ |
| WS1.1 | ◐ redirect done; full pack teardown folded into WS2/WS3 **Stage 2** |
| WS2 (publishing → module-level) | ☑ **Stage 1 shipped & merged to `main`** (merge `ba355a0`) |
| WS3.1 (single publish-class badge) | ☑ shipped with WS2 Stage 1 |
| WS4.2 (phrase audio indicator) | ☑ done _(main)_ |
| WS5.1 (single-symbol play modal) | ☑ done _(main)_ |
| WS4.1 · WS5.2 · WS6.1 | ☐ todo — on `main` |
| **Stage 2 — full pack teardown** (Tasks 7–9) | ☐ todo — on `main`, backup first |
| C.1 / C.2 / C.3 (content strategy) | ☐ blocked on decisions |

WS2/WS3 Stage 1 was built on the worktree then **merged into `main`** — main now carries
everything. Remaining work (WS4.1, WS5.2, WS6.1, **and Stage 2**) proceeds on `main`.

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

☑ **Stage 1 shipped** (built on worktree `claude/wizardly-noyce-054294`, **merged to
`main`** as `ba355a0`). Publishing now fires from each module's own page; the scattered
per-item pack controls + reload-defaults are removed. Commits: _f516ac0_ (tile badge) ·
_17699d5_ (categories publish) · _dcd6bb9_ (lists/sentences publish) · _9b077d6_ (strip
pack item UI) · _97ffd99_ (remove reload-defaults) · plus refinements _66f335d_ (zinc-900
badge) · _bfcd814_ (inline publish button). **Stage 2 (full pack teardown, Tasks 7–9)
still pending — now on `main`.** Full plan:
[phase-14.5-ws2-ws3-publishing-and-labels.md](phase-14.5-ws2-ws3-publishing-and-labels.md).
Design decisions that revised the original notes below:

- **Publish moves to each module's own page** (category detail; list/sentence folder
  banner) — it currently fires from the grid tile on *all* trees, not just lists/sentences.
- **Reload-defaults is dropped entirely** (not added to lists/sentences, and the existing
  category one is removed). Reset = **delete the module + reinstall from the library** —
  reuses existing install/uninstall flows; `librarySourceId` tracks the source.
- **Old per-item pack controls** ("Save to pack", "Republish to JSON") are removed (UI-only;
  backend deferred to the teardown — now Stage 2 of the same worktree plan).
- Core words & phrases keep their simple "publish default" button (unchanged).

## Workstream 3 — Admin label consistency
_Same admin surface as WS2 — best done alongside/after it._

Current state is inconsistent:
- **Categories** (e.g. Action): "Default" on the group tile **and** the details banner;
  "From pack" on the details banner.
- **Lists**: no label on the group tile; both "Default" and "From pack" on the list, and
  "Default" in the list-items banner.
- **Sentences**: both labels on the sentence; nothing on the group tile.

- ☑ **3.1 Normalize** — a single admin-only **publish-class badge** (Default/Free/Pro/Max,
  or "Draft") on group tiles only; no labels on banners or content. Replaces the scattered
  "Default" / "From pack" labels. Shipped with WS2 Stage 1 — see commit _f516ac0_ +
  _9b077d6_ (label strip).

## Workstream 4 — Edit-mode UI consistency

- ☐ **4.1 Category-details symbol edit state → match the core-words dropdown.** Replace
  the edit-toolbar layout (which forces symbols small and awkward) with: dashed border,
  per-symbol ✕ delete, drag-to-reposition. Nice touch: `move` cursor on symbol hover.
- ☑ **4.2 Fix phrases-dropdown audio indicator** stuck on "Tap to add audio" in edit mode.
  Root cause: both surfaces share `PhraseBuilderBody`, but `TalkerDropdown` computed
  `hasAudio` from stored paths only (`recordedAudioPath ?? audioPath`), while
  `InlinePhraseEditor` checks the live `ttsCache.checkMany`. Phrase TTS lives in the cache,
  not on the row, so the dropdown was always false. Fixed by mirroring the cache check
  (one batched lookup for all phrase names). _(main; TalkerDropdown.tsx)_

## Workstream 5 — Sentence playback & display

- ☑ **5.1 Revamp the single-symbol sentence play modal** — shipped as a variant of the
  block `CompositionPlayModal`. Symbols group on the **module (folder) colour at 50%**
  (`getCategoryColour(colour).c500` @ 50%) so the glow reads; the shared **`--theme-play-glow`**
  (`PLAY_GLOW`) sits on the **whole group** while the single clip plays (glow driven off the
  audio `play`/`ended` events); **24px** (`text-theme-h4`) sentence pill; footer has
  `pt-theme-general` so the glow never touches the buttons. Extracted shared **`ReplayButton`**
  (brand-primary "Replay") + **`PLAY_GLOW`** constant, now used by both modals.
  **Backdrop** matches the existing modals, not the mockup: `--theme-overlay`
  (`rgba(0,0,0,0.82)`), **no blur**. Figma design node: `3257-5627` (to be updated:
  backdrop = overlay/no-blur, glow = `#FACC15`). _(main; SentencePlayModal.tsx et al.)_
- ☑ **5.2 Block sentences saved from the talker** — full sentence text now shows to the
  right of the blocks (view + edit, read-only). Talker sentences keep no maintained
  whole-sentence title, so the text is **derived from the blocks** (`word→label`,
  `phrase→name`, joined) — exactly what plays; no audio nudge (sequence audio is per-unit).
  _(main; SentencesModeContent.tsx)_

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

## Execution split (decided 2026-07-06; updated post-merge)

- **Original split:** WS2 + WS3 + pack teardown on the worktree
  `claude/wizardly-noyce-054294`; WS4/WS5/WS6 on `main`.
- **Now:** WS2/WS3 **Stage 1 is merged into `main`** (`ba355a0`), so `main` is the single
  source of truth. All remaining work — WS4.1, WS5.2, WS6.1, **and Stage 2 (pack
  teardown)** — proceeds on `main`. The worktree stays live until Phase 14.5 completes as a
  reference/scratch space (e.g. for the Stage 2 recon), but landings go to `main`.
- **Whenever:** C.3 pipeline write-up (non-destructive), then the C.1/C.2 content strategy.

## Follow-ups (spawned from this pass)

- ◐ **Full packs-system teardown** (deferred from WS1.1) — **folded into the WS2/WS3 plan
  as Stage 2** (Tasks 7–9): backup + recon manifest → delete pack UI/routes/backend/
  data → drop `resourcePacks` table + `packSlug` schema fields. Stage 1 has landed on
  `main`, so Stage 2 now **runs on `main`** (take a `npx convex export` backup first).
  May warrant an ADR superseding ADR-010.

## Completed

- WS1.2 — Themes tab removed from `/library/modules` _(9b76ceb)_
- WS1.3 — category cards + detail show symbol count, ICU plurals _(cca39fa)_
- WS1.1 (partial) — `/library` minimal redirect + Navbar/sitemap repoint
