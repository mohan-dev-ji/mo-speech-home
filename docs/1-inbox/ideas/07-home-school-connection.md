# Home and School Connection

## The Problem This Solves

In current AAC practice, a child has one device configured by their teacher and a completely different setup at home configured by their parent. These two worlds never communicate. The child must context-switch between different symbol layouts, different vocabulary, and different sentence structures depending on where they are. This is harmful to communication development — consistency across environments is one of the most important factors in AAC success.

---

## The Solution — Shared Child Identity

A third Convex project — `convex-identity` — acts as a thin shared layer above both apps. It holds only the child's identity and the relationships between that identity and their Home and School profiles. All content (categories, lists, sentences, first-thens, state flags) remains entirely within its respective app's Convex project and is never merged or automatically synced.

```
convex-home        ← Mo Speech Home backend (parent owns this)
convex-school      ← Mo Speech School backend (teacher owns this)
convex-identity    ← Shared child identity (neither owns exclusively)
```

---

## Linking Home and School

1. Parent creates the child in Mo Speech Home → `convex-identity` creates a `childIdentity` record and generates a short invite code (e.g. `MOS-4829-XK`)
2. Teacher enters the invite code in Mo Speech School → `convex-school` creates a school profile for the child → `convex-identity` links the two profiles
3. Both apps are now connected — no content is shared or merged

---

## Context Switching

The child's device holds an `activeContext: "home" | "school"` flag in `convex-identity`. Switching context loads the corresponding profile.

**Who can switch context:**
- The parent (from Settings in Mo Speech Home)
- The teacher (from Settings in Mo Speech School)
- The child themselves (if permissions allow)

Switching context does not merge, copy, or affect either profile. It only changes which profile the child's device is currently displaying.

---

## Read-Only Cross Visibility

Neither party sees the other's profile by default. Visibility must be explicitly granted.

- **Parent viewing school profile** — Mo Speech Home makes a read-only HTTP action call to `convex-school`; returns a read-only snapshot; parent cannot edit anything
- **Teacher viewing home profile** — same mechanism in reverse

This is useful practically: a parent seeing what the teacher has built can choose to reinforce the same vocabulary at home — not automatically, but as a deliberate decision. That conscious reinforcement is more developmentally valuable than automatic merging.

---

## Sharing Inbox

Either party can share content to the other. A teacher can share a category, list, sentence, or first-then — the parent receives it in their inbox and can review, accept, or decline. The same works in reverse.

**Sending:**
- Tap "Share with Home" on any category, list, sentence, or first-then in Mo Speech School
- A `shareRequest` document is created in `convex-identity` with a full serialised snapshot of the item at the time of sending
- Mo Speech Home shows an inbox badge (driven by a Convex subscription to pending requests)

**Receiving — staging area:**
- Parent opens their inbox and previews the incoming item in full
- Three options: **Accept** (item copied into Home profile as independent editable content), **Decline** (removed from inbox), **Dismiss** (stays for later)
- Accepted items are fully independent from the original — editing them has no effect on the school version

**What can be shared:**
- Categories (including all symbols and ordering)
- Lists, sentences, first-thens

**What cannot be shared:**
- State flags (permissions are per-profile)
- Custom audio overrides (audio lives in the sending app's R2)

---

## Cross-Project API Pattern

Cross-project reads use HTTP Actions — the recommended approach:

- `convex-school` exposes a dedicated read-only HTTP endpoint authenticated by a shared secret + the child's school profile ID
- Mo Speech Home calls this endpoint from a Convex HTTP action when the parent requests the school profile view

Prototype this cross-project call early — it is the critical seam between the two systems and must be verified before building context switching or read-only views around it.

---

## convex-identity Schema

```typescript
childIdentity: {
  _id: Id<"childIdentities">
  name: string
  dateOfBirth?: number
  profilePhoto?: string
  language: string
  activeContext: "home" | "school"
  homeProfileId?: string
  schoolProfileId?: string
  inviteCode: string
  createdAt: number
  updatedAt: number
}

shareRequest: {
  _id: Id<"shareRequests">
  childIdentityId: Id<"childIdentities">
  fromApp: "home" | "school"
  toApp: "home" | "school"
  senderClerkId: string
  itemType: "category" | "list" | "sentence" | "firstThen"
  itemId: string
  itemSnapshot: object             // full serialised copy at time of sending
  status: "pending" | "accepted" | "declined"
  sentAt: number
  resolvedAt?: number
  resolvedBy?: string
}
```

---

## Mo Speech School — Key Differences from Home

| Aspect | Home | School |
|---|---|---|
| Account model | One parent → one child | One teacher → many students |
| Student access | Child has no Clerk account | Students join via invite link |
| Content ownership | Parent owns categories | Teacher owns categories, shared to class |
| Modelling | One-to-one | One-to-many broadcast |
| Pricing | Per family subscription | Per teacher subscription, unlimited students |

School is best built as a refactor of Home — same architecture, different account model and class management layer.
