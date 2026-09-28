# FEAT-203 · Symbol editor

**Layer 2 · Component** · [Back to the index](README.md)

- One editor for every picture, label and sound in Mo Speech
- Five picture tabs: **Symbols** (SymbolStix), **Upload Picture**, **Image
  Search**, **AI Generate** and **My Images**
- A live preview of the finished symbol
- Label in each language, with a reset back to the symbol's own word
- Audio: the default voice, generated speech, or a recording
- On boards: colours, text size, label and picture on/off, card shape,
  language pin, and which category it goes in
- The same editor, trimmed to fit, for list steps, sentences, phrases and
  cover pictures
- Photo credits are kept automatically

---

## What it does

Whenever a picture, a label or a sound is chosen or changed anywhere in Mo
Speech, it happens here. Tapping a symbol in edit mode, **Add Symbol**,
**Create a Symbol**, a search result's pencil, a list step's picture, a
category's cover: all open the symbol editor.

On a tablet or computer, the picture tabs sit beside the settings. On a phone,
it's one scrolling page: the preview, then the tabs, then the settings, with
**Cancel** and **Save** pinned to the bottom.

### Picking a picture: the five tabs

A search box sits above the tabs and is shared between them. It starts with
the symbol's word, so the right picture is often already on screen.

**Symbols.** The SymbolStix library: tens of thousands of professional AAC
symbols, searched in the board's language as you type. Tap one to use it. It
brings its word and recorded audio with it. This is the default tab, and it
costs nothing to search.

**Upload Picture.** Any photo or picture from the device (JPEG, PNG or WebP).
It's resized and converted automatically, so large phone photos don't slow the
app down. It's ideal for the student's own cup, pet, school or grandma.

**Image Search.** Creative Commons photos and illustrations from four sources:
Wikimedia Commons, Pixabay, Unsplash and Pexels. Each result shows its source,
licence and photographer, with a link to the original. Searching runs only
when you press Enter or **Search**, because each search uses one of the day's
30 searches. The count of searches left is shown underneath. The photographer
and licence are saved with the picture and listed in Settings → Credits. See
[FEAT-106](FEAT-106-settings.md).

**AI Generate.** For an everyday object that isn't in the symbols and can't be
found by searching. Name one thing ("red kite", not a scene) and choose a
style:

- **Photorealistic:** like a product photo on a white background.
- **Iconic Vector:** flat shapes and bold outlines. The closest match to the
  symbols on the board.
- **Storybook:** a soft, pastel picture-book illustration.
- **3D Claymation:** rounded and toy-like.

The editor shows exactly what will be asked for. **Generate** draws a new
picture each time, so you can keep going until one is right. Every generated
picture is saved to My Images and opened there, ready to use. Generations are
limited to 20 a day and 100 a month, and the count left is shown. If the image
service refuses a request, it doesn't use up a generation.

**My Images.** The account's own picture library: every picture it has
uploaded or generated, newest first, whether or not anything uses it. Pick one
and **Add to symbol**, and it's used without making a copy. A picture can also
be **deleted** here. This is the one place a picture is ever permanently
removed. The footer says whether the selected picture is in use. A picture in
use elsewhere can't be deleted until nothing uses it, and neither can the one on
the symbol you're editing.

### Label

The word shown on the symbol (a list step calls it **Description**). There's a
field for the board's language, and for each other language the symbol has. If
you've changed the word from a SymbolStix symbol's own, **Reset to "…"** puts it
back. Picking a different symbol only replaces the label if you haven't typed
your own.

### Audio

What the symbol says when tapped. See Audio below.

### Display, Text and Shape (boards only)

For symbols on a category board:

- **Background** and **text colour**. New symbols start in their category's
  colours.
- **Show or hide** the label, and the picture.
- **Text size:** S, M or L.
- **Shape:** square, rounded or circle.

### Language (boards only)

Pin a symbol to one language, so it always shows and speaks that language
whatever the board is set to. See [FEAT-305](FEAT-305-languages-and-voices.md).

### Category (boards only)

Which category the symbol belongs to, with **+ New category** to make one on the
spot. Save stays blocked until a category is chosen.

### The editor in other places

The editor adapts to where it's opened:

| Opened from | What it shows | Where the audio is set |
|---|---|---|
| A category board, Search, Home, the talker dropdown's Core words | Everything | In the editor |
| A word block in a block sentence | Picture, label and audio | In the editor |
| A list step | **Picture only** | The step's **audio window** |
| A symbol in a fluent sentence | **Picture only** | The sentence's **audio window** |
| A word in a phrase | **Picture only** | The phrase's **audio window** |
| A category, folder or group cover | Picture only | — |

A list step, a fluent sentence and a phrase speak as **one piece of language**,
not one sound per symbol: "put your shoes on", "I want to go outside", "more
please". So their audio can't belong to any one picture. Each has its own
**audio window**, with the same two choices: generate speech from the words, or
record your voice. Changing a picture never changes what they say.

- **List steps** open it with the 🔊 **Audio** icon on each step.
- **Fluent sentences** and **phrases** open it by tapping their "Audio ready" /
  "No audio" line in edit mode. That's due to become the same 🔊 icon as list
  steps ([MOS-81](https://linear.app/mo-intelligence/issue/MOS-81)).

## Why it helps

- **One place to learn.** However a symbol is reached, it's changed the same
  way.
- **The right picture, whatever it takes.** A professional symbol, the
  student's real-world photo, a Creative Commons picture, or a new drawing.
  Personalisation is what makes AAC meaningful to a particular child.
- **Nothing wasted.** Every uploaded or generated picture lands in My Images and
  can be used again on any symbol.
- **Licences handled.** Credits travel with Image Search pictures
  automatically, so instructors never have to track them.

## Audio

Three choices, with a status line saying which is in use:

- **Default:** for a SymbolStix symbol, its recorded word in the board's voice.
  Otherwise the label is read aloud. "Speaks the label above."
- **Generate:** type **Words to speak** (which can differ from the label, such
  as "television room in our house") and generate it in the board's voice.
  Play it back, and regenerate if needed.
- **Record:** record your own voice, play it back, discard and try again. A
  recording plays whatever voice the board uses.

List steps, fluent sentences and phrases don't use these choices. They have
their own audio window (see [The editor in other places](#the-editor-in-other-places)).

## Edge cases

- **Plans.** Editing needs Pro. Image Search, AI Generate, **Upload Picture**
  and **My Images** are all Max: on Free or Pro, each of those four tabs shows
  a "Max feature" panel in place of its normal content, explaining what it
  unlocks. See [FEAT-108](FEAT-108-pricing-and-tiers.md).
- **Re-editing an uploaded symbol.** Opening the editor on a symbol whose
  picture was uploaded opens straight on the Upload tab. On a plan below Max
  the tab itself shows the "Max feature" panel, but the editor's own live
  preview still shows the uploaded picture, and saving without changing it
  keeps it.
- **Daily and monthly limits.** Image Search allows 30 searches a day. AI
  Generate allows 20 a day and 100 a month. When a limit is reached, the tab
  says when it resets. The monthly limit resets on the 1st.
- **Changing the picture changes the credit.** Swapping an Image Search photo
  for a SymbolStix symbol removes the old credit. Saving without changing the
  picture keeps it.
- **Missing translations stay visible.** A label field for a language the
  symbol hasn't been given yet stays empty rather than being filled with
  English, so the gap can be seen.
- **Deleting a picture in use.** Blocked, with a note saying how many other
  items use it.

## Where it lives

- The editor and its tabs: `app/components/app/shared/modals/symbol-editor/`
- Image Search and AI Generate on the server: `app/api/image-search/` and
  `app/api/ai-generate/`
- Picture credits: `convex/imageCredits.ts`. The picture library:
  `convex/accountImages.ts`

## Links

- **Up from:** [FEAT-101 Home](FEAT-101-home.md) · [FEAT-102 Search](FEAT-102-search.md)
  · [FEAT-103 Categories](FEAT-103-categories.md) · [FEAT-104 Lists](FEAT-104-lists.md)
  · [FEAT-105 Sentences](FEAT-105-sentences.md) ·
  [FEAT-202 Talker dropdown](FEAT-202-talker-dropdown.md)
- **Related:** [FEAT-106 Settings](FEAT-106-settings.md) (Credits) ·
  [FEAT-108 Pricing & tiers](FEAT-108-pricing-and-tiers.md) ·
  [FEAT-302 Edit mode](FEAT-302-edit-mode.md) ·
  [FEAT-305 Languages & voices](FEAT-305-languages-and-voices.md)
