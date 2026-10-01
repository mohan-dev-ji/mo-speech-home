# Phase 41: Device lock with a PIN (MOS-82)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to work through this plan task by task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

Milestone: Final straight · **M5 Hardening**. Ticket:
[MOS-82](https://linear.app/mo-intelligence/issue/MOS-82). The approved design is
[`phase-41-device-lock-SPEC.md`](phase-41-device-lock-SPEC.md). **Read the spec first.** This
plan implements it and doesn't repeat its reasoning.

**Goal:** an adult locks a child's device to student view on chosen profiles. The lock survives
refresh, new tabs, restarts and typed addresses, and only a family adult's PIN unlocks it.

**Architecture:** Convex holds the truth. A `lockedDevices` row is keyed by a random device ID,
and each adult's PIN is a salted hash on their `users` row. The browser keeps the device ID in
`localStorage` for Convex calls, and in an **httpOnly cookie** so the Next.js request layer
(`proxy.ts`) can turn a locked device away from instructor-only addresses before they render, and
so the app shell's server layout can start in student view with no flash of instructor view. On the
client, a small `DeviceLockProvider` feeds `ProfileContext`, which forces student view and limits
the profiles while locked.

**Tech stack:** Convex 1.34, Next.js 16.2 (App Router, `proxy.ts`), Clerk 7.5
(`useReverification`, `reverificationErrorResponse`), next-intl 4, Radix Dialog.

## Facts this plan relies on (checked 2026-10-01, with file:line)

- **View mode lives in the tab.** `app/contexts/ProfileContext.tsx:123-155` keeps `viewMode` in
  `sessionStorage` (`mo-view-mode`). It starts as `'instructor'` and hydrates after mount, so a
  new tab paints instructor view first. `ViewMode` (`:60-64`) is not exported.
  `AppStateProvider.tsx:155-158` also reads `mo-view-mode` directly, to skip the instructor locale
  redirect in student view.
- **The active child is stored per user,** on `users.activeProfileId`
  (`convex/studentProfiles.ts` `setActiveProfile`). Two locked devices signed in as the same adult
  would follow each other. So a locked device keeps its own `currentProfileId` on its
  `lockedDevices` row.
- **Providers:** `app/[locale]/(app)/layout.tsx:24` (a server component that already reads the
  `mo-header-mode` cookie) renders `AppProviders`
  (`app/components/app/shared/sections/AppProviders.tsx:33-51`): PostHog → AppState → Theme →
  **Profile** → Talker → … → Toast, then `StudentOnboardingGate`, `InstructorPresenceWatcher`,
  `StudentViewLocaleSync`, `StudentViewRouteGuard`.
- **The switcher** is `app/components/app/shared/ui/BreadcrumbViewModeDropdown.tsx` (270 lines),
  mounted twice by `TopBar.tsx` (`:174` desktop, `:227` mobile drawer). `MenuItem` is at `:184-213`,
  and `ProfileRow` at `:215-270` with the padlock button at `:257-267`. It uses the i18n namespaces
  `studentViewLock` (`messages/en.json:269-278`) and `common`.
- **What student view hides today is driven by per-student flags, not by the lock:**
  - `Sidebar.tsx:46` and `TopBar.tsx:70-72` show the Settings link only if `settings_visible`.
  - `TopBar.tsx:185` shows Quick Settings, which contains **Sign out** (`QuickSettings.tsx:162-174`),
    only if `quick_settings_visible`.
  - Edit affordances depend on `student_can_edit` (`PageBanner.tsx:30-33` and others).
  - `StudentViewRouteGuard.tsx:23-51` is client-only and does nothing on a fresh tab.
- **No server-side guard exists.** `proxy.ts` (97 lines) reads no cookies of its own, redirects
  with `NextResponse.redirect(new URL("<path>", request.url))`, and checks only sign-in and the
  admin role.
- **The resource library is outside the app shell** (`app/[locale]/(public)/library/...`). Its
  navbar has its own **Sign out** (`app/components/marketing/sections/Navbar.tsx:40-45`), and it's
  linked from Home (`app/components/app/home/sections/ResourceLibraryBanner.tsx:26`). `/pricing`
  redirects a signed-in user to `/[locale]/settings?modal=plan`.
- **App routes:** `/[locale]/{home,search,categories,categories/[id],lists,lists/[id],lists/folder/[id],sentences,sentences/folder/[id],settings}`.
  Admin is `/admin/*` (not locale-prefixed).
- **The old lock:** `convex/studentViewLock.ts` (whole file), `convex/studentViewSessions.ts`
  (whole file), `schema.ts:631` (`studentViewLocked`) and `:1445-1455` (`studentViewSessions`),
  `convex/crons.ts:24-34`, `convex/studentProfiles.ts:239-243` and `:489`, `convex/account.ts:122-126`,
  `InstructorPresenceWatcher.tsx`, `app/hooks/useStudentViewPresence.ts`, `AppProviders.tsx:18,43`,
  `app/(admin)/admin/users/[userId]/page.tsx:172-174`.
- **A compile-time guard:** `convex/account.ts:30-70` fails the build unless every table with an
  `accountId` field is listed in `HandledAccountTable` and deleted in `cascadeDeleteAccount`.
- **Settings → Instructor Profile** is `app/components/app/settings/sections/InstructorProfilePanel.tsx`
  (namespace `instructorProfile`), a column of `SettingsSection` cards
  (`app/components/app/settings/ui/SettingsSection.tsx`). Carers see this tab too. Form precedent:
  `AccountBillingPanel.tsx:59-234` (`Input`, `Button`, status text).
- **Dialogs:** `app/components/app/shared/ui/Dialog.tsx` (Radix, z-300, always has a close X).
  The simplest example is `UseOriginalConfirmDialog.tsx`. There is no keypad or code-input
  component.
- **Clerk step-up:** only `AccountBillingPanel.tsx:63` uses `useReverification`, wrapping a Clerk
  SDK call. Nothing server-side uses it. `@clerk/nextjs@7.5.5` exports
  `reverificationErrorResponse`. Clerk's documented pattern is: the route returns
  `reverificationErrorResponse('strict')` unless `has({ reverification: 'strict' })`, and the
  client wraps `fetch(...).then(r => r.json())` in `useReverification`.
- **No Convex code hashes anything yet.** Task 0 confirms `crypto.subtle` works in a mutation.
- **Server-secret pattern:** `convex/lib/serverSecret.ts` (`assertServerSecret`),
  `lib/convexServer.ts` (`serverSecret()`). An authenticated route calling Convex as the user:
  `app/api/delete-account/route.ts:12-26`.
- **Running a function as a user:** `npx convex run <fn> '<args>' --identity '{"subject":"<clerk id>"}'`.

### Decision the spec left open, settled here

**A locked device keeps the student's existing permissions.** The spec says edit mode isn't
reachable on a locked device. But editing in student view is already a per-student permission the
adult sets (`student_can_edit`). So the lock doesn't override it: if the adult allowed that child to
edit, they can still edit when locked. What the lock always removes, whatever the flags say, is
instructor view, admin view, Settings, Sign out and the resource library. **Confirmed by the owner
on 2026-10-01:** the lock respects the "student can edit" setting.

### Test fixtures (dev deployment; check with `npx convex data users` first)

| Name | Convex `users` id | Clerk subject | Notes |
|---|---|---|---|
| Family C (owner) | `j57bvzrhe81eap0b73kk65tdw58fah5x` | `user_3Jzw6rc4xEnze31jmBwKGW9QkYU` | Max, student `kh7082zxvdrb7pe7jkn0kjga7n8faw8c` ("s1") |
| Carer of C | `j571dsrsra33kxkz6hx3jjw5z18fdr54` | `user_3K2r1cfBKvEvZcj1DAd8N3Neib0` | active member of C |
| Account A (a stranger to C) | `j5761rg3dwe3r13bzj0s8j0xhd8fb81b` | `user_3JzdGwXIW79ALFbhhHE8ykSQCFG` | separate family |
| Account B | `j5717je37k1h19ndtjn0bsgc49892p0v` | `user_3FRyegzhjxRy5uokPusWO4wcytY` | **the owner's main account: never write to it** |

`$OWNER`, `$CARER` and `$STRANGER` below are `--identity '{"subject":"<that Clerk subject>"}'`.
Probe device IDs start `phase41-probe-`. Probe PINs: owner `2468`, carer `1357`.

## Global constraints

- Work on `main`. One commit per task (a fix round may add one), `MOS-82` in the subject, and
  every message ends with a blank line and
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. If a commit is refused by a
  permission check, stop and report it.
- NEVER run `npm run dev`, `npx convex dev` or `stripe listen`. The owner runs them (dev server on
  port 3000). `convex dev` auto-pushes `convex/` edits on save, so wait about 10 seconds before
  probing.
- Read `convex/_generated/ai/guidelines.md` before touching `convex/`. Every function has argument
  validators.
- **A wrong PIN must never be reported by throwing.** A thrown mutation rolls back, which would
  undo the failed-attempt counter. PIN checks return a result object.
- **The PIN never leaves the server, and is never logged.** Only the salted hash is stored.
  Nothing returns the hash or salt to a client.
- **The lock is never plan-gated.** Locking and unlocking work on Free.
- **Collaborators keep working.** Family membership is decided through `resolveCallerAccountId` /
  `callerOwnsAccount` (`convex/lib/account.ts`), never by comparing `user._id` directly.
- **Never write to account B.** Write probes use family C, its carer, or `phase41-probe-*` rows,
  and each task leaves C's real data as it found it.
- UI copy: every string through `useTranslations`. New keys go in `messages/en.json` **only**,
  under a new `deviceLock` namespace. Retired keys are deleted from every locale file (`en`, `es`,
  `hi`, `pa`), including the flat copies in `_sourceSnapshot`.
- Theme tokens only in app UI: `bg-theme-*`, `text-theme-*`, `rounded-theme*`, `p-theme-*`,
  `gap-theme-*`. No hard-coded colours, spacing, radii or font sizes.
- Components live in `app/components/app/{domain}/{sections|ui|modals}/`.
- **No test framework; don't add one.** Each task's check is the `--identity` probes written in it
  (red before, green after), `npx tsc --noEmit` and `npx tsc -p convex/tsconfig.json --noEmit`
  (baseline 0 errors), and `npm run lint` (baseline 63 problems: 34 errors, 29 warnings; add none).
  Browser checks are the controller's, in the owner's Chrome with Claude in Chrome.

---

## Task 0: Two checks before anything is built (controller, with the owner)

Nothing here is committed except the notes at the end.

- [ ] **Step 1: Does Clerk offer an email code to a Google-only account?** With the owner signed
  in to the dev app in Chrome on a **Google** sign-in account, open Settings → Account & Billing
  and change something that triggers the existing step-up (`AccountBillingPanel.tsx:63`), or run
  this in the page console:

```js
const s = window.Clerk.session;
const v = await s.startVerification({ level: "first_factor" });
v.supportedFirstFactors.map((f) => f.strategy);
```

  Expected: the list includes `"email_code"`. If it doesn't, the owner enables **Email
  verification code** as a sign-in method in the Clerk dashboard (Development instance), and the
  check is repeated. Record the result. Repeat on a password account: expect `"password"` and
  `"email_code"`.

- [ ] **Step 2: Does `crypto.subtle` work in a Convex mutation?** Add a throwaway internal mutation
  to `convex/migrations.ts`, run it once, then delete it:

```ts
export const phase41CryptoProbe = internalMutation({
  args: {},
  handler: async () => {
    const data = new TextEncoder().encode("probe");
    const digest = await crypto.subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  },
});
```

  `npx convex run migrations:phase41CryptoProbe '{}'` should print
  `4fb0ad08…` (64 hex characters). If it throws, stop: the PIN hash then needs a small pure-JS
  SHA-256 in `convex/lib/`, and Task 1's `hashPin` changes to use it.

- [ ] **Step 3:** Add a `PIN_PEPPER` environment variable to the Convex dev deployment:
  `npx convex env set PIN_PEPPER "$(openssl rand -hex 32)"`. Note in the report that production
  needs its own value at M7.

---

## Task 1: The lock and the PIN on the server

**Files:**
- Modify: `convex/schema.ts` (`users` PIN fields; new `lockedDevices` table)
- Create: `convex/lib/pin.ts`, `convex/pin.ts`, `convex/deviceLock.ts`
- Modify: `convex/account.ts` (`HandledAccountTable` and `cascadeDeleteAccount`)

**Interfaces (later tasks rely on these exact names):**
- `api.pin.getMyPinStatus({})` → `{ hasPin: boolean }` (query)
- `api.pin.setMyPin({ currentPin?: string, newPin: string })` →
  `{ ok: true } | { ok: false, reason: "invalid" | "current_required" | "wrong", waitUntil?: number }` (mutation)
- `api.pin.resetPinFromServer({ serverSecret, clerkUserId, newPin })` → `{ ok: boolean }` (mutation, server-only)
- `api.deviceLock.getDeviceLock({ deviceId })` →
  `null | { sameAccount: boolean, allowedProfileIds: Id<"studentProfiles">[], currentProfileId: Id<"studentProfiles"> | null, waitUntil: number | null }` (query)
- `api.deviceLock.lockDevice({ deviceId, allowedProfileIds, currentProfileId })` →
  `{ ok: true } | { ok: false, reason: "pin_required" | "bad_profiles" | "device_taken" }` (mutation)
- `api.deviceLock.setCurrentProfile({ deviceId, profileId })` → `null` (mutation)
- `api.deviceLock.unlockDevice({ deviceId, pin })` →
  `{ ok: true } | { ok: false, waitUntil: number | null }` (mutation)

- [ ] **Step 1: Schema.** In `convex/schema.ts`, add to the `users` table:

```ts
    // Device-lock PIN (phase-41, MOS-82). Salted hash only; never the PIN.
    pinHash: v.optional(v.string()),
    pinSalt: v.optional(v.string()),
    // Wrong tries when changing the PIN in Settings, and when the next try is allowed.
    pinFailedAttempts: v.optional(v.number()),
    pinNextAttemptAt: v.optional(v.number()),
```

  And a new table, next to `studentProfiles`:

```ts
  /**
   * A device (one browser) locked to student view (phase-41, MOS-82). The lock
   * belongs to the device, not the profile. `deviceId` is a random value the
   * browser keeps; `currentProfileId` is which allowed child it is showing, so
   * two locked devices signed in as the same adult don't follow each other.
   */
  lockedDevices: defineTable({
    accountId: v.id("users"),
    deviceId: v.string(),
    allowedProfileIds: v.array(v.id("studentProfiles")),
    currentProfileId: v.id("studentProfiles"),
    lockedByUserId: v.id("users"),
    lockedAt: v.number(),
    failedAttempts: v.number(),
    nextAttemptAt: v.optional(v.number()),
  })
    .index("by_device_id", ["deviceId"])
    .index("by_account_id", ["accountId"]),
```

- [ ] **Step 2: `convex/lib/pin.ts`.**

```ts
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/** A PIN is exactly four digits. */
export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

/**
 * Salted, peppered SHA-256 of a PIN. The pepper (PIN_PEPPER env var) is not in
 * the database, so a database leak alone can't be brute-forced through the
 * 10,000 possible PINs.
 */
export async function hashPin(pin: string, salt: string): Promise<string> {
  const pepper = process.env.PIN_PEPPER;
  if (!pepper) throw new Error("PIN_PEPPER is not set");
  const data = new TextEncoder().encode(`${pepper}:${salt}:${pin}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** A fresh salt for a user's PIN. Unique per set; it needn't be secret. */
export function newPinSalt(userId: Id<"users">): string {
  return `${userId}:${Date.now()}`;
}

export async function pinMatches(user: Doc<"users">, pin: string): Promise<boolean> {
  if (!user.pinHash || !user.pinSalt) return false;
  return (await hashPin(pin, user.pinSalt)) === user.pinHash;
}

/**
 * How long to wait after the nth wrong try in a row: nothing for the first
 * four, then 30s, 1 min, 5 min, and 15 min from the eighth on.
 */
export function waitMsAfterFailures(failedAttempts: number): number {
  if (failedAttempts < 5) return 0;
  if (failedAttempts === 5) return 30_000;
  if (failedAttempts === 6) return 60_000;
  if (failedAttempts === 7) return 300_000;
  return 900_000;
}

/** The family's adults: the owner plus every active carer who has a users row. */
export async function familyAdults(
  ctx: QueryCtx,
  accountId: Id<"users">,
): Promise<Doc<"users">[]> {
  const adults: Doc<"users">[] = [];
  const owner = await ctx.db.get(accountId);
  if (owner) adults.push(owner);
  const members = await ctx.db
    .query("accountMembers")
    .withIndex("by_account_id_and_status", (q) =>
      q.eq("accountId", accountId).eq("status", "active"))
    .take(50);
  for (const m of members) {
    if (!m.clerkUserId) continue;
    const u = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", m.clerkUserId!))
      .first();
    if (u) adults.push(u);
  }
  return adults;
}
```

- [ ] **Step 3: `convex/pin.ts`.**

```ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { resolveCallerAccountId } from "./lib/account";
import { assertServerSecret } from "./lib/serverSecret";
import { hashPin, isValidPin, newPinSalt, pinMatches, waitMsAfterFailures } from "./lib/pin";

/** Whether the signed-in adult has set a PIN. Never returns the hash. */
export const getMyPinStatus = query({
  args: {},
  handler: async (ctx) => {
    const resolved = await resolveCallerAccountId(ctx);
    return { hasPin: !!resolved?.user.pinHash };
  },
});

/**
 * Set or change the caller's own PIN. Changing needs the current PIN. A wrong
 * current PIN is RETURNED, not thrown, so the failed-attempt count is saved.
 */
export const setMyPin = mutation({
  args: { currentPin: v.optional(v.string()), newPin: v.string() },
  handler: async (ctx, args) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved) throw new Error("Unauthenticated");
    const { user } = resolved;
    if (!isValidPin(args.newPin)) return { ok: false as const, reason: "invalid" as const };

    if (user.pinHash) {
      const now = Date.now();
      if (user.pinNextAttemptAt && user.pinNextAttemptAt > now) {
        return { ok: false as const, reason: "wrong" as const, waitUntil: user.pinNextAttemptAt };
      }
      if (!args.currentPin) return { ok: false as const, reason: "current_required" as const };
      if (!(await pinMatches(user, args.currentPin))) {
        const failed = (user.pinFailedAttempts ?? 0) + 1;
        const wait = waitMsAfterFailures(failed);
        await ctx.db.patch(user._id, {
          pinFailedAttempts: failed,
          pinNextAttemptAt: wait ? now + wait : undefined,
        });
        return { ok: false as const, reason: "wrong" as const, waitUntil: wait ? now + wait : undefined };
      }
    }

    const salt = newPinSalt(user._id);
    await ctx.db.patch(user._id, {
      pinSalt: salt,
      pinHash: await hashPin(args.newPin, salt),
      pinFailedAttempts: undefined,
      pinNextAttemptAt: undefined,
    });
    return { ok: true as const };
  },
});

/**
 * Forgot-PIN reset. Server-only: the Next route calls it after Clerk step-up
 * verification (an emailed one-time code) has passed for this Clerk user.
 */
export const resetPinFromServer = mutation({
  args: { serverSecret: v.string(), clerkUserId: v.string(), newPin: v.string() },
  handler: async (ctx, args) => {
    assertServerSecret(args.serverSecret);
    if (!isValidPin(args.newPin)) return { ok: false };
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", args.clerkUserId))
      .first();
    if (!user) return { ok: false };
    const salt = newPinSalt(user._id);
    await ctx.db.patch(user._id, {
      pinSalt: salt,
      pinHash: await hashPin(args.newPin, salt),
      pinFailedAttempts: undefined,
      pinNextAttemptAt: undefined,
    });
    return { ok: true };
  },
});
```

- [ ] **Step 4: `convex/deviceLock.ts`.**

```ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { callerOwnsAccount, requireCallerAccountId, resolveCallerAccountId } from "./lib/account";
import { familyAdults, isValidPin, pinMatches, waitMsAfterFailures } from "./lib/pin";

const DEVICE_ID = /^[A-Za-z0-9_-]{32,128}$/;

/**
 * Is this device locked? `null` means no. A locked device shows only the
 * allowed profiles that still exist. `sameAccount` is false when whoever is
 * signed in isn't one of the family's adults: the device is still locked, and
 * the client shows the "ask an adult" screen.
 */
export const getDeviceLock = query({
  args: { deviceId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("lockedDevices")
      .withIndex("by_device_id", (q) => q.eq("deviceId", args.deviceId))
      .first();
    if (!row) return null;

    const sameAccount = await callerOwnsAccount(ctx, row.accountId);
    const allowed: Id<"studentProfiles">[] = [];
    for (const id of row.allowedProfileIds) {
      const p = await ctx.db.get(id);
      if (p && p.accountId === row.accountId) allowed.push(id);
    }
    const current = allowed.includes(row.currentProfileId)
      ? row.currentProfileId
      : (allowed[0] ?? null);
    const now = Date.now();
    return {
      sameAccount,
      allowedProfileIds: sameAccount ? allowed : [],
      currentProfileId: sameAccount ? current : null,
      waitUntil: row.nextAttemptAt && row.nextAttemptAt > now ? row.nextAttemptAt : null,
    };
  },
});

/** Lock this device to student view on the chosen profiles. Any family adult with a PIN may. */
export const lockDevice = mutation({
  args: {
    deviceId: v.string(),
    allowedProfileIds: v.array(v.id("studentProfiles")),
    currentProfileId: v.id("studentProfiles"),
  },
  handler: async (ctx, args) => {
    const { accountId, user } = await requireCallerAccountId(ctx);
    if (!DEVICE_ID.test(args.deviceId)) throw new Error("Invalid device id");
    if (!user.pinHash) return { ok: false as const, reason: "pin_required" as const };

    const ids = Array.from(new Set(args.allowedProfileIds));
    if (ids.length === 0 || ids.length > 20 || !ids.includes(args.currentProfileId)) {
      return { ok: false as const, reason: "bad_profiles" as const };
    }
    for (const id of ids) {
      const p = await ctx.db.get(id);
      if (!p || p.accountId !== accountId) return { ok: false as const, reason: "bad_profiles" as const };
    }

    const existing = await ctx.db
      .query("lockedDevices")
      .withIndex("by_device_id", (q) => q.eq("deviceId", args.deviceId))
      .first();
    if (existing && existing.accountId !== accountId) {
      return { ok: false as const, reason: "device_taken" as const };
    }
    const fields = {
      accountId,
      deviceId: args.deviceId,
      allowedProfileIds: ids,
      currentProfileId: args.currentProfileId,
      lockedByUserId: user._id,
      lockedAt: Date.now(),
      failedAttempts: 0,
      nextAttemptAt: undefined,
    };
    if (existing) await ctx.db.replace(existing._id, fields);
    else await ctx.db.insert("lockedDevices", fields);
    return { ok: true as const };
  },
});

/** Switch a locked device between its allowed profiles. No PIN: the child may do this. */
export const setCurrentProfile = mutation({
  args: { deviceId: v.string(), profileId: v.id("studentProfiles") },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("lockedDevices")
      .withIndex("by_device_id", (q) => q.eq("deviceId", args.deviceId))
      .first();
    if (!row || !(await callerOwnsAccount(ctx, row.accountId))) throw new Error("Not authorised");
    if (!row.allowedProfileIds.includes(args.profileId)) throw new Error("Not authorised");
    const profile = await ctx.db.get(args.profileId);
    if (!profile || profile.accountId !== row.accountId) throw new Error("Not authorised");
    await ctx.db.patch(row._id, { currentProfileId: args.profileId });
    return null;
  },
});

/**
 * Unlock THIS device with any family adult's PIN. A wrong PIN is RETURNED, not
 * thrown: throwing would roll back the failed-attempt count and let someone
 * try all 10,000 PINs.
 */
export const unlockDevice = mutation({
  args: { deviceId: v.string(), pin: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const row = await ctx.db
      .query("lockedDevices")
      .withIndex("by_device_id", (q) => q.eq("deviceId", args.deviceId))
      .first();
    if (!row) return { ok: true as const };

    const now = Date.now();
    if (row.nextAttemptAt && row.nextAttemptAt > now) {
      return { ok: false as const, waitUntil: row.nextAttemptAt };
    }

    let matched = false;
    if (isValidPin(args.pin)) {
      for (const adult of await familyAdults(ctx, row.accountId)) {
        if (await pinMatches(adult, args.pin)) { matched = true; break; }
      }
    }
    if (matched) {
      await ctx.db.delete(row._id);
      return { ok: true as const };
    }
    const failed = row.failedAttempts + 1;
    const wait = waitMsAfterFailures(failed);
    await ctx.db.patch(row._id, {
      failedAttempts: failed,
      nextAttemptAt: wait ? now + wait : undefined,
    });
    return { ok: false as const, waitUntil: wait ? now + wait : null };
  },
});
```

  `resolveCallerAccountId` may be unused in this file after writing: remove unused imports so lint
  stays at baseline.

- [ ] **Step 5: Account deletion.** In `convex/account.ts`, add `"lockedDevices"` to the
  `HandledAccountTable` union, and delete the account's rows in `cascadeDeleteAccount` (query
  `by_account_id`, delete each), next to the other account-scoped tables. The backend type check
  fails until this is done.

- [ ] **Step 6: Probes.** After the push. `D=phase41-probe-0000000000000000000000000000`
  (32+ characters), `S1=kh7082zxvdrb7pe7jkn0kjga7n8faw8c`.

```bash
# No PIN yet: locking is refused.
npx convex run deviceLock:lockDevice "{\"deviceId\":\"$D\",\"allowedProfileIds\":[\"$S1\"],\"currentProfileId\":\"$S1\"}" $OWNER
# Set PINs. An invalid PIN is refused.
npx convex run pin:setMyPin '{"newPin":"12a4"}' $OWNER
npx convex run pin:setMyPin '{"newPin":"2468"}' $OWNER
npx convex run pin:setMyPin '{"newPin":"1357"}' $CARER
npx convex run pin:getMyPinStatus '{}' $OWNER
# Changing needs the current PIN.
npx convex run pin:setMyPin '{"newPin":"9999"}' $OWNER
npx convex run pin:setMyPin '{"currentPin":"0000","newPin":"9999"}' $OWNER
# A stranger can't lock onto C's child.
npx convex run deviceLock:lockDevice "{\"deviceId\":\"$D\",\"allowedProfileIds\":[\"$S1\"],\"currentProfileId\":\"$S1\"}" $STRANGER
# The owner locks. The lock is visible to the family, opaque to a stranger.
npx convex run deviceLock:lockDevice "{\"deviceId\":\"$D\",\"allowedProfileIds\":[\"$S1\"],\"currentProfileId\":\"$S1\"}" $OWNER
npx convex run deviceLock:getDeviceLock "{\"deviceId\":\"$D\"}" $CARER
npx convex run deviceLock:getDeviceLock "{\"deviceId\":\"$D\"}" $STRANGER
# Five wrong PINs, then the wait; the right PIN is refused during the wait.
for i in 1 2 3 4 5; do npx convex run deviceLock:unlockDevice "{\"deviceId\":\"$D\",\"pin\":\"0000\"}" $OWNER; done
npx convex run deviceLock:unlockDevice "{\"deviceId\":\"$D\",\"pin\":\"2468\"}" $OWNER
```

  Expected, in order: `pin_required`; `invalid`; `{ ok: true }` twice; `{ hasPin: true }`;
  `current_required`; `wrong`; `pin_required` or `bad_profiles` for the stranger (they have no PIN
  and it isn't their child: either refusal is right); `{ ok: true }`; a result with
  `sameAccount: true` and `allowedProfileIds: [S1]`; a result with `sameAccount: false` and an
  empty `allowedProfileIds`; four `{ ok: false, waitUntil: null }` then one with a `waitUntil`
  about 30 seconds ahead; then `{ ok: false, waitUntil: … }` for the right PIN during the wait.

  Wait 30 seconds, then check that either adult's PIN unlocks:

```bash
npx convex run deviceLock:unlockDevice "{\"deviceId\":\"$D\",\"pin\":\"1357\"}" $OWNER
npx convex run deviceLock:getDeviceLock "{\"deviceId\":\"$D\"}" $OWNER
```

  Expected: `{ ok: true }` (the carer's PIN, entered while the owner is signed in), then `null`.
  Confirm nothing leaks: `npx convex run pin:getMyPinStatus '{}' $OWNER` returns only `hasPin`.
  Leave the two PINs set: later tasks use them. Record in the report that C's owner and carer now
  have probe PINs `2468` and `1357`.

- [ ] **Step 7: Types, lint, commit.** `feat(lock): device lock and PIN on the server (MOS-82)`

---

## Task 2: The cookie and the request-layer guard

**Files:**
- Create: `lib/deviceLock/constants.ts`, `app/api/device-lock/route.ts`
- Modify: `proxy.ts`

**Interfaces:**
- Consumes: `api.deviceLock.getDeviceLock` (Task 1).
- Produces: `DEVICE_LOCK_COOKIE = "mo-device-lock"` and `DEVICE_ID_STORAGE_KEY = "mo-device-id"` in
  `lib/deviceLock/constants.ts`.
- Produces: `GET /api/device-lock` → `{ deviceId: string | null }`;
  `POST /api/device-lock` `{ deviceId }` → `{ ok: boolean }` (sets the cookie only if Convex says
  that device is locked); `DELETE /api/device-lock` → `{ ok: boolean }` (clears the cookie only if
  Convex says it isn't).

- [ ] **Step 1: Constants.** `lib/deviceLock/constants.ts`:

```ts
/** httpOnly cookie holding a locked device's id. The request layer reads it. */
export const DEVICE_LOCK_COOKIE = "mo-device-lock";
/** localStorage key holding the same id, for Convex calls from the client. */
export const DEVICE_ID_STORAGE_KEY = "mo-device-id";
```

- [ ] **Step 2: The route.** `app/api/device-lock/route.ts`. Follow
  `app/api/delete-account/route.ts:12-26` for calling Convex as the signed-in user (a per-request
  `ConvexHttpClient`, `getToken({ template: "convex" })`, `setAuth`).
  - `GET`: return `{ deviceId: cookies().get(DEVICE_LOCK_COOKIE)?.value ?? null }`. Requires a
    signed-in user (401 otherwise).
  - `POST`: read `{ deviceId }`, call `getDeviceLock`. If it returns a row (not `null`), set the
    cookie: `httpOnly: true`, `sameSite: "lax"`, `secure: process.env.NODE_ENV === "production"`,
    `path: "/"`, `maxAge: 60 * 60 * 24 * 365`. Return `{ ok: true }`. If `null`, return
    `{ ok: false }` and set nothing. A device can only be marked locked if the server agrees.
  - `DELETE`: read the cookie. If there's no cookie, return `{ ok: true }`. Otherwise call
    `getDeviceLock` for that ID: if `null`, delete the cookie and return `{ ok: true }`; if still
    locked, return `{ ok: false }` with status 409 and keep the cookie. The cookie can't be cleared
    while the server says locked.

- [ ] **Step 3: The guard in `proxy.ts`.** Inside `clerkMiddleware`, **after** the existing
  signed-in check and **before** the `intl(request)` return, add:

```ts
    // A locked device (phase-41, MOS-82) may only reach the student app.
    // Fail closed: anything not on the allow-list goes back to the student's home.
    if (request.cookies.has(DEVICE_LOCK_COOKIE)) {
      const path = request.nextUrl.pathname;
      if (isLockedBlockedApi(request)) {
        return NextResponse.json({ error: "device_locked" }, { status: 403 });
      }
      if (!path.startsWith("/api/") && !isLockedAllowedPage(request)) {
        const first = path.split("/")[1];
        const locale = (routing.locales as readonly string[]).includes(first)
          ? first
          : (request.cookies.get("NEXT_LOCALE")?.value ?? routing.defaultLocale);
        return NextResponse.redirect(new URL(`/${locale}/home`, request.url));
      }
    }
```

  with these matchers beside the existing ones:

```ts
const isLockedAllowedPage = createRouteMatcher([
  "/",
  `/${LOCALE_GROUP}/home(.*)`,
  `/${LOCALE_GROUP}/search(.*)`,
  `/${LOCALE_GROUP}/categories(.*)`,
  `/${LOCALE_GROUP}/lists(.*)`,
  `/${LOCALE_GROUP}/sentences(.*)`,
  "/sign-in(.*)",
]);

const isLockedBlockedApi = createRouteMatcher([
  "/api/stripe/checkout",
  "/api/stripe/portal",
  "/api/stripe/switch-plan",
  "/api/stripe/cancel",
  "/api/stripe/reactivate",
  "/api/invite",
  "/api/delete-account",
  "/api/admin(.*)",
]);
```

  Import `DEVICE_LOCK_COOKIE` with a relative path (`./lib/deviceLock/constants`), the way
  `proxy.ts` imports its other local modules. Check `routing.defaultLocale` exists in
  `i18n/routing.ts` (use `"en"` if not). `/sign-in` stays
  reachable so that, if the session ends, an adult can sign back in. The device is still locked
  afterwards. The marketing landing (`/[locale]`), `/pricing`, the library, Settings and `/admin`
  are not on the list, so they all redirect.

- [ ] **Step 4: Check.** Both `tsc` runs and lint. The redirect behaviour needs a browser with the
  cookie, so the controller checks it in Task 7. Prove the matcher logic here with a note in the
  report listing, for each of these paths, allowed or redirected: `/en/home`, `/en/settings`,
  `/en/settings?tab=plan`, `/admin`, `/en/library/modules`, `/en/pricing`, `/en`, `/hi/categories/abc`,
  `/sign-in`, `/api/tts`, `/api/stripe/checkout`, `/api/device-lock`, `/api/pin/reset`.

- [ ] **Step 5: Commit.** `feat(lock): device-lock cookie and request-layer guard (MOS-82)`

---

## Task 3: The client knows the device is locked

**Files:**
- Create: `lib/deviceLock/deviceId.ts`, `app/contexts/DeviceLockContext.tsx`
- Modify: `app/[locale]/(app)/layout.tsx`, `app/components/app/shared/sections/AppProviders.tsx`,
  `app/contexts/ProfileContext.tsx`, `app/contexts/AppStateProvider.tsx`

**Interfaces:**
- Consumes: Task 1's `api.deviceLock.*`, Task 2's routes and constants.
- Produces: `useDeviceLock()` from `app/contexts/DeviceLockContext.tsx`:

```ts
type DeviceLockValue = {
  /** "loading" until the first answer; the cookie makes the first paint "locked". */
  status: "loading" | "unlocked" | "locked" | "locked-other";
  allowedProfileIds: Id<"studentProfiles">[];
  currentProfileId: Id<"studentProfiles"> | null;
  waitUntil: number | null;
  lock: (allowed: Id<"studentProfiles">[], current: Id<"studentProfiles">) =>
    Promise<{ ok: true } | { ok: false; reason: "pin_required" | "bad_profiles" | "device_taken" }>;
  unlock: (pin: string) => Promise<{ ok: true } | { ok: false; waitUntil: number | null }>;
  setCurrentProfile: (id: Id<"studentProfiles">) => void;
};
```

  `"locked-other"` means locked, but whoever is signed in isn't one of the family's adults, or no
  allowed profile is left.
- Produces: `ProfileContext` gains `deviceLocked: boolean`. While locked, `viewMode` is always
  `"student-view"`, `allProfiles` holds only the allowed profiles, `studentProfile` is the device's
  current profile, and `setViewMode` does nothing.

- [ ] **Step 1: `lib/deviceLock/deviceId.ts`.**

```ts
import { DEVICE_ID_STORAGE_KEY } from "./constants";

/** This browser's device id, or null if it has never been locked. */
export function readDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  try { return window.localStorage.getItem(DEVICE_ID_STORAGE_KEY); } catch { return null; }
}

/** Create and remember a device id (two UUIDs: 72 characters, unguessable). */
export function createDeviceId(): string {
  const id = `${crypto.randomUUID()}${crypto.randomUUID()}`;
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
  return id;
}

export function writeDeviceId(id: string): void {
  try { window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, id); } catch { /* storage blocked */ }
}
```

  The ID is kept after unlocking. It's only an identifier, and reusing it is harmless.

- [ ] **Step 2: First paint.** In `app/[locale]/(app)/layout.tsx`, read the cookie next to the
  existing `mo-header-mode` read: `const initialDeviceLocked = cookieStore.has(DEVICE_LOCK_COOKIE);`
  and pass `initialDeviceLocked` to `AppProviders`, which passes it to `AppStateProvider` and to the
  new `DeviceLockProvider`.

- [ ] **Step 3: `DeviceLockProvider`** (`app/contexts/DeviceLockContext.tsx`, a client component),
  mounted in `AppProviders` between `ThemeProvider` and `ProfileProvider`:
  - State `deviceId: string | null`, initialised after mount from `readDeviceId()`. If it's `null`
    but `initialDeviceLocked` is true (storage was cleared, the cookie survived), fetch
    `GET /api/device-lock` and `writeDeviceId` the result. This is the fail-closed restore.
  - `const lockRow = useQuery(api.deviceLock.getDeviceLock, convexAuthed && deviceId ? { deviceId } : "skip")`,
    with `convexAuthed` from `useConvexAuth()`.
  - `status`:
    - `"locked"` or `"locked-other"` from `lockRow` when it has loaded (`locked-other` when
      `!lockRow.sameAccount` or `lockRow.currentProfileId === null`)
    - `"unlocked"` when `lockRow === null`, or when there's no device ID and `initialDeviceLocked`
      is false
    - while loading: `"locked"` if `initialDeviceLocked`, otherwise `"loading"`
  - **Keep the cookie in step.** In an effect: when `lockRow` is a row, `POST /api/device-lock`
    with the device ID (idempotent); when `lockRow === null` and `initialDeviceLocked` was true,
    `DELETE /api/device-lock` and then `router.refresh()`. Guard both with a ref, so each runs once
    per change.
  - `lock(allowed, current)`: `const id = readDeviceId() ?? createDeviceId()`, call the
    `lockDevice` mutation, and on `{ ok: true }` `POST /api/device-lock`, then set the device ID
    state.
  - `unlock(pin)`: call `unlockDevice`. On `{ ok: true }`, `DELETE /api/device-lock`, then
    `router.refresh()`.
  - `setCurrentProfile(id)`: call the mutation.
  - No `setState` directly inside an effect body without the existing lint-approved pattern: copy
    how `ProfileContext.tsx:141-147` hydrates from storage, including its eslint comment.

- [ ] **Step 4: `ProfileContext`.**
  - Read `const lock = useDeviceLock();` and `const deviceLocked = lock.status === "locked" || lock.status === "locked-other";`
  - `viewMode`: export the `ViewMode` type. The value given to consumers is
    `deviceLocked ? "student-view" : viewModeState`. `setViewMode` returns early when
    `deviceLocked`.
  - `allProfiles`: when locked, `all.filter((p) => lock.allowedProfileIds.includes(p._id))`.
  - `studentProfile` and `activeProfileId`: when locked, the profile whose `_id` is
    `lock.currentProfileId` (from the unfiltered list), or `null`.
  - `setActiveProfile(id)`: when locked, `lock.setCurrentProfile(id)`. Otherwise as now.
  - Add `deviceLocked` to the context type, the default value and the built value.
  - Everything else that branches on `viewMode` (theme, flags, language, voice) then follows with
    no further change, because it reads the same derived `viewMode`.
  - `stateFlags` in student view come from the student's own flags, so `student_can_edit` keeps
    working when locked. That's the owner's decision: don't override it.

- [ ] **Step 5: `AppStateProvider`.** Its locale-redirect skip (`:155-158`) reads `mo-view-mode`
  from `sessionStorage`. Make it also skip when the new `initialDeviceLocked` prop is true.

- [ ] **Step 6: Check.** Both `tsc` runs and lint. The controller does a quick browser check
  before Task 4 is reviewed. There's no lock button yet, so set it up by hand: in the page
  console run `localStorage.setItem("mo-device-id", "phase41-probe-browser-000000000000000000")`,
  lock that ID with Task 1's `lockDevice` probe as the signed-in adult, and reload twice (the
  first reload sets the cookie). Expected: the page starts in student view with no flash of
  instructor view, `/en/settings` bounces to `/en/home`, and after
  `npx convex run deviceLock:unlockDevice` with the right PIN the page returns to instructor
  view.

- [ ] **Step 7: Commit.** `feat(lock): the client follows the server's device lock (MOS-82)`

---

## Task 4: Locking and unlocking in the switcher

**Files:**
- Create: `app/components/app/shared/ui/PinPad.tsx`,
  `app/components/app/shared/modals/LockDeviceDialog.tsx`,
  `app/components/app/shared/modals/UnlockDeviceDialog.tsx`,
  `app/components/app/shared/sections/DeviceLockedScreen.tsx`
- Modify: `app/components/app/shared/ui/BreadcrumbViewModeDropdown.tsx`,
  `app/components/app/shared/sections/Sidebar.tsx`, `TopBar.tsx`,
  `app/components/app/shared/ui/QuickSettings.tsx`,
  `app/components/app/home/sections/ResourceLibraryBanner.tsx` (or where `HomeContent` renders it),
  `AppProviders.tsx`, `messages/en.json`

**Interfaces:**
- Consumes: `useDeviceLock()` and `useProfile().deviceLocked` (Task 3); `api.pin.getMyPinStatus`
  and `api.pin.setMyPin` (Task 1).
- Produces: `<PinPad value onChange length={4} disabled? />`, a controlled four-digit entry.
  Task 5 reuses it. Produces `<UnlockDeviceDialog open onOpenChange onForgot />`, where `onForgot`
  is wired in Task 5.

- [ ] **Step 1: Copy.** Add a `deviceLock` namespace to `messages/en.json` (English only):

```json
  "deviceLock": {
    "lockThisDevice": "Lock this device",
    "lockDescription": "Keep this device in student view",
    "unlock": "Unlock",
    "unlockDescription": "An adult's PIN is needed",
    "choosePinTitle": "Choose a PIN",
    "choosePinBody": "You'll use this 4-digit PIN to unlock any device you or your family lock.",
    "confirmPinTitle": "Enter it again",
    "pinMismatch": "Those didn't match. Try again.",
    "chooseProfilesTitle": "Which profiles can this device use?",
    "chooseProfilesBody": "The student can switch between the ones you tick.",
    "lockButton": "Lock device",
    "enterPinTitle": "Enter a PIN to unlock",
    "wrongPin": "That PIN isn't right.",
    "waitMessage": "Too many tries. Try again in {time}.",
    "forgotPin": "Forgot PIN?",
    "cancel": "Cancel",
    "next": "Next",
    "lockedOtherTitle": "This device is locked",
    "lockedOtherBody": "Ask an adult to unlock this device.",
    "errorGeneric": "Something went wrong. Please try again."
  }
```

- [ ] **Step 2: `PinPad`.** Four dots showing how many digits are entered, and a 3×4 grid of
  buttons: 1–9, an empty cell, 0, and backspace (the `Delete` icon from `lucide-react`). Each digit
  button is at least 56px square (`min-h-14 min-w-14`), for touch. Props:
  `{ value: string; onChange: (v: string) => void; length?: number; disabled?: boolean }`. It also
  accepts digits and Backspace from a keyboard (a `keydown` listener while mounted). It never
  renders the digits themselves. Tokens only: `bg-theme-surface`, `text-theme-alt-text`,
  `rounded-theme`, `border-theme-line`.

- [ ] **Step 3: `LockDeviceDialog`** (Radix `Dialog` from `shared/ui/Dialog.tsx`). Steps:
  1. If `getMyPinStatus().hasPin` is false: **choose PIN** (PinPad), then **confirm PIN**. If they
     differ, show `pinMismatch` and start again. If they match, call `setMyPin({ newPin })`.
  2. **Choose profiles:** a checkbox list of `useProfile().allProfiles`, with the current one
     ticked. The Lock button is disabled if none are ticked.
  3. **Lock device:** `useDeviceLock().lock(tickedIds, current)`, where `current` is the active
     profile if it's ticked, otherwise the first ticked. On `{ ok: true }` close; the provider
     switches the app to student view. On `pin_required`, go back to step 1. On any other failure,
     show `errorGeneric`.

- [ ] **Step 4: `UnlockDeviceDialog`.** Shows `enterPinTitle` and a `PinPad`. When four digits are
  in, call `useDeviceLock().unlock(pin)`:
  - `{ ok: true }`: close. The provider refreshes into instructor view.
  - `{ ok: false, waitUntil: null }`: clear the pad and show `wrongPin`.
  - `{ ok: false, waitUntil }`: disable the pad and show `waitMessage` with a countdown
    (`m:ss`), re-enabling when it reaches zero. Also start in this state when
    `useDeviceLock().waitUntil` is in the future, so a reload doesn't clear the wait.
  - A **Forgot PIN?** text button calls the `onForgot` prop.

- [ ] **Step 5: The switcher.** In `BreadcrumbViewModeDropdown.tsx`:
  - Remove everything that uses the old lock: the `getStudentViewLockState` queries (in the
    component and in `ProfileRow`), `lockMutation`, `unlockMutation`, the `dropdownDisabled` badge,
    and `ProfileRow`'s padlock button with its `onLock`, `onUnlock`, `lockLabel` and `unlockLabel`
    props. `ProfileRow` becomes a plain selectable row.
  - **When `deviceLocked` is false:** Admin (if admin), Instructor, the profiles as today, then a
    divider and a `MenuItem` **Lock this device** (`lockThisDevice` / `lockDescription`) that
    opens `LockDeviceDialog`. Hide **Lock this device** when `allProfiles.length === 0`.
  - **When `deviceLocked` is true:** only the allowed profiles (`allProfiles` is already filtered),
    then a divider and a `MenuItem` **Unlock** (`unlock` / `unlockDescription`) that opens
    `UnlockDeviceDialog`. No Instructor or Admin rows.
  - Keep using the `studentViewLock` namespace for the four description strings it still needs
    (`instructorDescription`, `adminDescription`, `studentDescription`,
    `studentProfileDescription`). Task 6 retires that namespace's other keys.
  - The dropdown is mounted twice (`TopBar.tsx:174,227`). Render each dialog inside the dropdown
    component, so each instance owns its own.

- [ ] **Step 6: What a locked device never shows.** Read `deviceLocked` from `useProfile()`:
  - `Sidebar.tsx:46` and `TopBar.tsx:70-72`: the Settings link is hidden when `deviceLocked`,
    whatever `settings_visible` says.
  - `QuickSettings.tsx:162-174`: the **Sign out** button isn't rendered when `deviceLocked`.
  - `ResourceLibraryBanner`: not rendered when `deviceLocked` (the library is blocked by the
    request layer anyway).

- [ ] **Step 7: `DeviceLockedScreen`.** Mount it in `AppProviders` beside
  `StudentViewRouteGuard`. When `useDeviceLock().status === "locked-other"`, it covers the app
  (`fixed inset-0 z-[250] bg-theme-background`) with `lockedOtherTitle`, `lockedOtherBody` and an
  **Unlock** button that opens `UnlockDeviceDialog` (dialogs are z-300, so they sit above it).
  Otherwise it renders nothing.

- [ ] **Step 8: Check.** Both `tsc` runs and lint. Then, in the owner's Chrome (controller): lock
  the browser from the switcher with a first-time PIN, switch between two allowed profiles, try a
  wrong PIN, and unlock with the right one.

- [ ] **Step 9: Commit.** `feat(lock): lock and unlock a device from the switcher (MOS-82)`

---

## Task 5: The PIN in Settings, and Forgot PIN

**Files:**
- Create: `app/api/pin/reset/route.ts`,
  `app/components/app/settings/ui/PinSection.tsx`,
  `app/components/app/shared/modals/ForgotPinDialog.tsx`
- Modify: `app/components/app/settings/sections/InstructorProfilePanel.tsx`,
  `app/components/app/shared/modals/UnlockDeviceDialog.tsx` (wire `onForgot`),
  `messages/en.json`

**Interfaces:**
- Consumes: `api.pin.getMyPinStatus`, `api.pin.setMyPin`, `api.pin.resetPinFromServer` (Task 1),
  `PinPad` (Task 4), `serverSecret()` (`lib/convexServer.ts`).
- Produces: `POST /api/pin/reset` `{ newPin }` → `{ ok: boolean }`, or Clerk's reverification
  error response.

- [ ] **Step 1: The route.** `app/api/pin/reset/route.ts`:

```ts
import { auth, reverificationErrorResponse } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { serverSecret } from "@/lib/convexServer";

export const dynamic = "force-dynamic";

/**
 * Forgot PIN (phase-41, MOS-82). The caller must have just passed Clerk's
 * step-up verification (an emailed one-time code, or their password). Only
 * then is their own PIN replaced.
 */
export async function POST(request: Request) {
  const { userId, has } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!has({ reverification: "strict" })) return reverificationErrorResponse("strict");

  let newPin: unknown;
  try { ({ newPin } = await request.json()); } catch { newPin = undefined; }
  if (typeof newPin !== "string" || !/^\d{4}$/.test(newPin)) {
    return NextResponse.json({ ok: false, error: "invalid_pin" }, { status: 400 });
  }
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const result = await convex.mutation(api.pin.resetPinFromServer, {
    serverSecret: serverSecret(),
    clerkUserId: userId,
    newPin,
  });
  return NextResponse.json({ ok: result.ok });
}
```

  `/api/pin/reset` isn't in Task 2's blocked list, so a locked device can reach it.

- [ ] **Step 2: `ForgotPinDialog`.** Two PinPad steps (new PIN, then confirm), then:

```ts
const resetPin = useReverification(async (newPin: string) => {
  const res = await fetch("/api/pin/reset", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ newPin }),
  });
  return await res.json();
});
```

  Calling `resetPin(pin)` makes Clerk show its verification step (the emailed code, per Task 0),
  then retries the request. On `{ ok: true }`, call `onReset(pin)` and close. If the person cancels
  Clerk's step (`isReverificationCancelledError` from `@clerk/nextjs/errors`), close quietly. On
  anything else, show `errorGeneric`. Props: `{ open, onOpenChange, onReset: (pin: string) => void }`.

- [ ] **Step 3: Wire it into unlocking.** In `UnlockDeviceDialog`, **Forgot PIN?** opens
  `ForgotPinDialog`. Its `onReset(pin)` calls `useDeviceLock().unlock(pin)`, so the new PIN unlocks
  this device straight away, as the spec says.

- [ ] **Step 4: `PinSection`** in Settings → Instructor Profile. Add a `SettingsSection` after the
  existing cards (before `UpgradeNudge`), titled `pinTitle`:
  - No PIN yet: body `pinNoneBody` and a **Set a PIN** button, which opens a dialog with two
    PinPad steps and calls `setMyPin({ newPin })`.
  - PIN set: body `pinSetBody`, a **Change PIN** button (three PinPad steps: current, new, confirm,
    then `setMyPin({ currentPin, newPin })`; `wrong` shows `wrongPin`, and a `waitUntil` shows the
    countdown), and a **Forgot PIN?** text button that opens `ForgotPinDialog`.
  - Below, `pinAdvice` in the muted style (`text-theme-s text-theme-secondary-alt-text`).

  Add to `en.json`, in `deviceLock`:

```json
    "pinTitle": "Device lock PIN",
    "pinNoneBody": "Set a 4-digit PIN so you can lock a device to student view and unlock it again.",
    "pinSetBody": "Your PIN unlocks any device you or your family lock.",
    "setPin": "Set a PIN",
    "changePin": "Change PIN",
    "currentPinTitle": "Enter your current PIN",
    "newPinTitle": "Choose a new PIN",
    "pinSaved": "PIN saved.",
    "pinAdvice": "If you forget it, we'll email you a one-time code. Don't keep your own email signed in on a student's device."
```

- [ ] **Step 5: Check.** Both `tsc` runs and lint. Browser (controller): set, change and reset the
  PIN on a password account and on a Google account; reset from the locked device and see it
  unlock.

- [ ] **Step 6: Commit.** `feat(lock): PIN in Settings and Forgot PIN by email code (MOS-82)`

---

## Task 6: Remove the old profile lock

Only after Tasks 4 and 5 are reviewed. Schema removal is two deploys: clear the data, then remove
the fields.

**Files:**
- Delete: `convex/studentViewLock.ts`, `convex/studentViewSessions.ts`,
  `app/components/app/shared/sections/InstructorPresenceWatcher.tsx`,
  `app/hooks/useStudentViewPresence.ts`
- Modify: `convex/schema.ts`, `convex/crons.ts`, `convex/studentProfiles.ts`, `convex/account.ts`,
  `convex/migrations.ts`, `AppProviders.tsx`, `app/(admin)/admin/users/[userId]/page.tsx`,
  `messages/{en,es,hi,pa}.json`

- [ ] **Step 1: Find every reference.**
  `grep -rn "studentViewLocked\|studentViewLock\b\|studentViewSessions\|InstructorPresenceWatcher\|useStudentViewPresence\|lockStudentView\|unlockStudentView\|getStudentViewLockState" app convex lib --include='*.ts' --include='*.tsx' | grep -v _generated`
  Save the list in the report. After this task the only hits allowed are the `studentViewLock`
  i18n namespace's four kept description keys in `BreadcrumbViewModeDropdown.tsx`.

- [ ] **Step 2: Deploy 1, clear the data.** Add to `convex/migrations.ts`:

```ts
/**
 * phase-41 (MOS-82): the profile-wide student-view lock is replaced by the
 * device lock. Unlock every profile and empty the presence table, so the
 * field and the table can be removed. Idempotent.
 * Run: npx convex run migrations:clearOldStudentViewLock
 */
export const clearOldStudentViewLock = internalMutation({
  args: {},
  handler: async (ctx) => {
    let profiles = 0;
    for await (const p of ctx.db.query("studentProfiles")) {
      if (p.studentViewLocked !== undefined) {
        await ctx.db.patch(p._id, { studentViewLocked: undefined });
        profiles++;
      }
    }
    let sessions = 0;
    for await (const s of ctx.db.query("studentViewSessions")) {
      await ctx.db.delete(s._id);
      sessions++;
    }
    return { profiles, sessions };
  },
});
```

  Run it twice. The second run must return `{ profiles: 0, sessions: 0 }`.

- [ ] **Step 3: Remove the client pieces first** (so nothing writes presence rows again): the
  `InstructorPresenceWatcher` import and element in `AppProviders.tsx:18,43`, then delete the
  watcher and the hook files. Remove the "Locked" badge in
  `app/(admin)/admin/users/[userId]/page.tsx:172-174`.

- [ ] **Step 4: Deploy 2, remove the backend.**
  - Delete `convex/studentViewLock.ts` and `convex/studentViewSessions.ts`.
  - `convex/crons.ts:24-34`: remove the "clean up stale student-view sessions" cron.
  - `convex/studentProfiles.ts:239-243`: remove the `studentViewSessions` deletion in
    `deleteStudentProfile`. `:489`: remove `studentViewLocked` from `listProfilesForAccount`.
  - `convex/account.ts:122-126`: remove the presence deletion loop.
  - `convex/schema.ts`: remove `studentViewLocked` (`:631`) and the `studentViewSessions` table
    (`:1438-1455`).
  - Delete `clearOldStudentViewLock` from `convex/migrations.ts` (it can't type-check once the
    field is gone).
  - Re-run the step 1 grep.

- [ ] **Step 5: Copy.** Delete `lockStudentView`, `unlockStudentView`, `toastUnlockedTitle` and
  `toastUnlockedBody` from the `studentViewLock` namespace in `en.json`, `es.json`, `hi.json` and
  `pa.json`, and their flat copies in each `_sourceSnapshot` (`es.json` / `hi.json` around lines
  1090-1097). Keep the four description keys. Check all four files still parse:
  `node -e "for (const l of ['en','es','hi','pa']) JSON.parse(require('fs').readFileSync('messages/'+l+'.json','utf8'))"`

- [ ] **Step 6: Check.** Both `tsc` runs, lint, and `npx convex data studentProfiles --limit 5`
  succeeds (the schema push was accepted).

- [ ] **Step 7: Commit.** `refactor(lock): remove the profile-wide student-view lock (MOS-82)`

---

## Task 7: The test list, docs and close-out (controller)

- [ ] **Clean up probes.** Decide with the owner whether C's owner and carer keep the probe PINs
  (`2468`, `1357`) or reset them. Confirm no `phase41-probe-*` rows remain:
  `npx convex data lockedDevices`.
- [ ] **Run the spec's 20-point test list** (`phase-41-device-lock-SPEC.md`, "Testing") in the
  owner's Chrome, and on a tablet where the owner can. Record each result in a table in the
  changelog. Anything that fails goes back to the task that owns it.
- [ ] **Docs.**
  - A new ADR, the next free number in `docs/4-builds/decisions/`: the device lock (the lock
    belongs to the device; Convex decides, the request layer enforces; each adult has their own
    PIN). Read ADR-008 first: view mode is covered there.
  - FEAT-301 (instructor and student views): rewrite the lock section from the spec.
  - FEAT-106 (Settings → Instructor Profile): the PIN section.
  - `docs/1-inbox/ideas/20-profile-lock-and-pin.md`: status banner → shipped.
  - `docs/01-final-straight.md` M5: a dated note. M7 checklist: `PIN_PEPPER` on the production
    Convex deployment, and the Clerk email-code setting on the production instance.
  - Changelog `docs/4-builds/changelog/YYYY-MM-DD-device-lock.md`.
- [ ] **Close out.** Move this plan and the spec to `docs/4-builds/plans/_done/`, and move MOS-82
  to Done with a comment.
