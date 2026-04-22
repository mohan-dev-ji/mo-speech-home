# ADR-003 — Audio Architecture: TTS, Voice Seeding, and Global Cache

**Date:** 2026-04-21  
**Updated:** 2026-04-22  
**Status:** Accepted

---

## Context

List items, sentence blocks, and category board custom symbols all need audio. The audio experience must be consistent regardless of whether a symbol is from the SymbolStix library or created by an instructor.

### Existing infrastructure
- SymbolStix audio pre-generated via Python script using Google Cloud TTS (`google.cloud.texttospeech` SDK), voice `en-GB-News-M`, stored at `audio/eng/default/{filename}.mp3` in R2
- R2 upload: `POST /api/upload-asset` — accepts `FormData` blob + key, requires Clerk auth, validates key starts with `profiles/`
- R2 asset delivery: `GET /api/assets?key=` — returns 302 redirect to signed R2 URL, preserving browser user-gesture chain for `audio.play()`
- Voice recording to R2 implemented in `PropertiesPanel.tsx` and `SymbolEditorModal.tsx`

### What was missing
- `audioPath` on list items and sentence records
- A TTS API route with lookup-before-generate logic
- A universal symbol editor that works across all three contexts (category board, list items, sentence slots)
- A dedicated Sentence Audio Editor for sentence-level audio
- Audio cleanup when list items or lists are deleted

---

## Decisions

### 1. Universal `SymbolEditorModal` — three modes

A single modal handles image picking and (where applicable) audio across all contexts. The `mode` prop controls which sections render:

| Section | `categoryBoard` | `listItem` | `sentenceSlot` |
|---|---|---|---|
| Image picker | ✓ | ✓ | ✓ |
| Label / Description | ✓ | ✓ | — |
| Audio | ✓ | ✓ | — |
| Display properties | ✓ | — | ✓ |
| Save writes to | `profileSymbols` | list item directly | sentence slot directly |

List items and sentence slots do **not** create `profileSymbol` records. They store `imagePath` and (for list items) `audioPath` directly on their data.

---

### 2. Sentence Audio Editor — separate component

Sentence-level audio is handled by a dedicated `SentenceAudioEditor` component, not the universal modal. It provides:
- Text field (the sentence to be spoken — pre-populated from slot descriptions, editable)
- **Generate** — runs the lookup-first TTS flow (see §3)
- **Record** — MediaRecorder flow; blob uploaded to `profiles/{profileId}/audio/{uuid}.webm` on Save

This separation keeps the universal modal focused on images and display, and allows the sentence audio flow to evolve independently.

---

### 3. TTS API route — lookup-first, global cache

```
POST /api/tts
Body:     { text: string, voiceId?: string }
Response: { r2Key: string, cached: boolean }
```

The route never returns raw audio bytes. It always resolves to an R2 key that the client can preview via `/api/assets?key=`. The client stores the key in state; on Save the key is written as `audioPath` directly — no second upload needed.

**Server lookup order:**
1. Normalise text (lowercase, trim)
2. Look up normalised text in `symbols` Convex table → if matched, resolve `R2_PATHS.symbolstixAudio(voiceId, filename)` → return if R2 object exists
3. Query `ttsCache` by `(text, voiceId)` index → return `r2Key` if found
4. Call Google Cloud TTS (WaveNet/News API, same SDK as Python seeding script) → upload to `audio/{voiceId}/tts/{uuid}.mp3` → write `ttsCache` record → return `r2Key`

Searching the SymbolStix folder first ensures that if a custom label matches an existing library word, the pre-seeded audio is used (free, instant, same voice). This also means duplicate sentences or short phrases benefit from prior seeding work.

**Google Cloud credentials** stay server-side. The client never calls TTS directly.

---

### 4. Voice architecture — profile-level setting

Each student profile stores a `voiceId`. All audio resolution — SymbolStix playback, TTS generation, TTS cache lookup — is scoped to that value.

```ts
const TTS_VOICES = {
  'en-GB-News-M': { languageCode: 'en-GB', name: 'en-GB-News-M' },
  // additional voices added as seeded
} as const;

export type VoiceId = keyof typeof TTS_VOICES;
export const DEFAULT_VOICE_ID: VoiceId = 'en-GB-News-M';
```

All voices use `google.cloud.texttospeech` (WaveNet/News tier). Chirp is not used — WaveNet is cheaper and was proven in the MVP seeding workflow.

Adding a new voice requires:
1. Running the Python seeding script with the new voice name to populate `audio/{voiceId}/symbolstix/`
2. Adding the voice to `TTS_VOICES`
3. No app code changes beyond the config constant

Switching voice in settings immediately changes SymbolStix playback. TTS cache for the new voice grows as the student uses the app.

---

### 5. R2 layout

```
audio/
  eng/default/                    ← en-GB-News-M SymbolStix (legacy path, read-only, never renamed)
  {voiceId}/
    symbolstix/                   ← seeded SymbolStix for additional voices
    tts/                          ← global TTS cache, permanent, shared across all profiles

profiles/
  {profileId}/
    images/{uuid}.webp            ← Google Images, AI-generated, device uploads
    audio/{uuid}.webm / .mp3      ← recorded voice only
```

```ts
const R2_PATHS = {
  symbolstixAudio: (voiceId: string, filename: string) =>
    voiceId === 'en-GB-News-M'
      ? `audio/eng/default/${filename}.mp3`
      : `audio/${voiceId}/symbolstix/${filename}.mp3`,
  ttsAudio:    (voiceId: string, uuid: string) => `audio/${voiceId}/tts/${uuid}.mp3`,
  profileImage:(profileId: string, uuid: string) => `profiles/${profileId}/images/${uuid}.webp`,
  profileAudio:(profileId: string, uuid: string, ext = 'mp3') => `profiles/${profileId}/audio/${uuid}.${ext}`,
};
```

Global audio (`audio/`) is **never deleted**. Profile audio (`profiles/{profileId}/`) is batch-deleted when the student profile is deleted.

---

### 6. Schema additions

**`ttsCache` table (new)**
```ts
ttsCache: defineTable({
  text: v.string(),       // normalised input
  voiceId: v.string(),
  r2Key: v.string(),      // audio/{voiceId}/tts/{uuid}.mp3
  charCount: v.number(),
}).withIndex('by_text_voice', ['text', 'voiceId'])
```

**`profileLists` — list item shape (updated)**
```ts
items: Array<{
  order: number,
  imagePath?: string,
  description?: string,
  audioPath?: string,     // ← new: global TTS key or profiles/.../audio/...
}>
```

**`profileSentences` — sentence shape (updated)**
```ts
{
  profileId: Id<'studentProfiles'>,
  text?: string,          // sentence text — feeds TTS and display
  slots: Array<{
    order: number,
    imagePath?: string,
    displayProps?: DisplayProps,
  }>,
  audioPath?: string,     // global TTS key or profiles/.../audio/...
}
```

**`studentProfiles` — new field**
```ts
voiceId: v.optional(v.string())  // defaults to DEFAULT_VOICE_ID if not set
```

---

### 7. Audio cleanup on delete

When a list item is removed or a whole list is deleted, any `audioPath` values that start with `profiles/` are deleted from R2 via a Convex action. Paths starting with `audio/` are global cache entries — they are never deleted.

The same rule applies to sentence `audioPath` values on delete.

```ts
// Convex action called from delete mutations
deleteProfileAudioObjects(keys: string[])
// filters to keys starting with 'profiles/' before calling DeleteObjectCommand
```

---

## Consequences

### New files
- `app/api/tts/route.ts` — lookup-first TTS, returns `{ r2Key, cached }`
- `app/lib/r2-paths.ts` — `R2_PATHS` and `TTS_VOICES` constants
- `app/components/app/lists/modals/SymbolEditorModal.tsx` — universal modal (three modes)
- `app/components/app/sentences/modals/SentenceAudioEditor.tsx` — sentence-level audio

### Modified files
- `convex/schema.ts` — add `ttsCache` table; add `audioPath` to list item and sentence shapes; add `voiceId` to `studentProfiles`
- `convex/profileLists.ts` — update item mutation args; add R2 cleanup to delete mutations (profile keys only)
- `convex/profileSentences.ts` — add `audioPath`, `text`, `slots` with `displayProps`; add R2 cleanup
- `app/components/app/lists/sections/ListDetailEdit.tsx` — open `SymbolEditorModal` in `listItem` mode
- `app/components/app/lists/sections/ListDetailDisplay.tsx` — auto-play `audioPath` on item open

### Unchanged
- `profileSymbols` table — no changes
- SymbolStix default audio library — static, pre-generated, never modified by app
- `POST /api/upload-asset` — unchanged; used only for recorded voice and image blobs
- `GET /api/assets` — unchanged; used for all R2 asset delivery
