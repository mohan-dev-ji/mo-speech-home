# Create / Edit Symbol Modal

## Overview

The symbol editor is a major feature of Mo Speech Home. It allows parents to create fully customised symbols — sourcing the image from four different places, setting the label in any language, choosing or recording the audio, and adjusting every display property.

All changes are held in local component state during editing. Nothing is written to Convex until the parent taps **Save to [Category Name]**.

---

## The Two Sections

### Image Section — Four Tabs

**Tab 1: SymbolStix Library**
- Search the full 58,000-symbol library (same voice + text search as the Search nav)
- Selecting a symbol sets `imageSource.type = "symbolstix"` and stores the `symbolId`
- Image is served via the existing R2 proxy — no new storage

**Tab 2: Google Images**
- Search field → calls Google Custom Search API → returns image results
- User taps to select an image
- Image is downloaded server-side and converted to `.webp`, uploaded to R2 under the child's profile folder: `profiles/{profileId}/symbols/{uuid}.webp`
- Copyright notice displayed: the parent is responsible for image rights
- Original URL stored as audit trail only

**Tab 3: AI Generation (Google Imagen)**
- Prompt field with suggested starter prompts for AAC context (e.g. "simple flat illustration of...")
- Generates via Google Imagen API server-side
- Generated image uploaded to R2 under profile folder
- Prompt stored for regeneration; regenerate button re-runs and replaces the image

**Tab 4: Device Upload**
- File picker (accepts image/*) or camera trigger on mobile
- Image compressed and converted to `.webp` client-side before upload
- Uploaded to R2 under profile folder
- Most important tab for personalisation — photos of family members, local places, favourite toys

---

### Properties Section

**Label**
- Text field per language (eng, hin)
- For SymbolStix symbols: pre-populated from `symbols.words[language]`, fully editable
- For custom symbols: required, no pre-population

**Audio**
Four options via segmented control:

- **Default** — uses the pre-generated SymbolStix audio from R2 (SymbolStix symbols only)
- **Choose Word** — search the R2 audio library to use a different word's audio
- **Generate** — text field pre-populated with the label; calls Google Chirp 3 HD; generated audio stored in R2 under profile folder
- **Record** — browser MediaRecorder; waveform visualisation; playback before committing

**Display**
- Background colour picker (hex)
- Text colour picker (hex)
- Text size selector: sm / md / lg / xl
- Border colour and width
- Toggle: Show Label (on/off)
- Toggle: Show Image (on/off — creates a text-only symbol)
- Card shape: square / rounded / circle

A live preview of the symbol card updates in real time as properties change.

---

## Save Flow

When the parent taps Save:

1. If image source is AI or Google Images and not yet uploaded → upload to R2 first
2. If audio type is "generate" and not yet generated → call Chirp 3 HD, upload to R2
3. If audio type is "record" and not yet uploaded → upload to R2
4. Create or update `profileSymbol` record in Convex with all resolved paths and settings
5. Return `profileSymbolId` to the calling context (category grid, list editor, etc.)

---

## Audio Resolution Order

When playing a symbol anywhere in the app:

```
1. profileSymbol.audio.type = "recorded"   → user's own recording
2. profileSymbol.audio.type = "tts"        → generated Chirp 3 HD audio
3. profileSymbol.audio.type = "r2"         → chosen alternative word audio
4. symbols.audio[language].default         → SymbolStix pre-generated audio (fallback)
```

Custom symbols (non-SymbolStix) always require an explicit audio source — there is no step 4 fallback.

---

## R2 Storage for Profile Assets

```
profiles/
  {profileId}/
    symbols/
      {uuid}.webp     ← Google Images, AI generated, device uploads
    audio/
      {uuid}.mp3      ← User recordings, TTS overrides
```

Deleting a child profile batch-deletes everything under `profiles/{profileId}/` in R2.

---

## Where Symbols Live

Custom symbols created in the editor are saved only to the child's profile (`profileSymbols` table in `convex-home`). They are never added to the global SymbolStix library. They are private to that profile.

Mo Speech admins may separately curate exceptional custom symbols into the resource library, but this is a manual step — not automatic.
