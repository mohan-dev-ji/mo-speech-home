# ADR-011 — Plugin Architecture for Content Modules

Date: 2026-05-23
Status: Proposed

---

## Context

Three distinct content surfaces in Mo Speech share more shape than they share differences:

- **Resource packs** — JSON catalogues of categories / lists / sentences. Shipped per-deploy. Visible per a runtime lifecycle overlay (publish window, tier override, featured flag, season, tags). Per [ADR-010](./ADR-010-pack-storage-shift.md).
- **Themes** — colour and surface tokens defining the visual identity of the app. Currently six flat themes hard-coded in `ThemeContext`. Slated to become first-class user-loadable artifacts with the same lifecycle as packs.
- **Languages** — UI translations + symbol translations + voice configuration. Architecturally laid out in [ADR-009](./ADR-009-multi-language-multi-voice-architecture.md) as a registry + per-locale data, but the runtime-publication / admin-CMS / tier-gating shape was left open.

Without a shared principle these three surfaces tend to acquire their own data shapes, their own admin UIs, their own visibility rules, and their own bugs. With a shared principle, adding a fourth plugin type (phonics packs, key-stage curricula, AAC-grid presets — none of which exist yet) becomes a recipe rather than a project.

The principle is already proven in production: ADR-010 moved packs to JSON-with-overlay successfully. This ADR generalises it, applies it explicitly to themes (introducing a normative design system) and languages (introducing tier-based slots), and reserves the pattern for future plugin types.

**Looser by intent.** Each plugin type's content shape is genuinely different — themes don't need `season`, languages don't need `featured`. This ADR captures the shape of the pattern and the *required* mechanics; per-plugin fields can flex.

---

## Decision

### 1. The general plugin pattern

Every content module in Mo Speech follows this shape:

```
convex/data/<plugin_type>/
  _index.ts        ← typed barrel; named exports per module
  <slug-a>.json    ← module content; the source of truth
  <slug-b>.json
  …

convex/schema.ts:
  <pluginType>Lifecycle table:
    slug: string (indexed)
    publishedAt?: number
    expiresAt?: number
    featured?: boolean       (omit if not meaningful for the plugin)
    tierOverride?: tier      (omit if tier doesn't apply)
    seasonOverride?: string  (omit if season doesn't apply)
    notes?: string
    createdBy: string
    updatedAt: number
    …plus any plugin-specific lifecycle fields
```

**Visibility rule (universal):** a module is visible iff (a) its JSON file exists in the bundled catalogue AND (b) a lifecycle row exists for the slug AND (c) `publishedAt <= now` AND (d) `expiresAt` is unset or in the future.

**Convex API contract (universal):** every plugin type exposes the same three admin-gated functions:

- `listAll<Type>ForAdmin` — every module joined with its lifecycle row, regardless of publish window. Used by the admin section table.
- `update<Type>Lifecycle({ slug, ...patch })` — one consolidated mutation; `null` clears a field, `undefined` leaves it alone.
- `delete<Type>Lifecycle({ slug })` — removes the lifecycle row. The JSON file in the repo is untouched.

**Admin UI contract:** every plugin gets a sidebar entry in `/admin` that follows the Library section's shape — filterable table, per-row dropdown actions, edit modal, delete confirmation. The components live in `app/components/admin/sections/<Type>AdminTable.tsx` etc. Per-row actions stay consistent: Publish now · Unpublish · Toggle featured (when applicable) · Edit lifecycle · Remove from library.

**Authoring path:** content lives in the repo. Editing a module = edit the JSON file, commit, deploy. Lifecycle changes (publish / unpublish / feature / expire) = admin dashboard click, deploy-free.

The ADR-010 pack-publish API route (write-back-to-JSON via local dev) is the prototype; future plugin types can reuse the same shape when authoring-in-the-app makes sense.

### 2. Themes — normative design system

Themes are the next plugin to formalise after packs. The current `ThemeContext` ships six flat themes hard-coded; this ADR makes themes pluggable with a deliberate, principled shape.

**Principle: every theme is a background + optional texture + universal greys + accent.**

A theme is composed of four layers:

- **Background layer** — the dominant visual identity. Can be a flat colour, gradient, tiled image, looping animation, or background image. The background's overall lightness implicitly sets the theme's mode (dark or light); the rest of the system inherits.
- **Texture layer (optional)** — a black-and-white image (grain, paper, fabric weave, frosted noise, organic pattern) applied with a CSS blend mode to introduce depth and optical complexity without changing the underlying colour. Sits between the background and surfaces. Common modes: `overlay`, `soft-light`, `multiply`, `screen`. Opacity dials the effect from "barely there" to "richly tactile." Specifically valuable for glassmorphic surfaces — texture is what stops glass looking sterile and makes it feel like *something*. Themes can omit this layer entirely; minimalist themes typically will.
- **Surface layer** — cards, bars, modals, popovers. These are universally one of: pure white, pure black, or a small palette of greys, modulated per-surface by `opacity` and `backdrop-blur` to achieve glassmorphic or solid effects. Themes do NOT each define their own card colour; surfaces are derived from the background mode. When the texture layer is present, it shows through surface translucency — that's where glassmorphism earns its name.
- **Accent layer** — a single primary accent colour used sparingly for highlights, CTAs, focus rings, and selected states. This is the existing Tailwind-500-equivalent token, repurposed from "dominant chrome" to "highlight only."

This shifts where personality lives. Today's themes (`sky`, `amber`, `rose`, etc.) achieve identity through dominant accent colour. The new shape achieves identity through dominant **background** with the accent stepped back. The result: themes can be visually dramatic (animated starfield, glassmorphic tiles over photography) while the UI remains legible and consistent across every theme.

**Theme JSON shape (illustrative — fields can flex):**

```jsonc
{
  "slug": "midnight-glass",
  "name": { "en": "Midnight Glass", "hi": "..." },
  "mode": "dark",                              // derived from bg lightness; explicit for clarity
  "background": {
    "kind": "gradient" | "flat" | "image" | "tiled" | "animation",
    "value": "linear-gradient(...)" | "#hex" | "/r2/path.jpg" | "{animation-id}"
  },
  "texture": {                                  // optional — omit entirely for clean / minimalist themes
    "imagePath": "themes/midnight-glass/grain.png",  // black-and-white image in R2
    "blendMode": "overlay",                      // CSS mix-blend-mode / background-blend-mode
    "opacity": 0.12                              // typical range 0.05–0.3
  },
  "accent": "#5b8def",                          // single accent; used for CTAs, focus, selection
  "surface": {
    "base": "white" | "black" | "#hex",         // card / modal base; defaults from mode
    "opacity": 0.08,                            // typically 0.04–0.15 for glassmorphic, 0.95+ for solid
    "blur": 12                                  // backdrop-blur in px; 0 for non-glass
  },
  "typography": { "displayFont": "...", "bodyFont": "..." },   // optional per-theme override
  "coverImagePath": "themes/midnight-glass/cover.jpg",
  "defaultTier": "free" | "premium" | "max"
}
```

**Lifecycle overlay (`themeLifecycle` table):** same shape as `packLifecycle` minus `season` (themes can be seasonal but the field can ride on `notes` until seasonal themes prove themselves), plus all the standard fields.

**Admin authoring surface:** `/admin/themes/<slug>` is a dedicated page (not just the modal pattern Library uses) because themes benefit from a **sticky live preview** at the top of the viewport while the settings scroll below. The admin sees their changes applied to a representative mini-app render in real time — Talker bar, a symbol card, a list item, a modal — as they tune background, texture, accent, surface opacity, and blur. The texture-blend-mode dropdown in particular benefits from live preview because the same B&W image looks dramatically different under `overlay` vs `soft-light` vs `multiply`.

**User-uploaded themes:** out of scope for V1 of this ADR. The admin-side authoring tooling is the prototype; if user-uploaded themes are ever requested with sufficient demand, the same authoring UI can be exposed to Max-tier users with a moderation queue routing to the admin Themes section before publication. Captured in Future hooks below.

**Tier gating:** `defaultTier` defaults to `free`. Premium themes use tile / animation backgrounds and are gated to paid tiers via the `tierOverride` lifecycle field — same mechanic as packs.

### 3. Languages — plugin shape + tier-based slots

The technical architecture of multi-language Mo Speech is settled by [ADR-009](./ADR-009-multi-language-multi-voice-architecture.md): registry as source of truth, ISO-keyed open record schema, voice-first R2 paths, status enum, translation-on-content-switch flow, transliterations for non-Latin scripts. This ADR does NOT replace any of that. It adds the **plugin-shape decisions** ADR-009 left open: how languages get published, who controls publication, and how user access tiers see them.

**Plugin shape:**

- Each language is a self-contained JSON module at `convex/data/languages/<code>.json`. Bundles: the translation strings (analog of `messages/<code>.json`), transliteration metadata, font reference, voice ID list, status (`stable` / `beta` / `machine-translated` per ADR-009).
- The runtime registry described in ADR-009 §1 is rebuilt from these JSON modules at deploy time. The hard-coded `lib/languages/registry.ts` becomes a thin barrel that imports the JSONs and assembles the registry array.
- Lifecycle overlay (`languageLifecycle` table): `publishedAt`, `expiresAt`, `tierOverride` (rare), `notes`, `status` (mirroring ADR-009 §3, but as a lifecycle-row field so it can change without a deploy).

**Tier-based language access (boolean, not a slot counter):**

> **Amended 2026-06-03.** The original design here was a slot *counter* (Free=1, Pro=2, Max=3) with a swap-replacement flow. That is **superseded** by a single boolean entitlement. Rationale below.

Multilingual is one entitlement, not a count. The system always exposes every published language; what a tier controls is simply whether a user can run **more than one**.

| Plan | Languages |
|---|---|
| Free | **1** — chosen at sign-up; changeable, but only one active at a time |
| Pro | **All** — every published language, switchable at will |
| Max | **All** — same language access as Pro; Max differentiates on *other* axes (extra voices, AI-translate-your-own-content, full pack library), not on language count |

**Why a boolean, not the 1/2/3 counter.** ADR-009 §5 establishes the multilingual case is ~95% bilingual, with trilingual "vanishingly small." A 2-vs-3 distinction therefore spends the Pro→Max upgrade lever on an almost-empty segment while charging real UX cost — a "slots" concept users must learn plus a swap-replacement flow. The only meaningful line is **"one language vs more than one,"** which a boolean captures cleanly. Two consequences worth stating:

- **The free tier is monolingual-*complete*, not crippled** — a non-verbal child can fully communicate in their one language. Free isn't a teaser.
- **The second language sits at Pro, not Max.** For a diaspora/bilingual household (Hindi at home, English at school) the second language is closer to an *accessibility need* than a luxury, so it belongs at the affordable tier, not the premium one. Gating a disabled child's home language behind the top plan would be both off-mission and a growth-suppressant in exactly the international segment multilingual exists to serve.

**How it surfaces.** A Free user picks their one language at sign-up. A Pro/Max user sees every language toggle in profile settings, free to switch and test at will. The natural multi-language pattern is **one student profile per language** (Hindi for one child, English for another), though switching within a single profile is also supported. Switching a profile's language is **non-destructive**: content created in one language stays put and offers the inline "Translate to <current language>" action (ADR-009 §6), so testing across languages never loses data. (If PostHog `language_switched` data later shows real demand for capping or for a count-based lever, this can revisit — but the default is the simple boolean.)

**Voice bundle:** each language ships with 4 default voices selected in the profile modal under language selection — adult male, adult female, child male, child female. These map to voice IDs in the registry per ADR-009 §4. Additional voices beyond the four are post-launch additions and don't require a language JSON change — the registry's `voices` array is editable independently.

**Admin dashboard as creation touch point:** the admin Languages section is the canonical place to:

- Input translations (bulk-paste from CSV, per-key inline, or trigger AI generation per ADR-009 §3)
- Trigger seed pipelines (symbol-table translation, default-list translation, default-sentence translation, marketing-site copy translation)
- Publish / edit / update / unpublish a language
- Promote a language between `machine-translated` → `beta` → `stable`
- Inspect translation status (X% of UI keys, Y% of 52k symbols, Z% of default packs translated)

The publish action writes the JSON module to disk via the same local-dev API route pattern as ADR-010's pack publish. A code deploy is required to ship a new language to production; the lifecycle overlay handles publish window / expiry without a deploy thereafter.

**AI translation for user-generated content:** ADR-009 §6 already establishes the show-and-flag pattern (display in source language with "no translation" indicator, inline "Translate to <current language>" action). This ADR adds the tier gate: the AI-translate action is available on **Pro and Max** tiers only. Free-tier users see the indicator but the translate CTA opens an upgrade nudge — same `clicked_upgrade` event pattern as the rest of the free-tier gating in ADR-010 / Phase 6.

### 4. Future plugin types

Once a fourth content surface arrives (phonics curricula, key-stage packs, AAC-grid templates, regional vocabulary packs), it inherits the same shape:

1. JSON files at `convex/data/<type>/*.json`
2. Lifecycle overlay table `<type>Lifecycle`
3. Three admin-gated Convex functions (`listAll`, `updateLifecycle`, `deleteLifecycle`)
4. Admin section page following the Library pattern (or a custom page like Themes if a live preview is justified)
5. Per-plugin tier gating via `tierOverride` if relevant; otherwise omit the field

The first three plugin types (packs, themes, languages) collectively prove the pattern. Future plugin specs should reference this ADR rather than re-deriving the shape.

### 5. What does NOT belong as a plugin

Some surfaces look pluggable but aren't, and this distinction prevents the pattern from being overgeneralised.

- **Student profile state** (stateFlags, recently-used data, modelling history) — account-scoped behavioural data, not catalogue content. Lives on `studentProfiles`, not in JSON.
- **Instructor preferences** (UI locale, grid size, label visibility) — same: account-scoped state, not catalogue.
- **Pricing tier definitions** — internal billing config, not a plugin. Lives in code (`SUBSCRIPTION_PLAN_IDS` etc.).
- **Symbol images** — bulk asset library, not modular. Lives flat in R2 per ADR-009 §7.
- **Modelling sessions** — ephemeral per-instructor state, not catalogue content.

The litmus test: *if it's user-facing browseable catalogue content with a publish lifecycle, it's a plugin. If it's account-scoped behavioural data or internal config, it isn't.*

---

## Consequences

- **Adding a new plugin type becomes a recipe**, not an architecture project. The Library / Themes / Languages admin sections are templates; new sections clone the shape.
- **Themes ship with a normative design language**: background-led identity, universal greys for surfaces, accent as highlight only. Existing six themes (`default`, `sky`, `amber`, `fuchsia`, `lime`, `rose`) get reshaped to fit the new principle during Phase 9 — they're currently accent-dominant, which is the inverse.
- **Languages get a clean admin home**: the dashboard becomes the language-creation tool, not just a metadata CMS.
- **Tier-based language slots are now a documented decision** (Free=1, Pro=2, Max=3) — implementers should NOT exceed these defaults without a follow-up ADR.
- **Translation gates for user-generated content** are tier-gated identically to other Pro+ features (consistent UX with category authoring, modelling, etc.).
- **The Library admin section is the canonical template**. Departures (e.g., the Themes dedicated page with sticky preview) are documented exceptions, not defaults.
- **Future plugin types inherit free** — phonics packs would land in ~1 day given the shape is already proven.

---

## Out of scope

- **User-uploaded themes** — V1 admin authoring only. Captured in Future hooks below.
- **User-uploaded languages** — never. Languages are a curated, registry-controlled catalogue with native-speaker QA per ADR-009 §3.
- **Plugin marketplace / cross-account sharing** — out of V1 scope across all plugin types.
- **Cross-plugin dependencies** (e.g., a pack that requires a specific theme to render correctly) — not modelled. If they emerge as real, that's a follow-up ADR.
- **Plugin versioning beyond git history** — same stance as ADR-010 §"Out of scope".
- **Auto-publishing on JSON edit** — explicit publish via admin remains the contract.
- **Prod-side authoring via GitHub API** — captured in ADR-010 Future hooks; not built now.

---

## Future hooks

Captured here so the V1 design doesn't preclude them.

### User-uploaded themes (Phase 9.3 of build plan)

When user demand justifies it, the admin-side authoring tooling for themes becomes available to Max-tier instructors. Their saved themes write to `themeLifecycle` with `createdBy: <instructorClerkId>` and remain private to that account until they submit for inclusion in the library. The Themes admin section gains a "Pending submissions" filter; admins review, edit if needed, and publish via the standard lifecycle flow.

### Plugin marketplace surface

If multiple plugin types accumulate community contributions (themes, regional vocab packs, language community translations), the `/library` page generalises from "Resource packs" to "Library" with sub-tabs per plugin type. The data shape is already there — only the marketing-side UI changes.

### Per-plugin analytics dashboards in PostHog

Each plugin type's lifecycle events (`<type>_published`, `<type>_loaded`, `<type>_unloaded`, `<type>_changed`) follow the same naming convention. PostHog dashboards become a search-and-replace exercise across plugin types. The `theme_changed` / `language_switched` / `pack_loaded` events shipped in Phase 7.5 are the first applications.

---

## References

- [ADR-008](./ADR-008-admin-role-and-view-modes.md) — admin role and view modes; the role gate that this ADR's admin sections inherit.
- [ADR-009](./ADR-009-multi-language-multi-voice-architecture.md) — multi-language registry, schema, voices, R2 paths, transliterations. ADR-011 builds on this without replacing any of it.
- [ADR-010](./ADR-010-pack-storage-shift.md) — the proof-of-concept for the pattern this ADR generalises. Pack lifecycle table, JSON-as-source-of-truth, local-dev publish API route.
- [`docs/1-inbox/ideas/00-build-plan.md`](../../1-inbox/ideas/00-build-plan.md) — Phases 8 (Languages plugin refactor) and 9 (Themes as pluggable packs) implement this ADR.
- [`docs/1-inbox/ideas/15-themes.md`](../../1-inbox/ideas/15-themes.md) — original themes spec; the design principles in §2 of this ADR supersede it where they conflict.
- [`docs/1-inbox/ideas/21-product-analytics-posthog.md`](../../1-inbox/ideas/21-product-analytics-posthog.md) — PostHog event-shape discipline that keeps the analytics layer plugin-compatible (plugin dimensions are open strings, not literal unions).
