# The Mo Speech language system — in plain English

> **What this is.** A jargon-free overview of how languages work in Mo Speech: what
> it takes to add one, how the "language operations" dashboard fits in, and how
> content (the words a child sees and hears) flows around the system. No code, no
> function names — just the ideas, with pictures.
>
> The detailed technical versions live in the ADRs (ADR-009 to ADR-013). This doc is
> the map; those are the street-level directions.

---

## 1. What "adding a language" actually means

Think of Mo Speech like a **picture dictionary that talks**. A child taps a picture; the
app shows a word under it and speaks it aloud. "Adding a language" (say, Hindi) means
making *every part* of that experience work in Hindi.

It helps to think of it like **dubbing a film into a new language** — there isn't one
job, there are several:

| The part | Film analogy | What it means here |
|---|---|---|
| **Menus & buttons** | The on-screen text / subtitles | Every label in the app ("Home", "Search", "Settings") translated |
| **The picture-words** | The script for every scene | All ~58,000 symbols get a Hindi word |
| **Search** | The subtitle index | Typing in Hindi (or even typed-out-in-English "kutta") finds the right picture |
| **Starter content** | The opening scenes everyone sees | The ready-made categories, lists and sentences a new family gets, translated |
| **Voices** | The voice actors | At least one male + one female Hindi voice |
| **The spoken audio** | The recorded dialogue | Each picture-word actually *speaks* Hindi |

A language is "fully made" when all of those are done. Some can happen at the same time
(translating menus and translating picture-words don't depend on each other), but some
**must** wait their turn — you can't record the Hindi audio until the Hindi words exist,
just as you can't dub a scene before the script is translated.

```
Translate menus  ─┐
Translate words  ─┼──►  Add voices  ──►  Record audio  ──►  Publish to families
Translate packs  ─┘        (the audio step has to wait for the words)
```

---

## 2. The "Language Workshop" (the operations dashboard)

Today, building a language happens through developer tools and command-line scripts —
fine for a developer, but it's all behind the curtain. The plan (ADR-012) is a single
**control-room page per language**, like the **dashboard of a coffee machine that shows
each stage brewing**.

Picture a **vertical checklist that fills in as you go**:

```
  Hindi  ────────────────────────────────────────────
  ✅ Menus & buttons        100%   [details ▸]
  ✅ Picture-words          99.8%  [details ▸]
  ✅ Search                 on
  ✅ Starter packs          done   [details ▸]
  ✅ Voices                 2 added
  🔒 Record audio           locked — waiting for picture-words   ← greyed out
  …  Spoken sentences       automatic once the above are done
  👤 Promote to families    needs a human to approve quality
```

Three simple ideas make it work:

- **Steps unlock in order.** A step you can't do yet is greyed out, and it *tells you
  why* ("waiting for picture-words"). You can't skip ahead and make a mess.
- **Every step keeps a receipt.** Each one records what ran, when, who pressed it, and
  what it cost — like an itemised bill. No more "did that translation actually run?"
- **One "Build language" button** can press the steps for you, *in the right order*. It's
  a smart shortcut, not a dumb "do everything at once" — it still respects the locks.

There's also a **"translator's desk"** (ADR-013): real human translators (freelancers,
not developers) get a simple, password-protected page to *suggest* and *correct*
translations. Their suggestions land in a **review queue** on this dashboard, where you
approve them before they go live. Think **"track changes" in a Word doc** — suggestions
come in, you accept or reject, nothing changes for families until you say so.

---

## 3. The tricky bit: how words reach a child's screen

This is the part that felt technical. Here's the whole thing as one idea.

### The problem we hit: the "photocopy" trap

When a family signs up, Mo Speech gives them a **starter set of boards** (categories,
lists, sentences). The way it works *today* is like handing them a **photocopy** of the
starter content — frozen in whatever languages existed *the day they signed up*.

So imagine:

```
Day 1 — a family signs up.
   Master starter content has:  English, Spanish
   The family gets a PHOTOCOPY:  English, Spanish   📄 (frozen)

Later — we add Hindi to the master content.
   Master starter content now:  English, Spanish, Hindi
   The family's photocopy:       English, Spanish   ❌ still frozen — no Hindi!
```

That's exactly the bug you found: an older account's Hindi student saw **English words**
(the photocopy never got Hindi) but heard a **Hindi voice** (the voice is chosen
separately). English words read by a Hindi voice = "English in a Hindi accent." Brand-new
accounts were fine, because their photocopy was made *after* Hindi existed.

### The fix: don't photocopy the words — look them up live

Here's the key switch. Instead of photocopying the *words*, we keep a **central
dictionary** that always has every language, and the child's board just **looks each word
up, fresh, every time it's shown** — in whatever language that child is set to.

Two halves, and the split is the whole trick:

- **The board's *layout* stays personal and frozen** — which pictures are on it, their
  order, anything the family rearranged or added. This is *theirs*; it should never change
  underneath them. (For a non-verbal child, a board that rearranges itself overnight would
  be genuinely upsetting.)
- **The *words* on it are looked up live** from the central dictionary at the moment the
  screen is drawn.

```
   THE OLD WAY (photocopy)              THE NEW WAY (live lookup)

   Master words: en, es, hi            Child's board:  ⬜⬜⬜  (just the layout
        │  copy once                                    + a little "look me up" tag
        ▼                                                on each picture)
   Board: en, es  (frozen)                    │  every time the screen draws…
        ✗ never sees hi                        ▼
                                       Central dictionary: en · es · hi · …
                                              ✓ always current
                                       Add a new language → it shows up on every
                                       board instantly, no chasing old accounts
```

Because the dictionary already knows every language, **the moment you finish a new
language, every existing family sees it automatically** — and if a translator later
*fixes* a clumsy word, that fix reaches everyone too. No giant "update all the old
accounts" operation.

### What about content a family made themselves?

Not everything can be looked up — because not everything came from Mo Speech. So there are
really **three kinds of content**, and each has a simple rule:

```
A word/board a child sees…

 ├─ came from Mo Speech's starter packs, untouched
 │     → look it up live in the dictionary        ✅ free, instant, every language
 │
 ├─ the family edited it (renamed, tweaked)
 │     → their version always wins                ✋ we never overwrite a family's words
 │
 └─ the family created it from scratch
       → Mo Speech has no translation for it       🤖 the AI translator offers to
         (e.g. their child's own phrase)              translate it on request; until then
                                                       it shows with a small "not
                                                       translated yet" note
```

The word **"untouched"** (the techies call it *pristine*) is the whole decision-maker:
if a family hasn't touched a starter item, trust the dictionary and look it up live; the
moment they edit it, it's theirs and we leave it alone.

### One more small fix: keep the voice and the words matched

If we ever *can't* find a word in the child's language and have to fall back to English,
we should **also fall back to the English voice** — so it reads as plain English, not
"English in a Hindi accent." Voice and words always travel together. Small change, removes
the weirdest-feeling glitch.

### What happens when a family edits a starter symbol

A symbol on a board isn't one single thing — it's a **little bundle of slots**, and each
slot is independently either **borrowed** (looked up live from the dictionary) or
**yours** (you changed it, so we leave it alone):

```
One symbol = these slots, each borrowed-or-yours:

   🖼  Picture           [ borrowed ]   ← the dictionary's picture
   🔤 Word · English     [ borrowed ]   ← looked up live
   🔤 Word · Hindi       [ borrowed ]   ← looked up live
   🔤 Word · Spanish     [ borrowed ]   ← looked up live
```

The important part: **the word is a separate slot *per language*, and the picture is its
own slot.** Editing one slot flips only *that* slot to "yours" — everything else keeps
borrowing. That makes every kind of edit behave gracefully:

| What the family does | Picture | The word they typed | The **other** languages' words |
|---|---|---|---|
| Pick a different ready-made symbol (dog → cat) | follows the new symbol | new symbol's word | **all live** — cat / बिल्ली / gato |
| Upload their own picture, keep the word | **yours** (their photo) | still borrowed | **still live** — their photo + कुत्ता / perro |
| Rename the word, keep the picture | still borrowed | **yours** ("doggy") | **still live** — Hindi still कुत्ता |
| Change both | **yours** | **yours** | **still live** |

The line that repeats down every row is the whole answer: **the other languages keep
flowing from the dictionary unless the family specifically changed *that* language.**

Two things fall out of this:

- **Renaming in one language never silently touches the others.** Rename "dog" → "doggy"
  in English and only the English slot becomes yours; Hindi still shows कुत्ता. It may be
  slightly inconsistent, but it's predictable and safe. If the family *wants* the rename
  to carry across, the app can gently offer **"Also update Hindi & Spanish? → Translate"**
  — opt-in, never automatic.
- **New languages still flow into the slots they didn't touch.** If a family renamed only
  the English word and you add Hindi a year later, that symbol's Hindi slot is still
  borrowed — so it picks up Hindi automatically. Their edit is a tiny island; everything
  around it keeps flowing.

So the only content that ever needs the AI translator is a slot the family **made or
changed themselves** — the only kind with no dictionary entry to borrow from.

---

## 4. Putting it together — the flow of data

Here's the whole system on one page. Boxes are *where things live*; arrows are *what flows
where*.

```
        YOU (admin)                         TRANSLATORS (freelancers)
            │                                        │
            │ build & publish languages              │ suggest / correct words
            ▼                                        ▼
   ┌─────────────────────────────────────────────────────────────┐
   │            THE LANGUAGE WORKSHOP (dashboard)                 │
   │   timeline · progress · history · review-and-approve queue   │
   └─────────────────────────────────────────────────────────────┘
            │ approved words feed…
            ▼
   ┌──────────────────────────┐        ┌───────────────────────────┐
   │  CENTRAL DICTIONARY       │        │  STARTER PACKS (the        │
   │  (all the picture-words,  │        │  ready-made boards Mo       │
   │  every language)          │        │  Speech ships)             │
   └──────────────────────────┘        └───────────────────────────┘
                    ▲                              │ a family's layout is copied once
                    │ looked up live, every        │ (their personal, frozen board)
                    │ time a screen is drawn        ▼
                    └──────────────────────  A CHILD'S BOARD  ───────►  shown & spoken
                                             (layout = frozen,           in the child's
                                              words  = looked up live)    language
```

The big idea in one sentence: **a child's board is their own frozen *layout*, but the
*words* are always looked up fresh from a central dictionary that knows every language —
so new languages and fixes reach everyone automatically, while their personal board never
shifts under them.**

---

## 5. A tiny glossary (plain word → the "official" term)

So you can connect this to the technical docs without drowning:

| In this doc | The official name | Where it's detailed |
|---|---|---|
| The central dictionary of picture-words | the global symbols table / `words` | ADR-009 |
| Starter packs / ready-made boards | library packs | ADR-010 |
| A child's board / their copy | profile content | ADR-009 |
| Menus & buttons text | UI strings | ADR-012 |
| The translation robot | the AI translation pipeline | ADR-012 |
| The translator's desk | the translator editing & staging area | ADR-013 |
| The Language Workshop / control room | the language operations console | ADR-012 |
| "Untouched" | *pristine* | ADR-012 §7 |
| Looking words up live instead of photocopying | dynamic resolution | ADR-012 §7 |
| Each piece (picture, each language's word) is borrowed-or-yours | per-field / per-language overrides | ADR-012 §7 |

---

### The one-paragraph version (if you only remember one thing)

Adding a language is like dubbing a film — several jobs, some in order, run from one
control-room dashboard with progress, history, and a human-approval queue. The thing that
*used* to go wrong was that we handed each family a frozen **photocopy** of their starter
content, so new languages never reached older accounts. The fix is to stop photocopying
the *words*: keep each family's board *layout* personal and frozen, but **look the words up
live** from a central dictionary that always has every language. New languages then appear
for everyone automatically; only content a family made themselves needs the AI translator's
help.
