# 2026-09-29: Account isolation

**Milestone:** M2 Billing truth (Final straight project) · **Issues:** MOS-92, MOS-90
**Spec:** [FEAT-301](../features/FEAT-301-instructor-and-student-views.md) ·
[FEAT-106](../features/FEAT-106-settings.md) ·
[FEAT-109](../features/FEAT-109-sign-up-and-onboarding.md) · **Plan:**
[phase-39-account-isolation-plan](../plans/_done/phase-39-account-isolation-plan.md)

Closed two data-isolation holes found in phase-38's review sweep, both about children's data:
a signed-in person could read or change another account's boards and student-view state by ID,
and a pending family invite could be claimed by anyone who knew the invited email address.

- **MOS-92**: board reads by ID (a category, its symbols, a list, a single symbol) now check that
  the document belongs to the caller's own account, via one small helper,
  `callerOwnsAccount` (`convex/lib/account.ts`). A mismatch returns exactly what "not found"
  returns today, so a stranger learns nothing, not even that the ID exists. Invited carers count
  as the host account, so a carer keeps working normally.
  - Student-view lock state and "who's viewing" (`convex/studentViewLock.ts`,
    `convex/studentViewSessions.ts`) now only work for a caller's own profiles. Presence can only
    be written for your own profiles, and a session can only be ended by whoever started it.
  - The three student-profile settings mutations — state flags, grid size, symbol text size
    (`convex/studentProfiles.ts`) — now check the profile belongs to the caller's account. Before,
    a carer invited to any account could change them on another family's profile, because the
    check only asked "is this person a collaborator anywhere", not "on this account".
  - Stale student-view presence rows are now cleaned up hourly (`convex/crons.ts`). The clean-up
    function already existed but was never scheduled; some rows were over 70 days old.
- **MOS-90**: `users.createUser` (`convex/users.ts`) now reads the Clerk user ID and email from
  the verified sign-in token, never from the browser's request. A pending invite activates only
  when Clerk has verified the email address, and invite emails are compared and stored in lower
  case (`convex/accountMembers.ts`). `AppStateProvider` also waits for the Convex login before
  creating the account record, and resets its synced state on sign-out so a second sign-in on the
  same device re-syncs cleanly.

**Verified 2026-09-29:** command-line checks running functions as two real accounts, before and
after each fix. In the owner's Chrome, signed in as the fresh test account: opening a category and
the talker's core-words dropdown, opening a list, editing a symbol, and switching to student view
and back (lock and presence) all still work for the account's own data, with no new console
errors. The other account's category URL shows nothing. A brand-new sign-up created its `users`
row from the token, with a lower-case email and its own set of default boards.

**New, open: MOS-94.** The invite-email route has no ownership or existence checks of its own,
and — separately — an invite sent to someone who already has a Mo Speech account never activates,
because `createUser` only runs at sign-up. Filed for M2.

**Side effect, not a regression:** an owner who is also an active collaborator on someone else's
account now has their student-profile settings changes applied to the **host's** profiles only,
matching how every other function already resolves a collaborator via `resolveCallerAccountId`.
Tracked under MOS-88/94.

**Owed for M7:** the production Clerk "convex" JWT template must carry `email` and
`email_verified`, the same as the dev instance, or a new production user's account stores an
empty email and no invite can ever activate. Added to the MOS-77 inventory.

**Files:** `convex/lib/account.ts`, `convex/profileCategories.ts`, `convex/profileLists.ts`,
`convex/profileSymbols.ts`, `convex/studentProfiles.ts`, `convex/studentViewLock.ts`,
`convex/studentViewSessions.ts`, `convex/users.ts`, `convex/accountMembers.ts`,
`convex/crons.ts`, `app/contexts/AppStateProvider.tsx`.

**Code review:** each ticket's commits were reviewed separately (see `.superpowers/sdd/progress.md`
for the per-task ledger); all Approved, with one fix round on the student-profile settings check
(loose "any collaborator" test tightened to `callerOwnsAccount`).
