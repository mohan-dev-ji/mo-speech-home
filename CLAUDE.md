# mo-starter — Claude Code Controller

## Stack
- Next.js 16 (App Router, TypeScript, `.tsx` throughout)
- Tailwind CSS 4 (tokens via `@theme {}` in `globals.css` — no `tailwind.config.ts`)
- Clerk v7 (`clerkMiddleware` + async `auth()`)
- Convex 1.x (real-time DB + auth via JWT)
- Stripe v19 (checkout, portal, webhooks)
- Cloudflare R2 (optional private asset storage)
- Zod (env validation at startup via `lib/env.ts`)

## Key Directories
```
app/
  (auth)/          sign-in, sign-up — no nav chrome
  (marketing)/     /, /pricing — Navbar + Footer
  (dashboard)/     /dashboard, /billing, /settings — app shell
  (admin)/         /admin, /admin/users — admin only
  api/             stripe/, assets/, health/
  components/
    marketing/     sections/ + ui/ — landing page components
    dashboard/     sections/ + ui/ — app shell components
    admin/         sections/ + ui/ — admin components
    shared/ui/     Button, Card, Badge, Skeleton, ThemeToggle
convex/
  schema.ts        users table definition
  auth.config.ts   Clerk JWT issuer config
  users.ts         all user queries + mutations
lib/
  env.ts           Zod env validation (throws at startup)
  stripe.ts        Stripe singleton + PRICE_IDS
  r2-storage.ts    R2 helpers (optional)
  utils.ts         cn(), formatDate(), formatCurrency()
types/index.ts     SubscriptionTier, SubscriptionStatus, UserRecord
proxy.ts           Route protection via clerkMiddleware (Next.js 16 replaces middleware.ts)
```

## Environment Variables Required
See `.env.local.example` for the full list with comments.
Critical: `CLERK_JWT_ISSUER_DOMAIN` must match the Clerk environment (dev vs prod have different values).

## Auth Pattern
- Client → Convex: `ConvexProviderWithClerk` (JWT, WebSocket)
- Server → Convex: `ConvexHttpClient` with `NEXT_PUBLIC_CONVEX_URL`
- `ctx.auth.getUserIdentity()` in Convex queries — `identity.subject` is the Clerk user ID

## Subscription Model
Three tiers: free / pro / business. No trial.
- `free` status + `free` tier = free plan user
- `active` status + `pro`/`business` tier = paying subscriber
- `cancelled` status = retain access until `subscriptionEndsAt`
- `past_due` status = access suspended

## Admin Access
Set `publicMetadata: { role: "admin" }` on the user in Clerk Dashboard.
Protected by: middleware (primary) + `(admin)/layout.tsx` redirect (defence in depth).

## Setup
See `GET-STARTED.md` for full step-by-step instructions.

<!-- convex-ai-start -->
This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.
<!-- convex-ai-end -->
