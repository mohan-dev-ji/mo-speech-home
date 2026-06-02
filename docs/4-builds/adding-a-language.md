# Adding a language — full Phase 8 playbook

A step-by-step guide to bringing a language from nothing to "fully made, ready for
native-speaker review", plus the edit/correction workflow and terminal commands.
Written after building **en (M/F)** and **es (M/F)** end to end; the immediate use
case is **Hindi**.

> **Node version:** the Convex CLI and all scripts need Node 20+. Prefix any
> command below with `source ~/.nvm/nvm.sh && nvm use 20.17.0` if your default Node
> is older.

---

## 0. The 8 ingredients of a "complete" language

| # | Ingredient | Where it lives | How it's filled |
|---|---|---|---|
| 1 | **Language module** (label, native label, dir, font, scriptFamily, voices) | `convex/data/languages/<code>.json` + imported in `_index.ts` | hand-edit JSON |
| 2 | **Lifecycle / visibility** (machine-translated → beta → stable + publish window) | `languageLifecycle` table | `/admin/languages` UI |
| 3 | **UI strings** | `messages/<code>.json` (mirror of `messages/en.json`) | translate the `"… (hi)"` placeholders |
| 4 | **Symbol translations** (`words.<code>` + `synonyms.<code>` on ~58,807 rows) | `symbols` table | AI pipeline (admin) |
| 5 | **Search index** | `convex/schema.ts` `search_text_<code>` over `searchText.<code>` (word+synonyms combined) | code edit (already exists for en/hi/es) |
| 6 | **Library-pack translations** | `resourcePacks` snapshots | `scripts/translate-pack.mjs` |
| 7 | **Voices** (catalog + per-voice seeded symbol audio) | `lib/r2-paths.ts` + `<code>.json` voices + R2 | `scripts/seed-voice-audio.mjs` |
| 8 | **Sentence/list audio** | resolved dynamically per `(text, voice)` | nothing to do — Phase 8.5 makes it automatic once #4 + #7 exist |

A language is "fully made" when 1–7 are done. #8 is free.

---

## 1. Where Hindi already stands (do NOT re-scaffold)

Hindi is **not a new language to add** — it's an existing one to *fill in*. Already done:

- ✅ `convex/data/languages/hi.json` — correct: `"scriptFamily": "non-latin"`, `"font": "notoSansDevanagari"`, `"nativeLabel": "हिन्दी"`, imported in `_index.ts`.
- ✅ `search_text_hi` index in `convex/schema.ts` (over the combined `searchText.hi`).
- ✅ `languageLifecycle` row — Hindi is currently **`stable`/visible** (legacy from the original hard-coded en+hi build).
- ✅ `messages/hi.json` — **all keys exist**, but most values are `"English value (hi)"` placeholders.
- ✅ The AI translation prompt already has a **non-latin / Devanagari variant** (native script word + 2 native synonyms + 2 Latin transliterations).

Still missing: **real UI translations** (#3 values), **symbol translations** (#4 — `words.hi` is empty), **pack translations** (#6), and **voices** (#7 — `voices: []`).

### "Should I start the Hindi files fresh?" — No.
The `"(hi)"` placeholders are the *intended* half-state, not junk. The key **structure** in `messages/hi.json` is derived from `en.json` and is correct — starting fresh means re-deriving every key by hand (error-prone, and you'd drop keys). **Keep the files; replace the placeholder values.** Same for `hi.json` (already correct) and the lifecycle row (already there). The only thing that "starts fresh" is the *values*, which the pipeline / translator fills in.

The one genuinely Hindi-specific cleanup is **hard-coded en/hi fallbacks** scattered in a few components from the original two-language build (see §7).

---

## 2. Pre-flight

```bash
# Work on a branch
git checkout -b lang/hindi

# Mandatory backups before any mass mutation (translations, voice seeds).
source ~/.nvm/nvm.sh && nvm use 20.17.0
node --env-file=.env.local scripts/backup-symbols.mjs "pre-hindi"      # committed symbols snapshot
npx convex export --path backups/$(date +%F)-pre-hindi.zip             # full deployment (gitignored)
git add convex/data/symbols_backups/*pre_hindi* && git commit -m "backup: pre-hindi"
```

Each symbol-translation run produces an irreplaceable AI diff — re-run
`backup-symbols.mjs "<label>"` and commit after each major step so the diff lives in
git history.

---

## 3. The build, layer by layer

### Layer A — UI strings (`messages/hi.json`)  ⟷ Phase 8.1
Replace every `"… (hi)"` placeholder with real Hindi (**~743 of them** as of writing —
`grep -c '(hi)' messages/hi.json`). Two ways:

- **Translator-driven (best for launch quality):** hand the file to a native speaker; they edit values only, never keys.
- **AI-first, human-reviewed:** ask an LLM to translate values while preserving keys + ICU placeholders (`{name}`, `{count}`), then a native speaker corrects.

Rules: never touch keys; preserve `{placeholders}` and markup; keep it casual/child-and-parent register (same as the symbol prompt). After editing:

```bash
# JSON valid?
node -e "JSON.parse(require('fs').readFileSync('messages/hi.json'))" && echo OK
# Key parity with en.json (must print 0 missing / 0 extra):
node -e "const e=Object.keys(require('./messages/en.json')),h=new Set(Object.keys(require('./messages/hi.json')));console.log('missing',e.filter(k=>!h.has(k)).length)"
# Any remaining placeholders?
grep -c '(hi)' messages/hi.json
```
next-intl hot-reloads — just refresh the app in `hi`.

> Note: the per-section keys are nested, so the parity one-liner above only checks
> top-level namespaces. For a deep check, compare with a small recursive script or
> just rely on `grep -c '(hi)'` trending to 0.

> **⚠️ Hindi-only first-run quirk (does NOT apply to future languages).**
> The `/admin/languages` → **Translate UI strings** route is diff-based: it stores a
> `_sourceSnapshot` of the English values it translated, and on re-runs **skips** any key
> whose English source is unchanged. But `messages/hi.json` is hand-authored legacy and
> has **no `_sourceSnapshot`** — so the *first* run treats every key as new and
> **re-translates all 782**, including:
>   - the ~20 hand-done Devanagari values from the original en+hi build, and
>   - the ~19 deliberately-English literals (`£9.99`, the typed confirm-words `DELETE` /
>     `RELOAD`, size codes `S`/`M`/`L`, `Pro`/`Max`).
> After this one run a snapshot is written, so all later runs behave correctly (skip
> unchanged). **This is unique to Hindi** — every language added via the pipeline gets a
> snapshot from its first translate, so it never re-translates wholesale. Two ways to
> handle the Hindi first run:
>   1. **Run, then review the diff** (recommended): `git diff messages/hi.json` and
>      spot-check the ~20 Devanagari keys + the literals. The typed confirm-words
>      (`confirmPlaceholder` / `reloadDefaultsConfirmPlaceholder`) **should translate** —
>      both `DeleteAccountDialog` and `ReloadDefaultsDialog` compare typed input against the
>      *localised* placeholder, so es shows ELIMINAR/RECARGAR and hi shows Devanagari, and
>      they work. The values that should stay literal are **prices** (`£9.99`) and **size
>      codes** (`S`/`M`/`L`, `h2`/`h4`) — confirm those didn't get translated. Quick scan;
>      leaves a clean snapshot.
>   2. **Pre-seed the snapshot** to protect those ~39 keys before running, so only the
>      743 placeholders translate. More surgical, more setup.

### Layer B — Symbol translations (`words.hi`)  ⟷ Phase 8.2
This is the AI pipeline (`convex/translationActions.ts` → `translateSymbolsBatch`,
self-scheduling, idempotent, resumable, Devanagari-aware).

**Prereq:** the Convex *deployment* needs Gemini/Vertex credentials (the action runs
server-side via `lib/llm/vertex`). It reads `GOOGLE_SERVICE_ACCOUNT_JSON` +
`GOOGLE_CLOUD_PROJECT_ID` + `GOOGLE_CLOUD_LOCATION` (with `GEMINI_TRANSLATION_LOCATION`
as an optional override) — the **same service-account JSON** the TTS route already uses,
set on the **deployment**, not `.env.local`:
```bash
npx convex env list                                          # confirm GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_CLOUD_PROJECT_ID + GOOGLE_CLOUD_LOCATION
# npx convex env set GOOGLE_SERVICE_ACCOUNT_JSON '<json>'    # if missing
```
Trigger: `/admin/languages` → Hindi → **Translate symbols** (calls
`translationJobs.startSymbolTranslation`).

**Run it from the admin UI** (don't hand-roll a script — the job, progress, pause,
token accounting and straggler handling are all built in):
1. `/admin/languages` → Hindi → **Translate symbols**.
2. It shows an estimate ("X to translate this run"), then runs in ~4-min self-scheduled
   batches. Safe to close the tab; reopen to watch progress or **Pause**.
3. It's **idempotent** — only rows missing `words.hi` are fetched, so re-running picks
   up the ~1–2% stragglers Gemini occasionally drops. Re-open the modal once at the end
   to mop those up.

The non-latin prompt writes `words.hi` in Devanagari **and** puts 2 Devanagari
synonyms + 2 Latin transliterations into `synonyms.hi` (so search works from either
keyboard). Search reaches those via the combined **`searchText.hi`** field (word +
synonyms joined into one indexable string) — the pipeline writes `searchText.hi` at
the same time it writes `words`/`synonyms`, so a freshly-translated language is
searchable with no extra step. The index is `search_text_hi` over `searchText.hi`.

> **Why not search `synonyms.hi` directly?** Convex full-text search needs a single
> string `searchField`; `synonyms.<code>` is a `string[]`, which can't be indexed. So
> transliteration search rides on `searchText.<code>`, not the array. See ADR-009 §9
> *Correction (2026-06-02)*. Pre-existing rows (translated before this landed) were
> backfilled once via `npx convex run migrations:backfillSearchText` — idempotent,
> additive, re-derivable from `words`+`synonyms`.

Snapshot the result for review history:
```bash
node --env-file=.env.local scripts/backup-symbols.mjs "hindi-symbols-machine"
git add convex/data/symbols_backups/*hindi_symbols_machine* && git commit -m "backup: hindi machine symbol translations"
```

### Layer C — Library-pack translations  ⟷ Phase 8.3
Use the existing pack translator (`scripts/translate-pack.mjs`;
`translate-starter-pack-es.mjs` is the worked example). It translates pack
category/list/sentence copy into `hi`.
```bash
node --env-file=.env.local scripts/translate-pack.mjs --lang hi   # confirm exact flags in the script header
```
Back up packs first if a `backup-starter.mjs`-style snapshot applies to the pack you're
touching.

### Layer D — Voices  ⟷ Phase 8.4
1. **Audition + pick** male/female Hindi voices on Google's demo
   ([voice list](https://cloud.google.com/text-to-speech/docs/list-voices-and-types) →
   filter `hi-IN`; e.g. `hi-IN-Wavenet-*` / `hi-IN-Neural2-*`).
2. **Catalog** them (mirror what es did):
   - `lib/r2-paths.ts` → add each to `TTS_VOICES` with explicit `languageCode: "hi-IN"`.
   - `convex/data/languages/hi.json` → fill `voices: [...]` with `{ id, label, ttsVoiceId, gender, region }` (region e.g. `"Hindi (India)"`).
   - `scripts/seed-voice-audio.mjs` → add each to the `VOICE_LANG` map: `"hi-IN-…": { languageCode: "hi-IN", lang: "hi" }`.
   ```bash
   npx tsc --noEmit && echo "catalog OK"
   ```
3. **Seed** — ⚠️ **must run AFTER Layer B** (the seed speaks `words.hi`; rows without a
   Hindi translation are skipped). Dry-run, then real run per voice, keeping the machine
   awake and the clock synced (lessons from the es run):
   ```bash
   node --env-file=.env.local scripts/seed-voice-audio.mjs --voice hi-IN-… --dry-run
   sudo sntp -sS time.apple.com
   caffeinate -i node --env-file=.env.local scripts/seed-voice-audio.mjs --voice hi-IN-…
   node --env-file=.env.local scripts/seed-voice-audio.mjs --voice hi-IN-… --flags-only   # mop up any failed flag batches
   ```
   `--flags-only` is the fast DB-only repair if you see `flag batch … failed`. Re-run the
   full command to fill any failed uploads (idempotent). Cost ≈ ~$13/voice for ~58k clips.

### Layer E — Sentence/list audio  ⟷ Phase 8.5
Nothing to do. Once `words.hi` (B) and the voices (D) exist, list items and sentences
resolve `(Hindi text, Hindi voice)` automatically through `/api/tts` + the global
`ttsCache`.

### Layer F — Flip visibility for review
In `/admin/languages`, set Hindi's translation status so reviewers (and not the public)
see it during review: `machine-translated` while filling in, `beta` for native review,
`stable` once signed off. Pickers gate on this (`getVisibleLanguages` — instructor view
passes `includeBeta`, so `beta` shows for you but `machine-translated` stays hidden
except in the admin preview).

---

## 4. Editing & corrections workflow (native-speaker review)

| Artifact | How a reviewer corrects it | Commit/track |
|---|---|---|
| **UI strings** | Edit values in `messages/hi.json` directly (keys untouched). Hot-reloads. | normal git diff |
| **Symbol word/synonyms** | Two options: **(a)** Convex dashboard → `symbols` table → find by `words.en` → edit `words.hi` / `synonyms.hi`; **(b)** for many fixes, a small one-off mutation/script. After fixes, re-snapshot. | `backup-symbols.mjs "<label>"` → commit the `.jsonl` so the correction diff is in git |
| **Pack copy** | Edit the pack snapshot (dashboard) or re-run `translate-pack.mjs` after improving the source. | pack snapshot/backup |
| **A wrong voice** | Re-pick the `ttsVoiceId`, update the 3 catalog spots, re-seed; the old R2 folder can be left or cleaned. | tsc + seed |

**Snapshot-diff is your review tool:** because each run commits a sorted-by-`_id`
`*.jsonl`, `git diff` between two snapshots shows exactly which `words.hi` changed —
ideal for a reviewer to scan an AI run's output, and for capturing their corrections.

Useful checks during review:
```bash
# How many symbols still lack a Hindi translation?
#   (run from the admin "Translate symbols" estimate, or a dashboard query on words.hi)
grep -c '(hi)' messages/hi.json          # remaining UI placeholders
npx tsc --noEmit                          # types still green after edits
```

---

## 5. Hindi-specific advice (the outlier)

1. **Module is already right** — don't recreate `hi.json`. `non-latin` + `notoSansDevanagari` are set, which drives both the Devanagari translation prompt and the font subset.
2. **Placeholders are structure, not debt to delete** — replace values, keep keys (§1).
3. **Transliterations matter for AAC** — the prompt already stores Latin transliterations (e.g. `kutta` for कुत्ता) in `synonyms.hi` so a parent on a Latin keyboard can search. Tell the reviewer not to strip these.
4. **Hard-coded en/hi leftovers** from the original two-language build — hunt and verify they don't shadow real data:
   ```bash
   grep -rnE "code: ?['\"]hi['\"]|['\"]हिंदी['\"]|=== ?['\"]hi['\"]" app convex --include="*.ts*" | grep -v _generated
   ```
   The two known ones today, both safe to leave (they don't shadow real data):
   - `app/components/app/settings/modals/ProfileModal.tsx` (~line 275) — a
     `[{code:'en'},{code:'hi'}]` first-paint fallback shown only until
     `getVisibleLanguages` hydrates.
   - `app/components/marketing/sections/WelcomeSplash.tsx` (~line 21) — the marketing
     splash's hard-coded language list (`{ code:'hi', native:'हिंदी', latin:'Hindi' }`).
     If a third stable language should appear on the splash, add it here.
   Also note `"हिंदी"` (splash/fallback) vs `"हिन्दी"` (the registry `nativeLabel`) — a
   minor spelling inconsistency worth standardising on the registry form.
   The real fix targets are any `if (lang === 'hi')` branches or hard-coded English copy —
   route those through `useTranslations` / the registry instead (ADR-009 §1). (We already
   did this for the settings modals; expect a few more in older components.)
5. **Order matters:** UI strings (A) and symbol translations (B) are independent and can
   run in parallel, **but voice seeding (D) must follow B** — the seed reads `words.hi`.
6. **Voices:** Google has solid `hi-IN` WaveNet/Neural2 voices; no "child" voices (same
   caveat as en/es). Audition and pick M/F.

---

## 6. Verification checklist (before native review)

- [ ] `npx tsc --noEmit` clean; `node -e "JSON.parse(...)"` on `messages/hi.json` + `hi.json`.
- [ ] `grep -c '(hi)' messages/hi.json` → 0 (or only intentional leftovers).
- [ ] Admin "Translate symbols" estimate for Hindi → ~0 remaining.
- [ ] `hi.json` `voices: [...]` populated; `TTS_VOICES` + `seed-voice-audio.mjs` updated; `tsc` clean.
- [ ] Each Hindi voice seed: `--dry-run` count ≈ translated rows; full run `failed: 0`; `--flags-only` shows `0` remaining.
- [ ] In-app (set a student to Hindi): symbols show Devanagari + speak Hindi; search works from Devanagari **and** transliteration; a sentence/list item plays Hindi in the Hindi voice; switching voice swaps it live.
- [ ] Snapshots committed (`scripts/backup-symbols.mjs`) so the AI diff + corrections are in git.

---

## 7. Command cheat-sheet

```bash
# Node 20 for everything
source ~/.nvm/nvm.sh && nvm use 20.17.0

# Backups (before mass mutations)
node --env-file=.env.local scripts/backup-symbols.mjs "<label>"
npx convex export --path backups/$(date +%F)-<label>.zip

# Types / JSON / Convex
npx tsc --noEmit
npx convex codegen            # regenerate _generated after schema/function edits
npx convex dev --once         # push schema + functions once (if no watcher running)
node -e "JSON.parse(require('fs').readFileSync('messages/hi.json'))" && echo OK

# Symbol translation → /admin/languages → "Translate symbols"
# (needs GOOGLE_SERVICE_ACCOUNT_JSON + GOOGLE_CLOUD_PROJECT_ID + GOOGLE_CLOUD_LOCATION on the deployment)
npx convex env list

# Pack translation
node --env-file=.env.local scripts/translate-pack.mjs --lang hi

# Voice seed (after symbol translation)
node --env-file=.env.local scripts/seed-voice-audio.mjs --voice <id> --dry-run
caffeinate -i node --env-file=.env.local scripts/seed-voice-audio.mjs --voice <id>
node --env-file=.env.local scripts/seed-voice-audio.mjs --voice <id> --flags-only

# Adding a brand-new language (NOT Hindi — Hindi already has these):
#  1) convex/data/languages/<code>.json  (+ import in _index.ts)
#  2) add search_text_<code> index (searchField "searchText.<code>") in convex/schema.ts
#  3) messages/<code>.json (copy en.json, values → "English (… )" placeholders)
#  4) /admin/languages → create lifecycle row → then steps B–D above
```

---

### Reference files
- Registry: `convex/data/languages/_index.ts`, `lib/languages/registry.ts`, `convex/data/languages/types.ts`
- Lifecycle/visibility: `convex/languages.ts` (`getVisibleLanguages`, `updateLanguageLifecycle`)
- Translation pipeline: `convex/translationActions.ts`, `convex/translationJobs.ts`, `convex/symbols.ts` (`fetchUntranslatedPage`, `applyTranslationsBatch`)
- Voices: `lib/r2-paths.ts` (`TTS_VOICES`), `lib/audio/resolveVoiceId.ts`, `scripts/seed-voice-audio.mjs`
- Audio resolution: `lib/audio/resolveAudioPath.ts`, `lib/audio/playTts.ts`, `app/api/tts/route.ts`, `convex/ttsCache.ts`
- Content-ops playbook: `docs/1-inbox/ideas/22-pack-translation-workflow.md`
- Architecture: `docs/4-builds/decisions/ADR-009-multi-language-multi-voice-architecture.md`
