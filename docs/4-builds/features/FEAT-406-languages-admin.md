# FEAT-406 · Languages admin

**Layer 4 · Admin** · [Back to the index](README.md)

- One row per language, with its **publish** state and **translation** stage
- **Add language** starts a new one
- The translation runs (app words, module copy, symbols) are started from here
- Three stages: **machine-translated** → **beta** (shown to families as
  *preview*) → **stable**
- Publish now, schedule a start and end date, or unpublish
- Filter by publish state and translation stage

---

## What it does

The **Languages** page of the admin dashboard (see
[FEAT-401](FEAT-401-admin-dashboard.md)) is where a language is born, translated,
checked and made available to families. It lists every language Mo Speech
knows about, with:

- **Language:** its name.
- **Publish:** whether families can choose it now, later, or not at all.
- **Translation:** how far along it is (below).
- **Window:** when it's published from, and until, if a date is set.
- **Updated:** when it was last changed.

Filters at the top narrow the list by publish state and translation stage.

### The three stages

| Stage | What it means | Families see it? |
|---|---|---|
| **Machine-translated** | Translated by machine, not yet checked | No |
| **Beta** | Being checked and refined | Yes, marked **preview** |
| **Stable** | Checked and complete | Yes |

Each row's menu moves a language up or down: **Promote → Beta**,
**Promote → Stable**, **Demote → Beta**, **Demote → Machine**.

### Publishing

A language only appears for families once it's **published** and inside its
**window**:

- **Publish now** makes it available straight away.
- **Edit lifecycle…** sets a **from** and an optional **until** date, to
  schedule a launch or a time-limited preview.
- **Unpublish** takes it away again.

A language that's published but still at the machine-translated stage stays
hidden from families' pickers.

### Adding a language, from start to finish

1. **Add language:** give it its code and its name in English and in its own
   script. This creates the language's file in the code, so it goes live after
   the next release.
2. **Voices:** a male and a female voice are added to the language by a
   developer. Until then, the language can't speak.
3. **Translate**, from the row's menu (see
   [FEAT-404](FEAT-404-translation-pipeline.md)):
   - **Translate UI strings…**: the app's own words.
   - **Translate symbols…**: the symbol library, as a background job with an
     estimate, a progress bar, and pause and resume.
   - **Translate module copy…**: the library's content.
4. **Switch on search:** when the symbol job finishes, the page shows the one
   line of code to add so the language gets its own search.
5. **Record symbol audio** for its voices.
6. **Publish** as **beta** (families see *preview*), check, and then
   **promote to stable**.

## Why it helps

- **A language is a managed launch.** It can be translated and checked
  privately, previewed with real families, and only then made fully available.
- **Nothing half-finished leaks out.** Machine-only languages never appear to
  families.
- **Scheduling.** A language can go live on a planned date, or run as a
  time-limited preview.
- **Everything in one place.** Translating, promoting and publishing all happen
  from the language's row.

## Audio

A new language has no voices until a developer adds them. It can't be used for
speech until then. See [FEAT-305](FEAT-305-languages-and-voices.md).

## Edge cases

- **English is the master.** It has no translate actions, because everything
  is translated from it.
- **A new language needs a release.** Adding one, and translating its app
  words, write into the code, so both happen on a developer's machine and go
  live after the next release. Translating symbols and module copy doesn't need
  a release.
- **A duplicate code** is refused.
- **Today:** English and Spanish are stable, Hindi is beta (*preview*), and
  Punjabi is machine-translated and unpublished, with no voices yet.

## Where it lives

- The page: `app/(admin)/admin/languages/`
- The table, row menus and windows: `app/components/admin/` (`LanguagesAdminTable`,
  `AddLanguageModal`, `EditLanguageLifecycleModal`, `TranslateSymbolsConfirmModal`)
- Adding a language's file: `app/api/admin/language-publish/`
- Stages, publish windows and what families see: `convex/languages.ts`

## Links

- **Up from:** [FEAT-401 Admin dashboard](FEAT-401-admin-dashboard.md)
- **Down to:** [FEAT-404 Translation pipeline](FEAT-404-translation-pipeline.md)
- **Feeds:** [FEAT-305 Languages & voices](FEAT-305-languages-and-voices.md)
