# Library Modules — Authoring, Backup & Restore

**Status:** Shipped · **Relates to:** [ADR-014 (content modules + three trees, incl. the 2026-06-27 "content in Convex" addendum)](../decisions/ADR-014-content-modules-and-three-tree-organisation.md) · [ADR-015 (composition primitive + "structure frozen, text live")](../decisions/ADR-015-composition-primitive-and-phrase-tree.md)

> **One-line vision:** all curated content (categories, lists, sentences, phrases, and the signup defaults) is **authored live in Convex** and mirrored to **git-committed JSON** by an exporter. The table is the source of truth; the JSON is the version-controlled backup you can restore a whole deployment from. This is the app's content disaster-recovery layer.

> **Scope note:** this doc describes the *system*, not the content. The actual symbols, words, categories, and packs are expected to change continuously with specialist SLT/AAC input — they are data, curated in the admin view, never hard-coded here. Do not list symbol sets in this file.

---

## 1. The three layers

Content lives in exactly one authoritative place — the `libraryModules` table — and is projected outward two ways: **consumed** by new-account seeding, and **backed up** to committed JSON.

```
        authoring (admin view)                     new-account signup
             │  writes                                   │  reads (isDefault)
             ▼                                            ▼
   ┌───────────────────────────────────────────────────────────────┐
   │            libraryModules  table   (LIVE SOURCE OF TRUTH)       │
   │   one row per module · tree ∈ {categories,lists,sentences,      │
   │   phrases} · slug · items[] · isDefault · defaultTier · surface │
   └───────────────────────────────────────────────────────────────┘
             │  export ▲ restore
   (DB→JSON) ▼         │ (JSON→DB, fresh deployment only)
   ┌───────────────────────────────────────────────────────────────┐
   │   convex/data/{categories,lists,sentences,phrases}/<slug>.json │
   │   + auto-generated _index.ts barrels                           │
   │   (git-committed audit-trail / rollback artifact)              │
   └───────────────────────────────────────────────────────────────┘
```

The golden rule that makes the whole thing legible:

> **The table is live. The JSON is a backup.** Editing JSON by hand changes nothing at runtime. Publishing in the admin view is the only thing that changes what real accounts get.

---

## 2. Source of truth — the `libraryModules` table

- One row per **module**. A module is one curated unit within a **tree**: `categories`, `lists`, `sentences`, or `phrases` (the ADR-014 three-tree model + the phrase tree from ADR-015).
- Addressed by **`(tree, slug)`** — the slug is the stable, human-readable identifier (`core-general`, `animals`, …). Treat a slug as immutable once a module is live.
- Key fields: `items[]` (the curated content), `isDefault` (part of the new-account manifest), `defaultTier` (free/pro/max gate), `surface` (e.g. dropbar core), `provenance`.
- Schema: `convex/schema.ts` → `libraryModules` (the `by_default` and `by_tree_and_slug` indexes are the two hot paths).
- Authored entirely in the **admin view** — "Publish" / "Publish as Default" write rows here. No code deploy, no committed JSON edit, is involved in day-to-day curation.

---

## 3. How signup consumes it

New accounts are seeded **from the table**, never from JSON.

- **Manifest:** every row flagged `isDefault: true` is the new-account seed set. `seedDefaultAccount` (`convex/profileCategories.ts`) queries `by_default`, sorts categories → lists → sentences, and installs each via `installContentModule`.
- **Materialise:** `installContentModule` (`convex/lib/contentModuleInstall.ts`) → `materialiseSymbolsFromJson` (`convex/lib/materialiseSymbols.ts`) creates the per-account `profileCategories` / `profileSymbols` / etc.
- **Core-words dropdown tab:** seeded like any other default. The `dropbar-core` module (`surface:"core"`, `isDefault`) installs one per-account "Core words" container (`librarySourceId = "dropbar-core"`) plus its symbols; the talker dropdown finds it via `getDropbarBoard` (`convex/dropbar.ts`). `injectCoreModulesIntoDropbar` is the *admin authoring* helper that fills that container from the `core-*` modules (`DEFAULT_CORE_INJECT_SLUGS` = general/pronouns/joining/position) before you publish `dropbar-core` — it is **not** part of signup.
- **Core word-categories:** the seven `core-*` `surface:"core"` category modules are (re)built by `seedCoreWordModules` (`convex/migrations.ts`), which resolves each authored word (`LITTLE_WORDS_GROUPS` in `convex/data/defaultCategorySymbols.ts`) to a `symbols` row at seed time. On a fresh deployment they also restore from the committed JSON like any other module — `seedCoreWordModules` is only needed when you want to re-resolve symbols from the word lists rather than from captured IDs. `surface:"core"` keeps them off the main Categories board and in the dropdown.
- **Composed sentences carry their composition:** block/sequence sentence items include `units[]` + `playback` and a derived whole-utterance `text` caption; language variants carry `variantGroupKey` + `authoredLanguage` so seeded boards collapse by board language and play stepped (block) or fluent. Untranslated variant siblings are skipped at publish (see §7). Pre-pipeline rows were backfilled once by `migrations.backfillSequenceSentenceText`.
- **Text resolves live (ADR-015 §3 / ADR-014 §4):** seeding snapshots *which* symbols a board holds, but localised **labels resolve live from the global `symbols` table at render**, so a later translation reaching the `symbols` table shows up on existing boards. The module row references symbols; it does not freeze their translations.

If nothing is flagged `isDefault`, a new account seeds empty — which is exactly what an unpublished admin selection looks like. (This is *not* a bug; it means "publish the defaults.")

---

## 4. Export — DB → committed JSON

`node scripts/export-library-modules.mjs`

The git audit-trail / rollback step. Run it **at milestones after a curation pass** and commit the diff — the same discipline as `scripts/backup-symbols.mjs`.

What it does:
1. Calls the `contentModules/exportModules:dumpAllModules` query (stable key order, no volatile timestamps — clean diffs).
2. Writes one `<slug>.json` per module under its tree dir.
3. **Prunes** any `*.json` not present in the dump, so the artifact matches the table exactly. Aborts if the dump is empty (guards against a catastrophic prune).
4. Regenerates each tree's `_index.ts` barrel (`CATEGORY_MODULES`, `LIST_MODULES`, `SENTENCE_MODULES`, `PHRASE_MODULES`) — these feed the restore path.

```bash
node scripts/export-library-modules.mjs
git add convex/data/{categories,lists,sentences,phrases}
git commit -m "export: library modules <label>"
```

> After any admin publish/curation, the committed JSON is stale until you run the exporter. The table is already correct; the export just refreshes the backup.

---

## 5. Restore — committed JSON → DB (the content layer)

`migrations.seedLibraryModulesFromJSON` (a `mutation`; run from the Convex dashboard or `npx convex run` with an `adminClerkUserId`). This rebuilds the `libraryModules` table from the git-committed barrels.

Semantics that matter:
- **Insert-only.** For each module in the barrels, it inserts a `libraryModules` row **only if that `(tree, slug)` doesn't already exist**. Existing rows are left untouched.
- **Skips starters** (`isStarter` fixtures are handled elsewhere).
- Preserves `isDefault`, `defaultTier`, `surface`, `provenance`, `coverImagePath`, `description`, `items` from the JSON. Stamps a fresh `publishedAt`/`updatedAt` and `createdBy = adminClerkUserId` (see the content-shape caveat in §7).

Because it is insert-only, there are two distinct scenarios:

**(a) Bootstrap an empty / fresh deployment** — the table has no (or missing) slugs:
```bash
npx convex run migrations:seedLibraryModulesFromJSON '{"adminClerkUserId":"user_…"}'
```
Fills every missing slug from git. This is the reason hand-editing JSON "does nothing" on a *live* deployment: seeding cannot overwrite or sync existing rows.

> To change a live module, edit it in the admin view (which writes the table), then re-export. JSON → table is a one-way bootstrap, not a two-way sync.

**(b) Rebuild / reset a populated table** — you want the table to match git exactly (DR drill, corruption recovery, resetting after experiments). Because reseed won't overwrite, you must first empty it, then reseed:
```bash
# take a full snapshot first (§6) — this is destructive
npx convex run migrations:wipeLibraryModules '{"confirm":"WIPE"}'
npx convex run migrations:seedLibraryModulesFromJSON '{"adminClerkUserId":"user_…"}'
```
`wipeLibraryModules` (`internalMutation`, guarded by `confirm:"WIPE"`) deletes every `libraryModules` row. This is the **verified DR restore path** for the content layer — a wipe(40)→reseed(40) round-trips **content-identical** (checked by diffing `dumpAllModules` before/after; core categories, `surface`, tiers, and block-sentence `units`/`playback`/`text` all reproduce). No separate `seedCoreWordModules` run is needed for a same-deployment restore — the `core-*` modules carry their captured symbols in the JSON.

Blast radius: (b) empties the resource-library / default source for the seconds between wipe and reseed. It does **not** touch existing user accounts (their content was already materialised at install). New signups in that window would seed empty — do it in a quiet window.

---

## 6. The other backup layer — full deployment snapshot

The JSON export (§4/§5) is the **content** backup: version-controlled, portable across deployments, curated-library only. Convex Pro ships automated daily backups; on the Starter plan we roll our own, and there is a second, complementary layer for **whole-deployment** disaster recovery — every table, including user accounts, byte-for-byte.

- **Take a snapshot** (gitignored, local — DR only):
  ```bash
  npx convex export --path backups/<date>-<label>.zip
  ```
  Run it **before any risky operation** — schema migrations, mass mutations, and specifically before a `wipeLibraryModules` (§5(b)).
- **Restore a snapshot** (byte-exact, same deployment):
  ```bash
  npx convex import --replace backups/<date>-<label>.zip
  ```
  This reproduces everything the JSON layer can't — original timestamps, `lastPublishedAt`/`tierOverride`, and all per-account data.
- **Symbols milestone snapshot** (committed, per-language diff): `node scripts/backup-symbols.mjs "<label>"` → `convex/data/symbols_backups/`. Captures irreplaceable AI-translation diffs in git history (see `CLAUDE.md` → Backups).

**Which restore do I want?**

| Situation | Use |
|---|---|
| Fresh/empty deployment needs the curated library | JSON reseed §5(a) — `seedLibraryModulesFromJSON` |
| Reset the library table to match git (content only) | JSON wipe+reseed §5(b) |
| Recover a whole deployment incl. user accounts, byte-exact | Full snapshot — `npx convex import --replace` |
| Undo a bad `wipeLibraryModules` you took a snapshot before | Full snapshot import (or just reseed, if content-only is enough) |

Rule of thumb: **content problems → JSON layer; data-loss / byte-exact / user-data problems → full snapshot.**

---

## 7. Invariants & edge cases

- **JSON is never the live source.** Signup, the dropbar, and the library pages all read the table. The `_index.ts` header says so explicitly; keep it that way.
- **`_index.ts` is auto-generated.** Never hand-edit the barrels — regenerate via the exporter. Hand edits are overwritten on the next export and desync the restore path.
- **Restore is insert-only** (§5). It bootstraps empty deployments; it does not push edits.
- **Export prunes.** A slug deleted from the table disappears from git on the next export. Intentional — the artifact mirrors the table — but it means the exporter is the moment a retirement becomes permanent in the backup.
- **Slugs are identity.** `(tree, slug)` keys the row, the JSON filename, the barrel entry, and `librarySourceId` on every installed copy. Renaming a live slug is a migration, not an edit.
- **Empty defaults ≠ broken.** No `isDefault` rows → empty new accounts. The fix is to publish defaults, not to touch code.
- **Text-live vs snapshot.** Boards snapshot symbol *references*; labels resolve live from `symbols` (ADR-015 §3). A missing translation on a board points at the `symbols` table or a stale per-profile `label`, not at this system.
- **Content-shape reseed drops timestamps.** `dumpAllModules` is deliberately timestamp-free (clean git diffs), so a JSON reseed (§5) resets `publishedAt`/`updatedAt` and does **not** reproduce `lastPublishedAt` or `tierOverride`. Effective tiers are unaffected when no module uses `tierOverride`. If you need a byte-exact restore (timestamps, overrides, user data), use the full snapshot (§6), not the JSON layer.
- **Wiping is guarded and destructive.** `wipeLibraryModules` requires `confirm:"WIPE"` and deletes all rows. Always take a full snapshot (§6) first; the reseed source is only as fresh as your last `export-library-modules.mjs` run.

---

## 8. Neighbouring mechanisms (don't confuse these)

- **`convex/data/starter_backups/`** + `migrations.restoreStarterPackFromBackup` — a **separate, older** snapshot of the starter *profileSymbols* (post-edit account state), not the module JSON. Different shape, different restore path.
- **`convex/data/defaultCategorySymbols.ts`** (`DEFAULT_CATEGORIES`, `LITTLE_WORDS_GROUPS`) — the original hard-coded **recipe**, now used by factory-reset / master-category seeding migrations, not by signup. It predates the "author in Convex" move.
- **The pack catalogue** (`loadResourcePackV2`, `convex/data/library_packs/`, `packLifecycle`) — the superseded pre-ADR-014 system this doc replaced. Fully torn down in Phase 14.5.

---

## 9. Why this system matters

The table can be wiped, corrupted, or migrated wrong. When that happens, every account's future seeding and the whole library depend on getting curated content back. Because the content is mirrored to versioned JSON and restorable into a fresh deployment with one mutation, a catastrophic data loss becomes a **restore-and-re-export**, not a re-authoring project. Keep the export discipline current — a backup you didn't take is the one you'll need.

---

## Reference — files & commands

| Concern | Where |
|---|---|
| Source of truth | `libraryModules` table (`convex/schema.ts`) |
| Publish (author → table) | `publishFolderAsModule` (`convex/contentModules/publish.ts`) |
| Signup manifest | `seedDefaultAccount` (`convex/profileCategories.ts`) |
| Install / materialise | `convex/lib/contentModuleInstall.ts`, `convex/lib/materialiseSymbols.ts` |
| Core-words tab container | `dropbar-core` module → `getDropbarBoard`; admin fill via `injectCoreModulesIntoDropbar` / `DEFAULT_CORE_INJECT_SLUGS` (`convex/dropbar.ts`) |
| Core word-categories seed | `migrations.seedCoreWordModules` (words in `convex/data/defaultCategorySymbols.ts`) |
| Block-sentence text backfill | `migrations.backfillSequenceSentenceText` |
| Export (DB→JSON) | `node scripts/export-library-modules.mjs` → `contentModules/exportModules:dumpAllModules` |
| Committed content backup | `convex/data/{categories,lists,sentences,phrases}/<slug>.json` + `_index.ts` |
| Restore/bootstrap (JSON→DB) | `migrations.seedLibraryModulesFromJSON '{"adminClerkUserId":"…"}'` |
| Wipe library table (guarded) | `migrations.wipeLibraryModules '{"confirm":"WIPE"}'` |
| Full deployment snapshot | `npx convex export --path backups/<date>-<label>.zip` (gitignored) |
| Full deployment restore | `npx convex import --replace backups/<date>-<label>.zip` |
| Symbols milestone snapshot | `node scripts/backup-symbols.mjs "<label>"` → `convex/data/symbols_backups/` |
