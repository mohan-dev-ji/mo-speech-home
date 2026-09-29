# Phase 40: Family access (MOS-88, MOS-94)

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to work through this plan task by task. Steps
> use checkbox (`- [ ]`) syntax for tracking.

Milestone: Final straight · **M2 Billing truth**. Tickets:
- [MOS-88](https://linear.app/mo-intelligence/issue/MOS-88): an invited carer is gated on their own plan, not the family's.
- [MOS-94](https://linear.app/mo-intelligence/issue/MOS-94): the invite email route has no checks, and an invite to someone who already has an account never activates.

Family invites are a Max feature (FEAT-108). Today they don't work as sold.

**Goal:** a carer invited to a family can do everything the family's plan allows, inside that
family's account. Only the family's owner, on Max, can send invites. Someone who already uses
Mo Speech can accept an invite as long as their own account has no students.

## Owner decisions (2026-09-29)

1. **The family's plan decides.** A carer working in a family's account gets the family's plan,
   whatever their own plan is. It is not "the higher of the two".
2. **Existing users can join only if they have no students.** An invite is accepted only if the
   invitee's own account has no student profiles. Otherwise they see a notice to use a different
   email. Nothing of theirs is ever hidden. An account switcher is post-launch.
3. **Carers can lock and unlock student view** on the family's children.
4. **Only the owner, on Max, can invite.** The invite email is sent only if the owner has created
   the invite. Carers can't invite.

**Architecture:** `resolveCallerAccountId` already resolves an active carer to the family's
`accountId`, but it returns the carer's **own** `user` doc, and every plan gate reads that. It will
also return `planUser`: the family owner's `users` doc for an active carer, the caller's own doc
otherwise. Every plan gate switches from `user` to `planUser`. `getMyAccess` computes the plan
from `planUser` and adds `role: "owner" | "collaborator"`, so every client screen and API route
that already reads `getMyAccess` follows automatically. Invites get one server-side check
(`accountMembers.canSendInvite`) that the email route must pass. A new `acceptPendingInvite`
mutation lets returning users join.

**Tech stack:** Convex, Next.js 16 route handlers, next-intl, Clerk.

## Facts this plan relies on (checked 2026-09-29, with file:line)

- **`resolveCallerAccountId`** (`convex/lib/account.ts:11-36`) sets `accountId` to
  `membership.accountId` for an active carer, but `user` is always the caller's own row.
- **Plan gates that take that `user`:**
  - `requireProTier(user)` in `profileCategories.ts` (102, 369, 435, 482, 505, 526),
    `profileSymbols.ts` (106, 162, 192, 346, 371), `profileLists.ts` (86, 129, 163, 179, 271,
    283, 312), `profilePhrases.ts` (87, 120, 157, 171, 188, 203, 223, 249, 263) and
    `profileSentences.ts` (182, 237, 295, 319, 339, 365, 382, 405, 429)
  - `effectiveUserTier(user)` in `contentModules/{categories,lists,sentences,phrases}.ts` (the
    install gate), `accountImages.ts:166` (`record`, with a comment defending the caller's own
    row that this plan reverses) and `lib/themes.ts:107` (called from `users.ts:545`
    `setMyThemeSlug` and `studentProfiles.ts:411` `updateStudentProfile`)
- **`users.getMyAccess`** (`convex/users.ts:47-103`) computes `tier`, `status`, `hasFullAccess`,
  `plan` and `customAccess` from the caller's own row. It feeds `AppStateProvider` (the whole
  client), `InstallModuleButton`, and the API routes `upload-asset`, `image-search/search`,
  `image-search/proxy`, `ai-generate/imagen` and `tts`.
- **`profileCategories.reseedAccount`** (~line 97) is a **public** mutation, with no app callers,
  that deletes every category and symbol on the caller's account and re-seeds it, gated only on
  Pro. Once carers get the family's plan, a carer could wipe the family's boards with it. It must
  become internal **before** the plan gates change.
- **Stripe routes** (`app/api/stripe/{checkout,portal,switch-plan,cancel,reactivate}`) have no
  owner check. A carer can open their own separate subscription through `checkout`. The
  **Account & Billing** tab is hidden for carers (`SettingsContent.tsx:16-33`), but the routes
  aren't guarded.
- **Student-view lock:** `lockStudentView` / `unlockStudentView` (`studentViewLock.ts:7-49`) use a
  local owner-only check. `BreadcrumbViewModeDropdown.tsx:156-164` shows the toggle to carers
  anyway, and calls it with no error handling.
- **Invites:**
  - `InvitesPanel.tsx:95-122` calls `inviteCollaborator` and then `POST /api/invite`.
  - `app/api/invite/route.ts` only checks that the caller is signed in, then calls Clerk
    `createInvitation({ ignoreExisting: true })`.
  - Invites only activate inside `createUser` (first sign-up, phase-39 rules: verified email,
    lower case).
  - `inviteCollaborator` (`accountMembers.ts:60-99`) doesn't stop a carer inviting (it uses their
    own `user._id` as the account), or an owner inviting themselves.
- **No `leaveAccount` / account-switch exists,** and a carer can't remove themselves. Out of
  scope: that's post-launch with the switcher.
- **The language gate** (`assertLanguageAllowed`) counts profiles under the passed user's own
  `_id`. Leave it on the caller's own `user`. Passing the family owner would make a carer's
  personal locale change cascade the family's children's languages.
- **Seeding is safe.** `seedDefaultAccount` only runs from `createStudentProfile` (the caller's
  own `_id`, carers skip onboarding) and from `reseedAccount` (made internal in Task 1).

### Test fixtures

| Name | Value |
|---|---|
| Family ("A"): the fresh **test** account, Pro | subject `user_3JzdGwXIW79ALFbhhHE8ykSQCFG`, users `_id` `j5761rg3dwe3r13bzj0s8j0xhd8fb81b` |
| Owner account ("B"), Max: **read only, never write** | subject `user_3FRyegzhjxRy5uokPusWO4wcytY`, users `_id` `j5717je37k1h19ndtjn0bsgc49892p0v` |
| Probe carer | subject `user_phase40_carer`, email `carer40@example.invalid` (verified) |
| Probe existing user with students | subject `user_phase40_busy`, email `busy40@example.invalid` |

Probe rows are created through the fixture mutation in Task 1 and removed in Task 4.

## Global constraints

- Work on `main`. One commit per task (a fix round may add one), ticket ID in the subject, and
  every message ends with a blank line and
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. If a commit is refused by a
  permission check, stop and report it.
- NEVER run `npm run dev`, `npx convex dev` or `stripe listen`. The owner's `convex dev`
  auto-pushes `convex/` edits on save, so wait about 10 seconds before probing.
- Read `convex/_generated/ai/guidelines.md` before touching `convex/`. Every function keeps
  argument validators.
- **Never write to account B's data.** Every write probe targets account A (the test family) or
  `user_phase40_*` probe rows.
- **The owner's behaviour must not change.** For an account owner, `planUser` is their own row,
  and every gate returns exactly what it did before.
- **Billing stays with the owner.** Carers never see or reach checkout, the portal, plan switches,
  cancel or reactivate (FEAT-106).
- UI copy: new keys go in `messages/en.json` **only**. Theme tokens only in app UI.
- **No test framework; don't add one.** The checks are the `npx convex run … --identity '<json>'`
  probes (red before, green after), `npx tsc --noEmit` and `npx tsc -p convex/tsconfig.json --noEmit`
  (baseline 0 errors), and `npm run lint` (baseline 63 problems: 34 errors, 29 warnings; add none).

---

## Task 1: Carers get the family's plan (MOS-88)

**Files:**
- Create: `convex/devFixturesPhase40.ts` (an internal test fixture, deleted in Task 4)
- Modify: `convex/lib/account.ts`, `convex/users.ts` (`getMyAccess`, `setMyThemeSlug`),
  `convex/profileCategories.ts` (including `reseedAccount` → internal), `convex/profileSymbols.ts`,
  `convex/profileLists.ts`, `convex/profilePhrases.ts`, `convex/profileSentences.ts`,
  `convex/contentModules/{categories,lists,sentences,phrases}.ts`, `convex/accountImages.ts`
- Modify: `app/contexts/AppStateProvider.tsx` (only if it has to pass through the new `role` field)

**Interfaces:**
- Produces: `resolveCallerAccountId(ctx)` and `requireCallerAccountId(ctx)` return
  `{ accountId, user, planUser, role }`:
  - `planUser: Doc<"users">`: the family owner's doc for an active carer, otherwise `user`.
  - `role: "owner" | "collaborator"`.
  - Existing callers that destructure `{ accountId, user }` keep working.
- Produces: `getMyAccess` returns its existing fields plus `role`. The plan fields come from
  `planUser`.

- [ ] **Step 1: Fixture.** Create `convex/devFixturesPhase40.ts`:

```ts
import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * phase-40 test fixtures only (deleted in phase-40 Task 4). Creates or removes
 * probe rows: users whose clerkUserId starts "user_phase40_", accountMembers
 * and studentProfiles belonging to them, and invites to "@example.invalid".
 */
export const phase40Fixtures = internalMutation({
  args: {
    action: v.union(v.literal("member"), v.literal("invite"), v.literal("cleanup")),
    accountId: v.optional(v.id("users")),
    email: v.optional(v.string()),
    clerkUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.action !== "cleanup") {
      if (!args.accountId || !args.email?.endsWith("@example.invalid")) {
        throw new Error("needs accountId and an @example.invalid email");
      }
      return await ctx.db.insert("accountMembers", {
        accountId: args.accountId,
        email: args.email,
        role: "collaborator",
        status: args.action === "member" ? "active" : "pending",
        invitedAt: Date.now(),
        ...(args.action === "member" && args.clerkUserId
          ? { clerkUserId: args.clerkUserId, joinedAt: Date.now() }
          : {}),
      });
    }
    let removed = 0;
    for await (const m of ctx.db.query("accountMembers")) {
      if (m.email.endsWith("@example.invalid")) { await ctx.db.delete(m._id); removed++; }
    }
    for await (const u of ctx.db.query("users")) {
      if (!u.clerkUserId.startsWith("user_phase40_")) continue;
      for await (const p of ctx.db.query("studentProfiles").withIndex("by_account_id", (q) => q.eq("accountId", u._id))) {
        await ctx.db.delete(p._id); removed++;
      }
      await ctx.db.delete(u._id); removed++;
    }
    return { removed };
  },
});
```

  Check the `accountMembers` and `studentProfiles` field and index names against
  `convex/schema.ts` first. Then create the probe carer as an active member of A:

```bash
C='{"subject":"user_phase40_carer","email":"carer40@example.invalid","emailVerified":true}'
npx convex run users:createUser '{}' --identity "$C"
npx convex run devFixturesPhase40:phase40Fixtures '{"action":"member","accountId":"j5761rg3dwe3r13bzj0s8j0xhd8fb81b","email":"carer40@example.invalid","clerkUserId":"user_phase40_carer"}'
```

- [ ] **Step 2: Red.** The carer, whose own plan is Free, gets Free inside family A (A is Pro):

```bash
npx convex run users:getMyAccess '{}' --identity "$C"
```

  Expected: `accountId` is A's ID, `tier: "free"`, `hasFullAccess: false`. Then try one
  Pro-gated write into A: pick `profileLists.createProfileList` (read its args in
  `convex/profileLists.ts`) and create a list named `phase40-probe`. Expected: `TIER_REQUIRED`.

- [ ] **Step 3: Lock the reseed first.** Change `profileCategories.reseedAccount` from `mutation`
  to `internalMutation`. It has no `api.` callers (check: `grep -rn reseedAccount app lib`).
  Update its doc comment: it's internal because it wipes an account's boards. Save, then wait
  for the push. **Never run it** (it deletes data). To confirm it's gone from the public API,
  call the public HTTP endpoint with an argument it doesn't accept. The old public function
  would reject the argument, and the new state answers "Could not find public function":

```bash
U=$(grep '^NEXT_PUBLIC_CONVEX_URL=' .env.local | cut -d= -f2- | tr -d '"')
curl -s -X POST "$U/api/mutation" -H 'Content-Type: application/json' \
  -d '{"path":"profileCategories:reseedAccount","args":{"__probe":1},"format":"json"}'
```

- [ ] **Step 4: `planUser` and `role`.** In `convex/lib/account.ts`, extend
  `resolveCallerAccountId`:

```ts
export async function resolveCallerAccountId(
  ctx: QueryCtx
): Promise<{
  accountId: Id<"users">;
  user: Doc<"users">;
  /** Whose plan applies: the family owner for an active carer (MOS-88), else `user`. */
  planUser: Doc<"users">;
  role: "owner" | "collaborator";
} | null> {
```

  In the collaborator branch, load the host's doc:
  `const host = await ctx.db.get(membership.accountId);`. If `host` is `null` (the owner deleted
  their account), treat the caller as an owner of their own account (`accountId = user._id`,
  `planUser = user`, `role = "owner"`) rather than failing. Otherwise `planUser = host` and
  `role = "collaborator"`. The owner path is `planUser = user`, `role = "owner"`.
  `requireCallerAccountId` passes the same shape through. Update both doc comments.

- [ ] **Step 5: Switch every plan gate to `planUser`.** For each call site listed under "Facts"
  (`requireProTier`, `effectiveUserTier`, `assertModuleInstallable`'s `userTier`), destructure
  `planUser` from the existing `requireCallerAccountId` / `resolveCallerAccountId` call and pass
  `planUser` instead of `user`. Keep `user` wherever the code uses it for anything else. Then:
  - `accountImages.record`: gate on `effectiveUserTier(planUser)`, and rewrite its comment. The
    plan now comes from the account's owner, the same as `getMyAccess` and the routes.
  - `users.setMyThemeSlug` and `studentProfiles.updateStudentProfile`: they fetch `user` by Clerk
    ID directly. Change them to use `resolveCallerAccountId(ctx)`, pass `planUser` to
    `assertThemeSelectable`, and keep every other use exactly as it was. `updateStudentProfile`'s
    owner-only check (`profile.accountId !== user._id`) stays: carers don't manage student
    profiles.
  - `assertLanguageAllowed`: leave it on `user` (see "Facts").
  - Then sweep: `grep -rn "requireProTier(user)\|effectiveUserTier(user)\|userHasFullAccess(user)" convex --include='*.ts'`
    should return only lines you've decided to keep. List each one, with the reason, in the
    report.

- [ ] **Step 6: `getMyAccess`.** Compute every plan field from `planUser.subscription` instead of
  `user.subscription`, and add `role` to the returned object. Update its doc comment to say the
  plan fields describe the account being worked in.

- [ ] **Step 7: Green.**

```bash
npx convex run users:getMyAccess '{}' --identity "$C"
```

  Expected: A's `accountId`, `tier: "pro"`, `hasFullAccess: true`, `role: "collaborator"`. Then
  repeat step 2's `createProfileList` as the carer. Expected: it succeeds, and the list is in A's
  account. Delete it as the carer with `deleteProfileList`. Then check the owners are unchanged:
  `getMyAccess` as A gives `role: "owner"` with the same plan fields as before, and as B gives
  `role: "owner"` with `tier: "max"` (a read).

- [ ] **Step 8: Types, lint, commit.** Both `tsc` runs are clean, and lint shows no new problems.
  Commit `convex/devFixturesPhase40.ts` too: it's an internal mutation, not public, and Task 4
  deletes it.
  `fix(billing): invited carers get the family's plan; reseedAccount is internal (MOS-88)`

---

## Task 2: Carers can lock student view; billing is owner-only (MOS-88)

**Files:**
- Modify: `convex/studentViewLock.ts`
- Modify: `app/api/stripe/{checkout,portal,switch-plan,cancel,reactivate}/route.ts`
- Modify: `app/components/app/shared/ui/BreadcrumbViewModeDropdown.tsx` (error handling only)

**Interfaces:**
- Consumes: `callerOwnsAccount(ctx, accountId)` (`convex/lib/account.ts`, phase-39), and
  `getMyAccess().role` (Task 1).

- [ ] **Step 1: Red.**

```bash
C='{"subject":"user_phase40_carer","email":"carer40@example.invalid","emailVerified":true}'
```

  Read A's student profile ID from `npx convex data studentProfiles` (the row with accountId
  `j5761rg3dwe3r13bzj0s8j0xhd8fb81b`), and its current `studentViewLocked`. Run
  `studentViewLock:lockStudentView` on it as the carer. Expected: "Not authorized for this
  profile".

- [ ] **Step 2: Lock and unlock use the shared rule.** In `convex/studentViewLock.ts`, replace
  `assertProfileOwnedByCaller`'s owner-only comparison with
  `callerOwnsAccount(ctx, profile.accountId)`. Keep the helper's name and its thrown messages.
  The owner still passes, and so does an active carer on the family's profiles.

- [ ] **Step 3: The toggle's errors.** In `BreadcrumbViewModeDropdown.tsx`, wrap the
  lock/unlock calls (~156-164) in `try/catch`. On failure, `console.error` it and leave the UI
  state unchanged. There's no existing toast pattern in this component, so don't invent one.

- [ ] **Step 4: Billing routes are owner-only.** Each of the five Stripe routes (not `webhook`)
  gets a guard at the top, after `auth()`: fetch `api.users.getMyAccess` with the caller's Clerk
  token (the same pattern as `upload-asset/route.ts`: `getToken({ template: "convex" })`,
  `convex.setAuth(token)`). If `access?.role === "collaborator"`, return
  `NextResponse.json({ error: "owner_only" }, { status: 403 })`. Keep everything else. Add no
  client copy: the billing tab is already hidden for carers.

- [ ] **Step 5: Green.** As the carer, lock A's student profile, check `studentViewLocked: true`,
  then unlock it and check it's back to its original value. A's owner lock and unlock still work
  (run it as A, restoring the original value). Route guard: this needs a signed-in carer
  session, so the controller checks it in Task 4. Here, check both `tsc` runs and lint.

- [ ] **Step 6: Commit.** `fix(billing): carers can lock student view; billing routes are owner-only (MOS-88)`

---

## Task 3: Invites: only the owner on Max, and existing users can join (MOS-94)

**Files:**
- Modify: `convex/accountMembers.ts` (`inviteCollaborator`, new `canSendInvite`, new `acceptPendingInvite`)
- Modify: `app/api/invite/route.ts`
- Modify: `app/contexts/AppStateProvider.tsx`
- Create: `app/components/app/home/ui/InviteNotice.tsx`
- Modify: `app/components/app/home/sections/HomeContent.tsx`
- Modify: `messages/en.json` (`home` or the namespace `HomeContent` uses: 2 keys)

**Interfaces:**
- Produces: `accountMembers.canSendInvite({ email: string }): Promise<boolean>` (query).
- Produces: `accountMembers.acceptPendingInvite({}): Promise<{ status: "joined" | "none" | "has_students" | "already_member" }>` (mutation).
- Produces: `useAppState().inviteNotice: "has_students" | null`.

- [ ] **Step 1: Red.**
  - (a) A carer can invite: `accountMembers:inviteCollaborator {"email":"x40@example.invalid"}`
    as the carer. It currently fails with "Max tier required" because the carer's own row is
    Free, but it isn't refused *as a carer*. Record the output.
  - (b) An existing user never joins. Create a probe user who already has a Free account:
    `users:createUser '{}'` as
    `{"subject":"user_phase40_late","email":"late40@example.invalid","emailVerified":true}`.
    Then add a pending invite for `late40@example.invalid` on A through the fixture
    (`{"action":"invite",…}`). Then run `getMyAccess` as `user_phase40_late`. Expected:
    `role: "owner"`, with its own `accountId`. There's nothing to activate it.

- [ ] **Step 2: `inviteCollaborator` is owner-only.** Switch it to `requireCallerAccountId`. Throw
  `"Only the account owner can invite"` if `role === "collaborator"`. Gate Max on
  `effectiveUserTier(planUser)`, which for an owner is their own row, so it's unchanged. Also
  throw `"You can't invite yourself"` if the normalised email equals the owner's own
  `user.email`.

- [ ] **Step 3: `canSendInvite`.**

```ts
/**
 * Server check for POST /api/invite (MOS-94): only an account owner on Max can
 * make Clerk send an invite email, and only to an address they have already
 * invited through inviteCollaborator.
 */
export const canSendInvite = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const resolved = await resolveCallerAccountId(ctx);
    if (!resolved || resolved.role !== "owner") return false;
    if (effectiveUserTier(resolved.planUser) !== "max") return false;
    const email = args.email.trim().toLowerCase();
    const pending = await ctx.db
      .query("accountMembers")
      .withIndex("by_account_id_and_status", (q) =>
        q.eq("accountId", resolved.accountId).eq("status", "pending"))
      .take(50);
    return pending.some((m) => m.email === email);
  },
});
```

- [ ] **Step 4: The route uses it.** In `app/api/invite/route.ts`, after the existing email
  format check:
  - normalise the email (trim and lower-case)
  - call `canSendInvite` through `ConvexHttpClient` with the caller's Clerk token
  - return `403 { error: "not_allowed" }` if it's false
  - pass the normalised email to Clerk

  Keep `ignoreExisting: true`, because an existing user now can join (step 5).

- [ ] **Step 5: `acceptPendingInvite`.**

```ts
/**
 * Join a family from a pending invite on sign-in, for people who already have
 * an account (MOS-94). createUser handles brand-new sign-ups. Same identity
 * rules as createUser (MOS-90): verified email, lower-case match. An account
 * that already has student profiles can't join: accountMembers maps a carer to
 * one family, and joining would hide their own students (owner decision
 * 2026-09-29), so they're told to use a different email.
 */
export const acceptPendingInvite = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { status: "none" as const };
    const email = (identity.email ?? "").trim().toLowerCase();
    if (!email || identity.emailVerified !== true) return { status: "none" as const };

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkUserId", identity.subject))
      .first();
    if (!user) return { status: "none" as const };

    const pending = await ctx.db
      .query("accountMembers")
      .withIndex("by_email_and_status", (q) => q.eq("email", email).eq("status", "pending"))
      .first();
    if (!pending) return { status: "none" as const };
    if (pending.accountId === user._id) return { status: "none" as const };

    const alreadyMember = await ctx.db
      .query("accountMembers")
      .withIndex("by_clerk_user_id", (q) => q.eq("clerkUserId", user.clerkUserId))
      .first();
    if (alreadyMember && alreadyMember.status === "active") {
      return { status: "already_member" as const };
    }

    const ownProfile = await ctx.db
      .query("studentProfiles")
      .withIndex("by_account_id", (q) => q.eq("accountId", user._id))
      .first();
    if (ownProfile) return { status: "has_students" as const };

    await ctx.db.patch(pending._id, {
      clerkUserId: user.clerkUserId,
      status: "active",
      joinedAt: Date.now(),
    });
    return { status: "joined" as const };
  },
});
```

  Check the index names against `convex/schema.ts` (`by_email_and_status`, `by_clerk_user_id`,
  and the `studentProfiles` `by_account_id`).

- [ ] **Step 6: Call it for returning users, and show the notice.** In `AppStateProvider.tsx`'s
  sync effect, returning-user branch (`else { void updateLastActive({}); }`): also call
  `acceptPendingInvite({})`. If `status === "has_students"`, store it in a new state value
  `inviteNotice`, exposed from the context as `inviteNotice: "has_students" | null`. Add it to
  the context type. Nothing else changes when it's `"joined"`: the Convex queries re-run on their
  own, and the app shows the family.

  `app/components/app/home/ui/InviteNotice.tsx`: when `inviteNotice === "has_students"`, render
  a notice using the same markup and tokens as `SettingsContent.tsx:70-73` (the collaborator
  notice): `rounded-theme-sm bg-theme-surface`, the `Users` icon and
  `text-theme-s text-theme-secondary-alt-text`. Render it at the top of `HomeContent`. Add to
  `en.json`, in the namespace `HomeContent` uses:

```json
    "inviteHasStudentsTitle": "You've been invited to join a family on Mo Speech",
    "inviteHasStudentsBody": "This account already has its own students, so it can't join another family. Ask them to invite a different email address, and sign in with that one to join."
```

  Show the title in bold, then the body.

- [ ] **Step 7: Green.**
  - (a) As the carer: `inviteCollaborator` gives "Only the account owner can invite", and
    `canSendInvite {"email":"late40@example.invalid"}` gives `false`.
  - (b) As A (owner on Pro): `canSendInvite {"email":"late40@example.invalid"}` gives `false`
    (not Max).
  - (c) As `user_phase40_late`: `acceptPendingInvite '{}'` gives `joined`; `getMyAccess` gives
    A's `accountId` with `role: "collaborator"`, and the pending row is now `active`.
  - (d) An existing user who has a student: create `user_phase40_busy`
    (`users:createUser` with `busy40@example.invalid`), give them a student profile through
    `studentProfiles:createStudentProfile` as that identity (read its args), add a pending invite
    for `busy40@example.invalid` on A through the fixture, then run `acceptPendingInvite` as
    them. Expected: `has_students`, and the row stays `pending`.

  `createStudentProfile` schedules `seedDefaultAccount` for the probe user's own account. Task
  4's clean-up must also delete the probe's `profileCategories` and `profileSymbols`. Add that to
  the fixture's clean-up branch now (by `accountId` for each `user_phase40_` user), and say so in
  the report.

- [ ] **Step 8: Types, lint, commit.** `fix(invites): only the owner on Max sends invites; existing users can join (MOS-94)`

---

## Task 4: Browser check, clean-up and docs (controller)

- [ ] **Clean-up.** `npx convex run devFixturesPhase40:phase40Fixtures '{"action":"cleanup"}'`,
  then confirm there are 0 `user_phase40_` users, 0 `@example.invalid` members, and no leftover
  `profileCategories`, `profileSymbols` or `studentProfiles` for those users. Delete
  `convex/devFixturesPhase40.ts` and commit.
- [ ] **Browser (Claude in Chrome).** The owner signs in as test account A (Pro) and as the
  second test account ("C", `j57bvzrhe81eap0b73kk65tdw58fah5x`, Free). Checks:
  - A upgrades to Max, then invites C's email from Settings → Invites. The invite email request
    returns 200.
  - C signs in. Because C already has a student profile, the Home notice appears and C's own
    boards are untouched.
  - To see a successful join, invite a third, brand-new email: sign up with it, check it lands in
    A's boards with Max features (for example the Upload tab is open), and that the Account &
    Billing tab is hidden.
  - As that carer, call `/api/stripe/checkout` from the console and expect 403 `owner_only`.
  - As that carer, lock and unlock the student view.
  - Finally, remove the carer as A, and put A back on Pro (or leave it on Max).
- [ ] **Docs.**
  - FEAT-108: tick the collaborators row. FEAT-106 (invites): only the owner on Max; existing
    users with students see the notice. FEAT-301: carers can lock.
  - `docs/01-final-straight.md` M2: a dated note.
  - Changelog `docs/4-builds/changelog/YYYY-MM-DD-family-access.md`.
  - Post-launch backlog: an account switcher and "Leave family" (file a ticket).
- [ ] **Close out.** Move this plan to `plans/_done/`, and move MOS-88 and MOS-94 to Done.
