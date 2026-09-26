# FEAT-102 · Search

**Layer 1 · Page** · [Back to the index](README.md)

- Find any symbol in the library, with results appearing as you type
- Search by voice: tap the mic and say the word
- Finds synonyms and transliterations, not just exact words
- Searches in the board's language: English, Hindi or Spanish
- Tap a result to hear it. With the talker on, it's added to the sentence too
- The pencil on each result personalises it and saves it into a category
- Free accounts can search, hear and build sentences. Saving is Pro

---

## What it does

Search is the quickest way to any symbol. It's a plain page with a search bar
at the top and results below, built for the moment a student needs a word
that isn't on their board.

### Searching as you type

Start typing and results appear straight away, after a short pause so the page
doesn't flicker on every letter. Up to 20 symbols come back as a grid of the
same tiles used on category boards.

The search is forgiving:

- **Synonyms count.** A search can find a symbol by another word for the same
  thing.
- **Transliterations count.** On a Hindi board you can type a Hindi word in
  Latin letters and still find it, as well as typing it in Devanagari.
- **Exact words come first in English.** Short everyday words such as "is" or
  "go" appear at the top, instead of being buried under longer words that
  start the same way ("Israel", "goalkeeper").

The search follows the board's language. A Hindi board searches Hindi words, a
Spanish board searches Spanish words, and results show labels in that
language.

### Searching by voice

The mic at the end of the search bar lets you say the word instead. While it's
listening, an overlay shows "Listening… speak now" and a way to cancel. Whatever
is heard becomes the search, and the results follow as if it had been typed.

In Chrome the browser's own speech recognition does the listening ("via
Browser"). In other browsers a cloud speech service takes over ("via Cloud"),
so voice search works everywhere. It listens in the board's language.

If something goes wrong, a short message under the search bar says what
happened and what to do. For example: the microphone was blocked, no
microphone was found, no speech was heard, or the connection dropped.

### Tapping a result

What a tap does depends on the talker switch in the top bar:

- **Talker off:** the symbol says its word. Useful for quickly checking a
  symbol, or answering in the moment.
- **Talker on:** the symbol says its word **and** joins the sentence being
  built in the talker, so a student can build a whole sentence straight from
  search. See [FEAT-201](FEAT-201-talker.md).

### Personalise and save

Under each result there's a pencil, **Personalise and save**. It opens the
symbol editor with that symbol already loaded: its picture, its word and its
audio. From there you can change anything (the picture, the label, the colours,
the voice), then choose which category to save it into, or make a new category
on the spot. The library symbol itself never changes. You're saving your own
copy.

## Why it helps

- **Students** can reach any word, even one the instructor never put on their
  board, and use it right away, spoken or in a sentence.
- **Instructors** can find the right symbol and file it into a category in one
  step, without going to the category first.
- **Voice search** helps anyone who finds typing slow: a parent holding a
  tablet one-handed, or a student who can say a word but not spell it.
- **Transliteration** matters in India. Many families type Hindi in Latin
  letters, and search meets them where they are.

## Audio

Each result speaks with the board's current voice, using the library's
recording of that word. When a symbol is personalised and saved, it starts
with that same default audio. A different recording or voice can be chosen in
the editor. See [FEAT-203](FEAT-203-symbol-editor.md) and
[FEAT-305](FEAT-305-languages-and-voices.md).

## Edge cases

- **Free accounts.** Searching, hearing and building sentences in the talker
  all work on Free. The pencil opens the "Pro feature" upgrade prompt instead
  of the editor, because saving into a category is part of Pro and Max. See
  [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **Nothing found.** The page says "No results for" the search, so it's clear
  the search ran and found nothing.
- **A language that's still being added.** A language without its own search
  yet falls back to searching English words, so search keeps working while
  that language is being translated. See
  [FEAT-404](FEAT-404-translation-pipeline.md).
- **Voice search can't start.** The error message says why (permission, no
  microphone, no speech, network, or an unsupported browser). Typing always
  still works.
- **Hidden for a student.** An instructor can hide Search from a student's
  view. The student then lands on the next page they're allowed to see. See
  [FEAT-301](FEAT-301-instructor-and-student-views.md). A student who can see
  Search can use the mic too. There's no separate switch for it.

## Where it lives

- The page: `app/[locale]/(app)/search/`
- The page layout and result tiles: `app/components/app/search/`
- Voice search: `app/hooks/useVoiceSearch.ts`
- The search itself: the symbol search in `convex/symbols.ts`

## Links

- **Down to:** [FEAT-201 The talker](FEAT-201-talker.md) ·
  [FEAT-203 Symbol editor](FEAT-203-symbol-editor.md)
- **Up from:** [FEAT-101 Home](FEAT-101-home.md) (the Search Symbols shortcut)
- **Related:** [FEAT-103 Categories](FEAT-103-categories.md) (where saved
  symbols go) · [FEAT-305 Languages & voices](FEAT-305-languages-and-voices.md)
  · [FEAT-404 Translation pipeline](FEAT-404-translation-pipeline.md)
