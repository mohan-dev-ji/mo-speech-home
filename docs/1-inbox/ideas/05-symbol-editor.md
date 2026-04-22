# Symbol Editor Modal — Universal

## Overview

`SymbolEditorModal` is a single universal modal used in three contexts across Mo Speech Home. A `mode` prop controls which sections are visible and what the save action does. Improvements to image picking, audio generation, or display properties benefit all contexts automatically.

All changes are held in local state. Nothing is written to Convex or R2 until the instructor taps **Save**.

---

## Modes

| Section | `categoryBoard` | `listItem` | `sentenceSlot` |
|---|---|---|---|
| Image picker (4 tabs) | ✓ | ✓ | ✓ |
| Label / Description | Label + language selector | Description (single lang) | — |
| Audio — Default | SymbolStix symbols only | — | — |
| Audio — Generate | ✓ | ✓ | — |
| Audio — Record | ✓ | ✓ | — |
| Display properties | ✓ | — | ✓ |
| Save writes to | `profileSymbols` | list item directly | sentence slot directly |

```tsx
type SymbolEditorMode =
  | { mode: 'categoryBoard'; categoryId: string; existingSymbolId?: Id<'profileSymbols'> }
  | { mode: 'listItem'; listId: string; itemLocalId: string }
  | { mode: 'sentenceSlot'; sentenceId: string; slotOrder: number };

type SymbolEditorModalProps = {
  profileId: string;
  config: SymbolEditorMode;
  initialState?: Partial<EditorState>;
  onSave: (result: EditorSaveResult) => void;
  onClose: () => void;
};
```

---

## Image Section — Four Tabs

**Tab 1: SymbolStix Library**
- Search the full 58,000-symbol library (same voice + text search as the Search nav)
- Selecting a symbol stores the `symbolId`; image served via R2 proxy — no new storage

**Tab 2: Google Images**
- Search → Google Custom Search API → image results
- Selected image downloaded server-side, converted to `.webp`, uploaded to `profiles/{profileId}/images/{uuid}.webp`
- Copyright notice shown; original URL stored as audit trail only

**Tab 3: AI Generation (Google Imagen)**
- Prompt field with AAC-context starter prompts (e.g. "simple flat illustration of...")
- Generated server-side, uploaded to `profiles/{profileId}/images/{uuid}.webp`
- Prompt stored; regenerate replaces the image

**Tab 4: Device Upload**
- File picker or camera trigger on mobile
- Compressed and converted to `.webp` client-side before upload
- Most important tab for personalisation — family photos, local places, favourite objects

---

## Label / Description Section

Shown in `categoryBoard` and `listItem` modes only.

- **`categoryBoard`**: labelled "Label", with language selector (eng, hin). Pre-populated from `symbols.words[language]` for SymbolStix symbols; required for custom symbols.
- **`listItem`**: labelled "Description", single language. Required for Generate audio; optional for Record.

The text in this field always feeds the Generate button.

---

## Audio Section

Shown in `categoryBoard` and `listItem` modes. Hidden for `sentenceSlot` — sentence audio is handled by the Sentence Audio Editor (see below).

Three options via segmented control:

**Default** — `categoryBoard` + SymbolStix symbol only
- Plays the pre-generated SymbolStix audio for the profile's current voice
- Resolved at play time from `R2_PATHS.symbolstixAudio(voiceId, filename)` — nothing stored on the symbol

**Generate**
- Reads the current label / description text
- Calls `POST /api/tts` with `{ text, voiceId }` — server runs the lookup-first flow:
  1. Normalise text (lowercase, trim)
  2. Look up word in `symbols` table → if matched, check SymbolStix audio R2 path for this voice → return if exists
  3. Query `ttsCache` by `(text, voiceId)` → return `r2Key` if found
  4. Call Google Cloud TTS (WaveNet/News API) → upload to `audio/{voiceId}/tts/{uuid}.mp3` → write `ttsCache` record → return `r2Key`
- Server returns `{ r2Key: string, cached: boolean }`
- Client previews via `/api/assets?key={r2Key}`; regenerate freely (each call replaces the preview key)
- On Save: `audioPath` set to the returned `r2Key` — no second upload needed

**Record**
- MediaRecorder: mic → chunks → Blob → preview → replace or discard
- Multiple takes free; only the accepted blob is uploaded
- On Save: blob uploaded to `profiles/{profileId}/audio/{uuid}.webm` → `audioPath` set to that key

```ts
type AudioState =
  | { mode: 'default' }
  | { mode: 'tts'; r2Key: string | null }   // null = not yet generated
  | { mode: 'record'; blob: Blob | null }   // null = not yet recorded
```

---

## Display Section

Shown in `categoryBoard` and `sentenceSlot` modes only.

- Background colour picker (hex)
- Text colour picker (hex)
- Text size selector: sm / md / lg / xl
- Border colour and width
- Toggle: Show Label (on/off)
- Toggle: Show Image (on/off — creates a text-only symbol)
- Card shape: square / rounded / circle

A live preview updates in real time as properties change.

---

## Save Flow

**`categoryBoard`**
1. If image is AI or Google Images and not yet uploaded → upload to `profiles/{profileId}/images/{uuid}.webp`
2. If audio mode is `record` → upload blob to `profiles/{profileId}/audio/{uuid}.webm` → resolve `audioPath`
3. If audio mode is `tts` → `r2Key` already in R2; use as `audioPath` directly
4. Create or update `profileSymbol` record in Convex
5. Return `profileSymbolId` to the calling context

**`listItem`**
1. If `pendingImageBlob` → upload → resolve `imagePath`
2. If audio mode is `record` → upload blob → resolve `audioPath`
3. If audio mode is `tts` → `r2Key` already resolved; use as `audioPath`
4. Call `updateProfileListItems` mutation with `imagePath`, `audioPath`, `description`
5. No `profileSymbol` record created

**`sentenceSlot`**
1. If `pendingImageBlob` → upload → resolve `imagePath`
2. Call `updateProfileSentenceSlot` with `imagePath` and `displayProps`
3. No audio, no `profileSymbol` record created

---

## Sentence Audio Editor

A separate focused component for sentence-level audio — not part of the universal modal.

**Inputs:**
- Text field: the sentence as written (pre-populated from slot descriptions if available, fully editable)
- Voice shown as read-only label (reflects profile `voiceId` setting)

**Generate** — same lookup-first flow as the modal Generate option:
1. Search SymbolStix audio for current voice
2. Search `ttsCache` by `(text, voiceId)`
3. If not found → generate via Google Cloud TTS → upload to global bucket → cache → return `r2Key`

**Record** — same MediaRecorder flow; blob uploaded to `profiles/{profileId}/audio/{uuid}.webm` on Save

Preview and regenerate/re-record freely before committing. On Save: `audioPath` written to the sentence record.

---

## Audio Resolution Order

When playing a symbol anywhere in the app:

```
1. profileSymbol.audio.mode = "record"  → user's own recording (profile R2 key)
2. profileSymbol.audio.mode = "tts"     → global TTS cache key for current voice
3. profileSymbol.audio.mode = "default" → SymbolStix pre-generated audio for current voice
```

Custom (non-SymbolStix) symbols always require an explicit audio source — there is no step 3 fallback.

---

## Voice Architecture

Each student profile stores a `voiceId`. This controls:
- Which SymbolStix audio folder is read at play time
- Which voice is used when generating TTS
- Which `ttsCache` entries match on lookup

All voices use the `google.cloud.texttospeech` SDK (WaveNet/News tier) — the same API as the Python seeding scripts. Chirp is not used.

Each voice is seeded with the full SymbolStix library and accumulates a growing TTS cache. Switching voice in settings immediately changes SymbolStix playback; TTS fills in as the student uses the app.

```ts
const TTS_VOICES = {
  'en-GB-News-M': { languageCode: 'en-GB', name: 'en-GB-News-M' },
  // additional voices added as seeded
} as const;

export type VoiceId = keyof typeof TTS_VOICES;
export const DEFAULT_VOICE_ID: VoiceId = 'en-GB-News-M';
```

---

## R2 Layout

```
audio/
  eng/default/                    ← en-GB-News-M SymbolStix library (legacy path, read-only)
  {voiceId}/
    symbolstix/                   ← seeded SymbolStix library for additional voices
      {filename}.mp3
    tts/                          ← global TTS cache, grows over time
      {uuid}.mp3

profiles/
  {profileId}/
    images/
      {uuid}.webp                 ← Google Images, AI-generated, device uploads
    audio/
      {uuid}.webm / .mp3          ← recorded voice only (TTS audio lives in global bucket)
```

All R2 paths constructed via `R2_PATHS` — never as inline strings in components:

```ts
const R2_PATHS = {
  symbolstixAudio: (voiceId: string, filename: string) =>
    voiceId === 'en-GB-News-M'
      ? `audio/eng/default/${filename}.mp3`            // legacy path
      : `audio/${voiceId}/symbolstix/${filename}.mp3`,

  ttsAudio: (voiceId: string, uuid: string) =>
    `audio/${voiceId}/tts/${uuid}.mp3`,

  profileImage: (profileId: string, uuid: string) =>
    `profiles/${profileId}/images/${uuid}.webp`,

  profileAudio: (profileId: string, uuid: string, ext = 'mp3') =>
    `profiles/${profileId}/audio/${uuid}.${ext}`,
};
```

Deleting a student profile batch-deletes `profiles/{profileId}/` only. Global audio (`audio/`) is never deleted — it is shared across all profiles.

---

## Global TTS Cache

```ts
ttsCache: defineTable({
  text: v.string(),       // normalised (lowercase, trimmed)
  voiceId: v.string(),
  r2Key: v.string(),      // audio/{voiceId}/tts/{uuid}.mp3
  charCount: v.number(),  // for cost tracking
}).withIndex('by_text_voice', ['text', 'voiceId'])
```

Same label generated by two families in the same voice → one R2 file, zero duplicate TTS cost. Applies to single words, custom labels, list descriptions, and full sentences.

---

## Where Symbols Live

- **`categoryBoard`**: saved to `profileSymbols` table. Private to that profile.
- **`listItem`**: `imagePath` / `audioPath` stored directly on the list item. No `profileSymbol` record.
- **`sentenceSlot`**: `imagePath` and `displayProps` stored on the sentence slot. No `profileSymbol` record.

Global TTS cache entries and their R2 files are permanent and shared across all profiles.
