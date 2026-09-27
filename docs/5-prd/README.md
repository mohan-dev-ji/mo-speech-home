# 5-prd

Product requirements. What the product needs to do and for whom.

Put here:
- User stories: `As a [user], I want to [action] so that [outcome]`
- Acceptance criteria for features
- Roadmap items with priority and rationale
- Constraints: legal, technical, business

**Rule:** PRD is the source of truth for *what* to build. It does not describe implementation — that's `4-builds/`. If a stakeholder asks why something works a certain way, the answer is in the PRD.

AI agents read this folder to understand scope and avoid building features that weren't requested.

---

## Contents

As the MOC says, Mo Speech's PRD is written after the fact: it's a record of what the shipped product does and for whom, and it drives the marketing material (M6). The feature specs in [`4-builds/features/`](../4-builds/features/README.md) describe *how* each capability behaves. This folder says *why* and *for whom*.

| File | What's in it |
|---|---|
| [`00-product.md`](00-product.md) | The product in one page: the problem, what it is, what makes it different, principles |
| [`01-users.md`](01-users.md) | Who it's for: instructor, student, SLT, and (future) schools |
| [`02-constraints.md`](02-constraints.md) | Markets and languages, children's data, plans, licensing, devices, accessibility |
| [`10-stories-pages.md`](10-stories-pages.md) | User stories and acceptance criteria: pages (FEAT-101–110) |
| [`20-stories-components.md`](20-stories-components.md) | … components (FEAT-201–206) |
| [`30-stories-modes.md`](30-stories-modes.md) | … modes and looks (FEAT-301–305) |
| [`40-stories-admin.md`](40-stories-admin.md) | … admin (FEAT-401–408) |
| [`50-scope.md`](50-scope.md) | Shipped, before launch, planned, and deliberately not planned |

Keep it in step: when a feature spec changes in a way a family would notice, update its stories here too.
