# Family Members and Account Collaborators

## Overview

Mo Speech Home is built for the whole family, not just the primary instructor. A second parent, a grandparent, or an older sibling can all be invited to the same account and use the app with the student — including running modelling mode.

---

## Account Structure

```
account (primary instructor — Stripe subscription holder)
  ├── studentProfile (the student's AAC profile)
  └── accountMembers[]
        ├── { email, role: "owner",        status: "active" }    ← primary instructor
        ├── { email, role: "collaborator", status: "active" }    ← second parent
        └── { email, role: "collaborator", status: "pending" }   ← grandparent (invited)
```

---

## Roles

**Owner**
- The Stripe subscription holder
- Can invite and remove collaborators
- Can delete the account and student profile
- Full access to all features

**Collaborator**
- Invited by the owner via email
- Gets their own Clerk account
- Full access to all AAC features — same as owner
- Can run modelling mode
- Cannot manage billing or remove the owner
- Can be removed by the owner at any time

---

## Invite Flow

1. Owner goes to Settings → Family Members → Invite
2. Enters the collaborator's email address
3. An invite email is sent (via Clerk or a Nodemailer API route)
4. An `accountMembers` record is created with `status: "pending"`
5. Collaborator clicks the link in the email, creates a Clerk account (or signs in if they already have one)
6. They are linked to the account — `status` updates to `"active"`
7. They can now open Mo Speech Home and access the student's profile

---

## Shared State

All collaborators share:
- The same student profile
- The same categories, lists, sentences, first-thens
- The same state flags
- The same modelling session history

Changes made by any collaborator are immediately visible to all others via Convex subscriptions.

---

## Convex Schema

```typescript
accountMembers: {
  _id: Id<"accountMembers">
  accountId: Id<"users">           // the owner's user record
  email: string
  clerkUserId?: string             // populated when invite is accepted
  role: "owner" | "collaborator"
  status: "pending" | "active"
  invitedAt: number
  joinedAt?: number
}
```

---

## Future Consideration — Student's Own Account

As the student grows and gains independence, they may eventually want their own Clerk account to log in and use the app independently. This is not in scope for V1 — the student is always a profile, not a user. The architecture supports adding this later by linking a Clerk account to the `studentProfile` record without restructuring the account model.
