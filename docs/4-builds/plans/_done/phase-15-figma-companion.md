# Phase 15 — Figma Visual Companion

> **Purpose.** A frame-by-frame brief for the Figma screens/components that accompany [`phase-15-implementation.md`](phase-15-implementation.md). The executing agent reads a written task **and** looks at the matching Figma frame, so the intended UI is unambiguous — the visual confirms the prose. Building these also forces the Figma file to stay current with the app.
>
> **How to use.** Before an implementation task marked *"confirm the Figma frame"*, the human builds/updates the frame here, then pastes its Figma URL beside the frame name below. The agent fetches it (Figma MCP `get_design_context` / `get_screenshot`) and matches its build to it. If code and frame disagree, stop and reconcile before coding.
>
> **Design system.** All frames use the existing tokenised design system (the "Full Build" Figma file — roundness vars, elevation styles, `--theme-*` tokens). No raw hex/spacing; bind to variables so light/dark + per-profile themes hold. Only **three** frames are needed — Phase 15 is mostly backend/logic; the UI surface is small.

---

## Frame 1 — "Made in EN" badge on a sentence row  → *(https://www.figma.com/design/3DAZYuK3A1TrkeZnyGwE1o/Mo-Speech---Finals?node-id=1439-23546&t=zyO52WYdvBQBy0cU-4)* and here on a screen *(https://www.figma.com/design/3DAZYuK3A1TrkeZnyGwE1o/Mo-Speech---Finals?node-id=1440-22491&t=zyO52WYdvBQBy0cU-4)*

**Backs:** Implementation Task 5. **Where:** the Sentences list row (`SentencesModeContent` sentence row), block/sequence sentences only.

**What to show**
- A normal sentence row (symbols + play button) as it exists today, **plus** a small badge reading **"Made in EN"** (or the native label of the authored language — e.g. "Made in हिन्दी").
- The badge is a quiet, secondary chip — not an error/warning colour. It communicates "this is a deliberate single-language asset", not "something is wrong".

**States to draw (one board, three rows)**
1. Board = English, sentence authored EN → **no badge** (same language).
2. Board = Hindi, sentence authored EN → **"Made in EN" badge visible**.
3. Board = Hindi, sentence authored HI → **no badge**.

**Tokens / spec**
- Chip: `rounded-theme-sm`, `bg-theme-*` (a muted surface token), `text-theme-*` secondary ink, small type. Reuse an existing badge/pill component if one exists in the system.
- Placement: inline on the row, aligned so it never collides with the play/edit controls at any width. Show the mobile (~380px) width too — the row must not overflow.

**Acceptance the agent checks against:** badge appears iff `authoredLanguage !== boardLanguage`; styling is token-bound; no horizontal overflow at mobile width.

---

## Frame 2 — Symbol Editor "Language" pin control  → *(Make this in accordance to the symbol editor and design system style)*

**Backs:** Implementation Task 9. **Where:** the Symbol Editor display/properties panel, alongside the existing display controls (colour, text size, shape toggles).

**What to show**
- A labelled **"Language"** select/segmented control with options: **Auto (follow board)** (default) · **English** · **हिन्दी** · **Español** · … (one per registry language, shown in its native label).
- The live symbol preview reflecting a non-Auto choice: e.g. control set to **English**, board is Hindi, preview tile shows the **English** label.

**States to draw**
1. `Auto` selected (default) — preview label follows the board language.
2. `English` pinned on a Hindi board — preview label is English; a subtle indicator that this tile is pinned (optional: a tiny language tag on the preview tile, mirroring Frame 1's badge language).

**Tokens / spec**
- Match the existing display-panel control styling (same control family as the colour/shape pickers — do not invent a new pattern). `rounded-theme`, theme text/surface tokens.
- Native labels come from the registry (`nativeLabel`); the control is data-driven, not a hard-coded list.

**Acceptance the agent checks against:** control matches the existing panel controls; options are registry-driven; default is Auto; preview updates on change.

---

## Frame 3 — Tone-chip row on the play modal  → *(https://www.figma.com/design/3DAZYuK3A1TrkeZnyGwE1o/Mo-Speech---Finals?node-id=3264-5993&t=zyO52WYdvBQBy0cU-4)*

**Backs:** Implementation Task 13. **Where:** `CompositionPlayModal` (block sentences) and `SentencePlayModal` (fluent sentences).

**What to show**
- A single **row of tone chips**: **😐 Neutral** (default/selected) · **😃 Excited**. Emoji + short label each. Designed so more chips (Asking / Calm / Sad) can be added later without reflow problems.
- Show the selected vs unselected chip states.

**Two modal variants to draw**
1. **Fluent sentence modal** — the sentence's single play control **plus** the tone-chip row beneath it.
2. **Block sentence modal** — the existing **stepped "blocky" replay (▶)** control **unchanged**, **plus** the tone-chip row. Annotate clearly: *"▶ = blocky stepped replay (neutral, per-block); chips = fluent whole-utterance clip with tone."* This distinction is the crux of Task 13 — make it visually legible which control does which.

**Tokens / spec**
- Chips: `rounded-theme` pills, selected = accent surface token, unselected = muted surface; adequate hit targets (AAC users — generous tap size). Theme-bound; verify contrast in light + dark.
- Row scrolls horizontally inside its own container if chips exceed width (future tones), never pushing the modal wider.

**Acceptance the agent checks against:** Neutral is default; the block modal keeps the blocky ▶ AND adds the chip row; chip states + hit targets match; tokens bound for light/dark.

---

## Not needed in Figma (logic-only, no visual surface)
Voice persona resolution, `authoredLanguage` stamping/resolution, voice-follows-text, the TTS `tone` param + cache key, the experimentation spike — all backend/logic. No frame required; the written plan is sufficient.

## Deferred (Phase 15.5 — do NOT design yet)
The "edit to build the Hindi version" flow (clickable badge → edit mode, reference-panel of the English original, reactive language-switch view). It reuses the composition-builder components; design it when 15.5 is scheduled, not now.
