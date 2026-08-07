# Auto-match Symbols on Create Category (design spec)

**Date:** 2026-08-07
**Status:** Design approved — pending implementation plan
**Relates to:** phase-16 audio-follows-label (`_done/phase-16-*`) · the create-category bulk-paste feature · FEAT-007 (audio resolution)

> One-line: on the Create Category modal, let a teacher tick words to auto-match each to its top SymbolStix result, producing fully-formed symbols (correct image + label + audio) so the category opens in edit mode ready to confirm — while the current fast placeholder flow stays the default.

---

## 1. Problem / value

Creating a category currently seeds **placeholder** symbols (label only); the teacher then opens each one to pick an image. For a pasted list of 48 words that's 48 manual picks. The top SymbolStix search result is the right symbol for >90% of everyday words, so auto-matching removes almost all of that work — valuable for busy teachers and TAs. The fast placeholder flow keeps its own benefit (speed, deliberate curation) and must remain the default.

---

## 2. UX (CreateCategoryModal)

- A **checkbox on the right of every symbol input**, all **unchecked by default**.
- An **"Auto-match all"** checkbox in the Symbols header that toggles every row at once, showing an **indeterminate** state when only some rows are ticked.
- On **Create**:
  - **No box ticked** → today's flow unchanged: placeholders created, route to edit mode. No spinner.
  - **≥1 box ticked** → a blocking **"Auto-matching your words…"** overlay while matching runs, then route to edit mode.
- Empty rows are ignored (as today); their checkbox is inert.

---

## 3. Flow when auto-matching (client-side, reusing the editor's algo)

All work happens in the browser under the spinner, then one mutation persists.

1. For each **ticked, non-empty** word, concurrently run `api.symbols.searchSymbols({ searchTerm: word, language, limit: 1 })` (the exact query the SymbolStix tab uses) via the Convex client. Take `results[0]` (may be undefined).
2. Build each row's symbol spec, **preserving paste order**:
   - **Matched** (`results[0]` present) → a fully-formed `symbolstix` symbol:
     - `imageSource: { type: 'symbolstix', symbolId: sym._id }`
     - `label: { [language]: word }` — the **typed word**, keyed by the board language.
     - **Audio:** if `word.trim() === (sym.words[language] ?? '').trim()` (the ~90% case) → **no override** (the symbol's own default clip already speaks the word). If it diverges → resolve `word` through `/api/tts` (voice = `voiceForLanguage(language)`, **no `literal` flag**) and attach a per-language `tts` override `{ type: 'tts', path, ttsText: word, language }` — identical to phase-16's save path, so the tile speaks the label (no F-1 mismatch).
     - `display`: system defaults (none persisted).
   - **Unticked, or ticked with zero search results** → a **placeholder** symbol (today's behaviour: `imageSource: { type: 'placeholder' }`, `label: { [language]: word }`), so no row is lost.
3. Call the extended `createProfileCategory` once with the **ordered symbols array**; it creates the category then each symbol in order. Route to `/{locale}/categories/{id}?edit=1` for the teacher to confirm/finish.

---

## 4. Architecture

- **Matching + audio resolve run client-side** — `searchSymbols` is a per-language full-text **query** (`withSearchIndex`), which Convex allows in queries/actions but **not mutations**, and the audio resolve is the `/api/tts` route (a client fetch). Doing both in the browser reuses the "search page + symbol editor" algo the user named, and keeps the create mutation pure. Rows resolve **concurrently** (`Promise.all`), so N words cost ≈ one search round-trip, not N sequential ones.
- **`createProfileCategory` gains an ordered `symbols` argument.** Replace `symbolLabels: string[]` with `symbols: Array<{ label: Record<string,string>; symbolId?: Id<'symbols'>; audio?: <audioSourceValidator record> }>`. For each entry: `symbolId` present → fully-formed `symbolstix` symbol (with optional `audio`); absent → placeholder. Order in the array = tile order. The current fast flow builds the same array with all-placeholder entries.
- Audio-resolve decision logic (`label === symbol word → no override, else /api/tts`) mirrors phase-16's `resolveDefaultKey` / save path; extract a shared helper if it reduces duplication, otherwise inline in the modal.

---

## 5. Edge handling

- **No search result for a ticked word** → placeholder (no error, no blocking).
- **`/api/tts` fails for a diverged word** → create the matched symbol on its **default clip** (possible label/audio mismatch, surfaced in the edit-mode confirm) rather than failing the whole batch. Log, don't throw.
- **All matching fails / offline** → the batch still creates (placeholders for unmatched); the category is never lost.
- **Empty rows** dropped exactly as today (server already trims + drops empty labels).
- **Free/Pro tier**: creation already gated where it is today; auto-match adds no new gate.

---

## 6. Acceptance criteria

1. **Default unchanged** — with no boxes ticked, Create behaves exactly as today (placeholders, no spinner, edit mode).
2. **Select-all** — ticking "Auto-match all" ticks every row; unticking clears all; partial selection shows indeterminate.
3. **Match quality** — ticking a common word (e.g. "rabbit") yields a tile with the top SymbolStix image, label "rabbit", speaking "rabbit"; verified in edit mode + via `getProfileSymbols` (symbolstix imageSource, no audio override when word == symbol word).
4. **Diverged word** — a ticked word whose top symbol has a different name gets label = typed word and a `tts` override with `ttsText` = typed word (speaks the label, not the symbol word).
5. **No match** — a ticked nonsense word becomes a placeholder, not an error.
6. **Order preserved** — tiles appear in paste order, matched and placeholder interleaved.
7. **Spinner** — "Auto-matching your words…" shows only when ≥1 box is ticked and blocks until done.

---

## 7. Out of scope

- Choosing among multiple search results (always the top hit; the confirm stage is where the teacher swaps).
- Auto-match on the per-symbol editor, lists, sentences, or the inline "+ New category" (this is the Create Category modal only).
- Server-side (action-based) matching — client-side reuse is preferred; revisit only if client round-trips prove slow at scale.

---

## 8. Touch points

| File | Change |
|---|---|
| `app/components/app/categories/modals/CreateCategoryModal.tsx` | Per-row checkbox + "Auto-match all" header toggle (with indeterminate); spinner overlay; client orchestration (concurrent `searchSymbols` + `/api/tts` resolve); build the ordered `symbols` array; pass to `onCreate` |
| `app/components/app/categories/sections/CategoriesContent.tsx` | `handleCreate(name, symbols)` — pass the resolved ordered list to the mutation |
| `convex/profileCategories.ts` | `createProfileCategory`: `symbolLabels: string[]` → `symbols: Array<{label, symbolId?, audio?}>`; create fully-formed symbolstix symbols or placeholders in order |
| `messages/en.json` | `createModalAutoMatchAll`, `createModalAutoMatching` (spinner), aria labels — en only |
