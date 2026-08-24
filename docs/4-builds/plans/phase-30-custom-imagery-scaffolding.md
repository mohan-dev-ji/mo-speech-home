# Phase 30 — Custom-Imagery Scaffolding

> **Standalone.** Written 2026-08-24 for a fresh session. Everything needed to start is in this file — no prior conversation required.

**Status:** not started
**Tickets:** MOS-8 · MOS-30 · MOS-31 · plus two new bugs found 2026-08-24 (file them, see §1 and §2)
**Blocks:** MOS-25 and MOS-13 are **paused** until this lands.

---

## Why this phase exists

Phase 29 restored the module catalogue and added the first three custom-imagery modules (`instruments`, `storybook`, `clothes`). Authoring them surfaced a run of defects that share one root: **the whole content pipeline was built and tested against SymbolStix, and non-SymbolStix imagery walks straight through gaps nobody had reason to notice.**

Five landed as fixes during Phase 29 (custom symbols were silent and un-tappable; `aiPrompt` was never persisted; Imagen was retired by Google; AI/search images were never resized; nothing was cacheable). The ones below are what remains, and two of them are load-bearing enough that **publishing the three modules is unsafe until they are fixed.**

The owner's decision on 2026-08-24: *"fully fix our scaffolding before finishing MOS-25 and 13."*

---

## Global constraints

- **Work on `main`.** No branch, no worktree — project standing convention.
- **The dev server is owner-run on port 3000.** Never `npm run dev`. Note it does **not** always hot-reload route handlers — see §6.
- **Never `npx convex dev`.** Use `--no-push` on every `npx convex run`.
- Node 20.17.0 (Convex CLI requirement).
- **No test framework exists and none may be added** (settled in phase-17). "Test" means a runnable command with a stated expected output.
- **Verification baseline — compare against these, never against zero:**
  - `npx tsc -p convex/tsconfig.json --noEmit` → clean, exit 0. Any error is yours.
  - `npx tsc --noEmit` → **4** pre-existing unrelated errors (3 stale `.next/types/validator.ts` refs, 1 Stripe `apiVersion` in `lib/stripe.ts:8`).
  - `npm run lint` → exactly `✖ 66 problems (36 errors, 30 warnings)`, all pre-existing. Do not fix them; do not add to them.
- **Never hard-code UI copy.** New keys go in `messages/en.json` **only** — never `hi.json`/`es.json`, or the translation pipeline treats them as already-translated and skips them forever.
- **Never hard-code colours/spacing/radii/font sizes.** Tailwind 4, `--theme-*` vars in `app/globals.css`.
- Take `npx convex export --path backups/<date>-<label>.zip` before anything destructive.

---

## 1. CRITICAL — four unguarded R2 delete paths

**File this as a bug first; it is the reason publishing is on hold.**

Four collectors push `imageSource.imagePath` for `userUpload`/`imageSearch` symbols with **no prefix guard**, so a *shared* module asset can be deleted from R2:

| Site | Trigger | Comment claims |
|---|---|---|
| `convex/contentModules/categories.ts:185` | uninstall a category module | — |
| `convex/profileCategories.ts:557` | reload a category's defaults | — |
| `convex/profileSymbols.ts:237` | delete one symbol | *"delete only uploads + image-search"* |
| `convex/profileSymbols.ts:288` | replace a symbol's image | *"Same **personal-key rules**"* |

Lists, sentences and phrases **do** guard, via `isPersonalAssetKey` in `convex/lib/contentModuleDelete.ts:92,110,125`. Categories and symbols are the outliers, and the last two comments describe a guard that was never implemented.

**The chain is unbroken.** Collector → `.filter(k => !referenced.has(k))` — which cannot rescue a shared key, because `collectReferencedPersonalKeys` only ever returns *personal* keys → `app/api/uninstall-content-module/route.ts:106` → `deleteFile` → `DeleteObjectCommand`. No guard at any layer.

**Impact.** ADR-022 fixed the *publish* side (assets are promoted to a shared prefix). The *delete* side for categories never had the guard, so `library_modules/` is not actually safe. Once the custom-imagery modules are published and installed, **any family deleting a symbol, swapping an image, reloading a category, or uninstalling a module deletes the shared asset for everyone.** Latent today only because nothing is published yet.

**Fix.** Wrap all four pushes in `isPersonalAssetKey`. Strictly subtractive — it can only ever delete *fewer* objects. Correct the two misleading comments while you are there.

**Verify.** `isPersonalAssetKey` must remain byte-identical (it is the delete-path predicate; §2's `isPromotableAssetKey` is the separate publish-path one — do not merge them). Then confirm by reading that every one of the four sites now filters, and that lists/sentences/phrases are untouched.

---

## 2. Attribution and licence are lost outside categories

**Also new, also file it.** Owner decision 2026-08-24: **fix properly, do not sidestep.**

`attribution` exists in exactly three places in the schema:

```
convex/schema.ts:164    libraryModuleCategoryItems → symbols
convex/schema.ts:609    profileSymbols.imageSource (imageSearch member)
convex/schema.ts:1240   imageSearchCache (the search cache, not stored content)
```

Category symbols only. A **sentence slot** stores just `order`, `imagePath`, `displayProps`, `label` — no `imageSourceType`, no `attribution`, no `license`, no `imageSourceUrl` — and `onSentenceSlotSave` in `SymbolEditorModal.tsx` passes only `imagePath`. **List items** and **phrase words** record `imageSourceType` but have no attribution fields either.

So picking a Wikimedia CC BY-SA image for a list item or sentence slot **silently discards the credit**, at every layer: profile table, module JSON, published module. That is a licence obligation, not a nicety.

Latent because image search has only ever been used in categories — measured 2026-08-24: lists 80/80 symbolstix, sentences 273 image-bearing all symbolstix, phrases 55 all symbolstix. **Zero custom imagery has ever gone through those three trees.**

**Scope — every layer, three trees:**
1. `convex/schema.ts` — add `imageSourceUrl` / `attribution` / `license` to `profileLists` items, `profileSentences` slots, `profilePhrases` words. Add `imageSourceType` to sentence slots (the only one of the three lacking it).
2. `convex/data/_shared/types.ts` — mirror onto `LibraryPackListItem`, `LibraryPackSentenceSlot`, `LibraryPackPhraseWord`, and the matching `libraryModule*Items` validators in `schema.ts`.
3. `app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx` — the `sentenceSlot` and `listItem` save paths must carry the fields the draft already holds (`draft.imageSourceUrl`, `draft.imageAttribution`, `draft.imageLicense` — they exist and are populated by `ImagesTab`).
4. `convex/contentModules/publish.ts` — carry them through the shape mappers (`promoteListItem`, `promoteWordLike`, `promoteUnit`), like the category branch already does.
5. `convex/contentModules/exportModules.ts` / `migrations.ts:seedLibraryModulesFromJSON` — round-trip them.
6. `convex/lib/contentModuleInstall.ts` — materialise them on install.
7. Wherever category symbols surface attribution in the UI, do the same for the other three.

**Verify.** Author one list item and one sentence slot from Image Search, publish, export, wipe, restore, install — and confirm the credit survives every hop. `scripts/verify-module-roundtrip.mjs` covers the export/restore leg.

---

## 3. MOS-8 — confirm and close

**Already fixed** in `c895df4` (Wikimedia restricts thumbnail generation to a per-file allowlist of widths; the provider was rewriting the API's valid `thumburl` to a hard-coded 640, which 400'd). Root cause and evidence are on the ticket.

It could not be confirmed in-app on 2026-08-23 because `imageSearchCache` was serving pre-fix rows (that is MOS-31). Those rows expired ~15:05 on 2026-08-24.

**Do:** run one Image Search, select a Wikimedia ("W" badge) result, confirm it lands in the preview. Then close MOS-8. If it still fails, the cache is not the explanation and it needs reopening.

---

## 4. MOS-30 — split Wikimedia thumbnail and save sizes

MOS-8's fix traded page weight for correctness by design: one API-returned URL now serves both the results grid and the saved symbol, so the grid loads save-size images (~104 KB vs ~22 KB each; **~2 MB per 19-result search**).

**Proposed fix** (full detail on the ticket): `searchWikimedia` requests `iiurlwidth=320` again for the grid; Wikimedia results carry only their `pageid`; the proxy resolves the save-size URL from the Commons API itself at selection time.

**Side benefit:** more secure than today. The proxy currently re-validates a client-supplied URL against a host allowlist precisely because a modified client or poisoned cache row could otherwise pull bytes from an arbitrary URL. Resolving from `pageid` removes that class of risk for this provider.

**Also in scope:** the error message is wrong. A failed *selection* surfaces **"Search failed. Please try again."** below the search bar — but the search succeeded. Misleading enough that MOS-8 was originally filed as a search bug.

---

## 5. MOS-31 — cache identity guards

The same blind spot bit twice in one day. Both caches key on content but not on the code that produced it, so a fix ships and the cache keeps serving pre-fix results:

- **`imageSearchCache`** stores fully-resolved `fullImageUrl`s and returns them without calling the provider (hits are free and skip the quota). After MOS-8 shipped, a repeat search returned pre-fix URLs and the bug looked unfixed. Only invalidation is a 24h TTL.
- **`aiImageCache`** was keyed `sha256(style|prompt)` with no model component, so Imagen-era and Gemini-era images would have collided. **Already fixed** in `0c26d70` (now `sha256(model|style|prompt)`).

**Solve it once, as a shared pattern rather than two one-offs.** Both want: a version/identity component in the key, a documented bump procedure, and a sweep for rows whose key can no longer be produced.

**Residual cleanup this phase should also do:**
- `aiImageCache` rows written under the old Imagen-era hash are now permanently unmatched — orphaned Convex rows plus the `ai-cache/` R2 objects they point at.
- 12 orphaned full-size PNGs under `accounts/…/images/` left by the Phase 29 backfill (it never deletes, by design). Keys are in that script's output.

---

## 6. A debugging trap that cost time — read before verifying anything

The dev server **served a stale compile** of `app/api/assets/route.ts`, so a correctly-set `Cache-Control` header looked absent. Several measurements were taken against old code before this was noticed, and a wrong conclusion was briefly committed.

**Control test:** change something trivially observable (e.g. the response status code) and check it actually changes. If it does not, the server is stale — restart it before trusting any measurement.

---

## Suggested order

1. **§1 guards** — small, strictly protective, and it unblocks publishing. Do it first.
2. **§3 MOS-8 confirm** — two minutes, and it closes a ticket.
3. **§5 MOS-31** — the cache guards, because they make every later verification trustworthy.
4. **§4 MOS-30** — depends on nothing else; do it whenever.
5. **§2 attribution** — the largest piece, touching every layer of three trees. Last, with the most room.

---

## When this phase is done

Return to **phase-29** (`docs/4-builds/plans/phase-29-module-artifact-restore-and-dr-test.md`), which is paused mid-Task-8 with Tasks 1–7 complete. Remaining there:

- Finish Task 6 (QA the five SymbolStix legacy modules; `space` is done)
- Task 7 Step 9 — the browser acceptance test for ADR-022 promotion. **Fold this into Phase 30's §2 verification**: author the real tiered list and sentence modules with custom imagery instead of the throwaway `promo-test-list` / `promo-test-sentence` scratch modules. One pass then covers the promotion proof, the attribution fix, the untested list/sentence pipeline, and real tiered content.
- Task 8 — finish `instruments` (blocked on image-search quota, not on code), publish all three
- Tasks 9–10 — the wipe/restore DR test and write-back

**Then** the `library_packs/` retirement, which is already prepared: `c9c6a59` extended promotion to migrate legacy keys, and `45bdc35` widened the backfill to image-search symbols. Sequence is in the Phase 29 session notes — backfill `space`, re-publish it, verify it renders from `library_modules/`, **reinstall it so the installed copy repoints too**, and only then delete the folder.

---

## Out of scope, but ticket-worthy

- **`translate-modules` skips symbol labels.** It assumes symbols resolve their labels from the global `symbols` table (ADR-014 §4) — true for SymbolStix, false for custom-image symbols, which have no `symbols` row. So their labels are reached by neither pipeline and must be hand-authored per language: ~72 translations across the three new modules. Recorded in `docs/4-builds/translation-style-guide.md`; **not yet ticketed.**
- **MOS-32** — category symbols cannot carry per-language variants, so a Hindi board cannot swap to a different symbol set. Filed, not urgent.
