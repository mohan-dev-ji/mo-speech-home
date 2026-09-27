# User stories · Layer 4: admin

Internal. The users here are the **Mo Speech team** (admins), not families.

---

## FEAT-401 · Admin dashboard · [spec](../4-builds/features/FEAT-401-admin-dashboard.md)

- As an **admin**, I want the key numbers at a glance, so that I know how Mo
  Speech is being used.

**Acceptance**

- Only accounts with the admin role can open it. Everyone else is redirected.
- The overview shows total users, users by plan, and activity and sign-ups in
  the last 7 days.

## FEAT-402 · Admin authoring · [spec](../4-builds/features/FEAT-402-admin-authoring.md)

- As an **admin**, I want to build content in the app and publish it, so that
  families get exactly what I made, without a developer.
- As an **admin**, I want to choose who gets it (every new account, or a plan),
  so that content supports the pricing.

**Acceptance**

- A category, list group, sentence group, or the dropdown's core words and
  phrases can be published as Default, Free, Pro or Max.
- It's live straight away. Updating never changes families' existing copies.
- Pictures, recordings and photo credits travel with the module.
- Free modules contain only SymbolStix content.

## FEAT-403 · Backup & restore · [spec](../4-builds/features/FEAT-403-backup-and-restore.md)

- As the **team**, we want our content and translations recoverable, so that no
  mistake or outage loses months of work.

**Acceptance**

- Library modules and the symbol library have a history in the repository, and
  can be restored.
- A full database snapshot is taken before any risky change.
- **Before launch (MOS-85):** pictures and recordings in file storage are backed
  up too, with a tested restore.

## FEAT-404 · Translation pipeline · [spec](../4-builds/features/FEAT-404-translation-pipeline.md)

- As an **admin**, I want to add a whole language without a translation agency,
  so that new markets open quickly and cheaply.

**Acceptance**

- The app's words, the symbol library and library content can each be
  translated from English.
- Only new or changed text is translated, and good translations are never
  overwritten.
- The symbol job shows an estimate first, then progress, and can be paused and
  resumed.

## FEAT-405 · Users admin · [spec](../4-builds/features/FEAT-405-users-admin.md)

- As an **admin**, I want to find any account and see its plan and profiles, so
  that I can support families.
- As an **admin**, I want to give an account free full access for a good
  reason, so that I can help families, schools and testers.

**Acceptance**

- Accounts can be searched and filtered by status.
- Custom access grants Max, with a required reason and an optional expiry, and
  every grant and revoke is recorded.
- *(M3, MOS-62.)* Affiliates are managed on the user's page.

## FEAT-406 · Languages admin · [spec](../4-builds/features/FEAT-406-languages-admin.md)

- As an **admin**, I want to launch a language in stages, so that families only
  see languages that are ready.

**Acceptance**

- Languages move through machine-translated, beta (*preview*) and stable.
- Machine-only languages are never shown to families.
- A language can be published now, scheduled, or unpublished.

## FEAT-407 · Themes admin · [spec](../4-builds/features/FEAT-407-themes-admin.md)

- As an **admin**, I want to control which themes are available, and on which
  plan, so that themes support the pricing.

**Acceptance**

- Themes can be published, scheduled or unpublished, and assigned a plan.
- New themes are made in code, not in the dashboard.

## FEAT-408 · Product analytics · [spec](../4-builds/features/FEAT-408-product-analytics.md)

- As the **team**, we want to know which features are used and what leads to an
  upgrade, so that we build the right things.
- As a **parent**, I want nothing my child says to be collected, so that I can
  trust Mo Speech.

**Acceptance**

- Only declared, anonymous events are sent. Never words, symbols, sentences or
  recordings.
- No automatic capture, no session recording, no IP addresses.
- An account can switch analytics off.
- **Before launch:** analytics moves to the EU region (MOS-75), and the
  onboarding events are wired up (MOS-86).
