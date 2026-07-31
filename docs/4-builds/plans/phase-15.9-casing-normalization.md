# Casing Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A deterministic casing normalizer that enforces the two-bucket casing rule from the [translation style guide](../translation-style-guide.md) on every content save and on machine-translation output — so casing is consistent app-wide regardless of author or LLM.

**Architecture:** One pure TypeScript function, `normalizeCasing`, operating on a single string given a `type` (`"lowercase"` | `"sentence"`) and `lang` code. A record helper applies it per-language across a `localisedString` record. It is wired into every content-writing Convex mutation (profile phrases/sentences/lists/folders/categories) and into `applyModuleTranslation` (the admin MT write path). Casing thus becomes a property of *saving*, applied identically to human-authored and machine-translated text.

**Tech Stack:** TypeScript, Convex mutations, Vitest (introduced by this plan — the repo's first unit-test harness; see Global Constraints).

## Global Constraints

- **Casing policy (from the style guide §1):** two buckets — **lowercase** for tappable vocabulary (phrase names, phrase/sentence word labels, list-item descriptions); **Sentence case** (capital first word only) for titles (list/folder/category/sentence names) and sentence text. Always-capital exceptions: **proper nouns** (allowlist) and the **English pronoun "I"** (only in `en`).
- **Caseless scripts:** Hindi (`hi`) and Punjabi (`pa`) are caseless (Devanagari/Gurmukhi). The normalizer must leave them unchanged. Source of truth for caselessness is the language registry `scriptFamily` (`"non-latin"`); this plan hardcodes the set with a comment to keep it in sync.
- **`localisedString`** = `v.record(v.string(), v.string())` (`convex/schema.ts:31`) — an ISO-code → text map, e.g. `{ en: "...", es: "...", hi: "..." }`.
- **Legacy union:** `profileLists` item `description` is `v.union(v.string(), v.record(...))` — a legacy plain string (English-origin) or a localised record. The normalizer must accept both.
- **New unit-test harness:** this plan adds **Vitest**. It is the project's first test runner. If the reviewer prefers not to add it, Task 1's test steps convert to a standalone `node --test` assertion script instead — but the pure function still gets tested.
- **Convex CLI needs Node 20+.** Prefix any `npx convex` command with `source ~/.nvm/nvm.sh && nvm use 20.17.0`.
- **No `npx convex dev` in a worktree** (rewrites `.env.local`). Typecheck Convex with `npx tsc -p convex/tsconfig.json --noEmit`.

## Content-type → casing map (definitive)

Every wiring task uses this table. Do not deviate.

| Field | `type` |
|---|---|
| `profilePhrases.name` | `lowercase` |
| `profilePhrases.words[].label` | `lowercase` |
| `profileSentences.name` | `sentence` |
| `profileSentences.text` | `sentence` |
| `profileSentences.units[].label` | `lowercase` |
| `profileLists.name` | `sentence` |
| `profileLists.items[].description` | `lowercase` |
| `profileFolders.name` | `sentence` |
| `profileCategories.name` | `sentence` |
| `libraryModules` name / `cat.*.name` / `list.*.name` / `sent.*.name` | `sentence` |
| `libraryModules` `description` | `sentence` |
| `libraryModules` `list.*.item.*.desc` | `lowercase` |
| `libraryModules` `sent.*.text` | `sentence` |

**Rationale for the phrase/sentence asymmetry:** a phrase is a tappable *fragment* (lowercase); a sentence is a complete *utterance* (Sentence case). This is the fragment-vs-complete distinction from the style guide, made visible in case.

---

## Task 1: The `normalizeCasing` pure utility + Vitest harness

**Files:**
- Create: `convex/lib/normalizeCasing.ts`
- Create: `convex/lib/normalizeCasing.test.ts`
- Modify: `package.json` (add `vitest` dev dep + `test` script)
- Create: `vitest.config.ts`

**Interfaces:**
- Produces:
  - `type CasingType = "lowercase" | "sentence"`
  - `normalizeCasing(text: string, opts: { type: CasingType; lang: string; properNouns?: string[] }): string`
  - `normalizeRecord(record: Record<string, string>, opts: { type: CasingType }): Record<string, string>`
  - `normalizeMaybeLocalised(value: string | Record<string, string> | undefined, type: CasingType): string | Record<string, string> | undefined`

- [ ] **Step 1: Add Vitest to the project**

Run:
```bash
npm install -D vitest
```

- [ ] **Step 2: Add the test script to `package.json`**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["convex/**/*.test.ts", "lib/**/*.test.ts"],
    environment: "node",
  },
});
```

- [ ] **Step 4: Write the failing test**

Create `convex/lib/normalizeCasing.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import {
  normalizeCasing,
  normalizeRecord,
  normalizeMaybeLocalised,
} from "./normalizeCasing";

describe("normalizeCasing — lowercase bucket", () => {
  it("lowercases a phrase-style fragment", () => {
    expect(normalizeCasing("Quiero Ir", { type: "lowercase", lang: "es" })).toBe("quiero ir");
  });
  it("lowercases a sentence-cased list item", () => {
    expect(normalizeCasing("Ponte los zapatos", { type: "lowercase", lang: "es" })).toBe("ponte los zapatos");
  });
  it("preserves the English pronoun I", () => {
    expect(normalizeCasing("I want to go", { type: "lowercase", lang: "en" })).toBe("I want to go");
  });
  it("does NOT capitalize a lone i in non-English", () => {
    expect(normalizeCasing("si i no", { type: "lowercase", lang: "es" })).toBe("si i no");
  });
  it("keeps allowlisted proper nouns capitalized", () => {
    expect(
      normalizeCasing("me gusta la navidad", { type: "lowercase", lang: "es", properNouns: ["Navidad"] })
    ).toBe("me gusta la Navidad");
  });
});

describe("normalizeCasing — sentence bucket", () => {
  it("capitalizes the first word only", () => {
    expect(normalizeCasing("de paseo", { type: "sentence", lang: "es" })).toBe("De paseo");
  });
  it("keeps the pronoun I and the sentence capital", () => {
    expect(normalizeCasing("this is my book", { type: "sentence", lang: "en" })).toBe("This is my book");
  });
  it("keeps proper nouns capital mid-sentence", () => {
    expect(
      normalizeCasing("this is my navidad book", { type: "sentence", lang: "en", properNouns: ["Navidad"] })
    ).toBe("This is my Navidad book");
  });
  it("skips a leading inverted question mark when capitalizing", () => {
    expect(normalizeCasing("¿a qué hora es?", { type: "sentence", lang: "es" })).toBe("¿A qué hora es?");
  });
});

describe("normalizeCasing — caseless scripts", () => {
  it("leaves Hindi unchanged (lowercase)", () => {
    expect(normalizeCasing("मुझे जाना है", { type: "lowercase", lang: "hi" })).toBe("मुझे जाना है");
  });
  it("leaves Hindi unchanged (sentence)", () => {
    expect(normalizeCasing("खाना कितने बजे है", { type: "sentence", lang: "hi" })).toBe("खाना कितने बजे है");
  });
});

describe("normalizeRecord", () => {
  it("normalizes each language by its own key", () => {
    expect(
      normalizeRecord({ en: "I Want To Go", es: "Quiero Ir", hi: "मुझे जाना है" }, { type: "lowercase" })
    ).toEqual({ en: "I want to go", es: "quiero ir", hi: "मुझे जाना है" });
  });
});

describe("normalizeMaybeLocalised", () => {
  it("treats a legacy plain string as English", () => {
    expect(normalizeMaybeLocalised("Wash Your Hands", "lowercase")).toBe("wash your hands");
  });
  it("normalizes a record", () => {
    expect(normalizeMaybeLocalised({ es: "Lávate Las Manos" }, "lowercase")).toEqual({ es: "lávate las manos" });
  });
  it("passes undefined through", () => {
    expect(normalizeMaybeLocalised(undefined, "lowercase")).toBeUndefined();
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './normalizeCasing'`.

- [ ] **Step 6: Write the implementation**

Create `convex/lib/normalizeCasing.ts`:
```typescript
/**
 * Deterministic casing normalizer — enforces the two-bucket casing rule from
 * docs/4-builds/translation-style-guide.md §1. Applied on every content save and
 * to MT output, so casing is consistent regardless of author or LLM.
 *
 * PURE: no Convex/runtime imports, unit-tested directly with Vitest.
 */
import { DEFAULT_PROPER_NOUNS } from "./properNouns";

export type CasingType = "lowercase" | "sentence";

// Caseless scripts — Devanagari (hi) / Gurmukhi (pa). Keep in sync with the
// language registry's scriptFamily === "non-latin".
const CASELESS_LANGS = new Set(["hi", "pa"]);

/** Restore allowlisted proper nouns to their canonical cased form. */
function restoreProperNouns(text: string, properNouns: string[]): string {
  let out = text;
  for (const noun of properNouns) {
    // Word-boundary, case-insensitive; supports multi-word entries.
    const re = new RegExp(`\\b${noun.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, noun);
  }
  return out;
}

/** Capitalize the first alphabetic character, skipping leading punctuation (¿ ¡ " ' « ). */
function capitalizeFirst(text: string): string {
  const i = text.search(/\p{L}/u);
  if (i < 0) return text;
  return text.slice(0, i) + text[i].toUpperCase() + text.slice(i + 1);
}

export function normalizeCasing(
  text: string,
  opts: { type: CasingType; lang: string; properNouns?: string[] }
): string {
  if (CASELESS_LANGS.has(opts.lang)) return text;

  const properNouns = opts.properNouns ?? DEFAULT_PROPER_NOUNS[opts.lang] ?? [];

  // 1. Lowercase everything.
  let out = text.toLowerCase();
  // 2. Restore proper nouns.
  out = restoreProperNouns(out, properNouns);
  // 3. Restore the English pronoun "I" (English only).
  if (opts.lang === "en") out = out.replace(/\bi\b/g, "I");
  // 4. Sentence bucket: capitalize the first word.
  if (opts.type === "sentence") out = capitalizeFirst(out);

  return out;
}

export function normalizeRecord(
  record: Record<string, string>,
  opts: { type: CasingType }
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [lang, value] of Object.entries(record)) {
    out[lang] = normalizeCasing(value, { type: opts.type, lang });
  }
  return out;
}

export function normalizeMaybeLocalised(
  value: string | Record<string, string> | undefined,
  type: CasingType
): string | Record<string, string> | undefined {
  if (value === undefined) return undefined;
  // Legacy plain string — English-origin per the Phase 15.5 convention.
  if (typeof value === "string") return normalizeCasing(value, { type, lang: "en" });
  return normalizeRecord(value, { type });
}
```

- [ ] **Step 7: Create the proper-noun allowlist (referenced above)**

Create `convex/lib/properNouns.ts`:
```typescript
/**
 * Per-language proper-noun allowlist for the casing normalizer. Conservative on
 * purpose — only add words that are ALWAYS capitalized and unlikely to collide
 * with a common word. Multi-word entries are supported.
 * Seeded from the content this app ships (festivals, brand). Grow as needed.
 */
export const DEFAULT_PROPER_NOUNS: Record<string, string[]> = {
  en: ["Diwali", "Christmas", "Eid", "Easter", "Mo Speech"],
  es: ["Navidad", "Diwali", "Semana Santa", "Mo Speech"],
  // hi / pa are caseless — no allowlist needed.
};
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `npm test`
Expected: PASS — all cases green.

- [ ] **Step 9: Typecheck Convex**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 10: Commit**

```bash
git add convex/lib/normalizeCasing.ts convex/lib/normalizeCasing.test.ts convex/lib/properNouns.ts vitest.config.ts package.json package-lock.json
git commit -m "feat(i18n): deterministic casing normalizer + Vitest harness"
```

---

## Task 2: Wire into `profilePhrases` mutations

**Files:**
- Modify: `convex/profilePhrases.ts` — `createProfilePhrase` (:98), `updateProfilePhraseName` (:163), `updateProfilePhraseWords` (:167)

**Interfaces:**
- Consumes: `normalizeRecord` from `./lib/normalizeCasing`.

Phrase `name` and word `label`s are both **`lowercase`** (phrases are vocabulary fragments).

- [ ] **Step 1: Import the normalizer**

At the top of `convex/profilePhrases.ts`, add:
```typescript
import { normalizeRecord } from "./lib/normalizeCasing";
```

- [ ] **Step 2: Normalize in `createProfilePhrase`**

In the `ctx.db.insert("profilePhrases", {...})` (`:98`), change:
```typescript
      name:  args.name,
      order: last ? last.order + 1 : 0,
      words: args.words ?? [],
```
to:
```typescript
      name:  normalizeRecord(args.name, { type: "lowercase" }),
      order: last ? last.order + 1 : 0,
      words: (args.words ?? []).map((w) =>
        w.label ? { ...w, label: normalizeRecord(w.label, { type: "lowercase" }) } : w
      ),
```

- [ ] **Step 3: Normalize in `updateProfilePhraseName`**

Change the patch (`:163`):
```typescript
    await ctx.db.patch(args.profilePhraseId, { name: args.name, updatedAt: Date.now() });
```
to:
```typescript
    await ctx.db.patch(args.profilePhraseId, {
      name: normalizeRecord(args.name, { type: "lowercase" }),
      updatedAt: Date.now(),
    });
```

- [ ] **Step 4: Normalize word labels in `updateProfilePhraseWords`**

In `updateProfilePhraseWords`, before the patch that writes `words`, map the labels:
```typescript
    const words = args.words.map((w) =>
      w.label ? { ...w, label: normalizeRecord(w.label, { type: "lowercase" }) } : w
    );
```
and write `words` (the normalized local) in the patch instead of `args.words`.

**Note:** `createPhraseVariant` copies `name`/`words` from an already-normalized source, so it needs no change — the source was normalized on its own save.

- [ ] **Step 5: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add convex/profilePhrases.ts
git commit -m "feat(i18n): normalize casing on profilePhrases saves"
```

---

## Task 3: Wire into `profileSentences` mutations

**Files:**
- Modify: `convex/profileSentences.ts` — `createProfileSentence` (:118), `updateProfileSentenceName` (:228), `updateProfileSentenceSlots` (:242), `updateProfileSentenceUnits` (:268)

**Interfaces:**
- Consumes: `normalizeRecord` from `./lib/normalizeCasing`.

Sentence `name` and `text` are **`sentence`**; inner `units[].label` (and any slot label) are **`lowercase`**.

- [ ] **Step 1: Import the normalizer**

```typescript
import { normalizeRecord } from "./lib/normalizeCasing";
```

- [ ] **Step 2: Normalize `name` (and `text` if present) in `createProfileSentence`**

In the insert, wrap the `name` field:
```typescript
      name: normalizeRecord(args.name, { type: "sentence" }),
```
If the insert also writes a localised `text` record, wrap it the same way with `{ type: "sentence" }`. If `text` is a legacy `string | record`, use `normalizeMaybeLocalised(args.text, "sentence")` (add it to the import).

- [ ] **Step 3: Normalize `units[].label` in `createProfileSentence` and `updateProfileSentenceUnits`**

Where `units` are written, map labels:
```typescript
    const units = args.units?.map((u) =>
      u.kind === "word" && u.label
        ? { ...u, label: normalizeRecord(u.label, { type: "lowercase" }) }
        : u
    );
```
Write the normalized `units` local in the insert/patch. (Match the actual discriminated-union shape in the file; only word-units carry a `label`.)

- [ ] **Step 4: Normalize in `updateProfileSentenceName`**

```typescript
    await ctx.db.patch(args.profileSentenceId, {
      name: normalizeRecord(args.name, { type: "sentence" }),
      updatedAt: Date.now(),
    });
```

- [ ] **Step 5: Normalize labels in `updateProfileSentenceSlots`**

If slots carry a localised `label`, map them with `{ type: "lowercase" }` before the patch, mirroring Step 3. If slots carry no text (image-only), leave unchanged.

- [ ] **Step 6: Typecheck + commit**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json --noEmit`
```bash
git add convex/profileSentences.ts
git commit -m "feat(i18n): normalize casing on profileSentences saves"
```

---

## Task 4: Wire into `profileLists` mutations

**Files:**
- Modify: `convex/profileLists.ts` — `createProfileList` (:71), `updateProfileListName` (:103), `updateProfileListItems` (:118)

**Interfaces:**
- Consumes: `normalizeRecord`, `normalizeMaybeLocalised` from `./lib/normalizeCasing`.

List `name` is **`sentence`**; item `description` (legacy `string | record`) is **`lowercase`**.

- [ ] **Step 1: Import**

```typescript
import { normalizeRecord, normalizeMaybeLocalised } from "./lib/normalizeCasing";
```

- [ ] **Step 2: Normalize `name` in `createProfileList` and `updateProfileListName`**

Wrap each `name` write:
```typescript
      name: normalizeRecord(args.name, { type: "sentence" }),
```

- [ ] **Step 3: Normalize item descriptions in `updateProfileListItems`**

Change the patch (`:194`):
```typescript
    await ctx.db.patch(args.profileListId, { items: args.items, updatedAt: Date.now() });
```
to:
```typescript
    const items = args.items.map((it) => ({
      ...it,
      description: normalizeMaybeLocalised(it.description, "lowercase"),
    }));
    await ctx.db.patch(args.profileListId, { items, updatedAt: Date.now() });
```

- [ ] **Step 4: Normalize descriptions in `createProfileList`**

If `createProfileList` writes items with descriptions, apply the same `.map(...)` as Step 3 before the insert.

- [ ] **Step 5: Typecheck + commit**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json --noEmit`
```bash
git add convex/profileLists.ts
git commit -m "feat(i18n): normalize casing on profileLists saves"
```

---

## Task 5: Wire into `profileFolders` + `profileCategories` mutations

**Files:**
- Modify: `convex/profileFolders.ts` — `createFolder` (:54), `renameFolder` (:85), `updateFolderMeta` (:106)
- Modify: `convex/profileCategories.ts` — `createProfileCategory` (:300), `updateCategoryMeta` (:378)

**Interfaces:**
- Consumes: `normalizeRecord` from `./lib/normalizeCasing`.

Folder and category `name`s are titles → **`sentence`**.

- [ ] **Step 1: Import in both files**

```typescript
import { normalizeRecord } from "./lib/normalizeCasing";
```

- [ ] **Step 2: Wrap every `name` write with `normalizeRecord(name, { type: "sentence" })`**

In `createFolder`, `renameFolder`, `updateFolderMeta` (only where `name` is set), `createProfileCategory`, `updateCategoryMeta` — replace `name: args.name` (or the local) with `name: normalizeRecord(args.name, { type: "sentence" })`. Leave non-name fields (icon, colour, order) untouched.

- [ ] **Step 3: Typecheck + commit**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json --noEmit`
```bash
git add convex/profileFolders.ts convex/profileCategories.ts
git commit -m "feat(i18n): normalize casing on folder + category names"
```

---

## Task 6: Wire into the MT write path (`applyModuleTranslation`)

**Files:**
- Modify: `convex/contentModules/translate.ts` — `applyModuleTranslation` (:46)

**Interfaces:**
- Consumes: `normalizeCasing`, `normalizeMaybeLocalised` from `../lib/normalizeCasing`.

This is where LLM output lands in `libraryModules`. Each translated value is written back into a typed slot (the `collectSlots` keys: `name`, `description`, `cat.*.name`, `list.*.name`, `list.*.item.*.desc`, `sent.*.name`, `sent.*.text`). Normalize each **by its slot type** per the Content-type map before persisting. Because Convex is the source of truth for the defaults, this keeps the seeded defaults clean without trusting Gemini's casing.

- [ ] **Step 1: Read `applyModuleTranslation` fully**

Run: `sed -n '46,140p' convex/contentModules/translate.ts` — understand how translated values are merged back into the module row (the slot-key → value application).

- [ ] **Step 2: Add a slot-key → CasingType helper**

At the top of the file (after imports), add:
```typescript
import { normalizeCasing } from "../lib/normalizeCasing";
import type { CasingType } from "../lib/normalizeCasing";

/** Map a collectSlots key to its casing bucket (style guide §2). */
function casingForSlot(slotKey: string): CasingType {
  if (slotKey.endsWith("item.desc") || /\.item\.\d+\.desc$/.test(slotKey)) return "lowercase";
  // names, descriptions, and sentence text are all read-as-language → sentence.
  return "sentence";
}
```
(Adjust the `item.desc` match to the exact key format produced by `collectSlots` — confirm against `translate-modules/route.ts:77-117`.)

- [ ] **Step 3: Normalize each translated value before writing**

At the point where a translated string is applied to its slot, wrap it:
```typescript
    const normalized = normalizeCasing(translatedValue, {
      type: casingForSlot(slotKey),
      lang: targetCode,
    });
```
and write `normalized` into the slot instead of the raw LLM value.

- [ ] **Step 4: Typecheck**

Run: `source ~/.nvm/nvm.sh && nvm use 20.17.0 && npx tsc -p convex/tsconfig.json --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add convex/contentModules/translate.ts
git commit -m "feat(i18n): normalize casing on module-translation output"
```

---

## Task 7: In-app verification

**Files:** none (verification only).

This project verifies via the running app, not integration tests. Confirm the normalizer works end-to-end on the authoring surface.

- [ ] **Step 1: Ensure the dev server + Convex are running**

The user keeps `npm run dev` (port 3001) and `npx convex dev` running on `main`. Do not start them. Confirm the latest Convex functions are pushed (auto-push on save).

- [ ] **Step 2: Author a list item in Title Case, save, confirm it stores lowercase**

In the app, edit a list item description to `"Ponte Los Zapatos"` (es board). Save. Reload. Expected: it displays and stores as `ponte los zapatos`.

- [ ] **Step 3: Author a list/folder name in lowercase, confirm Sentence case**

Rename a folder to `"going places"`. Save. Expected: stores/displays as `Going places`.

- [ ] **Step 4: Confirm the English "I" survives**

Author a phrase name `"I WANT TO GO"` (en). Expected: `I want to go` (lowercase bucket, but "I" preserved).

- [ ] **Step 5: Confirm Hindi is untouched**

Author/translate a Hindi name. Expected: Devanagari unchanged, no spurious transformation.

- [ ] **Step 6: Confirm a proper noun survives**

Author an es item `"me gusta la navidad"`. Expected: `me gusta la Navidad`.

- [ ] **Step 7: Confirm via a screenshot / read_page and report**

Capture the before/after and confirm each case. If any fails, fix the normalizer (Task 1) and re-run `npm test`, then re-verify.

- [ ] **Step 8: Final commit (if any verification-driven fixes were made)**

```bash
git add -A
git commit -m "fix(i18n): casing normalizer verification adjustments"
```

---

## Out of scope (explicit follow-ons)

- **The full MT-prompt rework** (style guide §8): passing content-type + language identity into the Gemini prompt, injecting the glossary, adopting the symbol pipeline's `scriptFamily` register examples. This plan makes casing deterministic so casing can be *stripped* from the prompt; the semantic prompt improvements are a separate phase.
- **Admin `libraryModules` English-authoring mutations** (`convex/contentModules/*.ts` create/update). This plan covers MT output into modules (Task 6) and all per-account content. If admins hand-author English module copy in inconsistent casing, wire those create/update mutations the same way — mechanical, same helper.
- **Client-side pre-normalization** (normalizing input as the user types). Not needed — normalize-on-save at the mutation is the single source of truth. Add only if live-preview casing is desired.
- **Deriving `CASELESS_LANGS` from the registry `scriptFamily`** instead of the hardcoded set. Zero-drift nicety; do it if a new caseless language is added.

## Self-review notes

- **Spec coverage:** normalizer util (Task 1) + all content save paths (Tasks 2–5) + MT output (Task 6) + verification (Task 7) cover the style-guide §1 normalization principle end-to-end. Proper-noun + "I" exceptions handled in Task 1. Caseless scripts handled in Task 1.
- **Type consistency:** `normalizeCasing` / `normalizeRecord` / `normalizeMaybeLocalised` signatures are defined in Task 1 and consumed unchanged in Tasks 2–6.
- **Known imprecision to confirm at execution:** the exact `units`/`slots` label shape (Task 3 Steps 3/5) and the `collectSlots` key format (Task 6 Step 2) must be read from the actual files before editing — the plan flags both. The wiring pattern is identical regardless of the exact shape.
