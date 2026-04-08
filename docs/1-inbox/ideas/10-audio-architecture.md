# Audio Architecture

## Two-Tier System

Mo Speech uses two distinct voice types. This is a deliberate product decision, not a cost compromise.

| Tier | Content | Voice | Method | Cost |
|---|---|---|---|---|
| 1 | Individual symbols (58k) | Google Standard TTS | Pre-generated once, stored in R2 | Effectively zero |
| 2 | Sentences, lists, first-thens | Google Chirp 3 HD | On-demand → cached in R2 | Pay per generation of new content |

---

## Tier 1 — Symbol Audio (Mechanical)

Individual symbol words use the same mechanical Google Standard TTS voice that was used in the MVP. This is deliberate — clear, unambiguous pronunciation aids processing for users who struggle with communication. Consistency matters more than naturalness for single words.

All 58,000 audio files are pre-generated and stored in R2. Generation is a one-time batch process per language. The app never calls TTS for individual symbol audio at runtime.

**R2 path structure:**
```
audio/eng/default/{word}.mp3
audio/hin/default/{word}.mp3
```

To add a new language: re-run the generation script with the target Google TTS language code and voice. Same process, different output folder.

---

## Tier 2 — Sentence Audio (Natural)

Sentences, lists, and first-thens use Google Cloud Chirp 3 HD — a natural, warm voice. A student hearing "Time to brush your teeth" or "I want to go to the park" should hear something human, not robotic.

**Generation:** On-demand when a sentence is first played. The text is sent to the Chirp 3 HD API server-side. The returned audio is uploaded to R2. All subsequent plays hit R2 directly — no API call, no cost.

**Cache key structure:**
```
sentences/{language}/{hash-of-text}.mp3
```

The hash is a deterministic hash of the sentence text and language. The same sentence created by two different users generates one audio file and shares the same R2 path.

---

## Audio Resolution Order

When the app plays a symbol, it resolves audio in this priority order:

```
1. profileSymbol.audio.type = "recorded"   → user's own recording (highest priority)
2. profileSymbol.audio.type = "tts"        → Chirp 3 HD generated override
3. profileSymbol.audio.type = "r2"         → alternative word chosen from R2 library
4. symbols.audio[language].default         → pre-generated SymbolStix audio (fallback)
```

Custom symbols (non-SymbolStix) have no step 4 fallback — they always require an explicit audio source.

---

## Voice Cloning — Future Premium Feature

Both ElevenLabs and Mistral Voxtral TTS (released March 2026, open-weight) support cloning from 2–3 seconds of audio. Two compelling future features:

**Instructor's voice:** An instructor records a few seconds of themselves speaking. The app synthesises all sentences in that voice. Emotionally significant for a non-verbal student — they hear a familiar, warm voice from the device.

**Student's own voice:** The most profound version. Capture whatever vocalisations the student makes and synthesise all sentences in their own voice. Dedicated AAC devices charge thousands of pounds for this. At Mo Speech's price point with modern TTS it becomes accessible. Positioned as a premium tier feature.

---

## Voxtral TTS — Watch This Space

Mistral released Voxtral TTS in March 2026. Open-weight, 4B parameters, runs on consumer hardware. In human evaluations it achieved a 68.4% win rate over ElevenLabs Flash v2.5. The architecture above works with any TTS provider — swapping is an environment variable change. Evaluate Voxtral once its commercial API pricing stabilises.

---

## Service Worker Caching

The existing service worker from the MVP caches symbol audio files after first load for instant playback. Core vocabulary (500 most common AAC words) is pre-cached on service worker install.

The service worker strategy applies to all audio regardless of tier:
- First request: fetch from R2, cache response
- Subsequent requests: serve from cache instantly (0ms)

This is critical for voice search — a user speaks "I want to eat" and four audio files must play with no perceptible delay.

---

## R2 Storage Structure

```
audio/
  eng/default/         ← pre-generated symbol audio (English)
  hin/default/         ← pre-generated symbol audio (Hindi)
sentences/
  eng/{hash}.mp3       ← cached natural voice sentences (English)
  hin/{hash}.mp3       ← cached natural voice sentences (Hindi)
symbols/
  {filename}.png       ← SymbolStix images
profiles/
  {profileId}/
    symbols/{uuid}.webp   ← custom symbol images (AI, Google, upload)
    audio/{uuid}.mp3      ← user recordings and TTS overrides
```
