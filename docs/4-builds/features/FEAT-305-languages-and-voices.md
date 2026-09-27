# FEAT-305 · Languages & voices

**Layer 3 · Modes & looks** · [Back to the index](README.md)

- The whole app, and every board, can run in the student's own language
- **Languages today:** English and Spanish, and Hindi (marked *preview*).
  Punjabi is being prepared
- Each language has a **male and a female voice**
- The instructor and each student can have a different language and voice
- Switching the language switches symbols, labels, audio and the app's own
  words together
- **Voice follows the words:** text in another language is spoken by that
  language's voice
- Your own content can be translated, and sentences and phrases get a proper
  version per language
- A symbol can be **pinned** to one language, for bilingual families

---

## What it does

Mo Speech is built for families who don't all speak English, starting with
India and Hindi. A language isn't a setting bolted on top. It runs through the
symbols, their words, their audio, the app's buttons and the content itself.

### Languages and voices

Each language has two voices, an adult **male** and an adult **female** voice,
with a preview in Settings:

| Language | Status | Voices |
|---|---|---|
| **English** | Live | British English, male and female |
| **Spanish** | Live | Latin American Spanish, male and female |
| **Hindi** | Live, marked *preview* while it's refined | Hindi (India), male and female |
| **Punjabi** | Being prepared (translated, not yet published) | Not yet |

A language marked **preview** can be chosen, but is still being polished.
Languages are added and published by Mo Speech's admins. See
[FEAT-404](FEAT-404-translation-pipeline.md) and
[FEAT-406](FEAT-406-languages-admin.md).

### Whose language?

- **The instructor** chooses the app's language in **Settings → Instructor
  Profile**. The app reloads in it.
- **Each student** has their own language and voice in **Settings → Student
  Profiles**. Switching to a student's view switches the app into their
  language: the app's own words, the symbols' labels, and the voice.
- **New accounts** start with the language chosen for the first student. See
  [FEAT-109](FEAT-109-sign-up-and-onboarding.md).

### What changes with the language

- **Symbols** show their word in the board's language and speak it in the
  board's voice. SymbolStix symbols come with words and recordings in every
  supported language.
- **Search** looks for words in the board's language, including Hindi typed in
  Latin letters. See [FEAT-102](FEAT-102-search.md).
- **The app itself** (buttons, menus, messages) appears in the language.
- **Library content** comes complete in every supported language. A Hindi
  board gets real Hindi content, not a translation to tidy up. See
  [FEAT-107](FEAT-107-resource-library.md).

### Voice follows the words

If something has no words in the board's language yet (say, an English list
step on a Hindi board), it's shown in its original language and **spoken by
that language's voice**. So English words sound English, not like English read
in a Hindi accent. As soon as it's translated, it speaks in the board's voice.

### Your own content in other languages

Things you've made yourself start in the language you made them in, marked
with a **"Made in"** badge on a board in another language. How they're
translated depends on what they are:

- **Names and labels:** category, group and list names, list steps and symbol
  labels. **One tap** fills in the board's language by machine translation. It
  can be edited, and **undone** to go back to the original. Names are never
  translated without being asked.
- **Sentences and phrases:** word order differs between languages, so these
  get their own **version** per language rather than a word-for-word
  translation. Tapping "Made in" offers **Translate** (text and voice filled in,
  then you reorder the symbols to fit) or **Edit manually**. Each language's
  version is kept separately. See [FEAT-105](FEAT-105-sentences.md) and
  [FEAT-202](FEAT-202-talker-dropdown.md).

A saved block sentence remembers the language it was built in, and always
plays that way.

### Bilingual families: pinned symbols

A symbol on a category board can be **pinned** to one language in the symbol
editor. It then always shows and speaks that language, whatever the board is
set to. It's useful for a word a family always says in one language, even
while the rest of the board is in another. See
[FEAT-203](FEAT-203-symbol-editor.md).

## Why it helps

- **Communication in the home language.** A child should be able to speak in
  the language their family speaks.
- **Real content, not translated English.** Library content, sentences and
  phrases are made properly for each language, with the right words and order.
- **Mixed households.** Different students can have different languages, and
  pinned symbols let one board mix two.
- **Honest audio.** Voice-follows-the-words means nothing is ever read in the
  wrong accent.

## Audio

- **Symbol audio:** SymbolStix recordings in each language's voice.
- **Everything else** (list steps, sentences, phrases, and symbols without a
  recording) is spoken by the language's voice from its text. The first time
  something is spoken, it's generated and kept, so it plays instantly after
  that.
- **Recordings** you make play in your own voice, whatever the board's
  language or voice.
- **Tones** (Max) are expressive recordings made on demand. See
  [FEAT-204](FEAT-204-play-modal.md).

## Edge cases

- **Free accounts use one language.** The account and all its students share
  it. A language per student is Pro. See [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **Missing translations stay visible.** Something without words in the
  board's language shows its original with a "Made in" badge, never a blank.
- **Library content** doesn't show "Made in" or translate controls, because
  it's already complete in every supported language.
- **Undoing a translation on the original language** isn't possible. The
  original always stays.
- **A language without its own search yet** searches English words while it's
  being prepared.

## Where it lives

- The languages and their voices: `convex/data/languages/` (one file each),
  read through `lib/languages/registry.ts`
- The app's own words per language: `messages/` (`en.json`, `hi.json` and so on)
- Choosing the right voice for the words: `lib/audio/`
- Translating your own content and making language versions: `convex/`
  (the translate and variant functions for lists, sentences and phrases)

## Links

- **Applies to:** everything
- **Related:** [FEAT-102 Search](FEAT-102-search.md) ·
  [FEAT-106 Settings](FEAT-106-settings.md) ·
  [FEAT-105 Sentences](FEAT-105-sentences.md) ·
  [FEAT-203 Symbol editor](FEAT-203-symbol-editor.md) ·
  [FEAT-404 Translation pipeline](FEAT-404-translation-pipeline.md) ·
  [FEAT-406 Languages admin](FEAT-406-languages-admin.md)
