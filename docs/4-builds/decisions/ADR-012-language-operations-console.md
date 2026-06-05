# ADR-012 — Language Operations Console

Date: 2026-06-03
Status: Proposed

---

## Context

A language in Mo Speech is "fully made" when eight ingredients exist (see [`docs/4-builds/adding-a-language.md`](../adding-a-language.md)): the language module, lifecycle/visibility, UI strings, symbol translations, the search index, library-pack translations, voices, and per-voice seeded audio. Building Hindi end-to-end (Phase 8) surfaced a structural problem: **the operations that produce those ingredients are triggered from four different places, with wildly different ergonomics, and no shared status or history.**

| Operation | Trigger today | Execution | Durable record |
|---|---|---|---|
| Translate **symbols** | Admin dashboard button | Convex action, self-scheduling, resumable | ✅ `translationJobs` row (status, progress, tokens, timestamps) |
| Translate **UI strings** | Admin button → Next route | **Dev-only** (`NODE_ENV=development`); writes `messages/<code>.json` via `node:fs` | ❌ none (just the file diff + `_sourceSnapshot`) |
| Translate **packs** | CLI: `scripts/translate-pack.mjs` | Local Node; writes `library_packs/*.json` | ❌ none (git diff only) |
| Seed **voice audio** | CLI: `scripts/seed-voice-audio.mjs` | Local Node; ~58k clips/voice, **hours**, GCP TTS + R2 | ❌ none (a local `*-errors.json` on failure) |

The pain this creates:

1. **No single view of where a language stands.** Answering "is Hindi launch-ready?" means cross-checking the admin Languages table, `grep -c '(hi)' messages/hi.json`, a dashboard query on `words.hi`, the `voices[]` array, and R2. The knowledge lives in a playbook, not the product.
2. **The voice seed babysits a laptop.** It must run with `caffeinate -i`, a freshly NTP-synced clock (R2 auth is clock-sensitive), and survive sleep for hours. This is operationally fragile and unrepeatable by anyone but a developer at a machine.
3. **No history or cost ledger.** Every run produces an irreplaceable artefact (an AI translation pass costs real money and is non-deterministic), yet only symbol translation records what happened. Pack/UI/voice runs leave nothing but a git diff — no who, when, scope, token/char count, or cost.
4. **It's not a product surface.** ADR-011 envisions tier-based language slots and an admin-dashboard creation flow; a non-technical admin (or eventually a contracted translator/reviewer) cannot drive any of this. It's all developer-CLI today.

This ADR proposes a **Language Operations Console**: a per-language admin page that consolidates *status*, *triggers*, and *history* for all eight ingredients — and decides which operations can actually move off the CLI, and which cannot (yet) and why.

---

## Decision

### 1. A per-language page that is a gated, incremental timeline

`/admin/languages/<code>` is the single pane of glass for one language — but it is **not a flat dashboard of buttons**. It is an **incremental, dependency-gated timeline**: a vertical sequence of stages where each stage is a **collapsible card** showing live progress + metadata (counts, %, cost, last-run, who ran it, errors) — reading almost like a tail of what a terminal would print, but persistent and structured. A stage is **locked** until its prerequisites are met, so the page itself encodes the build order the playbook currently keeps in prose.

**The dependency graph (the gates are real, not cosmetic):**

```
  [Module + lifecycle row]          ← prerequisite for everything
        │
        ├── UI strings  ─────────────┐   (independent track; % of en keys)
        ├── Symbol words ───────────┐│   (independent track; % of 58,807 rows with words.<code>)
        ├── Pack copy ──────────────┘│   (independent track; % of pack fields)
        └── Search index (manual PR) │   (search_text_<code>; needs the language registered)
                                     │
   [Voices catalog]  ────────────────┤   (config; ≥1 voice; independent, but a prereq for audio)
                                     │
                              ┌──────┴───────┐
                              ▼              ▼
                    [Voice audio seed]   gated on: Symbol words ✔ AND Voices catalog ✔
                              │              (the seed reads words.<code>; nothing else gates it)
                              ▼
                    [Sentence/list audio]  ← automatic / click-on-demand once symbols + voices exist
                                              (Phase 8.5 — no action, shown as "auto")
                              ▼
                    [Promote: machine-translated → beta → stable]
                              gated on human review/approval across UI + symbols + packs (ADR-013)
                              → existing accounts pick the language up automatically
                                via dynamic resolution; nothing to roll out (§7)
```

**On "symbols *and* packs before audio":** the *hard* technical gate on the voice audio seed is **symbol words + voices catalog** — the seed synthesises `words.<code>` and writes per-symbol R2 clips; it never reads packs. **Pack copy is a parallel track**, gated not on audio but on **promote-to-stable** ("fully made"). The timeline shows both edges honestly: audio unlocks when symbols+voices are done; packs are a sibling track that, together with UI strings and symbols, gates the final promotion. (If a future "pack audio pre-seed" is ever added it *would* gate on pack copy — but list/sentence audio is on-demand today, so it doesn't.)

**Each stage card carries:**
- **Live progress** — the coverage % / job state, from the generalised job log (§3) and a few coverage-count queries (the symbol-translation estimate action already computes one).
- **Collapsible metadata** — last run's scope, counts, token/char cost, who, when, and the most recent errors; collapsed by default so the timeline stays scannable, expanded for the terminal-style detail.
- **The stage's action** — its trigger button (Translate symbols, Translate UI strings, server-side voice seed §4, etc.), **disabled with an explicit reason when locked** ("needs symbol translation ≥ 99%").
- **Manual-step affordances** where they exist — the `search_text_<code>` snippet (already produced by `SearchIndexReminderBanner`), the promote-to-stable lifecycle controls.

This page needs almost no new backend: it reads `languageLifecycle`, the generalised job log (§3), the registry, and the coverage-count queries. The gating logic is a pure function of those reads.

### 1a. The "Build language" macro (the ordered, safe "translate everything")

The same dependency graph powers a single **Build language** action — the considered, *ordered* form of a "translate all" button. Rather than firing every pipeline blindly, it walks the graph in topological order: kick UI strings + symbol words + pack copy in parallel (independent), and **only** enqueue the voice seed once symbol translation crosses its threshold and voices are configured. It surfaces the one step it *can't* automate (the `search_text_<code>` schema PR) as a blocking checklist item rather than silently skipping it, and it stops at `machine-translated`, leaving the promote-to-`beta`/`stable` gate to human review (ADR-013). The macro is a convenience built **on** the timeline's gates — it cannot run anything the timeline would show as locked.

### 1b. The translator review queue is a stage on this page

The human approval step from [ADR-013](./ADR-013-translator-editing-and-staging-area.md) surfaces here: pending `translationSuggestions` for this language appear as a **review-queue stage** (approve / reject / publish). The AI pipelines and the human layer compose — for a language under review (`beta`), a pipeline run can **seed suggestions** for approval rather than publishing directly; for `stable`, it can publish straight through. Either way the run is recorded in the job log (§3).

### 2. The deciding constraint: repo-file writers cannot move server-side (yet)

Every "can this be a dashboard button in production?" question reduces to one axis: **does the operation write to the repo working tree, or to R2/Convex?**

- **Writes to R2 + Convex only** → can run server-side. **Voice seed** qualifies: it PUTs MP3s to R2 and flips `symbols.audio[voiceId] = true`. Nothing touches the repo.
- **Writes to repo JSON** → only works on a dev machine (`node:fs` on the working tree). **Pack translation** (`library_packs/*.json`) and **UI-string translation** (`messages/*.json`) both do this. This is exactly *why* the UI-strings route is hard-gated to `NODE_ENV=development` today. In production (Vercel/serverless) the repo is a read-only build artefact.

This constraint is not a bug to fix casually — repo JSON is the deliberate source-of-truth + git-history model for content (ADR-010). Moving pack/UI content into Convex tables to make it server-writable would unwind ADR-010's Republish-to-JSON content-ops model.

### 3. Generalise `translationJobs` → `languageJobs`: one durable operations log

Rename and widen the existing `translationJobs` table (which already has `kind: "symbols-words" | "library-packs"`) into a single `languageJobs` log that **every** operation writes to, regardless of where it executes:

```
languageJobs:
  slug: string                 // language code, indexed
  kind: "symbols-words" | "ui-strings" | "library-packs" | "voice-seed"
  voiceId?: string             // for voice-seed
  status: "queued" | "running" | "paused" | "completed" | "failed"
  scope?: string               // e.g. "all packs", "_starter", "hi-IN-Wavenet-F"
  cursor?: string              // resumability
  totalCount, processedCount: number
  inputTokens?, outputTokens?, characters?, costUsdEstimate?: number
  startedAt, completedAt?, updatedAt: number
  createdBy: string            // clerk user id
  lastError?: string
  artifactRef?: string         // pointer to the output diff / snapshot label
```

Critically, **dev-only CLI operations write to this log too.** The pack/UI-string scripts (run locally) post a `languageJobs` record on completion (one Convex mutation at the end). So even operations that *can't* move server-side still contribute to the unified history — the console shows "packs translated to hi · 80 fields · ~\$0.0054 · by mo@… · 2026-06-03" whether a button or a CLI produced it. This decouples "where it ran" from "is it recorded."

### 4. Move the voice seed server-side as a `languageJobs` kind

The voice seed is the strongest candidate to leave the CLI, because it's the worst laptop-babysitting offender and writes nothing to the repo. Model it exactly on the proven `translationActions.translateSymbolsBatch` pattern:

- A `"use node"` Convex action that processes the symbol table in ~2k-clip batches, self-scheduling the next batch until done (sidestepping the action time limit, same as symbol translation).
- Per clip: synthesise `words.<lang>` via GCP TTS REST (the deployment already calls Vertex this way for translation), `HeadObject` to skip existing (idempotent/resumable), `PutObject` to R2 under `audio/<voiceId>/symbols/<words.en>.mp3`, then flip the flag.
- Progress, pause/resume/cancel, and **cost accounting** ride on the same `languageJobs` row + admin controls already built for symbol translation. The existing `--dry-run` estimate becomes the pre-flight modal.

This eliminates `caffeinate`, the clock-sync ritual, and "did my laptop sleep?" — the job runs in the cloud and survives the admin closing the tab.

**Cost tradeoff (honest).** This shifts hours of synth/upload compute onto **Convex action compute (metered GB-hours)** — the Starter free tier is 20 GB-hours/month (see CLAUDE.md billing notes). A full two-voice Hindi seed is ~117k clips; the action is mostly I/O-wait (TTS latency + R2 PUT), which is cheap in GB-hours but not free. The TTS dollar cost (~\$11/voice) is identical either way. The CLI script stays in the repo as the local/dev escape hatch and for cost-sensitive bulk runs; the dashboard button is the convenience path. We pick the button as default and revisit if action-compute bills climb.

### 5. Pack + UI-string translation stay dev-only admin actions — for now

They're cheap (cents), fast (seconds), idempotent, and "content authoring happens on a dev machine" is an acceptable constraint while the authors *are* developers. They keep their existing dev-only triggers, and they post to `languageJobs` (§3) so they appear in history.

The escape hatch when a **non-technical translator/reviewer** must self-serve is the **GitHub-API authoring path** already flagged as a future hook in ADR-010 — a server action that commits the regenerated JSON to a branch/PR rather than writing the working tree. That path, and the human review/approval surface that drives it, are specified in [ADR-013](./ADR-013-translator-editing-and-staging-area.md) (the translator staging layer); it is **not** built as part of this ADR. The console is designed so that swapping a dev-only trigger for a GitHub-API-backed one later changes only the trigger, not the page — and ADR-013's approved suggestions are exactly what that trigger publishes.

### 6. Fits the ADR-011 language-slot + creation flow

The console is the concrete admin surface ADR-011 gestured at for languages: tier-based slots (Free=1, Pro=2, Max=3) decide which languages a *user* sees; the ops console is where an *admin* builds a language up through its lifecycle (`machine-translated` → `beta` → `stable`) before it ever reaches those slots. The per-language page is where "promote to stable" lives, with the ingredient grid as the readiness checklist.

### 7. New languages reach existing accounts automatically (dynamic resolution)

**The problem.** Default content (categories, lists, sentences, symbols) is **copied into each account at seed time** as a localised snapshot (ADR-010 copy-at-seed). A language added *after* a customer signed up never reaches their already-seeded content: it falls back to English text while their voice speaks the new language — a jarring mismatch (observed with Hindi: English labels with Hindi audio; sentences synthesised as English text in a Hindi accent). New accounts are fine; existing ones go stale, and **every existing customer would hit this for each language shipped post-launch**.

**The fix — resolve localised *text* live; keep *structure* copied.** The copy-at-seed reasons (ADR-010) — users own/edit their content, and an AAC board must stay stable under upstream change — apply only to **structure** (which symbols are on a board, order, deletions, additions), **not** to the **localised text** of an *unedited* item. So:

- **Structure stays a per-account snapshot** — stable, editable, AAC-safe (a child's board never shifts because a pack changed upstream).
- **The localised text of a *pristine* (unedited) pack-sourced field resolves live at render**, from sources that already exist and already hold every language:
  - **Symbols** → `symbols.words[lang]` (global Convex table, already all-languages). The category symbol query *already* re-resolves each symbol's **image** from its global row at render — so resolving the **label** from that same fetched row is nearly free.
  - **Category / list / sentence copy** → the current pack, by `librarySourceId` + `librarySourceCategoryKey`. The pack JSON is already bundled into Convex (`LIBRARY_PACKS`, O(1) by slug), so this needs **no schema move** — and if pack/UI translations later migrate into Convex tables, the same model holds; the source just changes address.
- **On first edit of a field, store the override and stop resolving it live.** Render becomes `override ?? liveSource[field][currentLang] ?? en`.

**Net: a new language — and any upstream translation fix — appears for every existing customer automatically, with no rollout job and no migration of their live data.** Symbols are the first, cheapest win (source already in Convex with all languages; the per-symbol global lookup already happens for images); pack copy follows the same pattern.

**The `pristine` flag is the core dispatch, not a backfill optimisation:** pristine + has-source → **resolve live**; edited, or no source at all (user-created) → the only content that still needs **AI** (ADR-009 §6 "Translate to <current language>", Pro/Max-gated). Promote-to-stable therefore triggers *nothing* for pristine content — it simply starts resolving.

**Graceful degradation in the meantime** (ADR-009 §6): until an edited/created item is translated it renders in its source language with a small "not translated yet" indicator (instructor/admin view) plus an inline "Translate to <language>". And one cheap, high-value safety net: **when display text falls back across languages, fall the voice back to match the text's language**, so you never get "English words in the new language's accent" while an item awaits AI translation.

**The one-time migration (what the "rollout job" demotes to).** Existing accounts hold *frozen* copies, not references. A single migration converts them to the reference model — stamp `symbolId` / `librarySourceId` + key + `pristine` on existing rows and drop (or demote to override) the frozen localised text where it still matches source. It reuses the backfill machinery and needs the category-only `reloadCategoryFromLibrary` primitive **extended to lists and sentences**. After it runs once, language additions are self-healing forever — there is no recurring per-language rollout.

**Rejected — *full* reference (structure included).** Rendering a board's *structure* live from the pack would let an upstream restructure shift a child's board under them — unacceptable for AAC. The chosen model references only the **localised text of pristine fields**; structure stays copied. That line is what keeps boards stable while letting languages and translation fixes flow in.

---

## Consequences

- **`translationJobs` is renamed/widened to `languageJobs`** with a `kind` discriminator covering all four operations; existing symbol-translation code migrates to it. The admin row component generalises from "translation job" to "language job."
- **All operations record history**, including the two that stay on the CLI — via a single end-of-run `languageJobs` mutation. History/cost becomes queryable and shown in the console.
- **The voice seed gains a cloud execution path** (self-scheduling Convex action) and loses its laptop-babysitting requirements; the CLI script remains for local/dev/bulk.
- **Pack and UI-string translation remain dev-only**; production self-serve is explicitly deferred to a future GitHub-API authoring path. The console abstracts the trigger so that swap is non-breaking.
- **A new read surface** (`/admin/languages/<code>`) consolidates status, triggers, and history; most of it is queries over existing data.
- **Action-compute cost moves onto the Convex bill** for server-side seeds — a metered tradeoff against developer convenience, watched via the existing spend limits.
- **The page encodes the build order as gates, not prose.** The dependency graph (§1) is enforced in the UI: locked stages can't run, the "Build language" macro (§1a) walks it topologically, and progress/cost/history live in collapsible per-stage cards (the "terminal summary, but persistent" shape).
- **The playbook (`adding-a-language.md`) becomes partly redundant** as the console encodes the same status checks and ordering rules in the UI — but it stays as the conceptual reference and the dev-CLI fallback. (ADR-012 itself is the *decision record*, not the guide — it does not become redundant; the playbook is the guide that does.)
- **Adding a language post-launch self-heals the existing base — with no recurring job.** Pristine pack-sourced content resolves its localised text *live* from source (symbols → `symbols.words`; pack copy → `LIBRARY_PACKS`), so a newly-published language (and any upstream translation fix) appears for every existing customer automatically (§7). Only user-edited/created content needs the ADR-009 §6 AI-translate path, with graceful "not translated yet" degradation until then. **One-time work:** a migration to convert existing frozen copies to the reference model (symbols first), extend `reloadCategoryFromLibrary` to lists + sentences, and add the `pristine` flag + voice-follows-text fallback. Structure stays copied (AAC stability); only localised text resolves live.

## Alternatives considered

- **Move everything server-side, including pack/UI translation, by relocating content into Convex tables.** Rejected: unwinds ADR-010's JSON-source-of-truth + git-history + Republish-to-JSON model for a convenience that only matters once non-technical translators exist.
- **Build the GitHub-API authoring path now** so pack/UI translation can be production buttons. Deferred: real cost (auth, branch/PR policy, review gate) with no current user — the authors are developers. Reserved as the documented next step.
- **Leave everything as-is (CLI + playbook).** Rejected: it doesn't scale past a developer, loses cost/history on every run, and gives no readiness view — the exact friction Phase 8 exposed.
- **A *blind* "translate everything" button** that fires every pipeline at once. Rejected — but **reframed, not dropped**: the operations have real prerequisites and orderings (voice seed gates on symbol translation + voices; search index is a manual schema PR), so a blind fire-all hides dependencies and can waste a seed on un-translated symbols. The accepted form is the **ordered "Build language" macro (§1a)** that walks the dependency graph topologically and refuses anything the timeline shows as locked. Same one-click convenience, dependency-safe.

## Out of scope

- **The GitHub-API authoring path** for production pack/UI-string writes (ADR-010 future hook) — reserved, not built.
- **Self-serve access for non-admin translators/reviewers** — the *console* is admin-only (ADR-008); the non-admin translator surface and its `translator` role are specified separately in [ADR-013](./ADR-013-translator-editing-and-staging-area.md). The console only hosts the admin-side *review queue* for what translators submit.
- **Cross-language batch operations** ("translate all pending languages") — per-language is the unit here.
- **Voice procurement / auditioning UI** — voices are still curated in the registry (ADR-009 §4 / out-of-scope).
- **Migrating the symbol-translation provider or prompt** — unchanged.

## References

- [ADR-008](./ADR-008-admin-role-and-view-modes.md) — admin role + view modes; the console is admin-gated.
- [ADR-009](./ADR-009-multi-language-multi-voice-architecture.md) — the registry, the eight ingredients, voices, and the `search_text` correction (§9) the console surfaces.
- [ADR-010](./ADR-010-pack-storage-shift.md) — pack JSON-as-source-of-truth and the GitHub-API authoring "future hook" this ADR defers to.
- [ADR-011](./ADR-011-plugin-architecture-for-content-modules.md) — tier-based language slots and the admin-dashboard creation flow the console concretises.
- [ADR-013](./ADR-013-translator-editing-and-staging-area.md) — the non-admin translator staging/editing layer; its review queue is a stage on this console (§1b) and its approved suggestions are what the publish step ships.
- [`docs/4-builds/adding-a-language.md`](../adding-a-language.md) — the playbook the console encodes.
- [`convex/translationJobs.ts`](../../../convex/translationJobs.ts) — the job model generalised into `languageJobs`.
- [`convex/translationActions.ts`](../../../convex/translationActions.ts) — the self-scheduling-batch pattern the voice-seed action reuses.
- [`app/api/admin/translate-ui-strings/route.ts`](../../../app/api/admin/translate-ui-strings/route.ts) — the dev-only repo-writer constraint (§2).
- [`scripts/seed-voice-audio.mjs`](../../../scripts/seed-voice-audio.mjs), [`scripts/translate-pack.mjs`](../../../scripts/translate-pack.mjs) — the CLIs this ADR partly absorbs.
