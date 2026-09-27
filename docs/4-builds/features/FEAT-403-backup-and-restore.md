# FEAT-403 · Backup & restore

**Layer 4 · Admin** · [Back to the index](README.md)

- Three layers of backup, each for a different kind of loss
- **Library modules** are saved as readable files in the code repository, and
  can be restored from them
- **The symbol library** is snapshotted to the repository at milestones,
  including its translations
- **The whole database** is exported to a file before any risky change
- Photo credits survive the round trip
- Run by the team from the command line. Families never see any of this

---

## What it does

Mo Speech's content took a long time to make: curated modules, a symbol library
translated into several languages, and years of families' own boards. The
database plan Mo Speech uses doesn't include automatic daily backups, so Mo
Speech keeps its own, in three layers.

### 1. Library modules, in the code repository

Every published module (see [FEAT-402](FEAT-402-admin-authoring.md)) can be
**exported** to one readable file per module, grouped as categories, lists,
sentences and phrases, and committed to the code repository.

- **What it gives:** a full history of every module. Each change shows up as a
  readable difference, so curation can be reviewed, and any earlier version can
  be recovered.
- **When:** after a curation pass, as a milestone.
- **Restoring:** the files can be loaded back into the database. The restore
  **adds any module that's missing and leaves existing ones alone**, so running
  it twice does no harm.
- **Credits included:** photo credits for Image Search pictures are saved and
  restored with each module, so a restore never republishes a picture without
  its credit.
- **Changes that matter only:** timestamps and other constantly changing
  details are left out, so the saved files only change when the content does.

The **database** is the live source. These files are the backup and the
review copy, not the other way round.

### 2. The symbol library, in the code repository

The SymbolStix symbol library (tens of thousands of symbols, with their words
in every language) is **snapshotted** to the repository at milestones: one
line per symbol, in a stable order, so each language run shows up as a clean,
reviewable difference. Once a language has been machine-translated, its
translations are irreplaceable work, and the snapshot keeps them safe in the
repository's history. See [FEAT-404](FEAT-404-translation-pipeline.md).

### 3. The whole database, before risky changes

Before anything risky (a structural change, a big translation run, a mass
change to data), the team exports a **full snapshot of the database** to a file
kept locally, outside the repository. It covers everything, including
families' own content. It can be restored completely, replacing the database's
current contents.

## Why it helps

- **Curation is never lost.** Every module and every symbol translation has a
  history.
- **Mistakes are recoverable.** A bad publish or a bad translation run can be
  rolled back.
- **Safe risk-taking.** A full snapshot before each risky change means there's
  always a way back.
- **Credits stay intact,** keeping Mo Speech on the right side of Creative
  Commons licences even after a restore.

## Audio

Audio files aren't part of these backups yet (see the known gap below). Modules and
symbols record where their audio lives, not the audio itself.

## Edge cases

- **An empty export is refused.** If an export finds no modules, it stops
  rather than deleting every saved module file.
- **Deleted modules.** An export removes the file of any module no longer in
  the database, so the files always match what's live.
- **Families' own content** is only in the full database snapshot (layer 3),
  not in the repository.
- **Tested restore.** A full wipe-and-restore test of the library modules is
  planned as part of launch readiness
  ([MOS-25](https://linear.app/mo-intelligence/issue/MOS-25)).

> **Known gap, being fixed before launch in [MOS-85](https://linear.app/mo-intelligence/issue/MOS-85)
> (High, M7):** none of the three layers includes the **files** themselves:
> pictures (uploads, Image Search, AI) and recordings, stored in cloud file
> storage (R2). The backups record where each file lives, not the file.
> [ADR-024](../decisions/ADR-024-account-image-library-and-one-hard-delete.md)
> names this too: "R2 is the thing to back up". MOS-85 adds recovery of
> deleted files and a second copy of the storage, with a tested restore.

## Where it lives

- Exporting library modules: `scripts/export-library-modules.mjs` (writes
  `convex/data/{categories,lists,sentences,phrases}/`)
- Restoring them: `seedLibraryModulesFromJSON` in `convex/migrations.ts`
- Symbol snapshots: `scripts/backup-symbols.mjs` (writes
  `convex/data/symbols_backups/`)
- Full database snapshots: the Convex CLI export, kept in a local `backups/`
  folder that's excluded from the repository
- How to run each one: the Backups section of the project's `CLAUDE.md`

## Links

- **Up from:** [FEAT-402 Admin authoring](FEAT-402-admin-authoring.md)
- **Related:** [FEAT-404 Translation pipeline](FEAT-404-translation-pipeline.md) ·
  [FEAT-107 Resource library](FEAT-107-resource-library.md)
