# Audio-follows-label — symbol editor audio redesign (design spec)

**Date:** 2026-08-06
**Status:** Design approved — pending implementation plan
**Relates to:** FEAT-007 (audio & language switching) §3/§4/§8 F-1 · ADR-009 (localisation + audio)

> One-line: make the tile **speak what it shows** by default, and give deliberate audio≠label its own home in the Generate tab. Eliminates the F-1 silent-mismatch class by construction.

---

## 1. Problem

Two related defects in the symbol editor:

1. **F-1 (FEAT-007 §8).** A tile's `label[lang]` can diverge from the underlying SymbolStix symbol's `words[lang]`. With no override, **default audio silently follows the symbol's word, not the label** — per language, invisible on the board you authored on, and shipped to every seeded account. (Concrete case: label "Arte"/"कला" over the *arts and crafts* symbol → spoke "manualidades"/"हस्तकला".)
2. **Inverted wiring.** In today's Audio section, **Generate** synthesises the *label*, while **Default** points at the *symbol* clip. That is backwards. Proloquo2Go's model clarified it: the spoken message and the caption are separate concerns — so *Default* should track the label, and a *custom spoken text* deserves its own field.

---

## 2. Model — audio as a per-language fork

Audio resolves from an explicit source, chosen per language via the Audio section's three tabs:

| Mode (tab) | Speaks | Own text field? |
|---|---|---|
| **Default** | *the label* — resolves `label[lang]` through the `/api/tts` chain (symbol clip → tts cache → generate) on **preview / save** | No — reads the label field above |
| **Generate** | a **custom spoken text**, decoupled from the label (e.g. label "TV room", speaks "television room in our house") | **Yes — new field, seeded from the label, independently editable** |
| **Record** | the instructor's own recording | No (mic) |

- A language **stays on Default** (audio just follows its label) **until the user deliberately switches it to Generate or Record.** Forks are independent per language.
- The previously-deferred decoupled spoken-text field **lives inside the Generate tab** — not as a second always-visible field in the label section. Default users never see it (avoids the "two confusing fields upfront" cost).
- `/api/tts` already implements the resolve chain (symbolstix → ttsCache → generate); no new backend.

> **Resolve order (must preserve).** For any word — including a custom label — `/api/tts` checks (1) the voice's **symbols folder** (`audio/<voiceId>/symbols/<word>.mp3`, real `fileExists`), then (2) the voice's **tts cache**, then (3) **generates** only if neither hit. So a custom label that matches an existing symbol's word reuses that seeded clip; generation is the last resort. The editor must call `/api/tts` **without** the `literal` flag — `literal: true` skips step 1 ([route.ts:230](../../../app/api/tts/route.ts)) and would defeat this reuse.

---

## 3. Label behaviour

- **Label-on-pick dirty flag.** Picking a SymbolStix symbol overwrites the label **unless the user hand-typed one** (tracked per language; a create-modal placeholder counts as *not* dirty). Typing marks the language dirty; clearing the field resets it to not-dirty; a pick always leaves it not-dirty. Net: clicking around symbols keeps re-filling the label, but a deliberate edit is protected. (Replaces the current "fill only if empty" rule in `SymbolStixTab`.)
- **Reset-to-symbol affordance** in the label section: shown only when `label[lang] !== symbol.words[lang]`. Resets the label to the symbol's word, which — because Default follows the label — restores the symbol's canonical caption *and* audio in one action.

---

## 4. Preview vs render (the reason we persist at save)

- **Preview (editor):** unchanged UX — play resolves the label through `/api/tts` silently and plays. Previewing a diverged Default **pre-warms** that clip, so the subsequent save's TTS step is a cache hit.
- **Render (live board):** `getProfileSymbolsWithImages` builds the audio map from *stored* data and can only reference R2 clips that already exist — it cannot synthesise. **Therefore a diverged Default's clip must be generated + stored at save.** This is also exactly what publish→seed carries to new users.

---

## 5. Save flow + failure handling (BLOCK)

On save, per language:
- **Default & label == symbol word** → store **no** override (render re-derives the symbol default per board voice; preserves current default-category behaviour and the FEAT-007 `r2` story).
- **Default & label diverges** → resolve `label[lang]` via `/api/tts`, store a per-language **`tts`** override with `ttsText = label`.
- **Generate** → store the custom text's resolved clip (`ttsText = custom text`).
- **Record** → store the recording (unchanged). A label edit never clobbers a recording or a chosen Generate.

**UX:** saving spinner →
- success → "Successfully saved", editor closes;
- `/api/tts` failure on a needed resolve → "Unable to save, please try again", editor **stays open, nothing persisted** — save blocks until TTS succeeds. (In practice a prior preview makes this a cache hit, so failure only bites on diverge-without-preview during a TTS outage.)

---

## 6. Data model / reopen derivation

- **No schema change** — `audioSourceValidator` already carries `ttsText` ([convex/profileSymbols.ts:8](../../../convex/profileSymbols.ts)).
- On reopen, classify each language's audio mode:
  - no override → **Default**
  - `tts` override with `ttsText === current label` → **Default** (cached, following the label)
  - `tts` override with `ttsText !== current label` → **Generate** (show the custom text in its field)
  - `recorded` override → **Record**

---

## 7. FEAT-007 consistency

Tightens §3/§4 rather than breaking them: label-matches-symbol stores no override (board-voice re-resolution preserved); label-diverges stores a per-language `tts` clip. F-1 becomes impossible by construction. On ship, mark FEAT-007 §8 F-1 **Resolved** and fold the new Default/Generate semantics into §3/§4.

---

## 8. Acceptance criteria

1. **Default categories unchanged** — a tile whose label equals its symbol word stores no audio override; the board plays the symbol clip in en/es/hi. (regression guard)
2. **Diverge on one board only** — edit the label on the en board; es/hi stay Default and still speak their own words; en speaks the label; nothing mis-speaks on any board.
3. **Custom Generate** — Generate-tab text "television room in our house" is spoken while the label shows "TV room"; reopening the editor shows that custom text in the Generate field.
4. **Record isolation** — a recording survives later label edits untouched.
5. **Block-on-failure** — a TTS failure on a needed save-time resolve keeps the editor open with the error and persists nothing; success closes the editor.
6. **Reset** — the reset affordance restores the symbol's caption and its default audio together.
7. **Label-on-pick** — clicking through symbols re-fills the label; a hand-typed label is preserved across further picks, per language.

---

## 9. Out of scope

- An always-visible spoken-text field in the *label* section (deferred; the Generate tab is its home).
- Bulk auto-image matching for pasted symbol lists.
- Tone / expressive (Gemini) changes.

---

## 10. Touch points

| File | Change |
|---|---|
| `app/components/app/shared/modals/symbol-editor/PropertiesPanel.tsx` | Default = follow label (no field); Generate = own text field; auto-flip Default→Generate on first divergence (once, don't fight manual tab changes); reset affordance |
| `app/components/app/shared/modals/symbol-editor/SymbolStixTab.tsx` | Dirty-flag label-on-pick (replaces fill-only-if-empty) |
| `app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx` | Per-language resolve on save; block-on-failure spinner/UX; reopen mode derivation |
| `app/components/app/shared/modals/symbol-editor/types.ts` | Draft additions: per-language label-dirty flags, Generate custom-text field |
| `app/api/tts/route.ts` | Reuse as-is (likely no change) |
| `convex/profileSymbols.ts` | No schema change (`ttsText` already present) |
| `messages/en.json` | New copy: reset, Generate custom-text label, save success/error states (en-only) |
