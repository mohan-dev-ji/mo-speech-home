# User stories · Layer 2: components

The building blocks shared across pages. See [`01-users.md`](01-users.md) for
the users.

---

## FEAT-201 · The talker · [spec](../4-builds/features/FEAT-201-talker.md)

- As a **student**, I want to build a sentence by tapping symbols, so that I can
  say more than one word.
- As a **gestalt learner**, I want whole phrases as blocks in my sentence, so
  that I can use the chunks I think in.
- As a **student**, I want to reorder or remove blocks without disturbing my
  board, so that I can fix a sentence safely.
- As an **instructor**, I want to save a sentence my child built, so that it
  becomes a one-tap sentence.

**Acceptance**

- With the talker on (Search and Categories), every tap speaks and adds a
  block. With it off, a tap only speaks.
- Blocks are words or phrases. Each plays on tap, drags to reorder, and has ✕
  to remove.
- Play speaks the sentence block by block.
- Save files it into Sentences, suggesting the group matching the current
  category. The sentence stays in the strip afterwards. On Free, Save shows the
  upgrade prompt.

## FEAT-202 · Talker dropdown · [spec](../4-builds/features/FEAT-202-talker-dropdown.md)

- As a **student**, I want the little words and my phrases always one tap away,
  so that I don't search mid-conversation.
- As an **instructor**, I want to add phrases that match my child's level, so
  that their phrases grow with them.

**Acceptance**

- Two tabs: Core words and Phrases. One tap adds to the talker.
- It's available wherever the talker is, and closes on navigation.
- In edit mode: create, arrange and delete words, and build and edit phrases.
- Phrases have their own audio, and a version per language.

## FEAT-203 · Symbol editor · [spec](../4-builds/features/FEAT-203-symbol-editor.md)

- As an **instructor**, I want to use a photo of my child's own things, so that
  the symbols mean something to them.
- As an **instructor**, I want to find or draw a picture when there's no symbol,
  so that no word is missing.
- As an **instructor**, I want to record my own voice for a symbol, so that my
  child hears a familiar voice.

**Acceptance**

- Five picture sources: SymbolStix, Upload, Image Search, AI Generate and My
  Images.
- Image Search runs only when asked, and keeps every photo's credit.
- AI Generate draws a new picture each time, in four styles, within daily and
  monthly limits.
- Every uploaded or generated picture is kept in My Images, to reuse or delete.
- Audio: default, generated, or recorded. List steps, fluent sentences and
  phrases have their own audio window instead.
- Plans: editing is Pro. Pictures from outside SymbolStix are Max.

## FEAT-204 · Play modal · [spec](../4-builds/features/FEAT-204-play-modal.md)

- As a **student**, I want to see my sentence big and hear it, so that nothing
  else distracts me.
- As a **student**, I want to see each part light up as it's spoken, so that I
  link sounds to pictures.
- As a **student**, I want to hear it again easily, so that I can repeat it as
  often as I need.

**Acceptance**

- Playing opens full screen, over a dimmed page, and speaks straight away.
- Fluent sentences glow as one. Blocks glow one at a time, for exactly as long
  as each speaks.
- Tapping the picture replays it. Tapping outside closes it.
- Tones play the whole sentence fluently with feeling (Max).

## FEAT-205 · Groups & folders · [spec](../4-builds/features/FEAT-205-groups-and-folders.md)

- As an **instructor**, I want to organise lists and sentences into coloured
  groups, so that I can find things as my collection grows.

**Acceptance**

- Lists and Sentences open on their groups. Drafts holds unfiled items.
- Every create and save asks which group to use (or a new one, or Drafts).
- Groups can be renamed, recoloured, given a cover picture, reordered and
  deleted. Items can be moved between groups.

## FEAT-206 · App shell · [spec](../4-builds/features/FEAT-206-app-shell.md)

- As a **student**, I want the way around to always be in the same place, so
  that I never get lost.
- As an **instructor**, I want to put the sidebar on my good-hand side, so that
  I can use the tablet one-handed.
- As an **instructor**, I want to hide the header for a student who doesn't need
  it, so that their screen is calm.

**Acceptance**

- The sidebar shows only pages allowed in the current view.
- The sidebar can be full or icon-only, left or right, per profile.
- Header off removes the talker and the page banner, leaving just the board.
- On a phone, the sidebar folds into a menu.
