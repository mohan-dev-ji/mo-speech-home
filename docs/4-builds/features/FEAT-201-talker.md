# FEAT-201 · The talker

**Layer 2 · Component** · [Back to the index](README.md)

- A sentence strip across the top of Search and Categories
- Switched on and off with the talker switch in the top bar
- With it on, every symbol tapped joins the sentence as a block
- Blocks are single words or whole phrases
- Tap a block to hear it, drag to reorder, ✕ to remove
- **Play** speaks the whole sentence, block by block
- **Clear** empties it. **Save** files it into Sentences (Pro)
- A dropdown of core words and phrases is always one tap away

---

## What it does

The talker is where a student puts words together. It's a strip across the top
of the page, and it builds a sentence one block at a time from anything the
student taps.

### Where it appears

The talker lives on the two pages built for finding words:
**[Search](FEAT-102-search.md)** and **[Categories](FEAT-103-categories.md)**
(the grid and every board). Other pages keep their own headers.

The **talker switch** in the top bar chooses what sits at the top of those
pages:

- **On:** the talker. Every tap on a symbol speaks it **and** adds it to the
  sentence.
- **Off:** the page's normal banner, with its title and its Edit and
  Modelling buttons. A tap only speaks.

A student can move between categories and search while building one sentence.
The talker keeps its blocks from page to page.

### Blocks

Each thing added is a **block**:

- **A word:** a single symbol.
- **A phrase:** a ready-made group of symbols such as "I want" or "more
  please". It's shown as one grey box with the phrase's name underneath, so it
  reads as a reusable chunk. Phrases come from the talker dropdown. See
  [FEAT-202](FEAT-202-talker-dropdown.md).

A sentence can mix both: "I want" + "biscuit" + "please".

The student can change the sentence:

- **Tap** a block to hear just that block.
- **Drag** a block to move it. On a touchscreen, press and hold, then move. A
  quick swipe scrolls the strip instead.
- **✕** removes a block.

When the sentence is longer than the strip, it scrolls, and the newest block
always slides into view.

### Play, Clear and Save

- **Play** opens the sentence full screen and speaks it block by block, each
  block lighting up as it's spoken, with a short pause between blocks. See
  [FEAT-204](FEAT-204-play-modal.md).
- **Clear** empties the strip for a new sentence.
- **Save** keeps the sentence as a **block sentence** in
  [Sentences](FEAT-105-sentences.md). A small window asks which group to save
  it to: an existing group, a new one, or Drafts. It picks a sensible choice
  first. When you're working in a category that has a sentence group with the
  same name (say "Food"), that group is chosen. A note confirms "Saved to
  Food". The sentence **stays in the strip** afterwards, so it can be saved
  into a second group, or changed and saved again.

### The dropdown

A tab under the strip opens the **talker dropdown**: core words (the small,
frequent words that hold sentences together) and phrases, one tap from any
page with the talker. See [FEAT-202](FEAT-202-talker-dropdown.md).

## Why it helps

- **Sentences, not just words.** A student can say "I want more juice please",
  not only "juice".
- **Blocks teach structure.** Seeing and hearing a sentence as reusable chunks
  supports how many autistic children develop language: from whole phrases,
  gradually broken into parts and recombined.
- **The board stays still.** Reordering happens in the strip, never on the
  board, so symbols keep the positions a student has learned.
- **Capture what works.** An instructor can save a sentence the moment a
  student builds it, and it becomes a one-tap sentence from then on.

## Audio

- **A word** plays its own audio: its recording, or the library's recording in
  the board's voice. A symbol with its own picture and no recording has its
  label read aloud, so no block is ever silent.
- **A phrase** plays its recording or its voiced audio. A phrase with no audio
  yet has its name read aloud.
- **Play** runs through each block's audio in turn.
- **Language follows the words.** English words on a Hindi board are spoken by
  an English voice, not read in a Hindi accent. A saved sentence remembers the
  language it was built in, so it always plays the way it was made. See
  [FEAT-305](FEAT-305-languages-and-voices.md).

## Edge cases

- **Free accounts.** Building and playing sentences works on Free. **Save**
  opens the "Pro feature" upgrade prompt, because keeping sentences is Pro. See
  [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **A symbol with no picture** speaks when tapped on a board, but isn't added
  to the strip. Every block needs a picture.
- **An empty strip.** Save does nothing until there's something to save.
- **Students.** In the student's profile, the instructor sets **Header on/off**
  (whether the student has a header at all: off removes the talker **and** the
  page banner with its buttons, leaving just the board) and **Talker mode / Banner mode**
  (which one shows). The student can change these themselves only if they've
  been given **Quick Settings**. The talker on/off switch is inside the Quick
  Settings menu, and the Talker mode switch sits beside it in the top bar. See
  [FEAT-106](FEAT-106-settings.md) and
  [FEAT-301](FEAT-301-instructor-and-student-views.md).
- **Modelling** can show a student what to tap to build a sentence. See
  [FEAT-303](FEAT-303-modelling-mode.md).

## Where it lives

- The strip across the top of the page, and saving:
  `app/components/app/shared/sections/PersistentTalker.tsx`
- The blocks, dragging and removing: `app/components/app/shared/ui/TalkerBar.tsx`
- The on/off switch: `app/components/app/shared/ui/TalkerToggle.tsx`
- What's in the sentence, shared across pages: `app/contexts/TalkerContext.tsx`

## Links

- **Up from:** [FEAT-102 Search](FEAT-102-search.md) ·
  [FEAT-103 Categories](FEAT-103-categories.md) ·
  [FEAT-105 Sentences](FEAT-105-sentences.md) (where saved sentences go)
- **Down to:** [FEAT-202 Talker dropdown](FEAT-202-talker-dropdown.md) ·
  [FEAT-204 Play modal](FEAT-204-play-modal.md)
- **Related:** [FEAT-206 App shell](FEAT-206-app-shell.md) (the top bar
  switch) · [FEAT-303 Modelling mode](FEAT-303-modelling-mode.md) ·
  [FEAT-305 Languages & voices](FEAT-305-languages-and-voices.md)
