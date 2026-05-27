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
| `docs/1-inbox/ideas/20-profile-lock-and-pin.md` | Profile lock edge case + proposed PIN-as-sudo confirmation gate |
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

## Convex Billing
- **Plan**: Starter (Free + pay-as-you-go overage). $0 base.
- **Region**: EU (`eu-west-1`, Ireland) — confirmed via URL `*.eu-west-1.convex.cloud`.
- **Spending limits**: $10/mo warning · $20/mo disable.
- **Why Starter not Pro**: Pro is $25/mo but on EU the included limits don't apply — every byte is billed at plan rate + 30% surcharge. So Pro EU costs $25 + everything-on-demand. Starter EU = Free tier limits apply, overage at +30%. Strictly cheaper for our scale.
- **Free-tier limits** (Starter): 1M function calls · 0.5 GB storage · 1 GB DB I/O · 1 GB egress · 20 GB-hours action compute · 40 deployments / month.
- **Overage rates** (Starter EU, with +30%): function calls $2.86/M · DB I/O $0.286/GB · egress $0.172/GB · storage $0.286/GB-mo.
- **Watch list before considering Pro**: daily backups (compliance), log streaming, custom domains, email support. Re-evaluate when MVP-2.0 + Home combined hit ~80% of Free monthly, or when first real customer pays. Probably also worth a US-region prod deployment at that point to dodge the surcharge.

## Backups
Convex Pro ships automated daily backups; on Starter we roll our own. Two layers:

- **Full deployment snapshot** (disaster recovery, gitignored):
  ```bash
  npx convex export --path backups/<date>-<label>.zip
  ```
  Run before any risky operation (schema migrations, multi-language translation runs, mass mutations). Local-only; the `backups/` dir is gitignored. Restore via `npx convex import --replace <zip>`.

- **Symbols-table milestone snapshot** (committed to git):
  ```bash
  node --env-file=.env.local scripts/backup-symbols.mjs "<label>"
  ```
  Writes `convex/data/symbols_backups/<YYYY_MM_DD>_<label>.jsonl` (one symbol per line, sorted by `_id` for stable git diffs) + a small `.meta.json` sidecar. Commit both. After Phase 8.2 each language run produces an irreplaceable AI-translation diff — these snapshots capture it in repo history. Backed by `convex/symbols.ts:dumpSymbolsPage`.

Node version: the Convex CLI requires Node 20+. If you have multiple Node versions via nvm, prefix backup commands with `source ~/.nvm/nvm.sh && nvm use 20.17.0`.

## Pricing Tiers: free / pro / max
(Template says "business" — this build uses "max" throughout)

## Critical Rules
1. **Never hard-code UI copy** — all text must come from `useTranslations`; add every key to `en.json` (real English) and `hi.json` (`"English value (hi)"` as a placeholder until a translator replaces it)
2. **Schema first** — define all Convex tables before building any UI
3. **Read `docs/4-builds/decisions/`** before proposing architecture changes
4. Auth: Clerk JWT → `ConvexProviderWithClerk`. Admin role via `publicMetadata: { role: "admin" }`
5. **Always use AAC theme tokens** — never hard-code colours, spacing, radii, or font sizes in AAC UI. This project uses **Tailwind CSS 4** — there is no `tailwind.config.ts`. All `--theme-*` CSS variables are declared in `:root` in `app/globals.css` and mapped to Tailwind utilities via the `@theme inline` block in the same file. Use `bg-theme-*`, `text-theme-*`, `rounded-theme` / `rounded-theme-sm`, `p-theme-*`, `gap-theme-*` etc. `ThemeContext` overwrites the CSS vars at runtime per student profile — any hard-coded value will break theme switching.
6. **Components live in `app/components/{domain}/{type}/`** — domain is `app`, `marketing`, or `admin`; type is `sections` (page-level compositions), `ui` (reusable atoms), or `modals` (dialogs); `page.tsx` files must be thin and import only from these folders.

## Reference Repos (working auth + payments)
- Template: `/Users/mohanveraitch/Projects/mo-starter`
- MVP: `/Users/mohanveraitch/Projects/Mo_Speech/_code/mo-speech-mvp-2.0`

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

<!-- convex-ai-end -->
