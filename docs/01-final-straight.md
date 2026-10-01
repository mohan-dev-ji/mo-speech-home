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

- **Plans** keep counting `phase-NN` in `4-builds/plans/` (next is **phase-38**. phase-37 was M0's credits filter). That is the
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

> **2026-09-25:** company setup joins M2. The payment account is opened on the Ltd, so the order is: IP side letter (MOS-57) → incorporate (MOS-58) → move checkout to **Stripe Managed Payments** as merchant of record (MOS-59, [ADR-025](4-builds/decisions/ADR-025-stripe-managed-payments-mor.md)), with MOS-29 done in the same routes.

> **2026-09-28:** MOS-87, MOS-28, MOS-29 and MOS-49 are built and merged to `main`, pending the
> owner's browser verification (checkout, portal, a fresh sign-up, and the Pro/Max symbol editor).
> MOS-59's remainder — the actual Managed Payments cut-over — waits on MOS-58 (the Ltd). While
> building MOS-49, a new gap surfaced: every access gate reads the **caller's own** plan, not the
> host account's, so a Family-invited collaborator on Free can't use a Max host's editing features.
> That's **MOS-88**, filed for its own M2 slot. See the changelog:
> [2026-09-28-billing-truth](4-builds/changelog/2026-09-28-billing-truth.md).

> **2026-09-28 (review):** a whole-phase review locked the last public user-data functions, put
> TTS tones and invites on the one Max rule, and made the Stripe webhook record honest statuses.
> It filed **MOS-90** for M2 (a pending invite can be claimed through the sign-up mutation, which
> trusts the browser's user ID and email) and **MOS-91** for M5 (client gates read the stored plan
> tier, not the effective one).

> **2026-09-29:** **MOS-90** and **MOS-92** are **Done and verified.** Every board read (category,
> its symbols, list, single symbol), student-view lock, presence and per-profile settings now
> check the caller's own account, including a host's profiles for invited carers. Sign-up reads
> the Clerk ID and email from the verified token, invites only activate once Clerk confirms the
> email, and emails are stored lower-case. Checked as two accounts from the command line and in
> the owner's Chrome; a fresh sign-up made its own record correctly. Filed **MOS-94** (an invite
> to someone who already has an account never activates). See the changelog:
> [2026-09-29-account-isolation](4-builds/changelog/2026-09-29-account-isolation.md).

> **2026-09-29:** verified in the owner's Chrome and against the live dev deployment. Every closed
> loophole refuses the call, signed out and signed in (Free, Pro and Max). A fresh sign-up is Free. A
> Stripe test checkout and a plan switch both reach the account through the webhook. The editor's
> Upload and My Images tabs lock below Max. The library shows Instruments and Clothes as Max. A bad
> price ID shows the "payments aren't available" message. MOS-87, MOS-28, MOS-29 and MOS-49 are
> **Done**; phase-38's plan is in `plans/_done/`. Open in M2: MOS-90, MOS-92, MOS-88, and MOS-59's
> Ltd steps.

> **2026-09-30:** **MOS-88** and **MOS-94** are **Done and verified.** An invited carer works in the
> family's account with the family's plan, can lock and unlock student view, and can choose between
> the family's children. Billing is owner-only: the tab is hidden and all five billing routes refuse
> anyone else. Only the family owner, on Max, can invite. Someone who already has an account joins on
> their next sign-in unless their own account has students, in which case Home shows a notice. Checked
> from the command line and in the owner's Chrome with a real invite to a brand-new email. See the
> changelog: [2026-09-30-family-access](4-builds/changelog/2026-09-30-family-access.md). Open in M2:
> MOS-59's Ltd steps.

> **2026-10-02:** **MOS-93** is **Done and verified.** An upgrade now charges the
> difference and starts at once; a downgrade or a monthly/yearly switch is booked for the next
> billing date and can be undone. Planning it turned up a worse bug: switching monthly to yearly
> gave a year for one month's price. Stripe Managed Payments supports everything this needs
> (checked in the sandbox), but it adds tax on top of the price, which MOS-59 has to settle. A Max
> family now shares one AI picture allowance. See the changelog:
> [2026-10-01-plan-switches](4-builds/changelog/2026-10-01-plan-switches.md). Test account A has a
> downgrade booked for 29 October: check after that date that it landed. The review filed
> **MOS-96**, **MOS-97** and **MOS-98** for M5. Open in M2: MOS-59's Ltd steps.

Small code, one real decision. Must land before anything writes pricing copy.

1. **MOS-28** — new accounts created in a free-consistent state; clear existing `trial` rows; drop
   the literal or document why it stays. Schema touch: data first, validator second.
2. **MOS-29** — try/catch on checkout and the four sibling routes; log type/code/message
   server-side; distinguish misconfiguration from card problems in the toast; a price-ID health
   check for key rotations.
3. **MOS-49** — decide: what free gates (click-and-play only?), whether a `starter` tier exists,
   which tier gets AI and at what ceiling, Stripe price IDs. If `starter` is chosen it is schema +
   gate work and gets its own plan.
4. **MOS-90**: the sign-up mutation takes the user ID and email from the browser and activates any
   pending invite for that email. Read both from the sign-in token so an invite can't be taken over.

Exit: a pricing table you would put on a public page.

### M3 — Admin surfaces  *(admin symbol editor + affiliates)*

> **2026-09-25:** Stripe Connect isn't available on an SMP account (ADR-025), so the affiliate payouts below move to a third-party tool or Global Payouts. See MOS-62.

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
- **MOS-91**: client-side gates read the stored plan tier; switch them to the effective tier
  (`tier` and `hasFullAccess` from `getMyAccess`) so the UI matches the server.

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
- **The production Clerk instance needs the "convex" JWT template with `email` and
  `email_verified` claims** (from phase-39, MOS-90/92), the same as the dev instance already has.
  Without it, a new user's account stores an empty email and no invite can ever activate. Add this
  to the MOS-77 inventory.
- **Check the invite email sender.** In development, Clerk's invite emails landed in spam. Before
  launch, check that the production sender domain is set up so family invites reach the inbox.
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
- ✅ 2026-09-25 (vault triage): **structure changed.** M3, M4 and M6 are **milestones inside *Final straight***, not separate projects, so M0→M7 reads as one chronological list of everything left before launch. The global vault inbox is empty; every idea is now a ticket or filed post-launch.

  | Milestone | Issues (in order) |
  |---|---|
  | M0 Clear the deck | MOS-43, MOS-42, MOS-38 |
  | M1 Docs truth | MOS-54 features rewrite (from `4-builds/features/_owner-brief.md`) → MOS-55 housekeeping → MOS-56 seed `5-prd/` |
  | M2 Billing truth | MOS-57 IP side letter → MOS-58 incorporate Ltd → MOS-59 SMP migration (+ MOS-29) · MOS-28 · MOS-49 pricing · MOS-87 server-only billing functions · MOS-88 collaborators use the host's plan · MOS-90 invite takeover via sign-up · MOS-92 account-scoped reads · MOS-94 invite to an existing account never activates · MOS-93 plan switches charge and land when they should |
  | M3 Admin surfaces | MOS-60 symbol editor design → MOS-61 build · MOS-37 · MOS-62 affiliates |
  | M4 Pro & Max themes | MOS-63 design loops → MOS-64 build + tier gating · MOS-65 `/admin/themes` editor |
  | M5 Hardening | MOS-51 · MOS-53 · MOS-66 home/school invites · MOS-67 Hindi checklist · MOS-68 full regression · MOS-91 client gates use the effective tier · MOS-96 quota functions trust the browser's limits · MOS-97 checkout allows a second subscription · MOS-98 reconcile a missed webhook |
  | M6 Marketing | MOS-69 design system doc · MOS-70 site design → MOS-71 site build · MOS-72 3D GFX · MOS-73 explainers → MOS-74 promo edits |
  | M7 Deploy | MOS-75 data protection · MOS-76 trademark · MOS-77 MVP resource inventory · MOS-78 Convex export → MOS-79 cut-over / launch |

  Labels: `design` (Figma work), `business` (company/legal; details live privately in the vault, never in this public repo), `ADR-025` (payments). Post-launch, deliberately not in the project: R&D claim, grants, SEIS, MOS-32, MOS-45, Phases 17–18.
