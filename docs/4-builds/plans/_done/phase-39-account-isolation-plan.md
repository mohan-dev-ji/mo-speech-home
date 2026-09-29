# Phase 39: Account isolation (MOS-92, MOS-90)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to work through this plan task by task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

Milestone: Final straight · **M2 Billing truth**. Tickets:
[MOS-92](https://linear.app/mo-intelligence/issue/MOS-92) (public reads return another account's
data by ID) and [MOS-90](https://linear.app/mo-intelligence/issue/MOS-90) (a pending invite can
be claimed by anyone who knows the invited email). Both came out of phase-38's review sweep, and
both are about children's data. MOS-88 (collaborators use the host's plan) and MOS-93 (plan
switches) are separate plans.

**Goal:** a signed-in person can only read or change their own account's boards and student-view
state, and only the real owner of an email address can accept an invite sent to it.

**Architecture:** one small helper, `callerOwnsAccount`, in `convex/lib/account.ts`. Every by-ID
function resolves the caller's account with the existing `resolveCallerAccountId` (which already
maps a collaborator to the host account) and compares it with the document's `accountId`. A
mismatch returns what "not found" returns today (`null` or `[]`), so a stranger learns nothing,
not even that the ID exists. `users.createUser` stops trusting the Clerk ID and email the browser
sends. It reads them from the signed-in identity, and it activates an invite only when Clerk says
the email is verified. Invite emails are compared in lower case.

**Tech stack:** Convex (queries/mutations, `ctx.auth.getUserIdentity()`), Clerk JWT template
"convex", Next.js client (`AppStateProvider`).

## Facts this plan relies on (checked 2026-09-29)

- **The Clerk "convex" token carries `email` and `email_verified`.** A live token from the dev
  instance decodes to claims including `sub`, `email` and `email_verified: true`. Convex surfaces
  them as `identity.subject`, `identity.email` and `identity.emailVerified`. The **production**
  Clerk instance needs the same template at M7 (add to the MOS-77 inventory).
- **Every `profileCategories`, `profileSymbols` and `profileLists` row has an `accountId`**
  (56 / 2138 / 26 rows, none missing), even though the schema marks it optional. So "no
  `accountId`" can safely mean "not yours".
- **`accountMembers` is empty in this deployment**, so normalising invite emails needs no data
  migration.
- **`npx convex run <fn> '<args>' --identity '<json>'` runs a function as a given user.** That is
  how every task below proves the fix without a browser. Checked: it resolves
  `{"subject":"user_3JzdGwXIW79ALFbhhHE8ykSQCFG"}` to the fresh test account.
- **The bug is real today.** Run as the fresh test account, `getProfileCategory` on a category
  owned by the other account returns the whole row.

### Test fixtures (real rows in the dev deployment)

| Name | Value |
|---|---|
| Fresh test account ("A"), Clerk subject | `user_3JzdGwXIW79ALFbhhHE8ykSQCFG` (users `_id` `j5761rg3dwe3r13bzj0s8j0xhd8fb81b`) |
| Owner account ("B"), Clerk subject | `user_3FRyegzhjxRy5uokPusWO4wcytY` (users `_id` `j5717je37k1h19ndtjn0bsgc49892p0v`) |
| B's category | `js7fnhx9hmj2g3cp14b85e2az58df3da` |
| B's symbol | `k97372j47r6mkkm26776tnsdk58dgzq5` |
| B's list | `k174c49ep0tc3xg5c0qv5k2cwd8d8tzk` |
| B's student profile | `kh79knp2mjw7v4cdecn5aayyps89nb9n` |

In the commands below, `$A` is `'{"subject":"user_3JzdGwXIW79ALFbhhHE8ykSQCFG"}'` and `$B` is
`'{"subject":"user_3FRyegzhjxRy5uokPusWO4wcytY"}'`.

## Global constraints

- Work on `main`. One commit per task, ticket ID in the subject, and every commit message ends
  with a blank line and `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- NEVER run `npm run dev`, `npx convex dev` or `stripe listen`. The owner runs them, and
  `convex dev` auto-pushes `convex/` edits on save. After saving a `convex/` change, wait about
  10 seconds before running a check against the deployment.
- Read `convex/_generated/ai/guidelines.md` before touching `convex/`. Every function keeps
  argument validators.
- **A stranger gets exactly what "not found" gets today.** Queries that return `null` for a
  missing document return `null` for someone else's; list queries return `[]`. No new error
  codes in queries, because the client already handles "not found" and nothing else should leak.
- **Collaborators keep working.** Ownership is always decided through `resolveCallerAccountId`,
  which maps an active collaborator to the host account. Never compare against `user._id`
  directly.
- **Don't change what the owner sees.** For the owner's own IDs, every function returns exactly
  what it returned before.
- **No test framework; don't add one.** Each task's check is the `npx convex run --identity`
  probes written in the task (red before, green after), plus `npx tsc --noEmit` and
  `npx tsc -p convex/tsconfig.json --noEmit` (baseline 0 errors) and `npm run lint` (baseline 63
  problems: 34 errors, 29 warnings; add none).
- Only run probes that **read**, or that **write only rows this plan's own test creates**. Never
  run a probe that would change the owner's real rows.

---

## Task 1: Board reads check ownership (MOS-92, part 1)

**Problem.** Five public queries take a document ID and return it with no account check:

| Function | File | Stranger should get |
|---|---|---|
| `getProfileCategory` | `convex/profileCategories.ts:130` | `null` |
| `getProfileSymbols` | `convex/profileCategories.ts:177` (no callers, but public) | `[]` |
| `getProfileSymbolsWithImages` | `convex/profileCategories.ts:192` | `[]` |
| `getProfileListWithItems` | `convex/profileLists.ts:51` | `null` |
| `getProfileSymbol` | `convex/profileSymbols.ts:57` | `null` |

Their callers (`CategoryDetailContent`, `TalkerDropdown`, `ModellingPickerModal`,
`ListDetailContent`, `ListsModeContent`, `SymbolEditorModal`) all run in a signed-in session and
only ever pass the account's own IDs, student view included (student view is a mode inside the
same Clerk session, not a signed-out route). So nothing legitimate changes.

**Files:**
- Modify: `convex/lib/account.ts` (add the helper)
- Modify: `convex/profileCategories.ts`, `convex/profileLists.ts`, `convex/profileSymbols.ts`

**Interfaces:**
- Produces: `callerOwnsAccount(ctx: QueryCtx, accountId: Id<"users"> | undefined): Promise<boolean>`
  in `convex/lib/account.ts`. It returns true only when the caller is signed in and
  `resolveCallerAccountId(ctx).accountId === accountId`. An `undefined` `accountId` returns
  false. Task 2 uses it too.

- [ ] **Step 1: Red.** Run as account A against B's rows. Each must currently leak data:

```bash
A='{"subject":"user_3JzdGwXIW79ALFbhhHE8ykSQCFG"}'
npx convex run profileCategories:getProfileCategory '{"profileCategoryId":"js7fnhx9hmj2g3cp14b85e2az58df3da"}' --identity "$A" | head -c 120; echo
npx convex run profileCategories:getProfileSymbols '{"profileCategoryId":"js7fnhx9hmj2g3cp14b85e2az58df3da"}' --identity "$A" | head -c 120; echo
npx convex run profileCategories:getProfileSymbolsWithImages '{"profileCategoryId":"js7fnhx9hmj2g3cp14b85e2az58df3da"}' --identity "$A" | head -c 120; echo
npx convex run profileLists:getProfileListWithItems '{"profileListId":"k174c49ep0tc3xg5c0qv5k2cwd8d8tzk"}' --identity "$A" | head -c 120; echo
npx convex run profileSymbols:getProfileSymbol '{"profileSymbolId":"k97372j47r6mkkm26776tnsdk58dgzq5"}' --identity "$A" | head -c 120; echo
```

  Expected: each prints B's data (a JSON object or a non-empty array). Save the output in the
  report.

- [ ] **Step 2: Add the helper** to `convex/lib/account.ts`, below `requireCallerAccountId`:

```ts
/**
 * Whether the signed-in caller's account owns a document with this accountId
 * (MOS-92). Collaborators resolve to the host account, so they own the host's
 * rows. A missing accountId is never owned. Use it in every function that takes
 * a document ID from the client, and return what "not found" returns when it's
 * false, so a stranger learns nothing about the ID.
 */
export async function callerOwnsAccount(
  ctx: QueryCtx,
  accountId: Id<"users"> | undefined,
): Promise<boolean> {
  if (!accountId) return false;
  const resolved = await resolveCallerAccountId(ctx);
  return resolved !== null && resolved.accountId === accountId;
}
```

- [ ] **Step 3: Guard the five queries.** Add `callerOwnsAccount` to each file's existing
  `./lib/account` import.

  `getProfileCategory`:

```ts
  handler: async (ctx, args) => {
    const category = await ctx.db.get(args.profileCategoryId);
    if (!category || !(await callerOwnsAccount(ctx, category.accountId))) return null;
    return category;
  },
```

  `getProfileSymbols` and `getProfileSymbolsWithImages`: make these the first lines of each
  handler, before any query:

```ts
    const category = await ctx.db.get(args.profileCategoryId);
    if (!category || !(await callerOwnsAccount(ctx, category.accountId))) return [];
```

  `getProfileListWithItems`: straight after the existing `const list = await ctx.db.get(...)`,
  change `if (!list) return null;` to:

```ts
    if (!list || !(await callerOwnsAccount(ctx, list.accountId))) return null;
```

  `getProfileSymbol`: straight after `const ps = await ctx.db.get(args.profileSymbolId);`,
  change `if (!ps) return null;` to:

```ts
    if (!ps || !(await callerOwnsAccount(ctx, ps.accountId))) return null;
```

- [ ] **Step 4: Green.** After the push, re-run step 1's five commands. Expected: `null`, `[]`,
  `[]`, `null`, `null`. Then run the same five **as B** (`--identity '{"subject":"user_3FRyegzhjxRy5uokPusWO4wcytY"}'`).
  Expected: B still gets its own data, the same shape as step 1. Then run one as a signed-out
  caller (no `--identity`). Expected: `null` or `[]`.

- [ ] **Step 5: Types and lint.** Both `tsc` runs are clean, and lint shows no new problems.

- [ ] **Step 6: Commit.** `fix(security): board reads only return the caller's own account's rows (MOS-92)`

---

## Task 2: Student-view lock and presence check ownership (MOS-92, part 2)

**Problem.**
- `studentViewLock.getStudentViewLockState` returns any profile's lock state.
- `studentViewSessions.getActiveStudentViewSessions` returns who is viewing any profile, including
  their Clerk user IDs.
- `endStudentViewSession` deletes any presence row whose `sessionId` you send, with no sign-in.
- `heartbeatStudentViewSession` requires sign-in, but writes a presence row against any
  `profileId`, including other accounts' children.

The hook `app/hooks/useStudentViewPresence.ts` only ever ends and heartbeats the session its own
tab created, for the signed-in account's own profile. `InstructorPresenceWatcher` and
`BreadcrumbViewModeDropdown` only read the active profile. So nothing legitimate changes.

**Files:**
- Modify: `convex/studentViewLock.ts`, `convex/studentViewSessions.ts`

**Interfaces:**
- Consumes: `callerOwnsAccount(ctx, accountId)` from Task 1 (`convex/lib/account.ts`).

- [ ] **Step 1: Red** (reads only):

```bash
A='{"subject":"user_3JzdGwXIW79ALFbhhHE8ykSQCFG"}'
npx convex run studentViewLock:getStudentViewLockState '{"profileId":"kh79knp2mjw7v4cdecn5aayyps89nb9n"}' --identity "$A"
npx convex run studentViewSessions:getActiveStudentViewSessions '{"profileId":"kh79knp2mjw7v4cdecn5aayyps89nb9n"}' --identity "$A"
```

  Expected: `{ "locked": false }` (or `true`), and `[]` or a list. The first proves the leak.
  The second leaks too when B has a student view open, but it may be empty now.

  To show the heartbeat and end holes without touching B's rows, create a throwaway session as A
  **on B's profile** and end it signed out:

```bash
npx convex run studentViewSessions:heartbeatStudentViewSession '{"profileId":"kh79knp2mjw7v4cdecn5aayyps89nb9n","sessionId":"phase39-probe"}' --identity "$A"
npx convex run studentViewSessions:getActiveStudentViewSessions '{"profileId":"kh79knp2mjw7v4cdecn5aayyps89nb9n"}' --identity '{"subject":"user_3FRyegzhjxRy5uokPusWO4wcytY"}' | grep -c phase39-probe
npx convex run studentViewSessions:endStudentViewSession '{"sessionId":"phase39-probe"}'
npx convex run studentViewSessions:getActiveStudentViewSessions '{"profileId":"kh79knp2mjw7v4cdecn5aayyps89nb9n"}' --identity '{"subject":"user_3FRyegzhjxRy5uokPusWO4wcytY"}' | grep -c phase39-probe
```

  Expected: the heartbeat succeeds (A wrote presence on B's child's profile), B then sees
  `phase39-probe` (count 1), the signed-out end succeeds, and the count goes back to 0. Record
  the output. The only row written is the probe's own, and it's deleted in the same step.

- [ ] **Step 2: Lock state.** In `convex/studentViewLock.ts`, import `callerOwnsAccount` from
  `./lib/account`, and change `getStudentViewLockState`'s handler to:

```ts
  handler: async (ctx, args) => {
    const profile = await ctx.db.get(args.profileId);
    if (!profile || !(await callerOwnsAccount(ctx, profile.accountId))) return null;
    return { locked: !!profile.studentViewLocked };
  },
```

  Leave `lockStudentView` / `unlockStudentView` and their local `assertProfileOwnedByCaller`
  alone. They're already safe for strangers. Their narrower owner-only rule (collaborators can't
  lock) is a product question for MOS-88, so note it in the report.

- [ ] **Step 3: Presence.** In `convex/studentViewSessions.ts`, import `callerOwnsAccount` from
  `./lib/account`, then:

  `heartbeatStudentViewSession`: after the identity check, and before looking up `existing`:

```ts
    const profile = await ctx.db.get(args.profileId);
    if (!profile || !(await callerOwnsAccount(ctx, profile.accountId))) {
      throw new Error("Not authorized for this profile");
    }
```

  Also, when `existing` is found, only patch it if `existing.clerkUserId === identity.subject`.
  Otherwise return `null` without writing, so a guessed `sessionId` can't keep someone else's
  session alive.

  `endStudentViewSession`: require identity, and only delete your own session:

```ts
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const existing = await ctx.db
      .query("studentViewSessions")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .first();
    if (existing && existing.clerkUserId === identity.subject) {
      await ctx.db.delete(existing._id);
    }
    return null;
  },
```

  `getActiveStudentViewSessions`: first lines of the handler:

```ts
    const profile = await ctx.db.get(args.profileId);
    if (!profile || !(await callerOwnsAccount(ctx, profile.accountId))) return [];
```

  Check `app/hooks/useStudentViewPresence.ts` still type-checks. It passes the same args. The
  `endStudentViewSession` call on tab close has the signed-in token, because it runs from the
  mounted React tree, and the session it ends is the tab's own. If the hook fires
  `endStudentViewSession` **after** sign-out, that call now does nothing and the row expires
  through `cleanupStaleSessions` (5 minutes). Say so in the report.

- [ ] **Step 4: Green.**

```bash
A='{"subject":"user_3JzdGwXIW79ALFbhhHE8ykSQCFG"}'; B='{"subject":"user_3FRyegzhjxRy5uokPusWO4wcytY"}'
npx convex run studentViewLock:getStudentViewLockState '{"profileId":"kh79knp2mjw7v4cdecn5aayyps89nb9n"}' --identity "$A"
npx convex run studentViewSessions:getActiveStudentViewSessions '{"profileId":"kh79knp2mjw7v4cdecn5aayyps89nb9n"}' --identity "$A"
npx convex run studentViewSessions:heartbeatStudentViewSession '{"profileId":"kh79knp2mjw7v4cdecn5aayyps89nb9n","sessionId":"phase39-probe"}' --identity "$A"
npx convex run studentViewLock:getStudentViewLockState '{"profileId":"kh79knp2mjw7v4cdecn5aayyps89nb9n"}' --identity "$B"
```

  Expected: `null`, `[]`, an error "Not authorized for this profile", then B's own real lock
  state. Then check the owner's path end to end with a throwaway session **on B's own profile, as
  B**: heartbeat → B sees it → end signed out (expect it's still there) → end as A (still there)
  → end as B (gone):

```bash
npx convex run studentViewSessions:heartbeatStudentViewSession '{"profileId":"kh79knp2mjw7v4cdecn5aayyps89nb9n","sessionId":"phase39-probe-b"}' --identity "$B"
npx convex run studentViewSessions:endStudentViewSession '{"sessionId":"phase39-probe-b"}'
npx convex run studentViewSessions:endStudentViewSession '{"sessionId":"phase39-probe-b"}' --identity "$A"
npx convex run studentViewSessions:getActiveStudentViewSessions '{"profileId":"kh79knp2mjw7v4cdecn5aayyps89nb9n"}' --identity "$B" | grep -c phase39-probe-b
npx convex run studentViewSessions:endStudentViewSession '{"sessionId":"phase39-probe-b"}' --identity "$B"
npx convex run studentViewSessions:getActiveStudentViewSessions '{"profileId":"kh79knp2mjw7v4cdecn5aayyps89nb9n"}' --identity "$B" | grep -c phase39-probe-b
```

  Expected counts: `1`, then `0`.

- [ ] **Step 5: Types and lint.** Both `tsc` runs are clean, and lint shows no new problems.

- [ ] **Step 6: Commit.** `fix(security): student-view lock and presence only work on the caller's own profiles (MOS-92)`

---

## Task 3: Sign-up takes the identity from Clerk, not the browser (MOS-90)

**Problem.** `users.createUser` (`convex/users.ts`, called once per new account from
`app/contexts/AppStateProvider.tsx` ~line 53) takes `clerkUserId` and `email` as arguments and
believes them. It then activates any pending `accountMembers` invite for that email under that
Clerk ID. Anyone who knows an invited email can call it with their own Clerk ID and the
invitee's email, before the invitee signs up, and become a collaborator on the inviting family's
account.

Two smaller faults sit in the same path:
- Invite emails are compared exactly, so `Carer@Example.com` never matches `carer@example.com`.
- The invite is activated even if Clerk hasn't verified the email.

**Files:**
- Modify: `convex/users.ts` (`createUser`)
- Modify: `convex/accountMembers.ts` (`inviteCollaborator`: store the email lower-cased and trimmed)
- Modify: `app/contexts/AppStateProvider.tsx` (the `createUser` call)
- Modify: `convex/migrations.ts` (an internal clean-up for this task's probe rows)

**Interfaces:**
- Changes: `createUser` args become `{ name?: string; referredBy?: string; locale?: string }`.
  `clerkUserId` and `email` are gone. The return shape `{ userId, wasCreated }` is unchanged.

- [ ] **Step 1: Red** (writes only probe rows, which step 5 deletes). Show that a caller can
  create a user under a Clerk ID and email that aren't theirs:

```bash
npx convex run users:createUser '{"clerkUserId":"user_phase39_victim","email":"victim@example.invalid"}' --identity '{"subject":"user_phase39_attacker","email":"attacker@example.invalid","emailVerified":true}'
npx convex data users --limit 50 --format jsonLines | grep -c 'user_phase39_victim'
```

  Expected: `{ userId, wasCreated: true }`, and the count is `1`. A row now exists for a Clerk
  user the caller isn't. Record it.

- [ ] **Step 2: Normalise invite emails.** In `accountMembers.inviteCollaborator`, compute
  `const email = args.email.trim().toLowerCase();` and use `email` for the duplicate check and
  the insert. Grep `convex/` for any other place that writes or compares `accountMembers.email`
  (`grep -rn "accountMembers" convex --include='*.ts' | grep -v _generated`) and lower-case
  there too. List what you found in the report.

- [ ] **Step 3: Rewrite `createUser`:**

```ts
export const createUser = mutation({
  args: {
    name: v.optional(v.string()),
    referredBy: v.optional(v.string()), // affiliate code from signup cookie
    locale: v.optional(v.string()),     // 'en' | 'hi' — set from /start or VoiceModal
  },
  handler: async (ctx, args) => {
    // MOS-90: the Clerk ID and email come from the verified token, never from
    // the browser. A caller could otherwise create a row under someone else's
    // Clerk ID, or claim a pending invite by sending the invitee's email.
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const clerkUserId = identity.subject;
    const email = (identity.email ?? "").trim().toLowerCase();

    // Guard: don't create duplicates
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", clerkUserId))
      .first();
    if (existing) return { userId: existing._id, wasCreated: false };

    const userId = await ctx.db.insert("users", {
      clerkUserId,
      email,
      name: args.name ?? identity.name ?? undefined,
      referredBy: args.referredBy,
      locale: args.locale,
      subscription: {
        status: "free",
      },
      lastActiveAt: Date.now(),
    });

    // Activate a pending invite for this email, but only once Clerk has
    // verified the address belongs to the person signing up.
    if (email && identity.emailVerified === true) {
      const pendingInvite = await ctx.db
        .query("accountMembers")
        .withIndex("by_email_and_status", (q) =>
          q.eq("email", email).eq("status", "pending")
        )
        .first();

      if (pendingInvite) {
        await ctx.db.patch(pendingInvite._id, {
          clerkUserId,
          status: "active",
          joinedAt: Date.now(),
        });
      }
    }

    return { userId, wasCreated: true };
  },
});
```

  Keep the file's existing doc comment above it, and add one line saying the identity comes from
  the token (MOS-90).

  **Stored email is now lower case.** Check that nothing compares `users.email` case-sensitively
  against user input: `grep -rn "\.email" convex --include='*.ts' | grep -v _generated`. List
  what you found. Change a comparison only if it would break with lower case.

- [ ] **Step 4: Update the caller.** In `app/contexts/AppStateProvider.tsx`, the `createUser`
  call becomes:

```ts
      void createUser({
        name: clerkUser.fullName ?? undefined,
        locale: urlLocale ?? "en",
      }).then((result) => {
```

  Keep the `.then(...)` body as it is.

  **Guard the timing.** `createUser` now needs the Convex token, but the effect currently runs as
  soon as Clerk has loaded. Convex may not have received the token yet. If `getMyUser` returns
  `null` before Convex is signed in, the effect would call `createUser` too early, it would throw
  `Unauthenticated`, and because `hasSynced.current` is already set the row would never be
  created. So:
  - import `useConvexAuth` from `convex/react`
  - read `const { isAuthenticated: convexAuthed } = useConvexAuth();`
  - add `if (!convexAuthed) return;` to the effect's early returns, **before**
    `hasSynced.current = true`
  - add `convexAuthed` to the effect's dependency list

  `getMyUser` (`convex/users.ts:29`) returns `null` when there's no identity, so this timing
  gap is real, not theoretical. `TalkerDropdown.tsx:111` already uses `useConvexAuth` the same
  way.

- [ ] **Step 5: Green, and clean up.** After the push:

```bash
# The old attack no longer type-checks against the validator:
npx convex run users:createUser '{"clerkUserId":"user_phase39_victim2","email":"victim@example.invalid"}' --identity '{"subject":"user_phase39_attacker","email":"attacker@example.invalid","emailVerified":true}'
# An honest sign-up creates a row for the token's own subject, email lower-cased:
npx convex run users:createUser '{}' --identity '{"subject":"user_phase39_honest","email":"Honest@Example.invalid","emailVerified":true}'
npx convex data users --limit 50 --format jsonLines | grep 'user_phase39_honest' | grep -o '"email":"[^"]*"'
# Signed out:
npx convex run users:createUser '{}'
```

  Expected: a validation error about the extra `clerkUserId` field; `{ wasCreated: true }`;
  `"email":"honest@example.invalid"`; `Unauthenticated`.

  Invite activation needs a pending invite, and inviting needs a Max account. Don't invite as the
  owner. Insert a probe invite directly with an internal mutation instead. Add to
  `convex/migrations.ts`:

```ts
/**
 * phase-39 test fixtures only. Inserts a pending invite on the given account
 * and removes every row this plan's probes created (Clerk IDs starting
 * "user_phase39_", emails ending "@example.invalid").
 * Run: npx convex run migrations:phase39Fixtures '{"action":"invite","accountId":"<id>","email":"<email>"}'
 *      npx convex run migrations:phase39Fixtures '{"action":"cleanup"}'
 */
export const phase39Fixtures = internalMutation({
  args: {
    action: v.union(v.literal("invite"), v.literal("cleanup")),
    accountId: v.optional(v.id("users")),
    email: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.action === "invite") {
      if (!args.accountId || !args.email?.endsWith("@example.invalid")) {
        throw new Error("invite needs accountId and an @example.invalid email");
      }
      return await ctx.db.insert("accountMembers", {
        accountId: args.accountId,
        email: args.email,
        role: "collaborator",
        status: "pending",
        invitedAt: Date.now(),
      });
    }
    let removed = 0;
    for await (const m of ctx.db.query("accountMembers")) {
      if (m.email.endsWith("@example.invalid")) { await ctx.db.delete(m._id); removed++; }
    }
    for await (const u of ctx.db.query("users")) {
      if (u.clerkUserId.startsWith("user_phase39_")) { await ctx.db.delete(u._id); removed++; }
    }
    return { removed };
  },
});
```

  Check the `accountMembers` field names against `convex/schema.ts` before running it (the insert
  must match the schema exactly). Then:

```bash
# Unverified email: the invite stays pending.
npx convex run migrations:phase39Fixtures '{"action":"invite","accountId":"j5761rg3dwe3r13bzj0s8j0xhd8fb81b","email":"carer1@example.invalid"}'
npx convex run users:createUser '{}' --identity '{"subject":"user_phase39_carer1","email":"Carer1@Example.invalid","emailVerified":false}'
npx convex data accountMembers --format jsonLines | grep carer1 | grep -o '"status":"[a-z]*"'
# Verified email, different case: the invite activates for the token's own subject.
npx convex run migrations:phase39Fixtures '{"action":"invite","accountId":"j5761rg3dwe3r13bzj0s8j0xhd8fb81b","email":"carer2@example.invalid"}'
npx convex run users:createUser '{}' --identity '{"subject":"user_phase39_carer2","email":"Carer2@Example.invalid","emailVerified":true}'
npx convex data accountMembers --format jsonLines | grep carer2 | grep -o '"status":"[a-z]*"\|"clerkUserId":"[^"]*"'
# Clean up every probe row.
npx convex run migrations:phase39Fixtures '{"action":"cleanup"}'
npx convex data users --limit 50 --format jsonLines | grep -c user_phase39_
```

  Expected: `"status":"pending"`; then `"status":"active"` with
  `"clerkUserId":"user_phase39_carer2"`; the clean-up reports the rows it removed; the final count
  is `0`. The invites are placed on the fresh **test** account (A), never the owner's. Delete the
  `phase39Fixtures` mutation from `convex/migrations.ts` before committing: it has done its job,
  and test tooling shouldn't ship.

- [ ] **Step 6: Types and lint.** Both `tsc` runs are clean, and lint shows no new problems.

- [ ] **Step 7: Commit.** `fix(security): sign-up and invite acceptance use the verified Clerk identity (MOS-90)`

---

## Task 4: Browser check and docs (controller)

- [ ] **Browser (Claude in Chrome, signed in as the fresh test account).** Check each of these
  still works for the account's own data, and the console shows no new errors:
  - open a category, and open the talker's core-words dropdown
  - open a list, and edit a symbol (the editor loads it)
  - switch to student view and back (presence and lock)
  - sign out through Quick Settings, sign back in, and check the Home page loads
- [ ] **Sign-up.** Sign up a second fresh account in Chrome, and check its `users` row has the
  Clerk subject and a lower-case email (`npx convex data users`).
- [ ] **Docs.**
  - FEAT-301 (instructor and student views): add an edge case saying only the account's own
    profiles can be locked, viewed or tracked.
  - FEAT-106 (settings, invites) and FEAT-109 (sign-up): add an edge case saying an invite is
    accepted only by someone signing in with that email, once Clerk has verified it, whatever the
    capital letters.
  - `docs/01-final-straight.md` M2: a dated note.
  - Changelog `docs/4-builds/changelog/YYYY-MM-DD-account-isolation.md`.
  - MOS-77 (M7 inventory): the production Clerk instance needs the "convex" JWT template with
    `email` and `email_verified`.
- [ ] **Close out.** Move this plan to `docs/4-builds/plans/_done/`, and move MOS-90 and MOS-92
  to Done in Linear.
