# The Mo Speech theme system — in plain English

> **What this is.** A jargon-free overview of how *themes* (the colours, textures and
> surfaces a student sees) work in Mo Speech: where a theme lives, how a student picks
> one, and — the important bit — how an admin's change to a theme reaches families who
> already chose it. No code, no token names — just the ideas, with pictures.
>
> It's the sister doc to [`language-system-explained.md`](./language-system-explained.md),
> and it deliberately reuses the same mental model: **don't photocopy — resolve live.**
> The detailed technical version lives in [ADR-011 §2](../decisions/ADR-011-plugin-architecture-for-content-modules.md).

---

## 1. The good news first: themes already do the right thing

There's a trap we fell into with *content* (the words on a child's board). When a family
signed up, we handed them a **photocopy** of the starter content, frozen in whatever
languages existed that day — so a language added later never reached them. (That whole
story is in [the language explainer](./language-system-explained.md); the fix was to stop
photocopying and **look words up live** from a central dictionary.)

**Themes never had that bug.** Here's why, in one picture:

```
   What a profile actually stores for its theme:

        ┌─────────────────────────────┐
        │  themeSlug:  "sky"          │   ← just the NAME of a theme.
        └─────────────────────────────┘     Not the colours. Just "sky".

   Every time the screen is drawn:

        "sky"  ──looks up──►  central theme list  ──►  the current "sky" colours
                                  (always live)
```

A profile saves only the **name** of its theme — `"sky"`, `"rose"`, and so on — never a
copy of the actual colours. The colours are **looked up live** from a central list every
time the app paints the screen. This is *exactly* the "resolve live" model we had to
retrofit onto content — themes had it from day one.

**What that buys us straight away:** if an admin improves the "sky" theme — nudges a
colour, softens a shade — **every family who picked "sky" sees the new version
automatically.** Nobody's theme is a frozen snapshot. There is never an "update all the
old accounts" job for themes. (Goal (a) in the Phase 9 brief is, structurally, already
done.)

```
   THE CONTENT TRAP (now fixed)          THEMES (always fine)

   Family gets a PHOTOCOPY of words      Family stores only the NAME "sky"
        ✗ frozen — misses new langs           │ looks up live every render
                                               ▼
                                        Central theme list → current "sky"
                                               ✓ admin's tweak reaches everyone
```

---

## 2. So what's left to build?

If themes already resolve live, why is there a Phase 9 at all? Because "the central list"
today is **hard-coded inside the app's code**, and that creates three gaps.

Think of it like a **recipe book bolted to the kitchen wall**. The chefs (families) all
cook from the same live book — good — but:

| The gap | Plain English | The fix |
|---|---|---|
| **You can't add a page without rebuilding the kitchen** | A new theme, or an edit to an existing one's colours, needs a full code release (a "deploy"). | Move themes into **swappable recipe cards** (JSON files) — the same filing system packs and languages already use. |
| **There's no "menu board" deciding what's on offer today** | Nothing controls which themes are *published*, which are free vs paid, which are seasonal. | A thin **"now showing" list** (the *lifecycle overlay*) an admin edits without a code release. |
| **There's no theme picker for families yet** | Students can't actually browse and choose themes in Settings. | A picker screen, with locks on the paid ones. |

The key distinction — and it's the same one we drew for content and languages:

```
   The COLOURS of a theme       =  "content"   →  changing them is a code release
                                                   (but still reaches everyone live)

   Whether a theme is PUBLISHED,  =  "lifecycle" →  an admin toggle, no release needed
   free-or-paid, seasonal
```

So an admin re-colouring a theme is a (small) code release — but a brand-new colour, once
released, flows to every existing family with no migration. And turning a theme **on/off**,
making it **free or premium**, or scheduling a **seasonal** theme needs no release at all.
This is the same split packs and languages use, written down in
[ADR-010](../decisions/ADR-010-pack-storage-shift.md) and [ADR-012 §2](../decisions/ADR-012-language-operations-console.md).

---

## 3. Newly published themes, gated by plan

Once themes live as swappable cards with a "now showing" list, the second goal falls out
for free:

```
   Admin publishes "Midnight Glass" (premium)
            │  adds a "now showing" entry: published ✓, tier = premium
            ▼
   It appears in EVERY family's theme picker automatically
            │
            ├─ Free family   →  sees it, with a 🔒 lock + upgrade nudge
            └─ Pro/Max family →  can pick it
```

No chasing existing accounts; no release for the publish itself. A theme shows up in a
picker when **(1)** its recipe card exists in the app *and* **(2)** an admin has switched
its "now showing" entry on (within its publish dates). Paid themes carry a lock for
families whose plan doesn't include them — the same lock mechanic used for premium packs.

---

## 4. When a family makes a theme *their own* (the borrowed-vs-yours bit)

Down the line (Phase 9.3) families may **customise** a theme — "I love Sky but I want a
warmer accent." The tempting-but-wrong way to store that is to **photocopy all of Sky's
colours** and change the one. That would walk us straight back into the content trap: their
copy would freeze, and a later improvement to Sky — or a brand-new ingredient like a
*texture layer* — would never reach them.

So we use the **exact same trick as the words on a board**: a custom theme is the base
theme's name **plus a short list of just the bits they changed.** Every colour is
independently either **borrowed** (still looked up live from the base theme) or **yours**
(you changed it, so we leave it alone).

```
   "My Sky" =  based on:  "sky"
               my changes: { accent: warm-orange }   ← the ONLY thing frozen

   Every colour, borrowed-or-yours:

      🎨 Background     [ borrowed ]  ← still live from Sky
      🎨 Surfaces       [ borrowed ]  ← still live from Sky
      🎨 Accent         [ yours ]     ← warm-orange, frozen
      🎨 (future) Texture[ borrowed ] ← a layer added LATER still flows in
```

Two things fall out, and they're the same two as for content:

- **Changing one colour never silently freezes the rest.** Warm up the accent and only the
  accent becomes "yours"; if the admin later refines Sky's background, your background
  still updates.
- **New ingredients still flow into the slots you didn't touch.** When the texture layer
  ships (see below), every custom theme that didn't override texture picks it up
  automatically. Their edit is a tiny island; everything around it keeps flowing.

This mirrors, field-for-field, how an edited symbol works in
[the language explainer §3](./language-system-explained.md) — "the other slots keep flowing
from the source unless the family specifically changed *that* one."

---

## 5. A note on what a theme *is* (the new shape)

Today's six themes (Sky, Rose, Amber…) get their personality from one **dominant accent
colour**. The Phase 9 redesign ([ADR-011 §2](../decisions/ADR-011-plugin-architecture-for-content-modules.md))
flips that: personality comes from the **background**, with the accent stepped back to a
highlight. A theme becomes four stackable layers:

```
   ┌─────────────────────────────────────────┐
   │  Accent     · one highlight colour        │  ← CTAs, focus rings, selection
   │  Surface    · cards / bars / modals       │  ← white/black/grey + glass blur
   │  Texture    · optional grain/paper/weave  │  ← what stops glass looking sterile
   │  Background · the dominant identity        │  ← flat, gradient, image or animation
   └─────────────────────────────────────────┘
```

This is *why* the borrowed-vs-yours model matters: the texture layer doesn't exist on the
six current themes. When it arrives, every theme (and every family's custom theme) that
hasn't overridden it should gain it for free — only possible because each layer is its own
borrowed-or-yours slot.

---

## 6. The whole thing on one page

```
        YOU (admin)
            │  edit a theme's colours → small code release (reaches everyone live)
            │  publish / unpublish / free-or-paid / seasonal → instant toggle, no release
            ▼
   ┌──────────────────────────┐        ┌───────────────────────────┐
   │  THEME RECIPE CARDS       │        │  "NOW SHOWING" LIST        │
   │  (JSON files — the        │        │  (lifecycle overlay —      │
   │  colours, every theme)    │        │  published? tier? season?) │
   └──────────────────────────┘        └───────────────────────────┘
                    ▲                              │ decides what's in the picker
                    │ looked up live, every         │ and which carry a 🔒
                    │ time a screen is drawn         ▼
                    └────────────────────  A STUDENT'S PROFILE  ──────►  painted on screen
                                           (stores only the theme NAME
                                            + any colours they made "yours")
```

**The big idea in one sentence:** a profile stores only the *name* of its theme (plus any
colours the family personally changed), and the actual colours are always looked up live
from a central list — so an admin's improvement and any newly published theme reach every
family automatically, while a family's personal tweaks stay theirs.

---

## 7. A tiny glossary (plain word → the "official" term)

| In this doc | The official name | Where it's detailed |
|---|---|---|
| The name a profile stores | `themeSlug` | [ADR-011 §2](../decisions/ADR-011-plugin-architecture-for-content-modules.md) |
| The central list of theme colours | the theme catalogue / `convex/data/themes/*.json` | ADR-011 §2 |
| Looking colours up live instead of photocopying | dynamic resolution | [ADR-012 §7](../decisions/ADR-012-language-operations-console.md) |
| The "now showing" list | the `themeLifecycle` overlay | ADR-011 §1, §2 |
| Free / premium gating | tier gating | ADR-011 §2 |
| A custom theme = base name + just-your-changes | per-field / per-token overrides (borrowed-or-yours) | ADR-012 §7 |
| The four-layer theme shape | background · texture · surface · accent | ADR-011 §2 |
| Colours-are-content, on/off-is-lifecycle | the repo-writer constraint | [ADR-010](../decisions/ADR-010-pack-storage-shift.md), ADR-012 §2 |

---

### The one-paragraph version (if you only remember one thing)

Themes already work the way we *wish* content had: a profile stores only the theme's
**name**, and the colours are looked up **live** from a central list — so an admin's tweak
and any newly published theme reach every existing family automatically, with no migration.
The Phase 9 work isn't fixing a photocopy bug (there isn't one); it's moving that central
list out of hard-coded app code into swappable JSON cards with a deploy-free "now showing"
overlay, adding a picker with plan-based locks, and — when families customise a theme —
storing only the colours they changed so everything they *didn't* touch keeps flowing.
