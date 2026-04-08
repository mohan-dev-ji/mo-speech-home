# ADR-001 — Instructor / Student Terminology

**Date:** 2026-04-08
**Status:** Accepted

---

## Context

The original docs and schema used **parent** and **child** to describe the two user roles in Mo Speech Home. These terms caused two problems:

1. **Ambiguity in data modelling.** "Parent container" is a standard data structure term used throughout the codebase (a category as the root container for symbols, lists, sentences, and first-thens). Having "parent" mean both a user role and a data relationship created confusion when reading schema discussions and build plan docs.

2. **Inaccurate scope.** Mo Speech Home is not exclusively for parents and children in the biological sense. The instructor role can be filled by a grandparent, an older sibling, a family friend, a speech-language therapist, or a carer. The AAC user (historically called "child") is described more accurately as a student — the person being supported in building communication.

---

## Decision

Replace all role-based uses of **child** and **parent** with **student** and **instructor** throughout all docs and schema.

| Old | New |
|---|---|
| `child` (role) | `student` |
| `parent` (role) | `instructor` |
| `childProfile` | `studentProfile` |
| `childProfiles` | `studentProfiles` |
| `childIdentity` | `studentIdentity` |
| `childIdentities` | `studentIdentities` |

**Preserved as-is:**
- `"parent container"` / `"universal parent container"` — data structure term, unambiguous in context
- Natural family language in descriptive prose — "a grandparent, a second parent, or a sibling can all be collaborators" remains correct and human
- General population references — "non-verbal children" as an AAC population description (not a role name)

---

## Consequences

- All docs in `docs/1-inbox/ideas/` updated
- Convex schema table names will use `studentProfiles`, `studentIdentities` from day one
- `convex-identity` HTTP actions and mutations use `studentIdentity` / `createStudentIdentity`
- The `PermissionContext` user role uses `student-view` (not `child-view`)
- The in-app UI toggle is "Student View" (not "Child View")
- `useSubscription()` hook returns `maxStudentProfiles` (not `maxChildProfiles`)
