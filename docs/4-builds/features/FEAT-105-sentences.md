# FEAT-105 · Sentences

**Layer 1 · Page** · [Back to the index](README.md)

- Whole sentences made of symbols, with audio, ready to say in one tap
- Two kinds: **fluent** sentences play as one smooth sentence, and **block**
  sentences play one block at a time
- Block sentences are saved from the talker and mix single words with phrases
- Tap a sentence to play it full screen, with the symbols lighting up as it
  speaks
- Play with feeling: angry, neutral or excited (Max)
- Organised into groups (folders), with Drafts for anything not yet filed
- Edit words, phrases, order and audio in edit mode
- Make a version in another language, with the right words, order and voice

---

## What it does

Sentences holds things a student says often, ready to say in one tap: "I want
to go outside", "Can I have a drink please", "I need a break". Each sentence is
a row of symbols with its words written out underneath.

### Two kinds of sentence

**Fluent sentences** are a row of single symbols that together make one
sentence. When played, the whole sentence is spoken smoothly in one go, and all
its symbols light up together for as long as it sounds. Fluent sentences are
made with **Create sentence**, here or on Home, never from the talker.

**Block sentences** come from the talker. When a student or instructor builds a
sentence in the talker and saves it, it arrives here as a block sentence. Its
blocks can be single words or **phrases**: short groups of words that belong
together, like "I want" or "more please". When played, each block lights up and
speaks in turn, with a short pause between blocks. See
[FEAT-201](FEAT-201-talker.md) and [FEAT-202](FEAT-202-talker-dropdown.md).

Block sentences are there to teach. A student sees and hears a sentence break
into its parts, and learns that the same phrase ("I want") can start many
different sentences. That supports how many autistic children learn language,
starting from whole chunks and gradually breaking them down.

### Groups

Sentences opens on its groups (for example "Talking about food" or "At the
shop"), with **Drafts** for anything not yet filed. It's the same system as
list groups. See [FEAT-205](FEAT-205-groups-and-folders.md).

### Playing a sentence

Tap a sentence and it plays full screen: the symbols in a group coloured like
its folder, with the sentence written underneath. It speaks straight away.
Tapping the symbols or the words plays it again, with a small pulse so the tap
is felt as well as heard.

Below it is a row of three faces: **angry**, **neutral** and **excited**. Each
plays the whole sentence again in that tone of voice, so a student can hear how
the same words sound with different feelings. See
[FEAT-204](FEAT-204-play-modal.md).

### Edit mode

**Edit** turns the page into an editable surface. See
[FEAT-302](FEAT-302-edit-mode.md).

**A fluent sentence** can be:

- renamed, or its text changed,
- given symbols, which can be tapped to edit, dragged to reorder or removed,
- given audio (below).

**A block sentence** can have:

- **word blocks** tapped to edit them in the symbol editor,
- **phrase blocks** edited in place: their words, name and audio, using the
  same phrase builder as the talker dropdown. A change saves straight away and
  only affects this sentence's copy of the phrase,
- blocks dragged to reorder or removed,
- new blocks added with **+**, which offers **Create a symbol** or **Create a
  phrase**.

Sentences can also be dragged to reorder, renamed, moved to another group or
deleted.

### Creating a sentence

**Create sentence** asks for the sentence and which group it goes in. With
**Auto-match** on, each word gets its own symbol and the sentence is built for
you. You can then adjust it in edit mode.

### Other languages

A sentence isn't just translated word for word. Sentence structure differs
between languages, so a sentence in another language is its own **version**,
with the right words, the right order and the right voice.

A sentence you wrote shows a **"Made in"** badge when the board is in another
language. Tap it to make a version for the board's language:

- **Translate:** the text and voice are filled in automatically. You then
  reorder the symbols to match how that language builds the sentence.
- **Edit manually:** arrange the symbols and type the text yourself.

Each language's version is kept separately, and switching the board language
shows the matching version. A board's version can be removed to go back to the
original. Sentences installed from the library come with their versions ready,
so they don't show the badge. See [FEAT-305](FEAT-305-languages-and-voices.md).

## Why it helps

- **Students** can say whole, everyday sentences in one tap, quickly enough for
  real conversation.
- **Block sentences** show how sentences are built from reusable parts, which
  supports language development rather than only replacing speech.
- **Tones** let a student express how they feel, not just what they want, and
  hear the difference.
- **Instructors** can capture a sentence the moment it's built in the talker,
  then tidy it here.

## Audio

- **Fluent sentences** speak the sentence text as one clip. Set it from the
  audio button in edit mode: **Generate audio** reads it with the board's
  voice, or **Record** your own. A recording wins over the voice. In edit mode,
  a sentence whose text has changed since its audio was made shows "No audio —
  tap to generate", so audio never goes out of step with the words.
- **Block sentences** play each block's own audio in turn: a word's audio, or a
  phrase's recorded or voiced audio.
- **Tones** make a fresh expressive recording of the whole sentence each time,
  played smoothly in one go, even for a block sentence.
- A sentence shown in another language than the board's is spoken by that
  language's voice, so it doesn't sound like the words in the wrong accent.

## Edge cases

- **Free accounts.** Playing sentences works. **Edit** and **Create** open the
  "Pro feature" upgrade prompt. See [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **Tones are Max.** On other plans, tapping a face opens the "Max feature"
  prompt. The plain replay always works.
- **A tone fails to play.** A message says it couldn't play that tone, rather
  than the face lighting up in silence.
- **Students and editing.** Editing appears in a student's view only if the
  instructor allows it. See
  [FEAT-301](FEAT-301-instructor-and-student-views.md).
- **Sentences hidden for a student.** The instructor can hide Sentences from a
  student's view.
- **Deleting a sentence** that has versions in several languages removes it
  from every board. The warning says so. Pictures stay in My Images.
- **Deleting a group** removes every sentence inside it, and the warning says
  how many.
- **Image credits survive reordering.** Moving or removing symbols never loses
  the credit an Image Search picture carries. See
  [FEAT-106](FEAT-106-settings.md).

## Where it lives

- The pages: `app/[locale]/(app)/sentences/` (the groups, and each group)
- The page, create window, fluent play window and inline phrase editor:
  `app/components/app/sentences/`
- The block-by-block player is shared with the talker:
  `app/components/app/shared/modals/CompositionPlayModal.tsx`

## Links

- **Down to:** [FEAT-201 The talker](FEAT-201-talker.md) ·
  [FEAT-202 Talker dropdown](FEAT-202-talker-dropdown.md) ·
  [FEAT-203 Symbol editor](FEAT-203-symbol-editor.md) ·
  [FEAT-204 Play modal](FEAT-204-play-modal.md) ·
  [FEAT-205 Groups & folders](FEAT-205-groups-and-folders.md) ·
  [FEAT-302 Edit mode](FEAT-302-edit-mode.md)
- **Up from:** [FEAT-101 Home](FEAT-101-home.md) (Create a Sentence)
- **Related:** [FEAT-104 Lists](FEAT-104-lists.md) (the same groups) ·
  [FEAT-305 Languages & voices](FEAT-305-languages-and-voices.md) ·
  [FEAT-402 Admin authoring](FEAT-402-admin-authoring.md)
