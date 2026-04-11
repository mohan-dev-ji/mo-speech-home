# Mo Speech Home — Claude Code Controller

## What This Is
Full AAC (Augmentative and Alternative Communication) platform for families. Fresh build on the mo-starter template, which derives from the working Mo Speech MVP.

## Read Before Building
All product design, feature specs, and build plans are in `docs/`:

| File | Purpose |
|---|---|
| `docs/1-inbox/ideas/00-build-plan.md` | **Start here** — phased build plan |
| `docs/1-inbox/ideas/00-overview.md` | Product vision, account model, doc index |
| `docs/1-inbox/ideas/12-convex-schema.md` | Full schema across all 3 Convex projects |
| `docs/1-inbox/ideas/` | All feature concepts — numbered 01–17 |
| `docs/3-design/screens/` | Figma screen exports by feature |
| `docs/3-design/design-systems/` | Design system reference image and Tokenised themes |
| `docs/4-builds/decisions/` | ADRs — read before changing architecture |
| `docs/4-builds/features/` | Feature specs — write one before building |

## Stack
- Next.js 16 / React 19 / TypeScript / Tailwind CSS 4
- Clerk v7 · Convex 1.x · Stripe v19 · Cloudflare R2 · next-intl v4

## Three Convex Projects
- `mo-speech-home` → `NEXT_PUBLIC_CONVEX_URL` — main app backend
- `mo-speech-identity` → `NEXT_PUBLIC_CONVEX_IDENTITY_URL` — shared child identity
- `mo-speech-school` → stub only, not built yet

## Pricing Tiers: free / pro / max
(Template says "business" — this build uses "max" throughout)

## Critical Rules
1. **Never hard-code UI copy** — all text must come from `useTranslations`; add every key to `en.json` (real English) and `hi.json` (`"English value (hi)"` as a placeholder until a translator replaces it)
2. **Schema first** — define all Convex tables before building any UI
3. **Read `docs/4-builds/decisions/`** before proposing architecture changes
4. Auth: Clerk JWT → `ConvexProviderWithClerk`. Admin role via `publicMetadata: { role: "admin" }`
5. **Always** use tailwind design tokens for all elements in frontend. Color palette, spacing, roundness and font. `tailwind.config.ts`
6. **Components live in `app/components/{domain}/{type}/`** — domain is `app`, `marketing`, or `admin`; type is `sections` (page-level compositions), `ui` (reusable atoms), or `modals` (dialogs); `page.tsx` files must be thin and import only from these folders.

## Reference Repos (working auth + payments)
- Template: `/Users/mohanveraitch/Projects/mo-starter`
- MVP: `/Users/mohanveraitch/Projects/Mo_Speech/_code/mo-speech-mvp-2.0`

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

<!-- convex-ai-end -->
