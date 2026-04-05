# mo-starter

A production-ready SaaS starter template. Clone it, fill in env vars, and ship.

## What's included

**Auth** — Clerk v7 with sign-in, sign-up, protected routes, and admin role via `publicMetadata`. JWT wired directly to Convex for authenticated real-time queries — no API hop.

**Database** — Convex with a `users` table, subscription tracking, and 8 pre-built queries/mutations. Real-time by default via WebSocket.

**Payments** — Full Stripe integration: checkout sessions (monthly + yearly), customer portal, idempotent webhook handler for `customer.subscription.*` events. Three tiers: Free, Pro, Business.

**Storage** — Cloudflare R2 helpers for private asset delivery via authenticated 302 redirect. Optional — the app works without it.

**Admin dashboard** — `/admin` with user stats by tier, user table, and individual user detail with manual access override. Protected by middleware + server component (double guard).

**Design system** — Tailwind 4 design tokens in CSS custom properties. Swap the entire theme by editing one block in `globals.css`. Light/dark mode with localStorage persistence and anti-flash script. Responsive fluid typography via `clamp()`.

**Marketing pages** — `/` (hero + features + CTA) and `/pricing` (3-tier cards + monthly/yearly toggle + comparison table). Swap placeholder copy; don't touch the structure.

**Dashboard shell** — `/dashboard` (account + subscription info), `/billing` (upgrade or portal), `/settings` (profile + theme). Ready to extend with your app's core feature.

---

## Philosophy

**Documentation as context notebook.** The `docs/` folder is structured for AI-assisted development. Ideas, research, designs, decisions, and PRD each live in their own numbered section. Any agent (or new developer) can orient themselves by reading `docs/` before touching code.

**Atomic domain components.** Components are organised by domain (`marketing/`, `dashboard/`, `admin/`) and level (`sections/` for page-level composition, `ui/` for primitives). A marketing `PricingCard` and a dashboard `SubscriptionBadge` never share a folder — they serve different contexts.

**No trial tier.** Free is permanent with limits. This maps cleanly to Stripe: no subscription = free, active subscription = tier based on price ID. No cron jobs, no expiry logic, no gotchas.

**Convex `_creationTime` over `createdAt`.** Every Convex document has `_creationTime` (epoch ms) as a system field. No `createdAt` is needed in any schema.

**Private assets by default.** R2 assets are served via authenticated 302 redirect, not public bucket URLs. This preserves the browser user-gesture chain (important for `audio.play()`) and keeps licensed or user content behind auth.

**Idempotent webhooks.** The Stripe webhook handler checks existing state before writing. Duplicate event delivery from Stripe won't double-write subscription data.

---

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | Stable, widely understood, proven in production |
| Language | TypeScript throughout | No `.jsx` — type safety catches integration bugs early |
| Auth | Clerk v7 | Best-in-class DX, JWT template wires directly to Convex |
| Database | Convex | Real-time WebSocket queries, no ORM, serverless |
| Payments | Stripe v19 | Industry standard, excellent webhook tooling |
| Storage | Cloudflare R2 | S3-compatible, generous free tier, zero egress |
| Styling | Tailwind CSS 4 | Design tokens in CSS, no config file needed |
| Env validation | Zod | Fails at startup with clear errors — no silent misconfigs |

---

## Project structure

```
app/
  (auth)/          Clerk sign-in/sign-up (no nav chrome)
  (marketing)/     Landing + pricing (Navbar + Footer)
  (dashboard)/     App shell (sidebar + topbar)
  (admin)/         Admin area (role-gated)
  api/             stripe/, assets/, health/
  components/
    marketing/     sections/ + ui/
    dashboard/     sections/ + ui/
    admin/         sections/ + ui/
    shared/ui/     Shared primitives
convex/            Schema, auth config, user functions
lib/               Stripe, R2, env validation, utils
types/             Shared TypeScript types
docs/              Context notebook (see docs/*/README.md)
```

---

## Adapting per project

1. Edit `globals.css` `:root` block — swap `--primary` and you're done with branding
2. Replace placeholder copy in `(marketing)/` components
3. Add your core feature under `(dashboard)/dashboard/`
4. Update `convex/schema.ts` with any domain-specific tables
5. Update `PRICE_IDS` in `lib/stripe.ts` with your Stripe price IDs
6. Set `NEXT_PUBLIC_APP_NAME` and update `app/layout.tsx` metadata

See `GET-STARTED.md` for the full setup walkthrough.
