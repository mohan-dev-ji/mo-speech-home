# Get Started

Step-by-step setup for a new project from this template. Work through these in order — each step depends on the previous.

---

## Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- A Clerk account (clerk.com)
- A Convex account (convex.dev)
- A Stripe account (stripe.com)
- Stripe CLI installed (`brew install stripe/stripe-cli/stripe`)

---

## Step 1 — Clone and install

```bash
git clone <your-repo-url> my-project
cd my-project
pnpm install
```

Copy the env example:
```bash
cp .env.local.example .env.local
```

---

## Step 2 — Clerk setup

1. Create a new application in [Clerk Dashboard](https://dashboard.clerk.com)
2. Choose your sign-in methods (email + password recommended for starters)
3. Copy **Publishable Key** → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
4. Copy **Secret Key** → `CLERK_SECRET_KEY`

**JWT Template (critical — easy to miss):**

5. In Clerk Dashboard → Configure → Sesions → **JWT Templates** → Add new template → choose **Convex** preset
6. Copy the **Issuer** URL shown (looks like `https://alert-shrew-70.clerk.accounts.dev`) → `CLERK_JWT_ISSUER_DOMAIN`

> **Gotcha:** JWT templates are per-environment. If your app uses the Development Clerk instance (it does during local dev), create the JWT template in the **Development** environment. When you deploy to production, create it again in the **Production** environment with the production issuer URL.

**Admin role:**

To grant admin access to a user:
1. Clerk Dashboard → Users → select user → Metadata tab
2. Set **Public metadata**: `{ "role": "admin" }`

**Expose metadata to the session token (required for admin routes):**

3. Clerk Dashboard → Configure → Sessions → **Customize session token**
4. Add the following claim and save:
```json
{ "metadata": "{{user.public_metadata}}" }
```
5. Sign out and back in — the middleware reads this claim to protect `/admin`

> Without this, `sessionClaims.metadata` is always `undefined` and the admin check will always redirect to `/dashboard` even with the correct public metadata set.

---

## Step 3 — Convex setup

```bash
npx convex dev
```

This will:
- Prompt you to log in / create a project
- Use cloud dev deployment
- Say N to the AI files prompt. This injects the same convex skills into every AI tool's config folder on your machine — .agents, .claude, .codebuddy, .commandcode etc
- Deploy your schema and functions
- Output `NEXT_PUBLIC_CONVEX_URL` → copy to `.env.local`
- Warn if `CLERK_JWT_ISSUER_DOMAIN` is not set in Convex env vars

**Set Convex environment variable:**
```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://your-issuer.clerk.accounts.dev
```

**Create a deploy key:**

The deploy key lets server-side API routes (account deletion, webhooks) query Convex without a user JWT.

1. Convex Dashboard → your project → **Settings** → **Deploy Key**
2. Copy the key → `CONVEX_DEPLOY_KEY` in `.env.local`

Leave `npx convex dev` running in a terminal throughout development.

---

## Step 4 — Stripe products

1. In Stripe Dashboard → Create a New Account → Product catalog → Add product

Create these products (or adapt to your pricing):

| Product | Price | Billing | Env var |
|---|---|---|---|
| Pro | e.g. $12/mo | Monthly recurring | `STRIPE_PRO_MONTHLY_PRICE_ID` |
| Pro | e.g. $99/yr | Yearly recurring | `STRIPE_PRO_YEARLY_PRICE_ID` |
| Business | e.g. $49/mo | Monthly recurring | `STRIPE_BUSINESS_MONTHLY_PRICE_ID` |
| Business | e.g. $399/yr | Yearly recurring | `STRIPE_BUSINESS_YEARLY_PRICE_ID` |

Copy each **Price ID** (starts with `price_`) → `.env.local`

2. Copy **Secret Key** → `STRIPE_SECRET_KEY`
3. Copy **Publishable Key** → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

---

## Step 5 — Stripe webhook (local dev)

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the **webhook signing secret** (starts with `whsec_`) → `STRIPE_WEBHOOK_SECRET`

Leave this running alongside `npx convex dev`.

> **Gotcha:** Changes to API route files (e.g. `app/api/stripe/webhook/route.ts`) are not always picked up by Turbopack's hot reload. If webhook behaviour seems stale, restart `pnpm dev`.

**For production:** In Stripe Dashboard → Webhooks → Add endpoint
- URL: `https://yourdomain.com/api/stripe/webhook`
- Events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- Copy the signing secret → production env vars

---

## Step 6 — Cloudflare R2 (optional)

Skip this if your project doesn't need file storage. The app works without it.

If you need it:
1. Cloudflare Dashboard → R2 → Create bucket
2. Create R2 API token with Object Read & Write
3. Fill in `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

Assets are served via `GET /api/assets?key=filename` — authenticated, 302 redirect. Never use a public bucket for licensed or user content.

---

## Step 7 — Finish `.env.local`

Your `.env.local` should now have all required vars filled in. Double-check:

```bash
# Should print your Convex URL (not empty)
grep NEXT_PUBLIC_CONVEX_URL .env.local

# Should print your Clerk publishable key
grep NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY .env.local
```

`lib/env.ts` validates all required vars at startup — if anything is missing it will throw with a clear message.

---

## Step 8 — Run

```bash
pnpm dev
```

In separate terminals (or tmux panes):
```bash
npx convex dev
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Visit `http://localhost:3000`. Sign up → check Convex dashboard → user should appear in the `users` table.

---

## Step 9 — Test the payment flow

1. Go to `/pricing` → click Upgrade
2. Use Stripe test card: `4242 4242 4242 4242`, any future date, any CVC
3. Complete checkout → you should be redirected to `/dashboard`
4. Stripe webhook fires → Convex user subscription updates in real time
5. `/dashboard` subscription card should now show Pro or Business

---

## Step 10 — Deploy

### Vercel (recommended)
```bash
npx vercel
```

Set all env vars in Vercel dashboard. Remember to create a new Clerk JWT template for the Production environment with the production issuer URL.

### Environment checklist before go-live
- [ ] `CLERK_JWT_ISSUER_DOMAIN` set to **production** Clerk issuer URL in both Vercel and Convex
- [ ] Stripe webhook endpoint added in Stripe Dashboard (not CLI)
- [ ] `NEXT_PUBLIC_APP_URL` set to your production domain
- [ ] R2 bucket CORS configured if serving assets in-browser

---

## Rate limiting (production)

This template does not include rate limiting. For production, add [Upstash Rate Limit](https://upstash.com/docs/redis/sdks/ratelimit/overview) to the Stripe checkout route and any other mutation endpoints. Takes ~15 minutes to add.
