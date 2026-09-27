# FEAT-402 · Admin authoring

**Layer 4 · Admin** · [Back to the index](README.md)

- How Mo Speech's own content is made: **built in the app, then published**
- Publish a category, a list group, a sentence group, or the talker dropdown's
  core words and phrases
- Choose a **classification**: **Default** (every new account gets it) or a
  library module for **Free**, **Pro** or **Max**
- Live straight away: no code change, no app update
- **Update module** re-publishes changes. New installs get them, and existing
  copies are left alone
- Pictures, recordings and photo credits travel with the module
- Translated into every supported language by the translation run
- Kept safe as files in the code repository (backup)

---

## What it does

Every default board, every library module, and the core words and phrases a new
account starts with was made the same way: an admin built it in the app, with
the same screens families use, then **published** it. There's no separate
content tool and no developer in the loop.

### Building

In the **admin view** (see [FEAT-301](FEAT-301-instructor-and-student-views.md)),
the admin makes content exactly as an instructor would: categories and
symbols, lists in a group, sentences in a group, core words and phrases. A
**module** is one unit of that:

- **a category** (with its symbols),
- **a list group** (its lists),
- **a sentence group** (its sentences),
- **the talker dropdown's core words**, or **its phrases**.

### Publishing

In edit mode, the admin taps **Publish as module**. A window asks for:

- **Module name:** how it appears in the library.
- **Slug:** the short name used in the library's web address (lowercase
  letters, numbers and hyphens).
- **Classification:**
  - **Default:** added automatically to **every new account**, and free to
    use.
  - **Free**, **Pro** or **Max:** listed in the resource library for accounts
    on that plan. See [FEAT-107](FEAT-107-resource-library.md) and
    [FEAT-108](FEAT-108-pricing-and-tiers.md).

**Publish**, and the module is live: in the library, or in the defaults for the
next sign-up. The talker dropdown has its own **Publish default**, for the core
words and phrases every account starts with.

### What travels with a module

- **Pictures and recordings** the admin uploaded, generated or recorded are
  **copied into the module's own storage** when it's published. The module then
  never depends on the admin's account, and keeps working if that account
  changes or is deleted.
- **Photo credits** for Image Search pictures travel with the module, and
  appear on the Credits screen of every account that adds it. See
  [FEAT-106](FEAT-106-settings.md).

### Updating

A published module shows its plan badge, and its button becomes **Update
module**. Updating re-publishes the current content under the same slug, which
is locked so it can't be duplicated by accident. **New installs get the
update. Accounts that already added it keep their own copy**, including any
changes they made.

While editing anything published as a **Default**, a reminder banner says the
changes will reach every new sign-up.

### The order new accounts see

On the categories grid, **Sync seed order** saves the current arrangement of
published categories as the order every new account receives, without
re-publishing each one. See [FEAT-109](FEAT-109-sign-up-and-onboarding.md).

### Every language

Modules are written in English and made complete in every supported language
before families see them:

- **Module words** (names, list steps, sentence and phrase text) are filled in
  by the **translation run**, started from the Languages admin page. It only
  adds or updates what's missing or changed, and never overwrites a good
  translation. See [FEAT-404](FEAT-404-translation-pipeline.md).
- **Symbol words** come from the symbol library, which is translated
  separately.
- **Sentences and phrases** carry their language **versions**. A version
  whose text hasn't been translated yet isn't published.

### Backup

Published modules are mirrored to files kept in the code repository, so the
content can be rebuilt if the database is ever lost. See
[FEAT-403](FEAT-403-backup-and-restore.md).

## Why it helps

- **Anyone on the team can make content.** No code, no deploy, no waiting. It's
  published from the app.
- **What families get is what the admin saw.** Content is built with the same
  screens families use.
- **Safe to share.** Copied assets and travelling credits mean a module keeps
  working, and stays properly credited, wherever it's installed.
- **Families' work is respected.** Updating a module never overwrites a
  family's copy.

## Audio

A module's audio is whatever the admin set: SymbolStix recordings, generated
speech, or recordings. Recordings are copied with the module. Generated speech
is made again in each account's own voice when played.

## Edge cases

- **An empty group** can't be published ("This group has no items to
  publish").
- **If copying pictures fails,** publishing stops and says so, rather than
  publishing a module that still points at the admin's own files.
- **There's no unpublish button.** Publishing is one-way in the app. A
  developer command can remove a single module. It deliberately leaves
  families' installed copies and the module's files alone, and needs extra
  confirmation to remove a Default.
- **Free modules must be SymbolStix-only** under the decided pricing. See
  [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **Only in the admin view.** None of this appears for families, or for an
  admin in the ordinary instructor view.

## Where it lives

- The publish window: `app/components/app/shared/modals/PublishModuleModal.tsx`
- Publishing, updating and installing: `convex/contentModules/`
- Copying a module's pictures and recordings: `app/api/admin/promote-module-assets/`
- Credits that travel with a module: `convex/lib/moduleCredits.ts`
- Translating modules: `app/api/admin/translate-modules/` and
  `convex/contentModules/translate.ts`

## Links

- **Up from:** [FEAT-301 Instructor & student views](FEAT-301-instructor-and-student-views.md)
  (the admin view)
- **Feeds:** [FEAT-107 Resource library](FEAT-107-resource-library.md) ·
  [FEAT-109 Sign-up & onboarding](FEAT-109-sign-up-and-onboarding.md) (defaults)
- **Related:** [FEAT-302 Edit mode](FEAT-302-edit-mode.md) ·
  [FEAT-403 Backup & restore](FEAT-403-backup-and-restore.md) ·
  [FEAT-404 Translation pipeline](FEAT-404-translation-pipeline.md)
