# FEAT-204 · Play modal

**Layer 2 · Component** · [Back to the index](README.md)

- The full-screen window where sentences, talker sentences and list steps are
  played
- It plays by itself as it opens, with a yellow glow on whatever is speaking
- Block sentences light up block by block. Fluent sentences light up as one
- Tap the picture to hear it again, and tap outside to close
- Play with feeling: **angry**, **neutral** or **excited** (Max). For a block
  sentence, this is also how to hear it spoken fluently
- One look and feel everywhere, so the student always knows what's happening

---

## What it does

When something is **played** (a sentence, a sentence built in the talker, a
list step), it opens full screen over a dimmed, softly blurred page. The page
fades back so there's nothing to do but look and listen. It starts speaking
straight away.

### Three kinds of play

**A fluent sentence** ([FEAT-105](FEAT-105-sentences.md)). The sentence's
symbols sit together on a panel in their folder's colour, with the sentence
written underneath. It's spoken as one smooth clip, and a **yellow glow** sits
on the whole group for exactly as long as it sounds.

**Blocks: a block sentence, or the talker's Play** ([FEAT-105](FEAT-105-sentences.md),
[FEAT-201](FEAT-201-talker.md)). The whole sentence is shown at once as its
blocks: single words and phrase boxes. The glow **steps** from block to block,
each lit for exactly as long as its own audio, with a short pause between. The
student sees and hears the sentence being put together from its parts.

**A list step** ([FEAT-104](FEAT-104-lists.md)). One step, large: its picture,
its words, its number or its **First** / **Then** label, and on a checklist, its
tick box. The step's audio plays as it opens, and the step can be ticked off
from here. A ticked step turns green.

### Hearing it again

In the sentence and block windows, **tapping the picture or the words plays it
again from the start**, with a small pulse so the tap is felt as well as heard.
It's one large target rather than a small replay button to aim at. A block
sentence and a fluent one behave the same way, because to a student they're the
same thing.

Tapping outside the picture, on the dimmed page, closes the window.

### Tones

Under the sentence and block windows is a row of three faces: 😠 **angry**,
🙂 **neutral** and 😄 **excited**. Each plays the whole sentence again in that
tone of voice, as one smooth clip with the glow on everything. The face stays
lit while it speaks. Students can hear how the same words change with feeling,
and use that feeling to express themselves.

**Tones are also how a block sentence sounds fluent.** Normally a block
sentence plays one block at a time, with pauses, to show how it's built. A tone
plays the same sentence as **one natural, flowing sentence**: no pauses, the
way it would really be said. So a student gets both, from the same saved
sentence. The pieces are one tap on the picture, and the whole thing said
naturally is one tap on a face. **Neutral** is the plain fluent reading, with
no particular feeling.

## Why it helps

- **Focus.** The full-screen window removes everything else while a sentence is
  spoken, which helps students who are easily distracted.
- **Seeing speech.** The glow links each sound to its picture, so a student
  learns which symbols made which words.
- **Blocks show structure.** Watching a sentence light up one chunk at a time
  shows how it's built, and that the same chunk can start many sentences.
- **Feeling, not just words.** Tones give students a way to say how something
  matters, not just what they want.
- **From parts to a whole.** A block sentence can be heard in pieces, then
  heard fluently with a tone. That's the step from learning a sentence's parts
  to saying it naturally.
- **Easy to repeat.** One big tap target makes hearing it again effortless,
  which matters for students who need repetition.

## Audio

- **Fluent sentences** play their sentence audio: a recording, or the
  sentence read by the board's voice.
- **Blocks** play each block's own audio in turn. A block with no audio yet
  has its words or name read aloud, and its glow still lasts exactly as long
  as the speech.
- **List steps** play the step's recording, or its words read aloud.
- **Tones** make a fresh expressive recording of the whole sentence each time.
- **The voice follows the words.** English words on a Hindi board are spoken by
  an English voice, whatever the board's voice is. See
  [FEAT-305](FEAT-305-languages-and-voices.md).

## Edge cases

- **Tones are Max.** On other plans, tapping a face opens the "Max feature"
  upgrade prompt. Plain playing and replaying always work. See
  [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **A tone that fails** shows "Couldn't play that tone. Please try again",
  rather than a face lit up in silence.
- **Tapping quickly.** A new tap, a tone or closing stops whatever was playing
  first, so sounds never overlap or play twice.
- **Tones aren't on list steps.** A step is an instruction, not something to
  say with feeling.

## Where it lives

- The fluent sentence window: `app/components/app/sentences/modals/SentencePlayModal.tsx`
- The block window (block sentences and the talker):
  `app/components/app/shared/modals/CompositionPlayModal.tsx`
- The list step window: in `app/components/app/lists/sections/ListDetailDisplay.tsx`
- The shared dimmed backdrop, glow and tone faces:
  `app/components/app/shared/ui/` (`PlayModalBackdrop`, `playGlow`,
  `playSurface`, `ToneChipRow`)

## Links

- **Up from:** [FEAT-104 Lists](FEAT-104-lists.md) ·
  [FEAT-105 Sentences](FEAT-105-sentences.md) · [FEAT-201 The talker](FEAT-201-talker.md)
  · [FEAT-202 Talker dropdown](FEAT-202-talker-dropdown.md) (phrases play as
  blocks)
- **Related:** [FEAT-108 Pricing & tiers](FEAT-108-pricing-and-tiers.md) (tones) ·
  [FEAT-305 Languages & voices](FEAT-305-languages-and-voices.md)
