# Pack Content Translation Workflow

> **What this is.** The operational playbook for fixing content issues in library pack JSON files — typos, capitalisation, mistranslations, register tweaks — across English and any translated locale. Use when a tester reports something wrong in a pack, or when content needs polish before a release.
>
> **Companion docs:** [11-language-and-i18n](../../../1-inbox/ideas/11-language-and-i18n.md) (the strategic why), [19-lists-and-sentences](../../../1-inbox/ideas/19-lists-and-sentences.md) (the schema of the fields you'll edit), ADR-009 (the LocalisedString architecture).
>
> **Required tools:** a code editor and Node 20+. The `scripts/translate-pack.mjs` Gemini pipeline does the AI translation when needed.

---

## TL;DR cheatsheet

| Symptom | Fix |
|---|---|
| English typo / capitalisation only | Edit `en` in pack JSON. Done. |
| English fix where existing Spanish (etc.) already conveys correct meaning | Edit `en` only, leave other locales. |
| English meaning has changed | Edit `en`, **delete the stale locale keys**, run `node --env-file=.env.local scripts/translate-pack.mjs <slug> <locale>` |
| Wrong Spanish (etc.) word/phrase, English is fine | Delete the stale locale key, re-run the script. |
| Wrong Spanish (etc.) on a **SymbolStix symbol label** in a pack (symbol has `symbolId`) | Not the pack JSON — comes from `symbols.words.<locale>`. Fix in the symbols admin path. |
| Wrong/missing Spanish on a **custom-image symbol label** in a pack (no `symbolId`) | Is the pack JSON — delete `label.es` and run the script as usual. |
| Bad image, wrong symbol order, restructure a category | Workflow C — admin curates in-app, then clicks **Republish to JSON**. |
| Create a brand-new pack | Two steps: **Save to pack → Create new** (assigns slug), then **Republish to JSON** (writes the file). |
| Bulk fix across all 7 non-starter packs | Edit each pack JSON, then `scripts/translate-pack.mjs --all <locale>` |

---

## The mental model

Every localised field in a pack JSON is a `LocalisedString` — an ISO-keyed open record:

```json
"name": {
  "en": "Christmas morning",
  "es": "Mañana de Navidad"
}
```

**English is the source of truth.** Every other locale (`es`, future `hi`, `pa`, …) is a *derivative* translated from English. This has two consequences:

1. **When English changes, derivatives become stale.** Whether they need refreshing depends on whether the *meaning* changed.
2. **The translation script (`scripts/translate-pack.mjs`) fills *missing* locales.** It never overwrites a locale that's already populated. So to force re-translation of a single field, **delete the stale key** — the script then sees it as missing and refills it. There is no `--force` flag (yet — can be added if volume demands it).

---

## Decision tree

```
Tester reports a content issue in a pack JSON
│
├─ Is the change PURE SURFACE? (typo, capitalisation, punctuation)
│   │
│   ├─ YES → Workflow A: edit en only.
│   │       The existing locale translations already convey the
│   │       intended meaning. Save Gemini calls and review time.
│   │
│   └─ NO  → Is it a different word, rephrasing, or new content?
│            │
│            └─ YES → Workflow B: edit en, delete locale keys, re-run script.
│                    Let Gemini re-translate against the new meaning.
│
└─ Is the issue in a SYMBOL LABEL inside a pack (labelOverride / label)?
    └─ See "Special cases" below — symbol labels are NOT translated by
       the pack script; their Spanish comes from symbols.words.es.
```

---

## Workflow A — surface change (no re-translation)

Use when the edit is a typo, capitalisation, or punctuation change that doesn't alter meaning. Existing locale translations stay valid.

### Example — `religion.json` doubled word

`lists[0].name.en` reads `"Going to the the Gurdwara"` (typo: doubled "the"). Spanish reads `"Ir al Gurdwara"` (already correct — Gemini saw through the typo and translated the intended meaning).

```diff
 "name": {
-  "en": "Going to the the Gurdwara",
+  "en": "Going to the Gurdwara",
   "es": "Ir al Gurdwara"
 }
```

That's the entire fix. No script run.

**When in doubt** about whether the existing Spanish is still correct, glance at it. If it reads naturally and conveys the intended meaning, leave it. If unsure, treat it as Workflow B (cheap insurance — a single field re-translation costs fractions of a cent).

---

## Workflow C — UI curate-and-Republish (visual edits)

For changes you need to *see* to judge — image swaps, layout reordering, restructuring categories, deleting bad symbols — open the app in admin mode and curate the loaded copy of the pack. Then push back to JSON via the **Republish to JSON** button. Pairs naturally with Workflows A and B; you'll often touch all three on a single tester report.

The model after the simplification:

- **Every profile row tracks its origin pack via `librarySourceId`** (set automatically by the materialiser when admin or instructor loads the pack). One field, no more `packSlug` fallback chain.
- **Republish gate toggle** (in the admin edit bar) is a safety switch — it just reveals the destructive **Republish to JSON** button. No backend write.
- **Republish to JSON** writes the current profile content for this pack back to `convex/data/library_packs/<slug>.json`. Dirty-state gated; disabled when nothing has changed since the last publish.
- **Save to pack** button is the picker — opens the existing `LibraryPackPickerModal`. Mutation is **duplicate-or-assign**: first-time save assigns `librarySourceId` to a fresh row; subsequent saves create a duplicate at the chosen pack.

### Creating a brand-new pack is a two-step flow

1. **Save to pack → Create new pack → enter slug + name → confirm.** This creates the `packLifecycle` row in Convex and assigns `librarySourceId` to a fresh row (or duplicates an existing one if the row was already pack-loaded).
2. **Open the row's detail page → open the Republish gate → click Republish to JSON → confirm.** This writes `<slug>.json` to disk and rebuilds the barrel. After the next Convex deploy (`npx convex dev --once` in dev), the new pack appears in `/library`.

Without step 2, the lifecycle row exists in Convex but the JSON file doesn't — `getPublicLibraryCatalogueV2` filters the pack out because `getLibraryPackBySlug(slug)` returns `undefined`.

### Removing content from a pack

There's no Library OFF button. To remove a category / list / sentence from a pack:
1. Delete the row from your profile (the standard delete affordance).
2. Republish the pack — the next JSON write drops the row from the file.

This is one-way deliberate, not a footgun.

### Moving content between packs

No "move" workflow either. To move from pack A to pack B:
1. Save to pack → pick B → row is duplicated at B (original stays at A).
2. Delete the original row + Republish A so its JSON drops it.

Two steps but rarely needed in practice.

### Origin badges

Every category card, list row, and sentence row now shows a **"From <Pack Name>"** badge when `librarySourceId` is set. Visible to instructors and admins. Brand-new admin-created content (no `librarySourceId`) shows no badge.

---

## Workflow B — meaning change (force re-translation)

Use when the English edit changes meaning — different word, rephrasing, new content. The existing Spanish (etc.) was translated from the old meaning and is now wrong.

### Three steps

**1. Edit the English** in the pack JSON.

**2. Delete the stale locale keys** in the same field. Two equivalent forms:

```json5
// Before
"text": {
  "en": "I want to go outside",
  "es": "Quiero salir afuera"
}

// After — option (a): delete the es key, leave the object
"text": {
  "en": "I want to go out for a walk"
}

// After — option (b): collapse to a plain string (legacy union shape)
"text": "I want to go out for a walk"
```

Both work. The script handles either; it'll upgrade option (b) back to the object shape with `en` + `es` keys.

**3. Run the script** for the affected pack and locale:

```bash
node --env-file=.env.local scripts/translate-pack.mjs <slug> <locale>
```

The script walks the pack, finds every localised field missing the target locale, translates them in a single Gemini batch, and writes the file back. Console output tells you how many fields were touched and what it cost.

### Example — re-translating `dinosaurs.json` after a capitalisation fix that *also* changed Spanish

We capitalised `"tyrannosaurus rex"` → `"Tyrannosaurus rex"`. The previous Spanish was `"el tiranosaurio rex es el dinosaurio más feroz"` — Spanish localisation of the species name. Capitalising the English as the binomial scientific term means the proper Spanish should preserve it. Workflow B applies:

```diff
 "name": {
-  "en": "tyrannosaurus rex is the most fierce dinosaur",
-  "es": "el tiranosaurio rex es el dinosaurio más feroz"
+  "en": "Tyrannosaurus rex is the most fierce dinosaur"
 }
```

```bash
$ node --env-file=.env.local scripts/translate-pack.mjs dinosaurs es
dinosaurs.json — translated 2 field(s) · 365/47 tok · ~$0.0002
```

The script touched only the 2 fields we cleared. The other ~11 Spanish-complete fields in the pack stayed untouched.

Spanish output: `"Tyrannosaurus rex es el dinosaurio más feroz"` — now preserves the binomial as a proper noun.

---

## Special cases

### Symbol labels inside packs — the SymbolStix vs custom-image distinction

Pack JSONs contain symbol entries that look localisable:

```json
// SymbolStix-backed (has symbolId)
{ "symbolId": "kn7c8...", "labelOverride": { "en": "Christmas tree" } }

// Custom-image (no symbolId, has imagePath + label)
{ "imageSourceType": "imageSearch", "imagePath": "library_packs/space/...",
  "label": { "en": "Earth" } }
```

The script handles them differently based on whether the symbol has a `symbolId`:

| Symbol kind | Marker | What the script does | Why |
|---|---|---|---|
| SymbolStix | has `symbolId` | **Skips both `label` and `labelOverride`** | At materialisation time the runtime merges `{...symbolDoc.words, ...sym.labelOverride}`. The Spanish slot comes from `symbols.words.es` (Phase 8.2 populated all 58,807 symbols) — not from anything in the pack JSON. Translating it in the pack would be duplicative work. |
| Custom-image | no `symbolId` | **Translates `symbols[].label`** | No central symbols-table entry exists → no Phase 8.2 fallback → the pack JSON is the only place the Spanish label can live. Skip it and the symbol stays English forever. |

**Consequences for tester reports:**

- If a SymbolStix symbol shows the wrong Spanish label inside a pack, the fix is in the **central `symbols` table** (admin path / `symbols.ts`), not the pack JSON. Editing `labelOverride.es` would only affect that one pack instance, not every other surface where the same symbol appears.
- If a custom-image symbol shows the wrong Spanish label, the fix **is** in the pack JSON's `symbols[].label.es`. Delete the `es` key and re-run the script the usual way.
- Editing **`labelOverride.en`** (or `label.en`) for English-only display issues is always fine — the English override is the original purpose of the field.

### Sentence `name` vs `text` — usually meant to be identical

A sentence has both `name` (the row label, button title) and `text` (the spoken phrase). They're often supposed to be the same string in any given locale. If they diverge in translation (e.g. `name.es = "Quiero salir afuera"` and `text.es = "Quiero salir"` for the same English `"I want to go outside"`), that's a polish gap.

**Fix:** delete both `es` keys before running the script. Gemini sees them in the same batch with identical English and produces consistent Spanish for both.

### `_starter.json` is excluded from `--all`

The `--all` mode skips underscore-prefixed files (`_starter.json` is the only one currently). To translate or re-translate fields in the starter pack, pass the slug explicitly:

```bash
node --env-file=.env.local scripts/translate-pack.mjs _starter es
```

### After editing pack JSONs

The barrel at `convex/data/library_packs/_index.ts` auto-picks up JSON edits. No schema change, no codegen step:

```bash
npx convex dev --once    # confirms typecheck + redeploys functions
```

If the dev server is running it'll hot-reload. Otherwise restart it as usual.

---

## Worked example — full tester-report fix, start to finish

> Tester: "On the Diwali pack the list name says 'Getting ready for Diwali' but it should say 'Preparing for Diwali' — and the Spanish should match."

This is a **meaning change** (different verb), so Workflow B.

1. **Locate.** `grep -n "Getting ready for Diwali" convex/data/library_packs/diwali.json` → finds `lists[0].name.en`.

2. **Edit + delete stale locale:**

   ```diff
    "name": {
   -  "en": "Getting ready for Diwali",
   -  "es": "Preparándonos para Diwali"
   +  "en": "Preparing for Diwali"
    }
   ```

3. **Run the script:**

   ```bash
   node --env-file=.env.local scripts/translate-pack.mjs diwali es
   ```

   Output: `diwali.json — translated 1 field(s) · ~$0.0001`.

4. **Eyeball the result:**

   ```bash
   git diff convex/data/library_packs/diwali.json
   ```

   Check the new `es` matches the intent.

5. **Convex pickup + dev refresh:**

   ```bash
   npx convex dev --once
   ```

6. **Commit:**

   ```bash
   git add convex/data/library_packs/diwali.json
   git commit -m "fix(diwali): rephrase list name 'preparing for diwali' + spanish"
   ```

Total wall-clock: under two minutes. Total Gemini spend: a fraction of a cent.

---

## When to ask Claude (or any AI assistant) to do this for you

The most efficient prompt template:

> "Pack `<slug>` has an issue in `<field path>`: `<wrong>` → `<correct>`. Re-translate `<locale>` if meaning changed."

Examples:

- *"Pack `religion` has a typo in `lists[0].name.en`: 'Going to the the Gurdwara' → 'Going to the Gurdwara'. No re-translation needed."*
- *"Pack `diwali` — change `lists[0].name` to 'Preparing for Diwali' and re-translate Spanish."*
- *"Pack `christmas`, sentence 0, name and text both: change English to 'Can I open my presents now' and re-translate Spanish for both."*

The assistant should narrate which workflow branch it's taking (A vs B) so you can correct mid-flight if the judgement looks wrong.

---

## Future improvements (only build if pain warrants it)

These are deliberately not built yet — current workflow is fine for occasional tester reports. Revisit if volume picks up.

- **`--force <field-path>` flag** on the script — re-translate a specific field without manually deleting its locale keys first. Saves one editor step.
- **`scripts/retranslate-field.mjs <slug> <locale> <path>`** — one-shot helper that does delete-and-re-run in a single command for routine single-field fixes.
- **Bulk locale diff tool** — given a pack and a locale, show every field's English alongside the translation so a native speaker can review without bouncing through the app.
- **Pre-commit lint** — catch doubled words, stale `(hi)` markers, and lowercase scientific binomials in pack JSONs at commit time so they never reach a tester.

---

## Reference — current pack inventory

| Pack | Slug | Tier | Notes |
|---|---|---|---|
| Starter pack | `_starter` | n/a | Loaded automatically on profile creation. Excluded from `--all` runs. |
| Christmas | `christmas` | max | 1 list, 1 sentence |
| Dinosaurs | `dinosaurs` | pro | 1 list, 1 sentence |
| Diwali | `diwali` | max | 1 list, 2 sentences |
| Fun | `fun` | free | 1 list, 1 sentence |
| Religion | `religion` | free | 1 list, 1 sentence |
| Space | `space` | free | Categories only — no lists or sentences |
| Vehicles | `vehicles` | pro | Categories only — no lists or sentences |

Spanish coverage: complete (as of Phase 8.3.1). Hindi / Punjabi: not yet translated; will use the same script with locale flag once those phases land.
