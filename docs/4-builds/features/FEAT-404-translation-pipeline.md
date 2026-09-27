# FEAT-404 · Translation pipeline

**Layer 4 · Admin** · [Back to the index](README.md)

- How Mo Speech gets from English into another language
- Four parts: the **app's words**, the **symbol library**, **library content**,
  and **symbol audio**
- Machine translation by Google's Gemini, with English as the master
- Only translates what's new or changed, and never overwrites a good
  translation
- The symbol library runs as a background job: estimate first, then watch
  progress, and pause, resume or cancel
- Run by admins from the **Languages** page, one language at a time

---

## What it does

Adding a language to Mo Speech means translating four different things. Each
has its own step, because each lives in a different place and changes at a
different pace. All four are started by an admin, from the **Languages** page
of the admin dashboard. See [FEAT-406](FEAT-406-languages-admin.md).

English is always the **master**. Every other language is translated from it,
and a translation is only redone when the English it came from has changed.

### 1. The app's words

The app's own words (buttons, menus, messages, settings) are all written once in
English. **Translate UI strings…** works out which of them are missing or
changed in the target language, translates only those, and saves them to that
language's file in the code. The team then commits the file and redeploys to
ship them.

This step runs on a developer's machine, not on the live site, because it
writes into the code. Anything not yet translated simply shows in English
until it is, so a half-translated language never shows blanks.

### 2. The symbol library

Tens of thousands of SymbolStix symbols each need their word in the new
language, plus the ways people might **search** for it: synonyms and, for
languages like Hindi, spellings in Latin letters. This is the biggest job, so it
runs in the **background**, started with **Translate symbols…**:

- **Estimate first.** Before starting, a window shows how many symbols still
  need translating, and the expected cost and time. Nothing is spent until the
  admin presses **Start translation**.
- **Watch it run.** A progress bar on the language's row shows how far it has
  got.
- **Pause, resume or cancel** at any time. Pausing stops within seconds.
- **Safe to interrupt.** It picks up where it left off, and skips any symbol
  already translated.
- **One language at a time,** so jobs never compete.
- **Patient with the service.** If the translation service is busy, it waits
  and tries again, and stops with a clear error if it keeps failing.

When a language's symbols are finished, one small code change is needed to
switch on **search** for that language. The Languages page shows the exact line
to paste. Until then, searching in that language falls back to English words.
See [FEAT-102](FEAT-102-search.md).

Symbol translations are irreplaceable work, so the symbol library is
**snapshotted to the code repository** after each language run. See
[FEAT-403](FEAT-403-backup-and-restore.md).

### 3. Library content

Mo Speech's library modules (names, descriptions, category names, list steps,
and sentence and phrase text) are translated by **Translate module copy…**, for one
language at a time. It only fills in what's missing or has changed since the
last run, and never replaces a translation that's already good. It writes
straight to the live content, so no redeploy is needed. Symbol words aren't
part of this step. They come from the symbol library (step 2). See
[FEAT-402](FEAT-402-admin-authoring.md).

### 4. Symbol audio

Each language's voices need the symbol library's words **recorded**. This is
generated ahead of time for each voice by a script, so symbols speak instantly
rather than waiting for speech to be generated. Anything not pre-recorded is
generated the first time it's played and kept after that. See
[FEAT-305](FEAT-305-languages-and-voices.md).

### And families' own content

The one-tap **translate** families use on their own names and list steps (see
[FEAT-305](FEAT-305-languages-and-voices.md)) uses the same translation service,
one piece of text at a time. That isn't part of this pipeline, and it's never
run by an admin.

## Why it helps

- **New languages without a translation agency.** A language can go from nothing
  to fully translated in hours, at a small cost.
- **Only pay for what changed.** Re-runs translate only new or changed words, so
  keeping languages up to date is cheap.
- **Good translations are protected.** Nothing already translated, or
  corrected by hand, is overwritten.
- **Safe to stop and start.** Long jobs can be paused, resumed and interrupted
  without losing work.

## Audio

Symbol audio for each language is recorded ahead of time for every voice (step
4). Everything else is spoken from its text, and generated on first play.

## Edge cases

- **Machine translation needs checking.** Translations are good but not
  perfect, which is why a language can stay at a **preview** stage while it's
  checked. See [FEAT-406](FEAT-406-languages-admin.md).
- **The app's words need a deploy.** They live in the code, so translating
  them only takes effect after the next release.
- **Search needs a one-line change** per language, shown on the Languages page
  when the symbol job finishes.
- **A failed job** stops with the error it hit, and can be resumed.
- **Sentences and phrases** are translated as text here. Their word order in
  each language is handled by their language versions. See
  [FEAT-105](FEAT-105-sentences.md).

## Where it lives

- The app's words: `app/api/admin/translate-ui-strings/` (writes `messages/`)
- The symbol library job: `convex/translationJobs.ts` and
  `convex/translationActions.ts`, with the estimate window and progress bar in
  `app/components/admin/`
- Library content: `app/api/admin/translate-modules/` and
  `convex/contentModules/translate.ts`
- Symbol audio: `scripts/seed-voice-audio.mjs`
- The translation service connection: `lib/llm/vertex.ts`

## Links

- **Up from:** [FEAT-406 Languages admin](FEAT-406-languages-admin.md)
- **Feeds:** [FEAT-305 Languages & voices](FEAT-305-languages-and-voices.md) ·
  [FEAT-102 Search](FEAT-102-search.md) ·
  [FEAT-107 Resource library](FEAT-107-resource-library.md)
- **Related:** [FEAT-402 Admin authoring](FEAT-402-admin-authoring.md) ·
  [FEAT-403 Backup & restore](FEAT-403-backup-and-restore.md)
