# Language and Internationalisation

## The Strategic Opportunity

The AAC market is almost entirely English-first. No serious AAC platform has been built with Hindi, Punjabi, Bengali, or Arabic as first-class languages. That is a genuine gap serving hundreds of millions of people. Mo Speech is architected before the build starts — language support is designed in at zero extra cost now rather than retrofitted later.

**Core rule: no component ever hard-codes `"eng"`. Every query accepts a `language` param.**

---

## Launch Languages

- **English** — primary; fully implemented in MVP
- **Hindi (Devanagari script)** — second language at launch

**Why Hindi:**
- Founder has personal and community connection
- Large South Asian population in the founder's area and son's school
- Getting Devanagari right proves the architecture for Bengali, Marathi, Nepali, and others that share the same script
- Hindi is the fourth most spoken language globally
- No existing AAC platform treats Hindi as a first-class language

**Future languages (community-led):**
- Punjabi (Gurmukhi script — different font, same data architecture)
- Spanish (Latin script — trivial font change, needs native-speaker QA)
- Arabic (RTL layout — significant extra work but enormous AAC-underserved population)
- Bengali, Tamil, Urdu — same pattern

---

## Two Options — Decision Pending

Both options are supported by the architecture. The decision can be made after English + Hindi launch.

### Option A — Symbol Content Only

Language changes symbol labels and audio only. App UI (nav labels, buttons, modals) stays in English.

- No i18n framework needed
- Simpler and faster to implement
- Not a fully native experience for non-English-literate instructors

### Option B — Full UI + Symbol Content (Recommended)

Language changes everything — symbol labels, audio, and all app UI text.

- Requires `next-intl` v4
- A Hindi-speaking instructor sees a fully Hindi app
- Builds trust with communities where instructors may not read English comfortably
- No AAC platform is doing this — genuine differentiator
- The marginal cost over Option A is modest once `next-intl` is scaffolded

**Why Option B is the right call for AAC specifically:**
The person setting up the app is often not the student — it is the grandparent, a carer, or a family member who may not read English comfortably. If they cannot navigate the settings, the app fails the student. A fully localised app removes this barrier entirely.

---

## Symbol Schema — Language Fields

The `symbols` table in Convex extends per language:

```typescript
words: { eng: string, hin: string }
audio: { eng: { default: string }, hin: { default: string } }
```

Additional languages add new fields — the schema is open-ended. `studentProfile.language` determines which fields are queried.

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

58,000 symbol labels need a Hindi equivalent. Approach:

1. Bulk translation via Google Cloud Translation API — approximately £8 for all 58k short labels
2. Native Hindi speaker manually reviews and corrects the core 500 vocabulary words (most frequently used; AI translation of short words can be inconsistent)
3. Store as `words.hin` in the Convex symbols table

---

## Symbol Audio (Hindi)

Re-run the existing Google TTS generation script with the `hi-IN` language code and a Hindi Neural2 voice. Same R2 structure, different folder:

```
audio/eng/default/want.mp3
audio/hin/default/want.mp3   ← चाहना
```

---

## Dual-Locale Consideration

In the parent view, the parent's UI can be in English while the child's symbols display in Hindi. UI language comes from `next-intl` (locale). Symbol content language comes from `childProfile.language`. These are separate concerns and can be set independently.

---

## Bilingual Households

One language per student profile at launch. A bilingual family can create two profiles for the same student — one in each language. The architecture supports per-session language switching later as a profile field change — not exposing it in V1 keeps Settings simple.
