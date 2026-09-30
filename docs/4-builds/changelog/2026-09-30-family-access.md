# 2026-09-30: Family access

**Milestone:** M2 Billing truth (Final straight project) · **Issues:** MOS-88, MOS-94
**Spec:** [FEAT-108](../features/FEAT-108-pricing-and-tiers.md) ·
[FEAT-106](../features/FEAT-106-settings.md) ·
[FEAT-301](../features/FEAT-301-instructor-and-student-views.md) ·
[FEAT-109](../features/FEAT-109-sign-up-and-onboarding.md) · **Plan:**
[phase-40-family-access-plan](../plans/_done/phase-40-family-access-plan.md)

Family invites are a Max feature, and until now they didn't work as sold. An invited carer was
held to their own plan, anyone signed in could make the invite email go out, and someone who
already had an account was never added. This phase fixes all three.

- **MOS-88: a carer works with the family's plan.**
  - An invited carer works inside the family's account with the family's plan, whatever their own
    plan is. `resolveCallerAccountId` (`convex/lib/account.ts`) now also returns `planUser`, the
    family owner's record, and every plan gate reads it. For an owner nothing changes.
  - Carers can lock and unlock student view (`convex/studentViewLock.ts`).
  - Carers can see and switch between the family's children (`convex/studentProfiles.ts`). Their
    choice is saved on their own record, so it never moves the owner's child, and the owner's
    choice doesn't move theirs. Adding, deleting, renaming and changing a child's language or
    voice stays with the owner.
  - Billing is owner-only. The Account & Billing tab was already hidden for carers. Now the five
    billing routes (checkout, portal, switch plan, cancel, reactivate) also refuse anyone who
    isn't the owner, through one shared guard (`lib/billingOwner.ts`). It fails closed.
  - `reseedAccount` is no longer public. It can wipe an account's boards, so a carer with the
    family's plan must never be able to call it.
- **MOS-94: invites are checked, and existing users can join.**
  - Only the family owner, on Max, can invite, and the invite email is only sent for an invite
    the owner has already created (`accountMembers.canSendInvite`, checked by `app/api/invite`).
    Carers can't invite, and you can't invite your own email.
  - Someone who already has an account joins on their next sign-in (`acceptPendingInvite`), with
    the same identity rules as sign-up: a verified email, matched in lower case. If their own
    account has students, they aren't added, and Home shows a notice asking the family to invite
    a different email.
  - The Invites panel now says so when the invite email couldn't be sent, instead of claiming
    success. The pending invite stays in the table.

**Personal and shared settings (confirmed in testing).** In instructor view, grid size, text size,
theme and language are each adult's own. Student-view settings belong to the child and are shared
by the family. **Everyone in a family edits the same boards.** Deletes are shared too, and there is
no undo yet.

**Verified 2026-09-30:** in the owner's Chrome, with a real invite to a brand-new email. The carer
landed in the family, their symbol and list went into the family's account, the Upload tab was open
(the family is on Max), billing was hidden and its routes refused, lock and unlock worked, and the
switcher showed the family's child. Command-line checks running functions as different accounts
covered the rest.

**Known edge case:** an owner who has carers but no students can still accept another family's
invite.

**Owed for M7:** in development, Clerk's invite emails landed in spam. Check the production sender
domain at launch. Added to the M7 notes in the Final straight doc.

**Not built, post-launch:** an account switcher, and a way for a carer to leave a family.

**Files:** `convex/lib/account.ts`, `convex/accountMembers.ts`, `convex/studentProfiles.ts`,
`convex/studentViewLock.ts`, `convex/users.ts`, `convex/accountImages.ts`,
`convex/profileCategories.ts`, `convex/profileLists.ts`, `convex/profilePhrases.ts`,
`convex/profileSentences.ts`, `convex/profileSymbols.ts`, `convex/contentModules/`,
`lib/billingOwner.ts`, `app/api/invite/route.ts`, `app/api/stripe/`,
`app/components/app/settings/sections/InvitesPanel.tsx`,
`app/components/app/shared/ui/BreadcrumbViewModeDropdown.tsx`,
`app/components/app/home/ui/InviteNotice.tsx`, `app/contexts/AppStateProvider.tsx`.

**Code review:** each task's commits were reviewed separately (see `.superpowers/sdd/progress.md`
for the per-task ledger); all Approved, with fix rounds on the billing guard and the invite edge
cases.
