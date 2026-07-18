# Phrase language scoping — design

**Date:** 2026-07-17
**Status:** ❌ **REJECTED (2026-07-18).** The proposed teardown was **not implemented**. Kept as a decision record — the research and taxonomy below stand; the conclusion was reversed after hands-on testing. See *Outcome* immediately below.
**Feeds:** nothing. No ADR addendum written; no phase plan created.

---

## Outcome — teardown rejected (2026-07-18)

After reading this spec, the owner tested the **existing** variant system by hand in the app: took a translated (seed) phrase on a Hindi board and edited it. Finding — a valid Hindi variant is reachable with tiny edits (delete the subject symbol, drop `to`/`the`, add a symbol for `hai`); and where a phrase collapses to a single word, it's simply deleted and a core word used instead. Two realisations followed:

1. **`variantGroupId` is optional and additive, not a forced bijection.** The system already supports both an English-parent → target-seed sibling *and* a standalone per-language phrase (`createProfilePhrase` with `authoredLanguage`, no group). It never *required* the English skeleton this spec argued against. The "no bijection" case attacked a requirement that doesn't exist.

2. **The research condemned auto-translating-and-shipping phrases — which the system doesn't do.** The variant flow *seeds a prompt the human edits*, which is exactly ADR-016 Addendum A (*"MT is a starting point that the human re-authors structurally"*). So the evidence below supports *good defaults + human edit* — and the current system **is** that. The seeded sibling acts as a useful scaffold on a new board ("we did this in EN; start here in HI"), after which Mo Speech's global edit mode / full customisation takes over. That edit-everything model is the product's core value, and it absorbs the imperfect mapping at one click.

**Weighed against that, the teardown was a lot of destructive work** (schema migration, deleting shipped-and-working code, removing the scaffold) to enforce a purity whose benefit the flexible editor already delivers. It also made phrases a *third* content category, breaking the phrases≈sentences symmetry — a cost this spec introduced rather than removed.

**Accepted, eyes open:** on a structurally-English phrase, the badge's "Translate to ⟨lang⟩" path can seed a poor variant before the human fixes it. Bounded by (a) cutting glue from *defaults*, (b) edit mode, (c) owner awareness → straight to manual edit on the "Made in…" click. Revisit only if user feedback shows the badge misleading on phrases.

### What actually shipped from this investigation

The parts **independent** of the rejected schema change were kept and are done:

- **Backup/data fixes** — exporter now covers the `phrases` tree; `surface` round-trips both ends; three legacy phrase modules (`everyday`/`feelings`/`social`) deleted. Committed `bb1474e`. (See *Completed ahead of this spec*.)
- **Dead-code sweep** — `getPhraseBanks`, `installDefaultBanksAndCore` (`profilePhrases.ts`), and `retireOldDropdownDefaults` (`dropbar.ts`) removed. These were dead (zero callers) **regardless** of the variant decision; the last was also a footgun (its `surface === "core"` retire logic would have un-defaulted the 7 kept core category modules).
- **Content, ongoing (owner):** author good trilingual default phrases and **cut the glue** (`to the` / `in the`). Still worth doing — glue teaches no structure, isn't a gestalt, and seeds the worst variants. This is content work in the owner's Google Sheet, not a code change.

**Not carried out:** removing `variantGroupId` from `profilePhrases`; deleting `createPhraseVariant` / the phrase badge / `collapseVariants`; the `authoredLanguage === boardLanguage` hide-filter; ADR-016 Addendum G. The variant system stays as-is for phrases.

> Everything below this line is the **original rejected proposal**, preserved unchanged as the record of what was considered and why it was set aside.

---

## Problem

Phrases are 2–5 symbol chunks in the talker dropdown, chained to build sentences. The English stack is built of *heads* — `I want to go` + `park`. Hindi cannot work this way: it is SOV with postpositions, and its wanting-frame `मुझे … है` is **discontinuous**, wrapping around the object. Spanish mostly tracks English because both are SVO.

ADR-016 currently treats phrases as structure-bound content and prescribes the sibling-row variant model (`variantGroupId`, source-anchored: *"the group id IS the source row's `_id`"*). That model assumes a **bijection** — every Hindi row hangs off an English parent.

**Phrases have no bijection.** Two independent proofs:

1. **Zero-mapping in both directions.** `to the` / `in the` have no Hindi counterpart at all (Hindi drops the article and welds the postposition to the noun). `जाना है` has no English counterpart — it is a verb-tail; English has no such part.
2. **Arity differs per sentence.** "I want to go to the park" is `[I want to go]` + noun in English (**one** phrase), but `[मुझे]` + noun + `[जाना है]` in Hindi (**two** phrases sandwiching the noun). No `variantGroupId` can express "one row here, two rows there."

Applying the variant model anyway would force invention of phantom English source rows — an English skeleton under every language.

## Evidence

Research summary (full citations in the session transcript; key sources below).

- **Soto & Tönsing (2024), *AAC* 40(1)** — set out to find a universal core; found the opposite, with a typological gradient: Spanish **62%** overlap with English, Sepedi **40%**, Korean (**SOV**) **33%**. Verbatim: *"core vocabulary lists are language-specific and it would be inappropriate to translate them across languages."* Hindi is SOV — the worst-transferring class.
- **Function words are the least transferable class.** Of 56 words surviving across all four languages, **exactly one** was a preposition. Our glue phrases (`to the`, `in the`) were made entirely of this class. ARASAAC independently reports prepositions/conjunctions *"simply do not work in a bilingual dictionary situation."*
- **The same meaning is a word in one language and a phrase in another.** Soto & Tönsing observe children used *"words that are not translation pairs"* and that a meaning is *"sometimes represented by phrases rather than only words."* This is the arity argument in the literature's own words.
- **Proloquo2Go draws the line at exactly this boundary** — auto-translates *words*, but per its own docs *"you will need to translate phrases … yourself."* AssistiveWare's CEO: *"a good localization cannot have the same word in the exact same place."*
- **Blissymbolics ran this experiment for 50 years and failed this way.** Concept-level universality was real; *"their order is based on English word order"* — the sequence was English all along, invisibly. This is the exact failure mode a source-anchored variant model would reproduce.
- **W3C / ICU / Fluent** forbid composing text from translated fragments; W3C's worked discontinuity example is **Japanese (SOV)**. Fluent's *asymmetric localization* — shared **ID**, each locale realising *"independently of the source language"* — is the industry answer.

**Verdict:** share the meaning ID, never share the structure. **And for phrases specifically, even the ID is not worth carrying** — see Decision.

## Decision

**Phrases are language-scoped content with no cross-language link.** No variants, no siblings, no badge, no intent ID.

An intent ID (the Fluent model) was considered and rejected. Its only benefit was an authoring coverage view, which measures completeness against a target that does not exist: **default phrases are examples, not a canonical matched set**, and every account diverges by design. The field would be populated on a handful of seed rows and empty across real user data — a spreadsheet column, not an architecture.

### The content taxonomy becomes three-way

ADR-016's binary split lumps together two things that behave differently. The discriminator is **does this express a complete meaning?**

| Category | Examples | Rule |
|---|---|---|
| Order-free | symbols, words, folder/list/group labels | Translates live *(unchanged)* |
| Structure-bound, **whole meaning** | sentences, lists | Per-language sibling variants via `variantGroupId` *(unchanged)* |
| Structure-bound **fragment** | **phrases** | **Language-scoped. Unlinked.** |

A sentence expresses one complete meaning, so it has a counterpart in every language and `variantGroupId` is meaningful — even when the symbols differ, which the variant model already caters for. A phrase is a fragment; fragments have no meaning that survives on its own. That is *why* ICU forbids composing from them.

### Mechanism

`authoredLanguage` becomes the entire language mechanism. It already exists (`schema.ts:796`) and already drives per-phrase text/voice resolution via `phraseLangOf`; it now also decides visibility.

- **Filter, client-side:** `collapseVariants(phrases, language)` → `phrases.filter(p => phraseLangOf(p) === language)`. One line for one line.
- **Client-side is deliberate**, preserving ADR-016's property that switching board language needs no Convex re-query, and keeping egress flat (Starter/EU bills every byte).
- **A Hindi board shows Hindi phrases only.** English phrases do not appear. This is why non-EN defaults are in scope — the tab must never be empty on first run.

### Legacy `authoredLanguage` inference

`authoredLanguage` is `v.optional`. Under a strict `=== boardLanguage` filter, a row with `authoredLanguage: undefined` matches **nothing** and vanishes from **every** board, including English — a silent data-disappearance bug.

**Rule:** an absent `authoredLanguage` resolves to the **origin locale inferred from the `name` record's keys** (`{en: "I want"}` → `en`); fall back to `DEFAULT_LOCALE` only if the record is empty. This follows the precedent set in Phase 15.5 (commit `87ce54b`, "key legacy plain-string list descriptions under origin locale").

### Why the teardown is safe

ADR-015 §3: a phrase inserted into a sentence is a **snapshot, not a live reference** — *"an instructor editing a phrase-bank entry must never retroactively reshape a child's already-saved sentence."* Hiding, deleting, or re-authoring phrases therefore **cannot** reach into saved sentences.

## Scope of change

Phrase variant linking is **already shipped end-to-end**. This is a removal, not an addition.

**Delete**
- `createPhraseVariant` — `convex/profilePhrases.ts:196-231`
- `phraseVariantTarget` state, author handler, `VariantAuthorModal` mount — `TalkerDropdown.tsx:129-131, 429-434, 886-892`
- The inline "Made in ⟨LANG⟩" badge — `TalkerDropdown.tsx:618-624, 1119-1132` (a bespoke duplicate of `TranslateBadge`, which phrases never used)
- `collapseVariants` / `reconcileVariantOrder` calls — `TalkerDropdown.tsx:307, 314`
- `getPhraseBanks` — `convex/profilePhrases.ts:79-113` (dead: zero callers)
- `installDefaultBanksAndCore` — `convex/profilePhrases.ts:119-149` (dead: its "Load defaults" button no longer exists)
- `retireOldDropdownDefaults` — `convex/dropbar.ts:239` (nothing left to retire; see Completed below)

**Change**
- Drop `variantGroupId` from `profilePhrases` (`schema.ts:799`) and stop projecting it (`profilePhrases.ts:71`, `dropbar.ts:137`)
- Swap collapse → filter; add the legacy-locale fallback
- Update the stale `getPhraseBanks` reference in the `dropbar.ts:111` comment

**Keep — load-bearing, do not touch**
- `authoredLanguage` on `profilePhrases`
- `profilePhrases.folderId`; `profileFolders` `tree:"phrases"`; the `"phrases"` member of `ModuleTree` — the dropbar and profile creation depend on these
- `phrases: PHRASE_MODULES` in `migrations.seedLibraryModulesFromJSON` — **now the live restore path** for the phrase backup (see Completed). An earlier draft of this spec called for its deletion; that was correct only while the JSONs were dead debris.
- The `core-*` category modules — these are **deliberate default category modules** (owner-confirmed 2026-07-17): resources on the Categories page for users who don't use the dropdown. Four of them are *also* `DEFAULT_CORE_INJECT_SLUGS` (`dropbar.ts:27`), the symbol source for the dropdown's Core-words tab, which is a separate editable selection. They are absent from the owner's test account only because it predates the change and has not been re-seeded. Out of scope here; do not touch.

**Migration risk:** rows already carrying `variantGroupId` need clearing; orphaned siblings become independent phrases (visible duplicates). Confirmed acceptable — dev-server only, and the owner is nuking and re-signing-up test accounts.

## Default content

Authored natively per language by the owner using the ADR-016 Addendum A pattern (**human owns symbol order** via drag-and-drop, script-independent; **MT owns text + audio**, removing the IME requirement). Published via the existing flow: build on the board → publish folder as `dropbar-phrases` → `seedDefaultAccount` installs on every new profile → each board filters to its own language. **No new pipeline.**

**No glue.** `to the` / `in the` are cut. They serve neither purpose phrases exist for (teaching sentence structure; gestalt chunks) — they are tap-efficiency artifacts, and tap efficiency is explicitly not a goal. They are also the exact word class the research says does not transfer. They never existed in the seeds, so this costs nothing.

**The stacks are different sizes, and some rows migrate tabs.** English needs two tiles to spell out a pronoun + auxiliary; Spanish is pro-drop and Hindi uses the dative — both inflect that meaning into a **single word**. So `I want` / `I need` / `let's go` are English *phrases* but Hindi and Spanish **words**, belonging in **Core words**, not Phrases.

| Meaning | EN | HI | ES |
|---|---|---|---|
| "I want" | phrase (`I`+`want`) | **word** मुझे | **word** Quiero |
| "I need" | phrase (`I`+`need`) | **word** चाहिए | **word** Necesito |
| "let's go" | phrase (`let's`+`go`) | **word** चलो | **word** Vamos |

**EN — 8 frames** (heads)

| name | words |
|---|---|
| I want | `I` · `want` |
| I want to go | `I` · `want` · `go` |
| I need | `I` · `need` |
| I am going | `I` · `going` |
| What time is | `what` · `time` · `is` |
| I like | `I` · `like` |
| all done | `all` · `done` |
| let's go | `let's` · `go` |

**HI — 6 frames** (tails). Plus मुझे · चाहिए · चलो → **Core words**.

| name | roman | words |
|---|---|---|
| जाना है | jaana hai | `जाना` · `है` |
| खाना है | khaana hai | `खाना` · `है` |
| बनाना है | banaana hai | `बनाना` · `है` |
| खेलना है | khelna hai | `खेलना` · `है` |
| कितने बजे है | kitne baje hai | `कितने` · `बजे` · `है` |
| अच्छा लगता है | achha lagta hai | `अच्छा` · `लगता` · `है` |

**ES — 6 frames** (heads). Plus Quiero · Necesito · Vamos → **Core words**.

| name | words |
|---|---|
| Quiero ir | `quiero` · `ir` |
| Quiero hacer | `quiero` · `hacer` |
| Voy a | `voy` · `a` |
| ¿A qué hora es | `a` · `qué` · `hora` · `es` |
| Me gusta | `me` · `gusta` |
| Ya está | `ya` · `está` |

**Authoring note — settle before building.** The owner's existing data renders मुझे as **one** symbol in `मुझे रिमोट चाहिए` but **two** ([person] + [want-hand]) in `मुझे पार्क जाना है`. Same word, two arities. Pick one: **one symbol**, since it is one word — let the want-hand belong to चाहिए.

## Completed ahead of this spec

Discovered while establishing ground truth; already done and verified.

- **`scripts/export-library-modules.mjs` now covers the `phrases` tree.** It previously read `OUT = {categories, lists, sentences}` and silently warned-and-skipped every live phrases row, so `convex/data/phrases/` was frozen and could never track the table — i.e. **phrases had no git backup at all**. `seen` is now derived from `OUT` so a new tree cannot drift out of the exporter again.
- **`surface` is now exported and restored.** `dumpAllModules` never projected `surface: v.optional(v.literal("core"))` (ADR-015 §6/§7) even though `ContentModuleBase` (`types.ts:160`) declares it, and `seedLibraryModulesFromJSON` never wrote it back — so a restore silently dropped the field on **all seven** `core-*` modules. The backup was not faithful to the table. Fixed both ends; the re-export recovered `surface: "core"` on all 7. **This affected every tree, not just phrases.**
  **Open thread (parked, not part of this spec):** those 7 rows carry `surface: "core"`, which ADR-015 §6/§7 defines as *"surfaced in the talker dropdown's Core-words tab (**not** the main Categories page/library)"* — yet their role is now default **category** modules. The field value and that ADR comment may have drifted apart. Worth checking post-nuke whether a live filter keys off `surface` in a way that conflicts with their intended role.
  `featured` / `tags` / `notes` / `tierOverride` remain excluded — they are absent from `ContentModuleBase` and `tierOverride` sits under the schema's `── Lifecycle ──` header. `translationSnapshot` is excluded per its own schema comment (*"Omitted from the git export (rebuilt safely on run)"*).
- **The three legacy phrase modules are deleted** (`everyday` 3 items, `feelings` 0, `social` 0). They were **not** stale — all three were still `isDefault: true` and seeding to every new profile, while `findPhrasesContainer` (which looks for `librarySourceId === "dropbar-phrases"`) matched none of them, so `ensureDropbarContainers` created a *fourth* empty folder that was the actual tab. Every new account was getting three invisible junk folders. `retireOldDropdownDefaults` existed to fix exactly this but had **zero callers** and was unreachable (`npx convex run` has no identity for its `requireCallerIsAdmin` gate) — it had never been run. Rows deleted via the Convex dashboard; the re-export pruned the JSONs and regenerated the barrel by machine.

`dropbar-phrases` does not exist in `libraryModules` — `PHRASES_SLUG` is only a constant and a folder sentinel. It will be created the first time the trilingual stack is published.

## Out of scope / deferred

- **Hindi gender-marked verbs.** जा रहा हूँ (m) / जा रही हूँ (f) — "I am going" is deliberately **omitted** from the HI stack. Every other HI frame uses the gender-neutral `मुझे … है` construction. This is a **profile-level** decision (a student gender setting), not a phrase-level one.
- **The monolingual GLP critique of carrier phrases.** Meaningful Speech: *"Carrier phrases are difficult to 'unglue.'"* Not treated as a blocker: the owner's SLP values this feature for *"reusing elements to make different sentences"* — which **is** mitigation, the criterion the GLP literature asks for. Revisit only if user feedback shows chunks sticking.
- **`contentModules/phrases.ts`** (`installPhraseModule` / `deletePhraseModule`) — no app callers today. The absent phrases catalogue on `/library/modules` is **deliberate** (ADR-015 §4 amendment, 2026-06-30: *"a phrase is an incomplete part of a sentence; shown as a standalone library card it reads as a broken half-sentence"*), so a write path without a public read path is the intended shape. Left in place; do not prune on a guess.
- **Cleanup migration for existing accounts** — not needed. Dev server only; test accounts are being nuked and re-created.

## Open question for the plan

Deleting `variantGroupId` from `profilePhrases` is a schema removal. Confirm whether to hard-remove the field or leave it defined-but-unused for one release, given Convex validates on write and existing rows may carry values. Recommendation: clear values in a migration, then remove the field in the same change — the data is dev-only and the field has no reader once the collapse call is gone.

## Non-goals

This spec does not change sentences, lists, labels, or the order-free translation model. It does not introduce an intent/meaning ID. It does not add a phrases catalogue to the public library.
