# ADR-013 — Translator Editing & Staging Area

Date: 2026-06-03
Status: Proposed

---

## Context

Translating Mo Speech today is **developer work**. Every correction to a UI string, pack label, or symbol word flows through a developer: edit `messages/<code>.json` / `library_packs/<slug>.json` by hand (or run a CLI translate script), eyeball the diff, commit, PR, deploy. Raw JSON with ICU placeholders (`{count}`, `<b>…</b>`) is a hostile surface for a non-technical translator, and the Hindi build made the friction concrete — the only way to fix a clumsy machine translation was for a developer to hand-edit JSON.

This is wrong on two axes:

1. **Translating is not dev work.** A native-speaker reviewer should be able to read English alongside the proposed translation, correct it, and submit — without touching git, JSON, or a dev machine.
2. **Translators are not admins.** They are freelancers, scoped to one language, who must never see user data, billing, the symbol-authoring tools, or any other admin surface. The existing admin gate (Clerk `role: "admin"`, ADR-008) is far too broad.

[ADR-012](./ADR-012-language-operations-console.md) established the **admin-facing** operations console (trigger the AI pipelines, watch progress, see history). This ADR adds the **human-facing** layer that sits *underneath* the machine pipelines: where a translator reviews, corrects, and approves the actual text before it ships. The investigation behind [ADR-012 §2/§5](./ADR-012-language-operations-console.md) settled the storage question this ADR builds on:

- The **language registry** (`convex/data/languages/*.json`) is structurally locked to build-time JSON (the Convex schema is *generated from* it) and is **not** translator-editable.
- **UI strings** (`messages/*.json`) and **pack copy** (`library_packs/*.json`) are JSON-source-of-truth, published via git, for the review/rollback/history that buys (ADR-010).
- **Symbol words** (`words.<code>` / `synonyms.<code>`) live in the Convex `symbols` table, not JSON.

The design principle that resolves "translator-friendly editing" vs "git's safety net": **Convex is a draft/staging layer in *front* of the published source of truth, not a replacement for it.**

---

## Decision

### 1. A `translationSuggestions` staging table in Convex

A single Convex table holds *working state* — proposed translations that have not yet been published. It is deliberately separate from the published artefacts (JSON / `symbols` table), which stay canonical.

```ts
translationSuggestions: defineTable({
  locale: v.string(),                    // 'hi', 'es', … — indexed; the scope a translator is granted
  // What is being translated — a discriminated target:
  target: v.union(
    v.literal("ui-string"),              // messages/<locale>.json key
    v.literal("pack-copy"),              // library_packs/<slug>.json field
    v.literal("symbol-word")             // symbols.words[locale] / synonyms[locale]
  ),
  refKey: v.string(),                    // ui: dot-path "lists.create" · pack: "<slug>:lists[0].name" · symbol: symbolId
  sourceEn: v.string(),                  // the English source the translator sees (snapshot at suggestion time)
  publishedValue: v.optional(v.string()),// what's live now (for the diff the translator sees)
  proposedValue: v.string(),             // the translator's text
  proposedSynonyms: v.optional(v.array(v.string())), // symbol-word only (native + transliteration)
  status: v.union(
    v.literal("draft"),                  // translator is still working
    v.literal("suggested"),              // submitted for review
    v.literal("approved"),               // reviewer accepted; queued to publish
    v.literal("rejected"),               // reviewer declined (with note)
    v.literal("published")               // written to the canonical target
  ),
  note: v.optional(v.string()),          // translator rationale / reviewer feedback
  proposedBy: v.string(),                // translator identity (see §2)
  reviewedBy: v.optional(v.string()),    // admin/reviewer identity
  sourceStale: v.optional(v.boolean()),  // set true if sourceEn changed after suggestion
  createdAt: v.number(),
  updatedAt: v.number(),
})
  .index("by_locale_status", ["locale", "status"])
  .index("by_locale_target", ["locale", "target"])
  .index("by_refKey", ["locale", "target", "refKey"])
```

Suggestions are **disposable by nature** — once published they can be pruned; wiping them loses only un-submitted drafts, never canonical content. This keeps the dev-disposability property ADR-010 valued.

### 2. Access: a scoped `translator` identity, password-gated, never admin

Translators authenticate through a **dedicated, narrow path** — never the admin role.

**Recommended:** a Clerk `role: "translator"` with `publicMetadata.locales: ["hi"]` granting access to a specific language (or languages). The translator UI lives at `/translate` (or a `translate.` subdomain) and is gated on this role; an admin issues a Clerk **invitation** scoped to the locale, which is the "password-protected page" — the freelancer sets their own password on first sign-in.

Why role-based identity rather than a single shared password: the whole workflow is *suggest → review → approve*, which needs **attribution** ("who proposed this, who approved it") and **per-locale isolation** (a Hindi freelancer must not touch Spanish). A shared passcode gives neither. Clerk invitations give both with no new auth system.

**Lighter alternative (documented, not chosen):** a signed, expiring magic-link / passcode per locale for true no-account access. Cheaper to issue, but loses attribution and makes revocation coarse. Reserve for a future "quick one-off review" mode if friction proves real.

**Isolation is enforced server-side:** every translator-facing Convex function checks the caller's role + locale grant and touches **only** `translationSuggestions` for that locale plus *read-only* source (English values + the current published value). Translator functions never read `users`, `studentProfiles`, billing, or any other table. This is a separate, audited function surface — not the admin API with a weaker check.

### 3. The translator workbench (`/translate/<locale>`)

A focused, password-gated UI — three tabs, one language:

- **UI strings** — English ↔ proposed, side by side, grouped by namespace, with ICU placeholders (`{count}`) rendered as protected chips the translator can't accidentally delete. Inline edit → Save draft → Submit.
- **Pack copy** — same pattern over the pack/category/list/sentence fields (the fields `translate-pack.mjs` handles; symbol *labels* inside packs are skipped, exactly as today, because they resolve from `symbols.words`).
- **Symbols** — a **searchable** editor (the table is ~58k rows; never a flat list). Search by English word, edit `words.<locale>` + the synonyms/transliterations, submit. This is where native review most improves machine output.

No user data, no admin tools, no app navigation — just the workbench for the granted locale.

### 4. Workflow: suggest → review → publish, against two publish targets

```
translator edits ─▶ draft ─▶ suggested ─▶ [admin/reviewer] ─▶ approved ─▶ published
                                              └─▶ rejected (+note) ─▶ back to translator
```

Approval is an **admin** action (or a senior-reviewer role later), surfaced in the ADR-012 console's per-language page as a review queue. "Publish" resolves by target:

- **UI strings & pack copy** → write the approved value into `messages/<locale>.json` / `library_packs/<slug>.json` and **commit to git** via the publish path ADR-010 reserved (`PUBLISH_VIA_GITHUB` GitHub-App hook in prod; the existing dev-only `fs` route locally). git stays canonical → diff-review, rollback, history preserved.
- **Symbol words** → patch the `symbols` table directly (`words[locale]` / `synonyms[locale]` / `searchText[locale]`), reusing `applyTranslationsBatch`'s write logic. Symbols have no JSON/git layer; the suggestion+approval record *is* their audit trail (recorded in `translationSuggestions` with `status: published`).

This split is deliberate and matches where each content type actually lives (ADR-012 §2): JSON-backed content round-trips through git; table-backed content publishes to the table.

### 5. Staleness: source-of-truth changes invalidate suggestions

Because suggestions snapshot `sourceEn` at proposal time, an English edit afterward can strand a translation against old source. On any English change (UI string edit, pack `en` edit, symbol `words.en`), mark matching open suggestions `sourceStale: true` and surface them in the workbench ("the English changed since you wrote this"). Mirrors the `_sourceSnapshot` diff logic the UI-string pipeline already uses — same idea, one layer up.

### 6. Relationship to the AI pipelines (ADR-012)

The machine-translation pipelines (translate symbols / UI strings / packs) and this human layer are **complementary, ordered**: AI does the bulk first pass (cheap, fast, 99%), then translators **correct and approve** the output. The cleanest integration: an AI run can **seed `translationSuggestions`** (status `suggested`, `proposedBy: "ai:gemini-2.5-flash"`) instead of writing straight to the published target — so a human always approves before it ships, for any language still in `beta`. For a `stable` language past review, AI can still publish directly; the staging step is the gate for languages *under* review.

---

## Consequences

- **Translation becomes non-dev work.** A scoped freelancer reviews and corrects in a purpose-built UI; no git, JSON, ICU-syntax, or dev machine. This is the headline win.
- **A new narrow auth surface** (`role: "translator"`, per-locale) and a new admin **review queue** on the ADR-012 per-language page.
- **`translationSuggestions` is the staging layer**; canonical content stays where it is (JSON+git for strings/packs, `symbols` table for words). No source-of-truth move — the ADR-010 / ADR-011 architecture and the registry "ah-ha" are untouched.
- **Publish remains gated by the repo-write constraint** for JSON content; this ADR makes the GitHub-App hook (ADR-010 future hook) the production publish path for approved suggestions, finally giving it a concrete trigger.
- **Symbol corrections gain an audit trail** they lack today (the suggestion record), even though they bypass git.
- **AI + human compose**: pipelines can seed suggestions for human approval on `beta` languages, raising launch quality without slowing `stable` ones.
- **Security depth**: translator functions are a separate, audited surface that cannot reach user/billing tables — a stronger boundary than "admin can do everything."

## Alternatives considered

- **Hand JSON files to translators.** Status quo. Rejected: hostile surface, dev-mediated, no attribution/review, easy to break ICU placeholders or keys.
- **Google-Sheets / spreadsheet round-trip.** Export en+target to a sheet, re-import. Rejected: no live preview, no placeholder protection, brittle import, no symbol-search at 58k scale, and a second sync to keep honest.
- **Move all content into Convex as source of truth (drop git for content).** Rejected in the ADR-012 investigation: you'd rebuild git's review/rollback/history/audit as app features and lose PR culture, for no gain the staging-layer model doesn't already give.
- **Single shared password for `/translate`.** Rejected as the primary: no attribution, no per-locale isolation, coarse revocation. Kept as a documented lighter option for future one-off reviews.
- **Let translators write straight to the published target (no approval step).** Rejected: freelancers are unvetted per-change; the suggest→approve gate is the quality and safety control, especially for `beta` languages.

## Out of scope

- **The machine-translation pipelines themselves** — owned by ADR-012; this ADR only adds the human review/approval layer in front of them.
- **The GitHub-App publish integration build-out** — its mechanics (App install, token scoping, conflict handling) are ADR-010's reserved future hook; this ADR gives it a trigger but doesn't specify the integration.
- **A senior-reviewer role distinct from admin** — approval is an admin action for now; a `reviewer` tier can be added later without schema change.
- **Translation memory / glossary / termbase** — valuable later (consistency across keys), not in V1.
- **Real-time collaborative editing** — single-editor-per-key with optimistic locking is enough at freelance scale.
- **User-facing community translation** — this is a curated freelancer surface, not crowdsourcing.

## References

- [ADR-008](./ADR-008-admin-role-and-view-modes.md) — admin role; this ADR adds a *narrower* `translator` role beside it.
- [ADR-009](./ADR-009-multi-language-multi-voice-architecture.md) — the registry, ISO-keyed records, and the lifecycle (`machine-translated`/`beta`/`stable`) that gates whether AI publishes directly or via human approval.
- [ADR-010](./ADR-010-pack-storage-shift.md) — JSON-source-of-truth + the GitHub-App publish hook this ADR triggers.
- [ADR-011](./ADR-011-plugin-architecture-for-content-modules.md) — the admin dashboard as creation/lifecycle touch point the review queue lives in.
- [ADR-012](./ADR-012-language-operations-console.md) — the admin operations console; this ADR is the human layer beneath its pipelines, and its review queue is a console surface.
- [`app/api/admin/translate-ui-strings/route.ts`](../../../app/api/admin/translate-ui-strings/route.ts), [`app/api/admin/pack-publish/route.ts`](../../../app/api/admin/pack-publish/route.ts) — the dev-only JSON publish routes the approve→publish step extends.
- [`convex/symbols.ts`](../../../convex/symbols.ts) (`applyTranslationsBatch`) — the symbol-word write path the publish step reuses.
