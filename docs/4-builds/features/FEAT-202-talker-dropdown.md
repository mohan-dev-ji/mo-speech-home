# FEAT-202 · Talker dropdown: core words & phrases

**Layer 2 · Component** · [Back to the index](README.md)

- Opens from a tab under the talker, over whatever page you're on
- Two tabs: **Core words** and **Phrases**
- One tap adds a word or phrase to the talker
- Core words: the small, frequent words that hold sentences together
- Phrases: short ready-made chunks of symbols, with their own audio
- Ready-made defaults, and instructors add their own for each student's level
- Edit mode: add, arrange and remove words, build and edit phrases
- Phrases can have their own version in each language

---

## What it does

Building a sentence shouldn't mean hunting for "I", "want" or "more" every
time. The talker dropdown keeps those words, and the phrases built from them,
one tap away wherever the talker is.

### Opening it

A tab under the talker strip opens the dropdown as a panel over the page.
Tapping a word or phrase adds it to the sentence straight away. The panel closes
when you move to another page, or when you tap the tab again. It's available
wherever the talker is: on Search and on every category board. See
[FEAT-201](FEAT-201-talker.md).

### Core words

The **Core words** tab is a grid of single symbols: the little words that
appear in almost every sentence (I, you, want, more, go, stop, like, not and so
on). They were chosen from AAC research and refined from the first version of
Mo Speech.

The grid follows the student's grid size (large, medium or small), and on
smaller screens it uses fewer, larger columns, so the words are always easy to
hit. It keeps a steady shape even when it's nearly empty.

### Phrases

The **Phrases** tab holds **phrases**: short chunks of symbols, usually two or
more, with their own audio, like "I want", "more please" or "can I have". Each phrase is a
card showing its symbols and its name. Tapped, it goes into the talker as one
block, and plays as one block. See [FEAT-201](FEAT-201-talker.md) and
[FEAT-204](FEAT-204-play-modal.md).

Mo Speech comes with some default phrases, and instructors are encouraged to
make their own to match their student's level. A student starting with single
words might have "more" and "please". A student putting words together might
have "I want to go to…".

### Edit mode

**Edit** at the top of the panel turns it into an editing surface. See
[FEAT-302](FEAT-302-edit-mode.md).

In **Core words**:

- **Create Word** adds a symbol, made in the symbol editor. See
  [FEAT-203](FEAT-203-symbol-editor.md).
- **Add a list** pastes many words at once (separated by commas or on new
  lines), with Auto-match finding a symbol for each.
- **Add row** makes room for more.
- Tap a word to edit it, drag to move it, or delete it.

In **Phrases**:

- **Create Phrase** asks for a phrase name, then builds it symbol by symbol.
- Each phrase can be edited in place: rename it, add or remove symbols, reorder
  them, set its audio, move it, or delete it.
- A phrase needs at least one symbol before it can be tapped into the
  talker. A phrase still being built stays out of the way until then.

**Exit Edit** returns to one-tap mode.

### Languages

Core words follow the board's language like any symbol. A phrase is treated
like a sentence: word order differs between languages, so a phrase in another
language is its own **version**, not a word-for-word translation. A phrase you
made shows a **"Made in"** badge on a board in another language. Tap it to make
that language's version, either filled in automatically and then reordered, or
built by hand. Each version can be removed to go back to the original. Phrases
from Mo Speech's defaults already come in every supported language. See
[FEAT-305](FEAT-305-languages-and-voices.md).

## Why it helps

- **Speed.** The words and phrases that make up most sentences are one tap away
  from any page. No searching mid-conversation.
- **Growth.** Phrases can grow with the student, from single-word requests to
  longer, more complex chunks, set by the instructor who knows them.
- **Language development.** Keeping phrases as whole chunks, and letting them
  be broken down and recombined in the talker, supports students who learn
  language in chunks first.
- **The same everywhere.** Whatever category a student is in, their core
  words and phrases are in the same place.

## Audio

- **Core words** speak like any symbol: a recording, the library's recording,
  or the label read aloud.
- **Phrases** have their own audio: a recording, or the phrase's name spoken by
  the board's voice. In edit mode each phrase shows whether its audio is ready,
  or "Tap to add audio". A phrase with no audio yet still speaks its name, so
  it's never silent.

## Edge cases

- **Free accounts.** Tapping words and phrases into the talker works on Free.
  **Edit** opens the "Pro feature" upgrade prompt. See
  [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **An empty tab.** Phrases says "No phrases yet — build one to fill this
  bank". Core words shows its empty grid, ready to fill in edit mode. Accounts
  made before the defaults existed get their empty Core words and Phrases tabs
  set up automatically the first time the dropdown opens.
- **Deleting a word** keeps its picture in My Images, but deletes any recording
  on it. The warning also says if the picture is used elsewhere.
- **Deleting a phrase** that has versions in several languages removes it from
  every board, and the warning says so.
- **Image credits survive editing.** Reordering or changing a phrase never
  loses the credit on an Image Search picture.

## Where it lives

- The dropdown panel: `app/components/app/shared/ui/TalkerDropdown.tsx`
- The phrase builder (also used when editing phrases inside sentences):
  `app/components/app/shared/ui/composition/`
- The account's core-words and phrases containers: `convex/dropbar.ts`

## Links

- **Up from:** [FEAT-201 The talker](FEAT-201-talker.md)
- **Down to:** [FEAT-203 Symbol editor](FEAT-203-symbol-editor.md) ·
  [FEAT-204 Play modal](FEAT-204-play-modal.md) ·
  [FEAT-302 Edit mode](FEAT-302-edit-mode.md)
- **Related:** [FEAT-105 Sentences](FEAT-105-sentences.md) (phrases inside
  block sentences) · [FEAT-305 Languages & voices](FEAT-305-languages-and-voices.md)
  · [FEAT-402 Admin authoring](FEAT-402-admin-authoring.md) (publishing the
  defaults)
