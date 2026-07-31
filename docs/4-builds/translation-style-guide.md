# Translation Style Guide

**Status:** Living document. **Owner:** Mo. **Started:** 2026-07-18.
**Two readers, one source of truth:** the MT pipeline (prompt blocks + glossary come from here) and the human reviewer (this is the QC checklist).

This guide governs how English **content** (categories, lists, sentences, phrases, titles) is rendered in other languages. It does **not** cover UI strings — those are handled separately (`translate-ui-strings`, keyed off `en.json`; see CLAUDE.md rule 1).

---

## Why this exists

Content is machine-translated by **Gemini 2.5 Flash** (Vertex, `temperature: 0.2`, structured JSON) and then reviewed by a human. The MT is an *assist*, per ADR-016 Addendum A — the human owns final structure. This guide's job is to make the machine's output correct-by-default so the review pass shrinks from "fix many things" to "spot-check a few."

Everything here was derived from a manual QC pass over the ES/HI defaults (2026-07-18). Each rule fixed a real error found in that pass.

---

## 1. The core: capitalization by content type

Two buckets, decided by **what kind of content it is** (which tree/slot), not by eyeballing grammar:

| Bucket | Content | Case |
|---|---|---|
| **Tappable vocabulary** | words, phrases, list items | **lowercase** |
| **Read-as-language** | titles (module/group/list/sentence names), sentences, descriptions | **Sentence case** (first word only) |

**Always capital, everywhere, both buckets:**
- **Proper nouns** — Diwali, Christmas, London / Navidad, personal names.
- **English pronoun "I"** — "I want to go", never "i want to go". *(English only — Spanish `yo` is not capitalized; Hindi is caseless.)*

**Rationale.** Lowercase suits tappable vocabulary — early readers recognise lowercase word-shapes, and it signals "building block." Titles are **organizational chrome read by the adult to navigate**, never spoken by the child; capitalizing them gives visual hierarchy over the lowercase tiles and matches how headings read as language. So titles sit with sentences, not with the vocabulary.

**Sentence case, NOT Title Case, for titles.** Title Case ("Life Skills", "Going Places") is an **English-only** convention. Spanish capitalizes only the first word of a heading + proper nouns (*"Habilidades para la vida"*, never *"Habilidades Para La Vida"*). Sentence case is the one heading rule identical across English and Spanish; Hindi is caseless (N/A). Never emit Title Case.

**Composed-utterance nicety (future, optional):** when lowercase phrase tiles chain into the sentence bar, the *composed* output may capitalize its first word + add end punctuation — so tiles stay lowercase fragments while the finished utterance reads as a sentence. Not required; noted for the renderer.

### This guide is advisory — the app does not enforce casing

**Considered and rejected (2026-07-18): automatic casing normalization on save.** Mo Speech's core value is that the user personalizes *every* aspect of their content. Silently overriding a user's capitalization would (a) feel broken — "why won't my capitals stick?"; (b) override *legitimate* choices (a teacher emphasizing a word, a child practising capitals, ALL-CAPS for loudness); and (c) contradict the autonomy the whole app exists to give families. The ROI was also small and practically unnoticeable.

So **the casing rules above are guidance, not enforcement.** They exist for:

- the **platform default content** — authored to a consistent house style; the maintainer follows this guide by choice, and
- **users who want a recommendation** — this becomes a section of the user content-guide ("here's what tends to read best"), take-it-or-leave-it.

Anyone who wants different casing just types it their way and it sticks. Fixing casing by hand across a full default set takes ~5 minutes. MT output *may* follow these rules as a **starting suggestion** so default content lands close to house style — but nothing is normalized or overridden after the fact. The user always owns the final text.

---

## 2. Register + case by content type

The single most important pipeline change: tell the model each value's **role**. The type is already known structurally (slot keys in the content route; caller context in the variant route) — it just needs to reach the prompt.

| Content type | Slot key(s) | Case | Register instruction |
|---|---|---|---|
| **Sentence** (the utterance) | `sent.text` | Sentence case | Complete first-person utterance the child says. Natural target-language word order. A finished sentence. |
| **Title / name** (module, category, list, sentence, group/folder) | `*.name` | Sentence case | A heading label. Concise noun-phrase or infinitive. **NOT a sentence** — never start with "Let's…" / "Vamos…" / a conjugated verb. |
| **Description** | `description` | Sentence case | Short natural sentence/phrase describing the module. |
| **List item** | `list.*.item.*.desc` | lowercase | A tappable label. **If it's a routine/instruction step, use the informal imperative** (Spanish *tú*: *ponte los zapatos*; Hindi तुम: हाथ धो लो). Otherwise a plain lowercase label. |
| **Phrase** (variant route only) | — (caller `kind`) | lowercase | A sentence **fragment / building block**. May be grammatically incomplete; **will be chained with other tiles — do NOT complete it into a full sentence.** |

**Note on phrases:** the library content route (`translate-modules`) does **not** handle phrases — phrases are per-account and translated on demand when a user authors a variant via the "Made in…" badge (`translate-text`). So the *phrase-fragment* rule belongs in the variant route's prompt, not the content route's.

---

## 3. Spanish (es)

**Dialect lock: neutral Latin American Spanish.** The configured voices are Latin American (`convex/data/languages/es.json` → `"region": "Latin America"`), but no prompt says so today — add it. There is currently **no locale-variety field** in the language module (no `es-419` vs `es-ES`); the dialect lives in this guide + the prompt until/unless one is added.

Consequences of the lock:
- **suéter**, not *jersey* (jersey = sports shirt in much of LatAm).
- **escuela**, not *colegio* (neutral; colegio is Spain-primary / connotes private).
- Preterite for recent past: **ya comí**, not *ya he comido* (Spain).

Other Spanish rules:
- **Titles = Sentence case, never Title Case** (§1).
- **Routine steps = *tú* imperative**: *ponte los zapatos*, *lávate las manos*, *sécate las manos*. Plural where natural (*los zapatos*, the pair).
- **Spanish already lowercases** days (*lunes*), months (*enero*), nationalities (*español*) — leave them lowercase; that suits our policy.
- **Proper-noun / festival capitals stay**: *Navidad*, *Diwali*.
- **Frames that take a following noun** must use the chainable form: *¿A qué hora es…?* (takes a noun), never *¿Qué hora es?* (standalone "what time is it").

## 4. Hindi (hi)

- **Devanagari is caseless — the entire §1 capitalization policy is N/A.** No capital/lowercase distinction to enforce.
- **Native script only, never romanised** (the pipeline already instructs this).
- **Gender-marking is the trap.** Continuous verbs inflect for speaker gender: जा रहा हूँ (m) / जा रही हूँ (f). Prefer gender-neutral frames where possible — the **मुझे … है** wanting-frame dodges it (मुझे जाना है, मुझे बनाना है). Where a form is unavoidably gendered ("I am going"), flag it as a **profile-level** (student-gender) decision, not a per-string one.
- **Register — loanword vs native.** Everyday spoken Hindi mixes English loanwords freely. **"routine" = रूटीन** (locked 2026-07-18) — the casual loanword, register-consistent with टॉयलेट रूटीन, chosen over the formal native दिनचर्या. Apply across all routine titles.
- **Titles = gerund/infinitive label, not a sentence.** "Going to school" list title → स्कूल जाना (label), not स्कूल जा रहे हैं ("we are going to school", a sentence).
- **Ambiguity flag — नाश्ता** = breakfast *or* snack. Fine for "snack" with a clear symbol, but if a separate "breakfast" card exists, disambiguate (हल्का नाश्ता for snack).

## 5. Punjabi (pa)

Configured in the registry (`scriptFamily: non-latin`, Gurmukhi) but **no content-specific rules decided yet**. Apply the shared rules (§1–§2, caseless like Hindi); add a Punjabi section when a review pass covers it.

---

## 6. Glossary (translation memory)

The pipeline has **no glossary mechanism** — every item is translated in isolation, so the same English label can come out differently in two places. Until a shared term list is wired in (§8), this table is the authority. **Same English → same translation, everywhere it appears.**

### Spanish

| English | Spanish | Notes |
|---|---|---|
| school | escuela | not *colegio* |
| jumper | suéter | not *jersey* |
| feelings | sentimientos | **locked** — Feelings category *Sentimientos*, module *Expresar sentimientos* |
| routine | rutina(s) | **locked** — *Rutina de baño*, *Rutinas de comida* |
| life skills | habilidades para la vida | established WHO term |
| everyday | de todos los días | check vs *cotidiano* if used elsewhere; pick one |
| talking about food | hablar de comida | infinitive title, not gerund *hablando* |
| expressing feelings | expresar sentimientos | infinitive title |
| going places | de paseo | **locked** |
| put on your shoes | ponte los zapatos | *tú* imperative, plural |
| I have already eaten | ya comí | LatAm preterite |

### Hindi

| English | Hindi | Notes |
|---|---|---|
| routine | रूटीन | **locked** — रूटीन over दिनचर्या (register-consistent with टॉयलेट रूटीन) |
| wash your hands | हाथ धो लो | तुम imperative |
| dry your hands | हाथ सुखा लो / हाथ पोंछ लो | सुखा लो = dry off (result); पोंछ लो = wipe (towel). Match the symbol; keep …लो cadence |
| snack | नाश्ता | ambiguous w/ breakfast — see §4 |
| I want / I need | मुझे … चाहिए | both English map to the same Hindi (चाहिए = want+need) |
| I want to (do X) | मुझे … है | gender-neutral wanting-frame (मुझे जाना है / बनाना है) |
| I am going | मैं … जा रहा/रही हूँ | gender-marked — profile-level decision |
| going to school (title) | स्कूल जाना | gerund/infinitive label, not the sentence स्कूल जा रहे हैं |

---

## 7. What stays human (don't try to prompt it away)

- **Semantic frame errors** — *¿Qué hora es?* (standalone) vs *¿A qué hora es* (takes a noun). Too subtle for a generic prompt; needs per-item context.
- **Idiom judgment** — the model nails standard terms (*habilidades para la vida*) and over-literalises idiomatic titles (*vamos a lugares*). A nudge helps; perfection doesn't come from a prompt.
- **Row-integrity slips** — the *ya comí* / *¿a qué hora es la cena* swap was a **spreadsheet** problem, not an MT one. No prompt fixes a misaligned row. When one stray cell appears, scan its neighbours — rows often shift together.

The goal is a smaller review pass, not zero. Don't stuff every edge case into the prompt: long prompts cost tokens on every call and dilute the instructions that matter.

---

## 8. Pipeline integration (from the 2026-07-18 audit)

All content MT runs through **`lib/llm/vertex.ts`** → Gemini 2.5 Flash. Four call sites; two matter for this guide.

### Leverage point — content route (`app/api/admin/translate-modules/route.ts`)
Handles categories, lists, sentences (the bulk of user-visible content). This is where to invest.

1. **Feed the model the content type.** `collectSlots()` (`route.ts:77-117`) already tags every slot with a typed key (`sent.text`, `cat.name`, `list.name`, `list.*.item.*.desc`, `name`, `description`). Today those keys are flattened into an opaque composite (`route.ts:206`) and the type never reaches the model. Fix: derive a coarse type per slot and pass a parallel `{key: type}` map (or group the batch by type), then add the §2 per-type rules to the system prompt (`route.ts:53`).
2. **Give it the language identity.** Site 1 passes only the bare ISO code (`route.ts:125`) — the *least-informed* prompt for the *most* content. The UI-string, variant, and symbol routes all pass `label (nativeLabel, ISO)`. Pass the same here, plus `scriptFamily`.
3. **Inject the glossary + dialect lock** into the system prompt (§3, §6). Store the glossary as a per-language data file next to `convex/data/languages/<code>.json` (or `glossary/<code>.json`) so it loads the way the language module already does at `route.ts:229-240`. One block amortizes across hundreds of batched items at negligible cost.
4. **Borrow from the symbol pipeline.** `convex/translationActions.ts` is the reference implementation — it already has register control ("avoid clinical/formal register — a parent doesn't say *ingerir* for eat", `:85`/`:102`), per-language worked examples, and a `scriptFamily` latin/non-latin system-prompt branch (`:151`). The content route should adopt the same `scriptFamily` switch and register examples.

### Variant route (`app/api/translate-text/route.ts`)
The on-demand "Made in…" MT for user-authored variants (sentences, lists, phrases, group titles). Type is known at the caller (`SentencesModeContent.tsx:950`, `ListsModeContent.tsx:548`, `GroupTile.tsx:140`, `TalkerDropdown.tsx:527`) but **discarded at the API boundary** — the route accepts only `{ texts, targetLang }` (`route.ts:34`). Fix: add a `kind` param and apply the §2 rule for that type — this is the **only** place the *phrase-fragment* rule applies. Glossary here is optional/opt-in (per-string calls; bundle client-side if used).

### Proposed system-prompt additions (content route)

Append to `SYSTEM_PROMPT` (`translate-modules/route.ts:53`). Draft:

```
Each value has a TYPE (provided alongside it). Apply these rules by type:
- sentence: a complete first-person utterance the child says. Natural target
  word order. Sentence case (capital first word only).
- title/name: a heading LABEL — concise noun-phrase or infinitive. NOT a
  sentence; never start with "Let's"/a conjugated verb. Sentence case, never
  Title Case (do not capitalize every word).
- description: a short natural phrase. Sentence case.
- list item: a tappable label — lowercase. If it is an instruction/routine
  step, use the informal imperative (Spanish tú; Hindi तुम).
Always keep capitals for proper nouns and the English pronoun "I", regardless
of type. Devanagari/Gurmukhi are caseless — ignore case rules for those.

Spanish: use neutral Latin American Spanish (suéter not jersey, escuela not
colegio, preterite "ya comí"). Titles use Sentence case, never Title Case.

Glossary — use these exact renderings wherever the English appears:
<injected per-language glossary from §6>
```

Keep the existing rules (placeholders, native script, proper nouns, same-keys) — this augments, not replaces.

> **Casing caveat (see §1):** casing is **not enforced** — the app never overrides user casing (personalization first). The case rules may go in the prompt as a *soft suggestion* so default content lands close to house style, but treat casing as low-priority: the author/reviewer sets final casing and users own theirs. The prompt's real job is register + dialect + glossary.

---

## Changelog

- **2026-07-18** — created from the ES/HI defaults QC pass. Locked: two-bucket casing, Sentence-case titles, neutral-LatAm Spanish, glossary (feelings→sentimientos, routine→ rutina / रूटीन, going places→ de paseo). Pending: everyday consistency.
- **2026-07-18 (later)** — normalization-on-save **rejected** on personalization grounds; §1 reframed as **advisory, not enforced** (the app never overrides user casing). The `phase-15.9-casing-normalization` plan was withdrawn.
