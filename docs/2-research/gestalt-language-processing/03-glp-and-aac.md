# 3 · GLP and AAC — how the tools are actually built

*The bridge from theory to product. What a robust AAC system needs to support a gestalt processor, why most existing tools fall short, and the principles Mo Speech should adopt.*

---

## The core tension

> Most current AAC systems are built with **analytic** language processors in mind. That leaves families and clinicians wondering how to support **gestalt** processors with tools designed for the opposite learner.
> — paraphrasing the consensus across SLP Now and Meaningful Speech

This single sentence explains the "cluttered Avaz" complaint. Avaz (and Proloquo2Go, TD Snap, LAMP, PODD) are *robust* — they contain everything. But "robust" was achieved by **piling features onto a word-based core**, then expecting a trained SLP to configure it per child. The result is powerful and overwhelming. Families bounce off it. Your SLP's clients refuse to use it.

Mo Speech's opportunity is not "more features than Avaz." It is **the same depth, revealed gradually** — which is exactly what your gating model already does.

## What a robust AAC system needs for a GLP

Synthesised from current SLP practice (sources in [doc 5](05-evidence-and-references.md)):

### 1. Both phrases *and* words, at the same time
A GLP-ready system cannot be only a phrase board or only a word grid. It must hold **whole stored gestalts** (for Stages 1–2) **and** individual words (for Stages 3+) simultaneously, because a real child is often straddling stages. The system grows *with* the child rather than being swapped out.

> **Don't** model isolated words ("go", "outside", "fun") to an early GLP.
> **Do** model meaningful whole phrases — "Let's go!", "This is fun!" — with expressive intonation, while keeping the words available underneath for when the child starts breaking phrases apart.

### 2. Deep, personal customisation
The defining feature of a GLP's early language is that their gestalts are **personal and experiential** — a line from *their* favourite show, *their* sibling's catchphrase, the exact words said during a meaningful moment.

> "Individualisation is not going to be found in any AAC system that comes standard out of the box." — Laura Hayes

This is the part no pre-built vocabulary can supply. A GLP-ready tool **must** let an instructor quickly add a custom phrase, with custom audio, that carries a specific emotional meaning for *that one child*. Generic vocabulary alone fails them.

### 3. Prosody — natural intonation, not flat TTS
Because meaning lives in the melody at Stage 1, **the voice matters as much as the words.** Current AAC voices are widely acknowledged to lack the prosodic nuance early GLPs need. A robust tool needs natural-sounding output and, ideally, a way to capture the *right* intonation for a given gestalt.

This is the clinical justification for your SLP's "convey tone / multiple audio" point. It is not a nice-to-have; for a Stage 1 child it is the difference between language that means something and language that doesn't.

### 4. Motor-planning consistency
GLPs (and AAC users generally) build speed and automaticity by learning *where things live* through repetition. **A word or phrase should stay in the same place over time.** If the layout reshuffles, the motor memory resets. This has a direct design consequence: dynamic, predictive, "smart" rearranging must never move the *anchor* vocabulary — predictions appear in a dedicated zone, they don't reshuffle the board.

### 5. Navigation that supports breaking gestalts down
Stage 2 (mitigation) is the pivot of the whole journey, and it is fundamentally a **navigation** problem: the child fires a stored phrase, then needs the *fragments and next-words* to recombine it. This is precisely your SLP's "jump to a page where suggestive/predictive words pop up." It is the single most GLP-specific piece of UI, and almost no consumer AAC does it well.

### 6. Measurement by engagement, not button-presses
A subtle but important practice note: progress for a GLP is **not** measured by activation counts. SLPs are told to watch what happens *around* a tap — eye contact with the device, returning to it after a gesture, facial expression, pausing before vocalising. "Document what happens before or after someone activates something, rather than focusing on activation counts."

For Mo Speech this is a caution about analytics: **don't build a dashboard that reduces a child to taps-per-day.** If you surface progress data to instructors (relevant to your Phase 11 home-school thinking), frame it around engagement and modelling, not hit counts — or you'll quietly push instructors toward exactly the compliance-drilling GLP warns against.

## Existing systems, briefly

| System | Shape | GLP fit |
|---|---|---|
| **PODD** | Pragmatic, phrase-rich paper/app system | Often recommended for GLPs — phrase-led |
| **TD Snap** (incl. "Gestalts" page sets) | Robust grid, configurable | Workable with heavy SLP setup |
| **Proloquo2Go / LAMP** | Core-word, motor-planning focused | Analytic-leaning; needs adaptation |
| **Avaz** | Robust, feature-complete | Has the features; UX overwhelms families (your SLP's complaint) |

The takeaway is *not* to copy any of them. It's that the field already knows phrase-based, prosody-rich, consistently-placed, personally-customised systems are what GLPs need — and that the open problem everyone agrees on is **making that usable for non-specialist families.** That problem is Mo Speech's entire reason to exist.

## The do's and don'ts, distilled

**Do**
- Offer whole, meaningful phrases with rich intonation from the start.
- Make custom-phrase + custom-audio creation fast and central, not buried.
- Keep anchor vocabulary in stable locations (motor planning).
- Put predictions/next-words in a dedicated zone that supports mixing.
- Let words and phrases coexist; let the child use either.
- Frame progress around engagement and modelling.

**Don't**
- Force single words on a child who is still in chunks.
- Treat the flat default TTS voice as "good enough."
- Reshuffle the board dynamically.
- Reduce success to activation counts.
- Assume one configuration fits the whole journey — it must *grow*.

---

**Next:** [`04-glp-in-mo-speech.md`](04-glp-in-mo-speech.md) — turning all of this into concrete Mo Speech features, and mapping every one of your SLP's seven non-negotiables.
