# Phase 15 — Default Modules Remake (Runbook)

**Status:** Ready to execute · **Linear:** [Default modules remake](https://linear.app/mo-intelligence/project/default-modules-remake-4ea543e1e104) (MOS-11…MOS-23)
**Relates to:** [FEAT-002 (library-modules backup/restore)](../features/FEAT-002-library-modules-backup-restore.md) · ADR-014 (content modules / three trees) · ADR-015 (composition primitive)

> This is an **operational runbook**, not a feature design — back up → prove the machinery → wipe → slim the schema → rebuild for marketing. The only slice with real code + migration risk is the schema cleanup (MOS-17); its diff is in Appendix A.

---

## Two hard constraints (get the order wrong and it bites silently)

1. **Back up before every wipe.** The full `convex export` snapshot is the master rollback.
2. **Field-drops need empty tables.** Convex rejects a schema push if *any* surviving document still carries a dropped field. So the schema change lands only after the target tables are wiped.

## Decisions locked (from the MOS-17 validation)

| Field(s) | Decision | Why |
|---|---|---|
| `profileId` (all 6 profile tables) | **Drop** + dead indexes | No reader; every query is account-scoped. |
| `profileCategories.folderId` + `by_folder_id_and_order` | **Drop** | ADR-014 category-foldering never implemented; categories install flat. |
| `libraryModules.notes` / `provenance` / `isStarter` | **Drop** | Dead at runtime (`isStarter` never true on live rows). |
| `libraryModules.isDefault` (+ `by_default`) | **Keep** | Sole reader is `seedDefaultAccount`; cheap, no reason to churn the seed path. |
| `libraryModules.tierOverride` / `translationSnapshot` | **Keep** | `tierOverride ?? defaultTier` read pervasively; `translationSnapshot` drives the live translation pipeline. |
| `libraryModules.surface` (`"core"`) | **Keep** | Load-bearing: propagates to `profileCategories.surface` → board-vs-dropdown filter. Do NOT fold into `tree`. |
| `profileSymbols.audio` | **Keep** | Per-language audio override read at board load + asset GC ref-counting. |
| `profilePhrases.audioPath` | **Keep** | Read at playback; populated by installed phrase modules. |
| All `icon` fields | **Deferred** | Not a clean drop — it's a 4-field chain (`profileCategories.icon` → required `items[].icon`; `profileFolders.icon` → `libraryModules.icon`). Separate follow-up ticket. |

---

## Sequence

### Phase 0 — Safety net
- **0.1** Full deployment snapshot (master rollback):
  ```bash
  source ~/.nvm/nvm.sh && nvm use 20.17.0
  npx convex export --path backups/$(date +%Y_%m_%d)-pre-remake.zip
  ```
  (`backups/` is gitignored. Restore with `npx convex import --replace <zip>`.)

### Phase 1 — Publish real content + capture it (MOS-11)
- **1.1** In the authoring/admin surface, **publish all lists, phrases, and sentences as Default** (`isDefault`), plus a couple as **Free** — this gives the machinery test real, mixed content.
- **1.2** Export the modules to committed JSON:
  ```bash
  node scripts/export-library-modules.mjs
  git add convex/data/{categories,lists,sentences,phrases} && git commit -m "export: pre-remake defaults"
  ```

### Phase 2 — Prove backup / restore / seed (the de-risking loop) (MOS-24)
- **2.1** Wipe **`libraryModules` only** (a mutation; leave profile tables alone — the seed test uses a *fresh* account, not a wiped one).
- **2.2** Restore from JSON: run `migrations.seedLibraryModulesFromJSON` from the Convex dashboard with an `adminClerkUserId`. Verify rows reinserted (insert-only; skips starters — FEAT-002 §5).
- **2.3** **Fresh signup → verify `seedDefaultAccount` seeds the new account** from the restored defaults. Must be a genuinely new account — the seed no-ops if the account was already seeded.
- **✅ Gate:** machinery proven end-to-end. If anything failed, fix it here — you still have the 0.1 snapshot and the committed JSON.

### Phase 3 — Wipe + schema cleanup (worktree → empty tables) (MOS-17)
- **3.1** Full teardown: **burn test/admin accounts + clear `libraryModules`** so every target table (profile tables + `libraryModules`) is empty. Verify with row counts before pushing.
- **3.2** On this worktree branch, apply **Appendix A** (schema diff + companion code edits).
- **3.3** Typecheck — this is the safety net that catches any reader you missed (a missed reader = failed push):
  ```bash
  source ~/.nvm/nvm.sh && nvm use 20.17.0
  npx tsc -p convex/tsconfig.json
  ```
  Must be clean. **Never run `npx convex dev` in this worktree** (it spins up an anonymous local backend + rewrites `.env.local`).
- **3.4** Merge the branch → `main`. `convex dev` on main auto-pushes the slimmed schema onto the now-empty tables. The push succeeds because no document carries a dropped field.

### Phase 4 — Rebuild defaults for marketing (on the slimmed schema) (MOS-13)
- **4.1** Rebuild categories / lists / phrases / sentences via the authoring surface, **screen-recording**.
- **4.2** Remake the demoted core-word modules (now category modules) for marketing.
- **4.3** Build 2–3 demo-tier category modules to exercise the Publish button.
- **4.4** Add cover images to the modules.
- **⚠️ Recording is blocked on [MOS-10](https://linear.app/mo-intelligence/issue/MOS-10)** (core-words EN fallback) — don't film with broken translations.

### Phase 5 — Re-baseline the backup (MOS-25)
- **5.1** Re-export so the committed JSON matches the slimmed schema + final content:
  ```bash
  node scripts/export-library-modules.mjs
  git add convex/data/{categories,lists,sentences,phrases} && git commit -m "export: final marketing defaults"
  ```
- **5.2** Fresh full snapshot (`npx convex export …`).

**Rollback at any point:** `npx convex import --replace backups/<date>-pre-remake.zip`.

---

## Appendix A — Schema change (apply in Phase 3.2)

> Icon fields are **retained** (deferred). `isDefault` / `tierOverride` / `translationSnapshot` / `surface` / `profileSymbols.audio` / `profilePhrases.audioPath` are **retained** — do not touch.

### A1 — `convex/schema.ts`

**`libraryModules`** — remove three fields (indexes unchanged; `by_default` stays):
```diff
-    provenance: v.optional(
-      v.object({
-        author: v.optional(v.string()),
-        version: v.optional(v.string()),
-        licence: v.optional(v.string()),
-      })
-    ),
     ...
-    notes: v.optional(v.string()),
-    isStarter: v.optional(v.boolean()),
```

**`profileCategories`** — drop `profileId`, `folderId`, and three dead indexes:
```diff
-    profileId: v.optional(v.id("studentProfiles")), // legacy; kept optional so old docs validate. New writes omit.
     ...
-    folderId: v.optional(v.id("profileFolders")),
     ...
       .index("by_account_id", ["accountId"])
       .index("by_account_id_and_order", ["accountId", "order"])
-      .index("by_profile_id", ["profileId"])
-      .index("by_profile_id_and_order", ["profileId", "order"])
-      .index("by_folder_id_and_order", ["folderId", "order"]),
```

**`profileSymbols`** — drop `profileId` + its index (keep `audio`):
```diff
-    profileId: v.optional(v.id("studentProfiles")), // legacy; kept optional for back-compat.
     ...
-      .index("by_profile_id", ["profileId"])
```

**`profileLists`** — drop `profileId` + two indexes (keep `folderId` + `by_folder_id_and_order`):
```diff
-    profileId: v.optional(v.id("studentProfiles")), // legacy; kept optional for back-compat.
     ...
-      .index("by_profile_id", ["profileId"])
-      .index("by_profile_id_and_order", ["profileId", "order"])
```

**`profileSentences`** — drop `profileId` + two indexes (keep `folderId` + `by_folder_id_and_order`):
```diff
-    profileId: v.optional(v.id("studentProfiles")), // legacy; kept optional for back-compat.
     ...
-      .index("by_profile_id", ["profileId"])
-      .index("by_profile_id_and_order", ["profileId", "order"])
```

**`profilePhrases`** — drop `profileId` + its index (keep `audioPath`, `folderId`):
```diff
-    profileId: v.optional(v.id("studentProfiles")), // legacy parity; new writes omit.
     ...
-      .index("by_profile_id", ["profileId"])
```

**`profileFolders`** — drop `profileId` + its index (keep `icon`):
```diff
-    profileId: v.optional(v.id("studentProfiles")), // legacy parity; new writes omit.
     ...
-      .index("by_profile_id", ["profileId"])
```

### A2 — Companion code edits (same commit — otherwise `tsc` / the push fails)

`tsc -p convex/tsconfig.json` is the authority; this list is the starting point. Fix every error it reports.

- **`profileId` drops:** likely **zero** required edits. The only reference is the orphan-tolerant backfill cast at `convex/migrations.ts:40` (`as unknown as { …profileId? }`) — compiles regardless; optionally prune the `profileId?` from the cast.
- **`profileCategories.folderId` drop:** expected **zero** edits (never written/read for categories) — let `tsc` confirm no generic `.folderId` reader exists.
- **`libraryModules.provenance`:**
  - `convex/contentModules/exportModules.ts:38` — remove the `...(m.provenance ? …)` dump line.
  - `convex/migrations.ts` (seed, ~`:525`) — remove `provenance` from the insert.
  - `listAll*ModulesForAdmin` projections in `contentModules/{categories,lists,sentences,phrases}.ts` — remove the `provenance` field (unwired queries, but they still typecheck against the doc).
- **`libraryModules.notes`:** remove from the same `listAll*ModulesForAdmin` projections and any `update*Lifecycle` patch that sets `notes`.
- **`libraryModules.isStarter`:**
  - `convex/contentModules/exportModules.ts:37` — remove the `...(m.isStarter …)` dump line.
  - `convex/contentModules/detail.ts:179` — replace `module.isStarter ?? false` with `false` (preserves the return shape; no client change).
  - `contentModules/{categories,lists,sentences,phrases}.ts` — every `module.isStarter ?? false` (public catalogue + `assertModuleInstallable` arg) → `false`.
  - `convex/migrations.ts:~499` skip (`if (mod.isStarter) …`) reads the **JSON barrel** type, not the Convex doc — leave it; it's harmless and defensive.
  - Verify `installContentModule` / `assertModuleInstallable` / `isModuleVisible` only take `isStarter` as a **parameter** (they do) — no doc read to change there.

### A3 — Sub-issue mapping
MOS-18 `profilePhrases.profileId` ✅ · MOS-19 `profileList.profileId` ✅ · MOS-20 `profileFolders.profileId` ✅ (icon deferred) · MOS-21 `profileCategories.profileId` + `folderId` ✅ (icon deferred) · MOS-22 `profileSymbols.profileId` ✅ (audio kept) · MOS-23 `profileSentences.profileId` ✅.
