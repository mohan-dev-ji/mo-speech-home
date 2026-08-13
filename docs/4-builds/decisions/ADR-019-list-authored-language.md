# ADR-019 — Lists carry an `authoredLanguage` (origin marker)

**Status:** Accepted · **Date:** 2026-08-13
**Refines:** ADR-016 (composed-content language variants) for the single-record **list** case.
**Design:** [`2026-08-13-list-authored-language-origin-design.md`](../../superpowers/specs/2026-08-13-list-authored-language-origin-design.md)

## Context

A list is a **single localised record** — a `name` record plus one `description` record per item (ADR-016 Addendum E: "lists are single-record labels; no fork logic"). The "Made in \<lang\>" badge and the translate/revert controls were derived purely from *which language keys the record holds* (`labelTranslateState`), because a list had **no notion of which language is its master/origin**. Two consequences fell out of that:

- **Revert on the origin board was destructive.** A list made in EN then translated to ES is `{en, es}`. On the EN board `labelTranslateState` saw "board key present + another key exists" → offered **Revert** → `revertProfileListLanguage` stripped `en` → the English master was deleted (leaving `{es}`).
- **The "Made in" label vanished once translated** — it only showed in the `untranslated` state, so a non-origin board lost the signal of where the master lived.

Sentences and phrases never had this problem: they carry `authoredLanguage` on their variant rows. Lists were built without it, and that gap is what left them unable to tell master from variant. (Related: the create-keying bug fixed in `c095735` had lists stored under `en` regardless of board — this ADR builds on that fix.)

## Decision

Give each list an **`authoredLanguage`** — its origin/master language, set at create = the board language it was authored on — and make the label/translate/revert logic **origin-aware** on both surfaces (the group-view list card and the per-item controls in the detail view).

**Behaviour matrix:**

| Board vs origin | Board-lang text present? | Label | Control |
|---|---|---|---|
| On the origin board | (always — it's the master) | none | none |
| Non-origin, not yet translated | no → master shows as fallback | Made in \<origin\> | Translate |
| Non-origin, translated | yes → the variant shows | Made in \<origin\> | Revert (removes this variant; master untouched) |

The badge reads **`authoredLanguage`** (not `resolvedLocale`) and shows on **both** non-origin states.

### Mechanism

- **Schema:** `profileLists.authoredLanguage: v.optional(v.string())`, stored at create. Legacy rows and `_starter` defaults have no value → read as `DEFAULT_LOCALE` (`en`) at runtime (`list.authoredLanguage ?? DEFAULT_LOCALE`). **No migration** — this matches their data (everything was `en`-keyed before the create fix, and defaults are authored in `en`).
- **One origin-aware state function** — `listTranslateState(record, boardLang, authoredLanguage): 'origin' | 'untranslated' | 'translated'` (`lib/languages/variants.ts`). `'origin'` (board === origin) → no label, no control; otherwise it reuses `needsTranslation` to pick `untranslated`/`translated`. Non-origin-aware `labelTranslateState` stays for item-level counts that have no `authoredLanguage` in scope.
- **Wiring:** the list card and the three per-item edit layouts (row/column/grid) resolve state via `listTranslateState`, mapping `'origin' → 'none'` for `TranslateRevertControl` (which renders nothing for `'none'`). Item level is **control-only** — no new per-item "Made in" pill (the list-level badge carries the origin signal).
- **Revert is structurally safe:** `revertProfileListLanguage` no-ops when `args.language === (list.authoredLanguage ?? DEFAULT_LOCALE)`, and the item-level `handleItemRevertConfirm` no-ops on the origin board — so a master key can never be stripped, in addition to the UI not offering revert there.

## Consequences

- **The origin board is clean** (no badge, no translate, no revert) and **revert can no longer delete the master** — the reported bug is fixed at both the list and item levels.
- **"Made in \<origin\>" persists on non-origin boards** across both fallback and translated states, so "where is the master?" is always answerable.
- **No migration and no user action** — existing lists read as "Made in EN" via the fallback, which is correct for them.
  - *Transition-window caveat:* lists created between the create-keying fix (`c095735`) and this ADR have a board-language-keyed name (e.g. `{es}`) but no `authoredLanguage`, so they fall back to origin `en`. On their true origin board they show a cosmetically-wrong "Made in EN" + a Revert that safely no-ops (the last-key guard blocks the strip — no data loss). The set is small and single-tenant; recreating those lists (or a one-shot backfill `authoredLanguage = resolvedLocale(name, DEFAULT_LOCALE)` for lists lacking the field) closes it. Left un-backfilled by choice.
- **Categories are out of scope.** The create-keying fix (`c095735`) already keys new category names under the board language, but categories have no `authoredLanguage` and their card affordances are unchanged here. The same origin-awareness for categories is a possible follow-up.
- **Sentences/phrases unchanged** — they already carried `authoredLanguage` and variant rows.
