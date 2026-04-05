# Next.js 16 Setup Notes

## What Changed in Next.js 16

These are the changes that directly affect this project when starting from the Mo Speech MVP template.

---

## 1. middleware.ts → proxy.ts

`middleware.ts` is deprecated in Next.js 16 and renamed to `proxy.ts`. The exported function must also be renamed from `middleware` to `proxy`.

Next.js 16 still accepts `middleware.ts` but logs a deprecation warning. Use `proxy.ts` from the start.

**Run the official codemod first — it handles the rename automatically:**
```bash
npx @next/codemod@canary upgrade latest
```

**Manual change if needed:**
```ts
// proxy.ts (was middleware.ts)
export function proxy(request: NextRequest) {   // was "middleware"
  // same logic as before
}
```

**Configuration flags are also renamed:**
```ts
// next.config.ts
const nextConfig: NextConfig = {
  skipProxyUrlNormalize: true,   // was skipMiddlewareUrlNormalize
}
```

---

## 2. next-intl + proxy.ts

next-intl's middleware must run in `proxy.ts`. When chaining with Clerk:

```ts
// proxy.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

const intlProxy = createMiddleware(routing)
const isPublicRoute = createRouteMatcher(['/', '/en', '/hi', '/sign-in(.*)', '/sign-up(.*)'])

export function proxy(request: NextRequest) {
  if (isPublicRoute(request)) {
    return intlProxy(request)
  }
  return clerkMiddleware()(request, {} as any)
}

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)'
}
```

Check the Clerk + next-intl documentation for the current recommended chaining pattern — both libraries update frequently.

---

## 3. next-intl v4 — NextIntlClientProvider is Required

In next-intl v3, `NextIntlClientProvider` was optional. In v4, any client component calling `useTranslations` requires a provider above it or throws:

```
Error: Failed to call `useTranslations` because the context from `NextIntlClientProvider` was not found.
```

Add it to the root layout:

```tsx
// app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'

export default async function LocaleLayout({ children, params: { locale } }) {
  const messages = await getMessages()
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

---

## 4. `use cache` + next-intl — Do Not Mix

`use cache` (Next.js 16's new caching directive) does not work with `getTranslations()` because `getTranslations()` reads from request headers, and cached components cannot depend on request-time information.

**Rule:** Do not add `"use cache"` to any component that uses `useTranslations` or `getTranslations`. Use Convex subscriptions for data freshness instead of `use cache`.

---

## 5. Async params — Full Removal

In Next.js 16, `params` and `searchParams` in page components must be awaited. Sync access is fully removed.

```ts
// Before (Next.js 14 — breaks in 16)
export default function Page({ params }: { params: { locale: string } }) {
  const { locale } = params
}

// After (Next.js 16)
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
}
```

The codemod handles most of these automatically.

---

## 6. Turbopack is Now Default

Turbopack is the default bundler in Next.js 16 — up to 5–10x faster Fast Refresh. No action needed unless you have custom webpack config in `next.config.ts`. If so, check Turbopack's `resolveAlias` equivalent.

The tilde (`~`) import prefix is not supported by Turbopack. Remove any `~` imports.

---

## 7. Node.js Minimum — 20.9+

Check local Node version and Vercel deployment settings. Must be 20.9 or higher.

```bash
node --version  # must be >= 20.9
```

---

## 8. next lint is Removed

Replace in `package.json`:
```json
// Before
"lint": "next lint"

// After
"lint": "eslint ."
```

---

## 9. Image Cache Default Changed

`images.minimumCacheTTL` default changed from 60 seconds to 4 hours. For most cases this is a better default. If you need the old behaviour:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  images: { minimumCacheTTL: 60 }
}
```

---

## Setup Checklist for This Project

```bash
# 1. Run codemod — handles most breaking changes automatically
npx @next/codemod@canary upgrade latest

# 2. Install next-intl v4
pnpm add next-intl@latest

# 3. Verify Node.js version
node --version   # must be >= 20.9

# 4. Manual steps
# - Rename middleware.ts → proxy.ts (if codemod didn't)
# - Rename exported function to proxy
# - Add NextIntlClientProvider to root layout
# - Create messages/en.json and messages/hi.json with stub keys
# - Update package.json lint script
# - Check next.config.ts for webpack config needing Turbopack equivalent
```
