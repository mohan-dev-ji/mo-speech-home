# Language and Internationalisation

> **Architectural source of truth:** [ADR-009](../../4-builds/decisions/ADR-009-multi-language-multi-voice-architecture.md) (multi-language + multi-voice), [ADR-011](../../4-builds/decisions/ADR-011-plugin-architecture-for-content-modules.md) (plugin pattern), and the [Phase 8 implementation spec](../../4-builds/features/language-plugin-phase-8.md) supersede the architectural specifics in this doc (schema shape, R2 paths, the "two options" question, etc.). This document is preserved as strategic context — the *why* and the *market opportunity*. The *how* lives in the ADRs.

## The Strategic Opportunity

The AAC market is almost entirely English-first. No serious AAC platform has been built with Hindi, Punjabi, Bengali, or Arabic as first-class languages. That is a genuine gap serving hundreds of millions of people. Mo Speech is architected before the build starts — language support is designed in at zero extra cost now rather than retrofitted later.

**Core rule: no component ever hard-codes `"eng"`. Every query accepts a `language` param.**

---

## Launch Languages

- **English (`en`)** — primary; carried from MVP
- **Hindi (`hi`, Devanagari script)** — second language at launch
- **Punjabi (`pa`, Gurmukhi script)** — third language; shipped as `machine-translated` stub in Phase 8.0 to verify the plugin pattern beyond bilingual; promoted to `beta` after native-speaker review in Phase 8.6. Owner has local translator contacts and reads Gurmukhi for spot-checking.

**Why Hindi:**
- Founder has personal and community connection
- Large South Asian population in the founder's area and son's school
- Getting Devanagari right proves the architecture for Bengali, Marathi, Nepali, and others that share the same script
- Hindi is the fourth most spoken language globally
- No existing AAC platform treats Hindi as a first-class language

**Why Punjabi as third:**
- Non-Latin script forces real font-loading verification (Noto Sans Gurmukhi)
- Owner can spot-check rendered Gurmukhi output
- Regionally cohesive with Hindi — same target user base
- High local-community relevance
- See [ADR-009 §9](../../4-builds/decisions/ADR-009-multi-language-multi-voice-architecture.md) for the Latin-transliteration handling that lets users search by phonetic spelling when they don't have a Gurmukhi keyboard

**Future languages (community-led after Punjabi proves the pipeline):**
- Spanish (Latin script — trivial font change, needs native-speaker QA)
- Arabic (RTL layout — `dir` field already wired through; layout work deferred per ADR-009 §8)
- Bengali, Tamil, Urdu, Korean — same pattern

---

## Scope — Decided: Full UI + Symbol Content

> **Decided.** Option B (full UI + symbol content via `next-intl` v4) is the chosen path. Architecturally specified in ADR-009 and ADR-011. The historical "Option A vs B" framing is preserved below as context.

Language changes everything — symbol labels, audio, and all app UI text. A Hindi- or Punjabi-speaking instructor sees a fully localised app. No AAC platform is doing this — genuine differentiator.

**Why Option B is the right call for AAC specifically:**
The person setting up the app is often not the student — it is the grandparent, a carer, or a family member who may not read English comfortably. If they cannot navigate the settings, the app fails the student. A fully localised app removes this barrier entirely.

**Rejected alternative — symbol content only (Option A):** Language changes symbol labels and audio only; UI stays English. Cheaper to build but fails the carer/grandparent setup case. Not pursued.

---

## Symbol Schema — Language Fields

> Authoritative shape: [ADR-009 §2](../../4-builds/decisions/ADR-009-multi-language-multi-voice-architecture.md). Summarised here.

Bilingual fields are **ISO-keyed open records** (not fixed `{eng, hin}` pairs):

```typescript
words: { [iso: string]: string }       // { en: "dog", hi: "कुत्ता", pa: "ਕੁੱਤਾ" }
synonyms: { [iso: string]: string[] }  // Latin transliterations for non-Latin scripts live here
audio: { [voiceId: string]: boolean }  // voice-keyed; "is voice seeded" — paths convention-resolved, not stored
```

Display resolves via a 3-tier fallback (`displayValue()` helper): `value[currentLang] ?? value[defaultLang] ?? Object.values(value)[0]`. Adding a language is adding a key — no schema migration. ISO 639-1 codes (`en`, `hi`, `pa`) are used consistently across schema, routes, and message files.

---

## next-intl Setup (Option B)

**Install:**
```bash
pnpm add next-intl@latest
```

**Message files — one JSON per language:**
```json
// messages/en.json
{ "nav": { "home": "Home", "search": "Search", "categories": "Categories" } }

// messages/hi.json
{ "nav": { "home": "होम", "search": "खोज", "categories": "श्रेणियाँ" } }
```

**In components:**
```tsx
import { useTranslations } from 'next-intl'

export function BottomNav() {
  const t = useTranslations('nav')
  return <NavItem label={t('home')} />  // "Home" or "होम" automatically
}
```

**Locale source — from studentProfile:**
When a profile is loaded, `studentProfile.language` sets the active locale. The URL prefix updates (`/en/` → `/hi/`) and the entire UI switches. No page reload needed.

**Next.js 16 note:** next-intl middleware must be in `proxy.ts` (not `middleware.ts`) and the exported function must be named `proxy`. See `13-next16-setup.md`.

---

## Font Strategy

No single font covers every script. Load only the font for the active locale via `next/font/google`.

```ts
import { Noto_Sans } from 'next/font/google'             // Latin (English)
import { Noto_Sans_Devanagari } from 'next/font/google'  // Hindi, Marathi, Nepali
import { Noto_Sans_Arabic } from 'next/font/google'       // Arabic (when added — also RTL)
import { Noto_Sans_Bengali } from 'next/font/google'      // Bengali
```

A Hindi user never downloads the Arabic font. Next.js handles per-locale font loading with zero layout shift.

**Special cases:**
- **Arabic / Urdu** — right-to-left. `dir="rtl"` on the html element. Every UI component needs RTL testing. Significant extra work.
- **CJK (Chinese, Japanese, Korean)** — fonts are 5–15MB. Use system font fallback or subset. Extra work but solved problem.

---

## Symbol Label Translation

> Implementation: Phase 8.2 (AI translation pipeline). Spec in [`docs/4-builds/features/language-plugin-phase-8.md`](../../4-builds/features/language-plugin-phase-8.md) §8.2.

~52,000 symbol labels need an equivalent in each new language. Approach:

1. Bulk translation via AI (Anthropic API or Google Cloud Translation) — triggered from the admin Languages section, batched and resumable
2. Native speaker reviews and corrects the core 500 vocabulary words (highest-priority, most frequently used; AI translation of short context-free words can be inconsistent)
3. **Latin transliterations** generated in the same AI pass for non-Latin scripts (Devanagari, Gurmukhi, Hangul, Hanzi) and stored in the `synonyms.<iso>` field — see [ADR-009 §9](../../4-builds/decisions/ADR-009-multi-language-multi-voice-architecture.md). Lets users without a script-native keyboard search phonetically (`kutta` → `कुत्ता`).
4. Stored as `words.<iso>` in the Convex `symbols` table; status tracked per (language, content-type) via `languageLifecycle` row + per-symbol completion percentages surfaced in the admin Languages section.

---

## Symbol Audio (voice-first R2 paths)

> Authoritative shape: [ADR-009 §4](../../4-builds/decisions/ADR-009-multi-language-multi-voice-architecture.md). Phase 8.4 (voice seeding) ships 4 voices per language.

R2 paths are **voice-first**, not language-first — voice IDs (`en-GB-News-M`, `hi-IN-Wavenet-A`) already encode language, so a language prefix would be redundant:

```
audio/<voice>/symbols/<word>.mp3   // per-voice SymbolStix recording
audio/<voice>/tts/<hash>.mp3       // generated TTS, cached
```

The `symbols.audio` field stores `{ [voiceId]: true }` — whether the voice has been seeded — not paths. The resolver builds paths from convention; missing recordings fall through to TTS synthesis via `convex/ttsCache.ts`.

**Legacy `audio/eng/default/` preserved** as a one-line fallback for `en-GB-News-M` until all 52k symbols are re-seeded under the new convention. No bulk R2 rename needed.

Each language ships with 4 default voices (adult M/F, child M/F) at launch. Additional voices are post-launch additions and don't require a language JSON change.

---

## Dual-Locale Consideration

In the parent view, the parent's UI can be in English while the child's symbols display in Hindi. UI language comes from `next-intl` (locale). Symbol content language comes from `childProfile.language`. These are separate concerns and can be set independently.

---

## Bilingual Households — Now Tier-Based Slots

> **Updated by [ADR-011 §3](../../4-builds/decisions/ADR-011-plugin-architecture-for-content-modules.md).** Earlier "one language per profile" stance is superseded. The architecture supports N languages per profile; tier gates how many.

Each student profile has tier-based "language slots":

| Plan | Active language slots |
|---|---|
| Free | 1 |
| Pro  | 2 |
| Max  | 3 |

A user at their slot limit who wants to add another sees the **swap-out flow** — pick which existing language to deactivate. Swapping is non-destructive: per-symbol translations remain in the open-record schema regardless. The cap is on active usage, not on data.

These defaults are deliberately low — 95% of users are bilingual at most, the third slot serves diaspora trilingual families, and anything beyond clutters UX without serving real demand. PostHog `language_switched` events will inform whether Max should expand later (constant change, not a schema change).

---

## Plugin Architecture — Adding a Language Post-Launch

> Full spec: [ADR-011](../../4-builds/decisions/ADR-011-plugin-architecture-for-content-modules.md). Implementation: Phase 8.1 onward.

Adding a language is a recipe, not a project:

1. Admin "Add language" button in `/admin/languages` → enters ISO code + label + native label + font + initial `status: 'machine-translated'`
2. The button writes `convex/data/languages/<code>.json` to disk via a publish API route (cloned from `pack-publish`); a `languageLifecycle` row is inserted
3. Admin triggers translation pipelines from the same section: UI strings (Phase 8.1), symbols (Phase 8.2), default packs (Phase 8.3)
4. Voice seeding (Phase 8.4) — 4 voices via TTS provider
5. Native-speaker review (Phase 8.6) promotes `machine-translated` → `beta` → `stable`

Status gates visibility: `machine-translated` languages are invisible in production pickers (dev-flag toggle for testing); `beta` shows with a "preview" badge; `stable` shows clean. No code edits needed across promotions — pure data and lifecycle changes.
