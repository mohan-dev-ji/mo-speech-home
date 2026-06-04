# Plan — Wire up the language boolean gate (replaces the slot counter)

## Context
ADR-011 §3 was amended this session: the never-built "language slots" counter (Free=1/Pro=2/Max=3) is replaced by a **boolean** — Free is a **monolingual account** (one language at a time, changeable), Pro/Max get **all languages**, switchable at will (the multi-language pattern being one student profile per language). No slot code exists to remove; this is a greenfield gate.

Exploration confirmed the account already has the pieces: tier helpers (`userHasFullAccess`/`requireProTier` + `TIER_REQUIRED` in `convex/lib/access.ts`, `useSubscription`), two language fields (`users.locale` for instructor UI + per-profile `studentProfiles.language`), and Free is already capped at **1 student profile** (`maxStudentProfiles`). The `UpgradeNudge` component + `upgrade.*` copy are the reusable paywall surface.

**Decided UX (user-confirmed): "Switch freely (cascade)."** Free keeps the full language picker and may switch their one language anytime — the change **cascades** so the UI locale + their single profile move together (account stays monolingual). The upgrade nudge fires only on a genuine *second simultaneous* language (a profile in a different language, or UI≠student divergence), which Free can't reach casually because of the 1-profile cap. Pro/Max behaviour is byte-for-byte unchanged.

## Enforcement model
Invariant: **distinct languages across `users.locale` + all `studentProfiles.language` ≤ 1 for a Free account.** Enforced at write-time in the three mutations that set a language. Backend is the source of truth; the client mirrors via `UpgradeNudge`. Rendering/speaking is never blocked (no breakage for grandfathered/downgraded accounts).

## Changes

### 1. Backend guard — `convex/lib/access.ts`
Add `assertLanguageAllowed(ctx, user, nextLanguage, opts)` next to `requireProTier`:
- **Short-circuit:** `if (userHasFullAccess(user)) return { cascade: false }` — Pro/Max/custom-grant unchanged (single line that preserves all paid behaviour; `getMyAccess` already lifts grantees so the client capability matches).
- **Free path:** load the account's profiles via `studentProfiles.by_account_id` (`.collect()`, same pattern used across `studentProfiles.ts`), build the *resulting* distinct-language set after applying the proposed change (`opts.kind`: `"locale"` | `"profile"` with optional `profileId`; no `profileId` = create).
  - `distinct.size ≤ 1` → allow, `{ cascade: false }`.
  - Account currently monolingual **and** this is a *change* of the existing single language (`kind:"locale"`, or `kind:"profile"` with a `profileId`) that would diverge → **cascade**: return `{ cascade: true, cascadeProfileIds: [profiles whose language ≠ next], cascadeLocale: users.locale ≠ next }`. The calling mutation performs the cascade writes (it owns the write ctx).
  - Genuine 2nd language (a *new* profile in a different language, or a change leaving siblings diverged) → `throw new ConvexError({ code: "TIER_REQUIRED", required: "pro", message: "Multiple languages require Pro or Max." })`.

### 2. Wire the guard into the 3 mutations
- `convex/users.ts` → `setMyLocale`: call guard (`kind:"locale"`), patch locale, then apply cascade (patch each `cascadeProfileIds` profile's `language`).
- `convex/studentProfiles.ts` → `updateStudentProfile`: only when `args.language !== undefined`; guard (`kind:"profile", profileId`), patch, then cascade (patch other diverging profiles + `users.locale` if `cascadeLocale`).
- `convex/studentProfiles.ts` → `createStudentProfile`: guard (`kind:"profile"`, no `profileId`) before insert (create only blocks or passes; no cascade).

### 3. Client capability — `hooks/useSubscription.ts`
Add `canUseMultipleLanguages: isPro` to the type + returned object (`isPro` already folds in `hasFullAccess`; custom grants lift tier upstream, so grantees get `true`).

### 4. Picker wiring (catch the gate, show the nudge)
Mirror `LoadPackButton`'s `TIER_REQUIRED` catch — don't pre-filter the option list; let the backend decide, surface the nudge on throw.
- `app/components/app/settings/modals/ProfileModal.tsx`: wrap `handleLangChange` (the `updateProfile` call) in try/catch → on `TIER_REQUIRED` open a new `UpgradeNudge` (import it; add `open` state). Also fix `handleCreate` (the new-profile path, ~line 564) to default `language` to the **account's current language** instead of hard-coded `"en"`, and wrap in the same catch.
- `app/components/app/settings/modals/InstructorProfileModal.tsx`: pull `setMyLocale` out of the `Promise.all` in `handleConfirm`; `await` it in its own try/catch → on `TIER_REQUIRED` open the nudge and skip the `NEXT_LOCALE` cookie + `language_switched` event; on success keep current cookie/redirect behaviour.

### 5. Onboarding — `app/components/app/onboarding/StudentOnboardingGate.tsx`
- Replace the hard-coded `["en","hi"]` chooser with the dynamic list from `getVisibleLanguages` (`{ includeBeta: true }`), mirroring `ProfileModal`'s usage + first-paint fallback; change the `("en"|"hi")` state to `string`.
- On create: call `createStudentProfile({ name, language, ... })` then `setMyLocale({ locale: language })` and write the `NEXT_LOCALE` cookie — so a new Free account starts **consistently monolingual** (profile language = instructor locale), avoiding a day-one `en`-locale + `hi`-profile divergence.

### 6. Nudge copy — `UpgradeNudge` + message catalogues
Extend the `feature` union to include `"multiLanguage"`, widen the `bodyKey` type, and add `upgrade.multiLanguageBody` (+ reuse `proFeatureTitle`) in `messages/en.json` (and `hi`/`es` placeholders per the project's i18n rule). Pass `feature="multiLanguage"` from the pickers.

## Edge cases (decided)
- **Grandfathered divergent Free accounts:** guard only blocks writes that *keep/increase* divergence; never rewrites on read. A collapse-to-one edit is allowed; the app keeps working. No migration.
- **Pro→Free downgrade:** freeze, don't rewrite (Stripe webhook untouched). Multi-language account stays usable; further language changes must collapse to one or re-upgrade.
- **Custom-access grants:** unblocked via the `userHasFullAccess` short-circuit + `getMyAccess` tier lift.
- **Beta/preview languages:** orthogonal — Free may pick a beta language as their one language; `languageLifecycle.tierOverride` (per-language paid) stays out of scope.
- **Pro/Max + collaborators:** unchanged (short-circuit; collaborators write only their own locale, no profiles).

## Critical files
- `convex/lib/access.ts` (new guard) · `convex/users.ts` (`setMyLocale`) · `convex/studentProfiles.ts` (`create`/`updateStudentProfile`)
- `hooks/useSubscription.ts` (capability)
- `app/components/app/onboarding/StudentOnboardingGate.tsx` (onboarding)
- `app/components/app/settings/modals/ProfileModal.tsx` + `InstructorProfileModal.tsx` (nudge wiring)
- `app/components/app/shared/ui/UpgradeNudge.tsx` + `messages/*.json` (copy)

## Verification (running app, dev server already up)
1. `npx convex dev --once` + `npx tsc --noEmit` — guard typechecks against all three call sites.
2. **Free switch (cascade):** Free account, one `en` profile → switch it to `hi` in ProfileModal → Convex dashboard shows BOTH `users.locale` and the profile now `hi`; URL redirects to `/hi/...`; no nudge.
3. **Free instructor locale change:** InstructorProfileModal → change locale → single profile follows (cascade), no nudge.
4. **Free blocked:** (force a 2nd profile via dashboard, or attempt locale≠profile) → expect `UpgradeNudge`, no write.
5. **Pro/Max allowed:** with Pro (or a custom grant) create `en`+`hi`+`es` profiles, diverge locale freely → all succeed, never a nudge; `useSubscription().canUseMultipleLanguages === true`.
6. **Onboarding:** fresh sign-up picking Hindi → new profile `language:hi` AND `users.locale:hi`, routes to `/hi`.

## Out of scope
Per-language paid tiers (`languageLifecycle.tierOverride` enforcement), a migration to auto-collapse grandfathered accounts, the admin languages console (ADR-012), and the translator surface (ADR-013).