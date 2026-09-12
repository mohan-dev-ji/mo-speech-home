# Mo Speech Home — Final Straight

> **Status:** Living roadmap from 2026-09-07 to launch. Supersedes the *ordering* in
> [`00-roadmap.md`](00-roadmap.md), which is frozen as the build record (phases 0–18 and every
> architectural note in it stay valid; its "Refined Execution Order" table is now history).
> Read this file for *what comes next*; read `00-roadmap.md` for *why the app is shaped the way it is*.

## Where the build is

Authoring and testing are done. Phases 13–36 shipped the content-module architecture, the sentence
builder, bilingual symbols, the image pipeline (search, AI generate, My Images) and the default
module remake. The product works. What remains is the work that turns a working app into a
launched product: truthful docs, a settled price, the admin surfaces an operator and an affiliate
need, the visual differentiator (animated themes), the marketing layer, and the cut-over from the
MVP.

Two numbering systems, kept separate on purpose:

- **Plans** keep counting `phase-NN` in `4-builds/plans/` (next is **phase-37**). That is the
  build ledger.
- **This roadmap** uses named **milestones M0–M7**. A milestone is a goal, not a plan; one milestone
  may spawn several phase plans.

---

## Backlog audit — 2026-09-07

Every open Linear issue was re-checked against `main` at `fb9781d`. Twelve are open; one is
superseded, one project is finished but not marked so.

### Close now (no work)

| Issue | Why |
|---|---|
| **MOS-46** aiImageCache key omits the style template | **Superseded.** ADR-023 / phase-34 removed `aiImageCache` entirely (no table, no `aiImageCacheHashInput`, no reader). There is no cache to key. Close as *Canceled — superseded by ADR-023*. |
| **Project "Default modules remake"** | Every child is Done or Canceled (MOS-11/12/13/17/24/25 done; 14/15/16/18–23 canceled). The project sits in *Backlog*. Mark **Completed**. |

### Still real, verified in code

| Issue | Verified state on `main` | Size |
|---|---|---|
| **MOS-43** Image Search tab auto-runs a metered search | `ImagesTab.tsx:80` still fires `/api/image-search/search` from a `useEffect` on `debouncedSearch`, seeded from the label. `AiGenerateTab` only fetches on press, so it is not affected. | S |
| **MOS-42** Stale `imageCredits` rows after uninstall | `getAccountImageCredits` (`convex/imageCredits.ts:92`) still returns every row with no join to referenced keys. Option 1 (read-time filter via `imageCreditRefs`) is the agreed shape. | S–M |
| **MOS-53** Phase-36 follow-ups | Re-verified 2026-09-07: the *feature* is finished (ADR-024 delete model matches the code) but the review minors are mostly still present. Reshaped: two code items kept (collaborator upload 400s in `upload-asset`; My Images query runs on every editor open) → **M5**; two docs items → **M1**; the rest cancelled with a note. | S |
| **MOS-38** Provenance shape declared 4× | `imageProvenanceFields` in `schema.ts:162` plus byte-identical `imageProvenanceSchema` in `profileLists.ts`, `profileSentences.ts`, `profilePhrases.ts`. | S |
| **MOS-28** 14-day "trial" default | `convex/users.ts:138–148` still inserts `status: "trial"`; `"trial"` still in the status union. | S (schema touch) |
| **MOS-29** Stripe checkout swallows errors | `app/api/stripe/checkout/route.ts` has no try/catch. Siblings unchecked. | S |
| **MOS-49** Pricing rethink | Decision ticket, not code. Tier price and AI ceiling are one decision. | Decision |
| **MOS-37** translate-modules skips custom-image labels | Route header still says symbol labels are not translated here. `instruments`, `storybook`, `clothes` ship English labels on HI/ES boards until fixed. | M |
| **MOS-51** Lint triage (23 set-state-in-effect) | `npm run lint` today: 36 errors, 29 warnings. Unchanged. | M |
| **MOS-32** Per-language category symbol variants | No variant columns on `profileCategories` / `profileSymbols`. Real differentiator, large schema change, not blocking anything. | L |
| **MOS-45** Student profile photo | Whole data path exists, no writer. Owner: not wanted now. | Parked |

### Duplicates waiting in the vault

`~/Vault/00_inbox` holds two notes that already exist as tickets. When `/vault-triage` runs, link
them rather than creating new issues:

- *Stripe – Silent checkout failure* → **MOS-29**
- *Trial default* → **MOS-28**

The rest of the inbox maps onto milestones below (noted per milestone) and should become tickets
only when that milestone is next.

---

## The milestones, in order

Order is driven by dependencies, not by size:

- Docs before marketing, because the PRD is what the marketing copy is written from.
- Pricing before the marketing site and before themes, because both need to know what each tier
  gets.
- Admin surfaces before the SLT pilot, because the affiliate flow and the symbol editor are what
  the pilot exercises.
- Hardening and cut-over last, because the UI is still moving (see the marketing-capture rule:
  never film from an in-progress build).

### M0 — Clear the deck  *(small, fresh-context fixes; empties the backlog for `/vault-triage`)*

Do these while the phase-36 code is still in your head. One plan, `phase-37-image-hygiene`.

1. Close **MOS-46**; mark project *Default modules remake* Completed.
2. **MOS-43** — metered tabs search on intent only (Enter / button); SymbolStix tab keeps auto-search.
3. **MOS-42** — read-time filter in `getAccountImageCredits` against referenced keys. Rows never deleted.
4. **MOS-38** — one `convex/lib/imageProvenance.ts`, imported by the three `profile*.ts`; bring
   `displayPropsSchema` along.

Exit: backlog holds only MOS-28/29/49 (billing), MOS-37/51/53 (scheduled below), MOS-32/45 (parked).

### M1 — Docs truth pass  *(the "restructure features docs" item)*

The features folder describes intentions, not the shipped app: FEAT-001 says *Not started*,
FEAT-004 *Proposed*, FEAT-005 *Draft for review* — all three shipped months ago. Five of the 24
origin ideas carry a superseded banner; more should.

- Rewrite `4-builds/features/` as one spec per **capability the app has today**: categories,
  lists, sentences (fluent + block), phrases, talker, symbol editor (five tabs), image library,
  modelling mode, languages, themes, library + modules, settings + billing, admin. Each spec:
  problem / what it does / edge cases / where the code lives. Add **FEAT-009 image library**
  (MOS-53 asks for it). Add a `features/README.md` index readable by marketing.
- **MOS-53 docs items**: ADR-023 gets a one-line forward pointer to ADR-024; FEAT-009 is the
  image-library spec named above.
- Freeze `00-roadmap.md` with a banner pointing here. Do not delete content from it.
- Seed `5-prd/` from the rewritten specs — it is the source for marketing copy per the MOC.
- Banner every origin idea in `1-inbox/ideas/` as *shipped as FEAT-00N* or *superseded by ADR-NNN*.

Vault notes that belong here: *Create a features docs index*, *App design system doc* (the design
system doc is the marketing hand-off; it can be written here or at the start of M6).

### M2 — Billing and pricing truth

Small code, one real decision. Must land before anything writes pricing copy.

1. **MOS-28** — new accounts created in a free-consistent state; clear existing `trial` rows; drop
   the literal or document why it stays. Schema touch: data first, validator second.
2. **MOS-29** — try/catch on checkout and the four sibling routes; log type/code/message
   server-side; distinguish misconfiguration from card problems in the toast; a price-ID health
   check for key rotations.
3. **MOS-49** — decide: what free gates (click-and-play only?), whether a `starter` tier exists,
   which tier gets AI and at what ceiling, Stripe price IDs. If `starter` is chosen it is schema +
   gate work and gets its own plan.

Exit: a pricing table you would put on a public page.

### M3 — Admin surfaces  *(admin symbol editor + affiliates)*

Both live in `/admin`, both are what the India SLT pilot exercises, so they ship together.

- **Admin symbol editor** — `1-inbox/ideas/22-admin-symbol-editor.md` (status *shaping*) and the
  vault note *Admin dashboard language editor*. Search the `symbols` table with the app's search
  algorithm, open a symbol, see the image with every language's label, edit. Adds the **GLP
  connected-words field** as symbol metadata; the field is the data the post-launch GLP phases
  build on, so it ships empty and fills from SLT work. Brainstorm first, Figma second, per the
  idea note.
- **MOS-37** — folded in: `translate-modules` falls back to the module row's own label when there
  is no `symbols` row. Same domain (symbol labels), and the pilot's Hindi boards need it.
- **Affiliates** — roadmap Phase 12 as written (`16-affiliates.md`, vault *Affiliates set-up*):
  Stripe Connect Express, four-state admin section, referral cookie, commission events on
  checkout and invoice, automatic transfer. Depends on M2's price IDs.

Exit: the SLT can be granted affiliate status and can report a symbol correction from inside the
app.

### M4 — Pro and Max themes

Vault note *Pro and Max themes*. Animated, looping, textured backgrounds; the `/admin/themes`
lifecycle page reviewed and extended (roadmap 9.4). Depends on M2 for which tier gets which
themes. Uses Figma and Remotion. This is the visual differentiator the marketing material is
built around, so it precedes M6.

### M5 — Hardening

The original roadmap Phase 16, minus the docs work already done in M1.

- **MOS-51** — lint triage, one hook at a time; browser-check anything touching theme, category
  order or list/sentence state. Record the new lint baseline in the ticket.
- **MOS-53** (reshaped) — `upload-asset` resolves the host account via `resolveCallerAccountId`
  so a collaborator can upload; My Images query stays `"skip"` until the tab is first opened.
- Home/school invite-link testing (roadmap Phase 11 hypothesis).
- Hindi launch checklist (`00-roadmap.md` §"Hindi Launch Checklist").
- Cross-language, cross-theme, dual-profile regression.

### M6 — Marketing site and promo material

Vault notes *Marketing site design*, *Marketing GFX material*, *App design system doc*.
Site copy comes from `5-prd/` (M1) and the pricing table (M2). Screen captures and the Blender /
Remotion material are filmed **only** from the M4/M5 build, never earlier. The site can be
designed in parallel with M3–M5; the footage cannot.

### M7 — Deploy: full build replaces the MVP

Preconditions that are not code:

- The MVP has 100+ live users and organic signups (see memory: audit before decommissioning any
  shared GCP project). Clerk is shared between the MVP and this build, so the user pool carries
  over, but every shared Google Cloud / Stripe / R2 resource needs an inventory first.
- `npx convex export` full snapshot before the DNS change.
- Convex plan/region review at real traffic (Starter EU today; see `CLAUDE.md`).

Then: Vercel project on the existing URL, MVP archived, launch.

---

## After launch (unchanged from the old roadmap)

- **Phase 17** language humanisation + GLP datasets — fed by the connected-words field from M3 and
  by SLT data from the pilot. Deliberately not scheduled until that data exists.
- **Phase 18** GLP surface features — morphology, prediction, keyboard page.
- **MOS-32** per-language category symbol variants — pull forward only if the pilot's Hindi
  feedback demands it.
- **MOS-45** student profile photo — parked, owner's call.

---

## Linear housekeeping to match this doc

- ✅ 2026-09-07: MOS-46 canceled as superseded; *Default modules remake* project marked Completed;
  MOS-53 reshaped to two code items (M5) with its docs items moved to M1.
- **Structure.** Everything sits under the existing initiative *Mo Speech Home*. A Linear
  **project** is a body of work with its own start, end and status updates; a **milestone** is
  ordering inside one. So:
  - One project **Final straight** with milestones *M0 Clear the deck*, *M1 Docs truth*,
    *M2 Billing truth*, *M5 Hardening*, *M7 Deploy*. These are fix bundles of three to six
    tickets each and do not earn a project of their own (the *Default modules remake* project
    sitting in Backlog after all its work shipped is the overhead to avoid).
  - Standalone projects, created by `/vault-triage` when their notes are promoted:
    **Admin surfaces** (milestones *Symbol editor*, *Affiliates*), **Pro & Max themes**
    (*Design*, *Build*, *Admin page*), **Marketing** (*Site*, *GFX material*). Each has design
    and build stages and deserves a progress view.
- ✅ 2026-09-07: project **Final straight** created under *Mo Speech Home* with milestones M0, M1,
  M2, M5, M7 ([linear](https://linear.app/mo-intelligence/project/final-straight-f80a6fc1fa3d)).
  MOS-43/42/38 → M0; MOS-28/29/49 → M2; MOS-51/53 → M5. MOS-37 waits for the Admin surfaces project.
- MOS-32 and MOS-45 stay in Backlog with the *parked* label rather than being cancelled; the
  descriptions are the record.
