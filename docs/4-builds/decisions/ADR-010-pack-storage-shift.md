# ADR-010 — Resource Pack Storage Shift (Convex Table → JSON Files)
Date: 2026-05-14
Status: Proposed

---

## Context

Resource pack content currently lives in Convex table `resourcePacks` ([convex/schema.ts:418-558](../../../convex/schema.ts)). Each row carries both lifecycle metadata (`publishedAt`, `expiresAt`, `tier`, `featured`, `name`, `description`, `coverImagePath`, `season`, `tags`, `isStarter`) and pack content snapshots (`categories[]`, `lists[]`, `sentences[]` with nested symbol references, label overrides, display overrides, audio paths).

Authoring happens inside the main app via ADR-008's hybrid model. Admins use their own account's `profileCategories` / `profileLists` / `profileSentences` / `profileSymbols` as the working surface; toggling "Make Default" or "Save to library" via the `LibraryPackPickerModal` runs sync helpers (`syncCategoryToPackIfPublished` and siblings) that copy a snapshot of the profile row into the pack's content arrays.

Three problems have surfaced as the catalogue starts to take shape:

1. **Admin-only duplicate content.** Admins are both authors (working copies in profile tables) and potential consumers (loading their own packs via `/library` creates duplicate rows on the same account).
2. **No clean prod boundary.** Pack content is mutable production data. Authoring happens in production. There is no review surface, no rollback, no audit trail beyond Convex's transactional history.
3. **Dev disposability.** We want to wipe the dev Convex deployment freely. Today that destroys pack content alongside experiments.

Conceptually packs are content artefacts, not application data — like a locale messages file, a static catalogue, or a plugin definition. This ADR treats them as such: JSON files committed to the repo, shipped with every deploy, with a thin Convex overlay for runtime lifecycle controls.

The existing `resourcePacks` table holds work that is highly valuable (Religion, Fun, the curated starter). That data is **migrated to JSON first** before anything is reconditioned. Once JSON is canonical and the cutover is verified, `resourcePacks` is dropped entirely in a deferred cleanup phase.

---

## Decision

### 1. Pack content lives in versioned JSON files in the repo

`convex/data/library_packs/` holds one JSON file per pack, slug-keyed:

```
convex/data/library_packs/
├── _starter.json
├── religion_faith.json
├── fun.json
└── …
```

(Underscore-only filenames — Convex rejects hyphens in any path component inside the `convex/` tree, including JSON filenames. Slugs use the same convention: `religion_faith`, not `religion-faith`. Matches the existing `convex/data/starter_backups/` directory.)

Each file matches a `LibraryPack` TypeScript type colocated at `convex/data/library_packs/types.ts`. The shape mirrors today's `resourcePacks` snapshot fields exactly:

```ts
type LibraryPack = {
  slug: string;             // 'religion-faith' — filename without `.json`
  name: { eng: string; hin?: string };
  description: { eng: string; hin?: string };
  coverImagePath: string;   // R2 key under library_packs/<slug>/...
  defaultTier: 'free' | 'pro' | 'max';
  isStarter?: boolean;
  categories?: Array<{ /* mirrors today's snapshot category shape */ }>;
  lists: Array<{ /* mirrors today's snapshot list shape */ }>;
  sentences: Array<{ /* mirrors today's snapshot sentence shape */ }>;
};
```

Files are bundled JSON imports in the Convex function code (`import packs from "./data/library_packs/_index"`). They ship with every Convex deploy and every Next.js build.

### 2. The `resourcePacks` table is kept as a legacy backup through the cutover, then dropped later

Post-migration, the `resourcePacks` table is **not touched at runtime** but stays in the schema as a read-only safety net. If the JSON pipeline turns out to have a bug, we still have the original data in Convex.

The table is dropped in a deferred Phase X once:

1. JSON-based load + signup has been in use for a meaningful period.
2. At least one full authoring round-trip (modal → JSON → commit → deploy → load on test account) has been verified end-to-end.
3. We're confident there's no regression worth rolling back.

Until that point, the runtime catalogue uses two pieces:

- The bundled **JSON files** (content; source of truth).
- A new **`packLifecycle`** table (runtime overlay).

…and `resourcePacks` sits unused but inspectable.

```ts
packLifecycle: defineTable({
  slug: v.string(),
  publishedAt: v.optional(v.number()),
  expiresAt: v.optional(v.number()),
  featured: v.boolean(),
  tierOverride: v.optional(v.union(v.literal('free'), v.literal('pro'), v.literal('max'))),
  seasonOverride: v.optional(v.string()),
  notes: v.optional(v.string()),
  createdBy: v.string(),     // Clerk userId of the admin who first published the slug
  updatedAt: v.number(),
}).index('by_slug', ['slug']).index('by_createdBy', ['createdBy'])
```

A pack is visible on `/library` only when:

1. A JSON file exists for the slug.
2. A `packLifecycle` row exists for the slug with `publishedAt <= now` and `expiresAt` unset or in the future.

Tier comes from `tierOverride ?? pack.defaultTier`. Featured comes from the row. Sync helpers, `propagateToPack` flags, and the snapshot-building helpers (`buildCategorySnapshot` and siblings) all get deleted in Phase X — not in the main rollout.

### 3. `/library` reads from JSON + lifecycle overlay

`getPublicLibraryCatalogue` is rewritten to:

1. Read all `LibraryPack`s from the bundled JSON (sync, no DB call).
2. Read `packLifecycle` rows by slug.
3. Merge: include packs where a lifecycle row exists and is within window; resolve tier from override or default.
4. Return the card-shape the existing UI consumes.

`LibraryPackCard`, `LibraryGrid`, `LoadPackButton` keep their interfaces — only the underlying query changes.

### 4. Loading a pack materialises from JSON

`loadResourcePack` is rewritten to take `packSlug: string` and:

1. Look up the JSON pack by slug from the bundled map.
2. Look up the lifecycle row by slug to confirm visibility + tier eligibility (dedup gate still applies).
3. Materialise into profile tables — same end state as today (categories, lists, sentences, symbols all created with `librarySourceId = slug`).

`loadStarterTemplate` reads `_starter.json` and runs the same materialiser. `seedDefaultAccount` (signup) calls `loadStarterTemplate`.

### 5. Two distinct export paths

This ADR distinguishes carefully between two different "exports" that serve different purposes:

**(a) Migration export** — one-time, reads from `resourcePacks` snapshots.

A repo script (`pnpm pack:migrate`) reads every existing `resourcePacks` row on dev, walks the existing snapshot data (`categories[]`, `lists[]`, `sentences[]`), copies any custom R2 assets into the `library_packs/<slug>/…` prefix, and writes one JSON file per pack. **The migration uses the existing snapshot data — not profile tables — because the snapshot is already built and verified.** This is the lower-risk path for preserving valuable existing data.

Run once. After the resulting JSON commits and the V2 read paths are live, the migration export is no longer needed and the script can be archived.

**(b) Authoring export** — ongoing, reads from profile tables, triggered by the modal's Save click.

After migration + cutover, **new pack authoring works like this**:

1. Admin builds content in their account's `profileCategories` / `profileLists` / `profileSentences` (existing UX, unchanged).
2. Admin clicks the existing "Make Default" or "Save to library" affordance, which opens `LibraryPackPickerModal`. The modal UX is unchanged: New pack (name + slug + tier inputs) or Add to existing.
3. **On modal Save click**, two things happen in one flow:
   - A Convex mutation creates or looks up the `packLifecycle` row by slug and sets `publishedToPackId` on the profile row to that lifecycle row's `_id`.
   - The client-side handler POSTs to a Next.js API route running on the local dev server (`POST /api/admin/pack-publish`) with the pack's slug. The API route uses `ConvexHttpClient` to fetch every profile row across the admin's account where `publishedToPackId` matches the slug's lifecycle row, builds the snapshot, copies any new custom assets to `library_packs/<slug>/…`, and writes `convex/data/library_packs/<slug>.json` directly to disk.
4. Admin reviews the JSON diff (`git diff`), commits, opens PR, merges, deploys.

Subsequent edits to a pack's content go through the same dual flow: edit content in profile tables, then re-trigger publish via the same modal opening with the existing pack pre-selected, or a separate "Republish" affordance that appears when `publishedToPackId` is set. The Convex side stays the source of profile-row truth; the API route rebuilds JSON from those rows on demand.

**The API route only works on local dev — deliberately.** Writing to a repo file requires Node `fs/promises` access to `convex/data/library_packs/`, which only works when running `pnpm dev` on a developer's machine. Serverless prod environments (Vercel) have a read-only filesystem; any "write" would be ephemeral and gone on the next deploy.

Making prod authoring work would require a different write target — most naturally a GitHub API integration where the Save click commits the JSON via a GitHub App, triggering an auto-deploy. That's intentionally out of scope for V1. The cost (GitHub App auth surface, token management, branching strategy, rate limits, conflict handling) outweighs the benefit at one-admin scale where the publish action happens a handful of times per pack.

The API route is shaped so this is a clean future extension: it accepts `{ slug }` from the modal and is the single place the write target is decided. A future `PUBLISH_VIA_GITHUB=true` env flag swaps `fs.writeFile` for a GitHub commit call without touching the Convex side or the modal UI. See "Future hooks" below.

### 6. Custom assets live under `library_packs/<slug>/…` R2 prefix

Any non-SymbolStix asset referenced by a pack (folder covers, custom illustrations, voice recordings) lives under a slug-namespaced prefix in shared R2:

```
library_packs/<slug>/covers/<filename>.png
library_packs/<slug>/symbols/<filename>.png
library_packs/<slug>/audio/<filename>.mp3
```

Shared across dev and prod (one bucket, no isolation). SymbolStix assets stay under their existing global prefix, referenced by `symbolId` only and resolved at materialisation time.

Both the migration export and the authoring API route are responsible for copying assets from admin-account-scoped prefixes (where they land during authoring) into the canonical pack-scoped prefix, and rewriting the JSON paths.

### 7. Dev Convex is fully resettable — once changes are published

Workflow:

- Admin authors in dev (profile tables + small `packLifecycle` rows).
- Admin clicks Save in the modal → JSON updated on disk → commit, PR, merge, deploy.
- After publishing, dev's profile tables and `packLifecycle` rows are disposable.

Wipe loses: in-progress profile-table content not yet published, account-scoped R2 uploads not yet copied, dev `packLifecycle` rows.
Wipe keeps: every published pack (in the repo), every R2 pack asset (in shared bucket), every contributor's history (in git).

---

## Consequences

- **JSON is the source of truth.** PR-reviewable, diffable, reversible, history-rich. Backups are automatic via git.
- **Existing data is preserved.** The migration step (Phase 3 of the rollout) reads every `resourcePacks` row on dev and writes JSON. Religion, Fun, starter — all survive the shift before any reconditioning happens.
- **`resourcePacks` is kept as a legacy backup** through the cutover. Removal is a deferred Phase X that runs only after JSON has been proven stable in real use. Sync helpers, `propagateToPack` flags, and snapshot-builders are likewise kept until that final cleanup phase — they no-op against the unused table, but they're cheap to keep until we're confident.
- **Authoring UX preserved.** The `LibraryPackPickerModal` keeps its current shape (New pack / Add to existing). What changes underneath: the Save click writes JSON via a local dev API route instead of patching a `resourcePacks` row.
- **Local-dev constraint becomes structural — for V1.** The publish path only works on `pnpm dev` locally. A future GitHub-API write-target (env-flagged) extends this to prod authoring without changing the modal UX or Convex side. Captured as a future hook below; not built now.
- **`/library` and load both flip to JSON.** Two query implementations swap; UI components don't change.
- **Code deploy required to ship pack content.** Lifecycle controls (publish/expire/feature/re-tier) stay deploy-free via the `packLifecycle` overlay.
- **Admin duplicate problem dissolves.** Admin authoring lives in profile tables; loaders use a test account in dev or prod (different account = dedup gate fires).

---

## Out of scope

- Multi-author conflict resolution. There's one admin today; PR review handles it when the team grows.
- Pack versioning beyond git history. Users keep their loaded snapshots; next year's edits only affect new loads.
- A drag-and-drop "pack editor" UI on the admin dashboard. Authoring stays in the existing in-app surface.
- Server-side bundling of R2 assets at deploy time. Assets stay on R2; JSON carries paths only.
- Auto-publish on every profile-row edit. Republish stays explicit (modal Save / Republish button) so the JSON only updates when the admin says so.
- **Prod-side authoring.** V1 authoring only works on local dev with `pnpm dev` running. See "Future hooks" below for the path to enable it.

---

## Future hooks

Captured here so the V1 design doesn't preclude them and the cost is known when the time comes.

### Prod authoring via GitHub API

When the team grows beyond one admin, or when "publish from anywhere" becomes a real need, the `app/api/admin/pack-publish` route extends to support a GitHub write-target:

- Add an env flag `PUBLISH_VIA_GITHUB=true`.
- When the flag is set, the route swaps the `fs.writeFile` call for a GitHub commit via Octokit + a GitHub App installation token.
- The modal Save click on prod kicks the same POST; the route commits the JSON to a configurable branch (default: `main` direct push, or open a PR if reviews are required).
- Vercel auto-deploys from the merge → pack live.

Cost when built: GitHub App setup, install across the repo, token scoping (`contents:write` on the target repo only), conflict handling (refuse if the file changed on `main` since the admin last loaded it), rate-limit awareness. Maybe a day of work. The route + Convex contract don't change — admin UX is the same modal click.

### Pack lifecycle UI on the admin dashboard

The `packLifecycle` table is designed to be edited from a Phase 7 admin dashboard surface. Toggles for `publishedAt` / `expiresAt` / `featured` / `tierOverride` would let admins manage live catalogue rotation without code deploys. Captured in `docs/1-inbox/ideas/06-resource-library.md` "Admin CMS (Thin)" already; this ADR doesn't change that intent.

---

## References

- [ADR-008 — Admin Role and View Modes](./ADR-008-admin-role-and-view-modes.md) — defines the hybrid authoring model this ADR evolves
- [ADR-009 — Multi-language and Multi-voice Architecture](./ADR-009-multi-language-multi-voice-architecture.md) — JSON open-record schema convention this ADR aligns with
- [`docs/1-inbox/ideas/06-resource-library.md`](../../1-inbox/ideas/06-resource-library.md) — original resource library spec; back-merge after this ADR lands
- [`docs/4-builds/features/resource-library-catalogue.md`](../features/resource-library-catalogue.md) — operational catalogue tracker; format unchanged (add slug column)
- [`convex/data/defaultCategorySymbols.ts`](../../../convex/data/defaultCategorySymbols.ts) — current starter-pack recipe; `_starter.json` produced by the migration takes over its role
