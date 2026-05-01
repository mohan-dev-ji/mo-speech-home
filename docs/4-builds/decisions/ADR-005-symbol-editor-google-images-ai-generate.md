# ADR-005 — Symbol Editor: Image Search + AI Generate Tabs

**Date:** 2026-04-27 (revised 2026-04-28 — pivoted from Google CSE to Wikimedia Commons; revised 2026-04-29 — AI Generate build deviations)
**Status:** Accepted

> **2026-04-29 update (AI Generate build):** When implementing the Imagen route, two §3 dependencies were dropped:
> 1. **No `sharp`.** Imagen 4 Fast has no upstream resize parameter (it's `1K`-only), so the route stores the native ~1MB PNG. With a 10/user/day cap the R2 cost is rounding-error; `sharp` is a heavy native dep that slows Vercel cold starts. Tradeoff: every play-modal render of an AI symbol ships ~1MB instead of ~80KB. If mobile bandwidth complaints surface, add `sharp` (or browser-side `createImageBitmap` resize at display time) — both are localised follow-ups.
> 2. **No `@google-cloud/aiplatform` SDK.** The route uses REST + `google-auth-library`, mirroring `app/api/tts/route.ts:15-50`. The SDK adds ~100MB of grpc/proto deps and gives nothing here (no streaming, no useful retry logic). Same auth code path as TTS.
>
> Schema consequence: `aiImageCache.r2Key` ends in `.png` not `.webp` (cache helper `R2_PATHS.aiCache` returns `ai-cache/{uuid}.png`).

> **2026-04-28 update:** Google Custom Search JSON API turned out to be unusable on this Google account regardless of project, billing, key, or restriction state — the failure is account-scoped, not project-scoped (full diagnostic trail in [§ Google Cloud diagnostic trail](#google-cloud-diagnostic-trail)). The Image Search tab now uses **Wikimedia Commons** directly as v1, with **multi-source merge** (Pixabay + Unsplash + Pexels) as a follow-up if real-world testing shows gaps. AI Generate (Vertex AI Imagen) is unaffected — it uses service-account auth which works fine.

---

## Context

The `SymbolEditorModal` has four image-source tabs but only two are wired up. `SymbolStix` and `Upload` work; `Image Search` and `AI Generate` are placeholder "Coming soon" stubs (`SymbolEditorModal.tsx:713–726`). These two tabs are the standout features that make custom symbols feasible without instructor design effort:

- **Image Search** (Wikimedia Commons) lets instructors find real photos (animals, food, places, household objects) without copyright headaches — every result is CC-licensed with explicit attribution metadata. Brand-specific / proper-noun gaps are covered by Upload + AI Generate.
- **AI Generate (Imagen 4 Fast via Vertex AI)** covers the long tail — anything Wikimedia won't have, with stylistic presets (photorealistic / iconic vector / storybook / 3D claymation) so instructors don't have to write good prompts.

Both pipe their output through the same `pendingImageBlob → uploadBlobToR2` path the Upload tab already uses, and the schema (`convex/schema.ts:208–227`) already has `googleImages` and `aiGenerated` variants ready to receive them. (The `googleImages` variant name is kept for schema continuity — it now means "external image search result" regardless of provider.)

The build sets up: a server route that calls Wikimedia Commons, a server route for Imagen generation, a `proxy-image` endpoint to fetch a chosen result client-side as a Blob, two Convex tables to cache results, a daily-quota table, and the two new tab components. AI generation is **Max-tier only, capped at 10/day per user**; Image search is **Max-tier only, capped at 30/day per user** (higher limit because Wikimedia is free and rate-friendly). Images are downsized to **512px max edge** before R2 upload — play modal is the largest display target and doesn't need more.

---

## Decision

### 1 — Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│  SymbolEditorModal (existing)                                    │
│    ├─ ImagesTab (new)                                            │
│    │     POST /api/image-search/search?q=&page=                  │
│    │       → Convex query api.imageCache.lookupSearch (cache)    │
│    │       → if miss: Wikimedia Commons API → cache 24h → return │
│    │     onSelect → POST /api/image-search/proxy?url=            │
│    │       → fetch remote → resize 512px → return webp Blob      │
│    │       → handleImageSelected(blob, previewUrl) [existing]    │
│    │                                                             │
│    └─ AiGenerateTab (new)                                        │
│          POST /api/ai-generate/imagen { prompt, style }          │
│            → Convex query api.imageCache.lookupAi(hash)          │
│            → if hit: return cached r2Key                         │
│            → if miss: enforce daily quota → call Imagen 4 Fast   │
│                       → resize 512px → upload R2 → cache → return│
│          on "Add to Symbol" → fetch r2Key as Blob → handleImageSelected
└──────────────────────────────────────────────────────────────────┘
```

Both tabs end at the existing `handleImageSelected(blob, previewUrl)` callback — so on Save the modal's existing list-item / categoryBoard / sentence-slot save flows already classify the result with the right `imageSourceType` and write to the existing schema variants. No changes to save logic.

### 2 — Files to create

**Routes**
- `app/api/image-search/search/route.ts` — Clerk auth → tier check (`max`) → quota increment → Convex `imageCache.lookupSearch` → on miss call Wikimedia Commons API → Convex `imageCache.writeSearch` → return `{ results: [{ thumbnailUrl, fullUrl, sourceUrl, width, height, attribution, license }], cached, remaining }`. Provider-agnostic shape so a future multi-source merge slots in without changing the response contract.
- `app/api/image-search/proxy/route.ts` — Clerk auth → fetch remote URL server-side → validate `image/*` content-type → resize to 512px max edge → encode webp → return Blob (no R2 write yet; client uploads via existing `/api/upload-asset` only on modal Save). Whitelist of allowed source domains: `upload.wikimedia.org`, plus future merge sources.
- `app/api/ai-generate/imagen/route.ts` — Clerk auth → tier check → quota increment → hash `(prompt, style)` → Convex `imageCache.lookupAi` → on miss call Imagen 4 Fast (`@google-cloud/aiplatform` or REST) → resize 512px → upload to `ai-cache/{uuid}.webp` (global, not per-profile) → Convex `imageCache.writeAi` → return `{ r2Key, cached, remaining }`.

**Lib**
- `lib/image-providers/wikimedia.ts` — `searchWikimedia(query, page): Promise<ImageResult[]>`. Uses the public Wikimedia Commons API (no key, no auth):
  ```
  https://commons.wikimedia.org/w/api.php
    ?action=query&format=json
    &generator=search&gsrsearch=filetype:bitmap|drawing {query}
    &gsrnamespace=6&gsrlimit=20&gsroffset={page*20}
    &prop=imageinfo&iiprop=url|size|extmetadata|mime
    &iiurlwidth=300
    &origin=*
  ```
  Maps the response to the unified `ImageResult` shape: `{ thumbnailUrl, fullUrl, sourceUrl, width, height, attribution, license }`. Filters out SVG-only results (Wikimedia returns logos/diagrams not useful for AAC) by checking `mime`. Long-tail: if zero results, fall back to `gsrsearch=hastemplate:Photograph {query}` for a photo-only retry.
- `lib/image-resize.ts` — shared `resizeToWebp(input: Buffer, maxEdge: number): Promise<Buffer>` using `sharp` (server-side; add to deps).
- `lib/ai-style-prompts.ts` — exports `STYLE_PRESETS` with the four templates. Single source of truth used by the route to wrap the user prompt before calling Imagen.

```ts
export const STYLE_PRESETS = {
  photorealistic: {
    label: 'Photorealistic',
    template: (p: string) => `a clear, well-lit photograph of ${p}, plain white background, centred subject, no text, no watermark`,
  },
  iconic: {
    label: 'Iconic Vector',
    template: (p: string) => `a simple flat vector icon of ${p}, bold black outlines, single subject, AAC symbol style, white background, no text`,
  },
  storybook: {
    label: 'Storybook',
    template: (p: string) => `a friendly children's storybook illustration of ${p}, soft pastel colours, simple shapes, white background, no text`,
  },
  claymation: {
    label: '3D Claymation',
    template: (p: string) => `a soft 3D claymation render of ${p}, plain background, centred, cute, no text`,
  },
} as const;
```

**Convex**
- `convex/imageCache.ts` — three queries + two mutations:
  - `lookupSearch({ query })` — index on `by_query`, returns cached results if `expiresAt > now`.
  - `writeSearch({ query, results })` — sets 24h TTL.
  - `lookupAi({ hash })` — index on `by_hash`, no expiry.
  - `writeAi({ hash, prompt, style, r2Key })`.
- `convex/featureQuota.ts` — `checkAndIncrement({ feature, limit })` mutation. Reads `featureQuota` row keyed by `(userId, feature, day)`, throws `QuotaExceeded` if at limit, otherwise increments. Returns `{ remaining }`. `getRemaining({ feature, limit })` query for surfacing in the UI.

**Schema additions (`convex/schema.ts`)**
```ts
imageSearchCache: defineTable({
  query: v.string(),         // normalised lowercase
  results: v.array(v.object({
    thumbnailUrl: v.string(),
    fullUrl: v.string(),
    sourceUrl: v.string(),         // e.g. Wikimedia file page
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    attribution: v.string(),       // photographer / uploader
    license: v.string(),           // e.g. "CC BY-SA 4.0"
    provider: v.string(),          // 'wikimedia' for now; 'pixabay'/'unsplash'/'pexels' later
  })),
  expiresAt: v.number(),
}).index("by_query", ["query"]),

aiImageCache: defineTable({
  hash: v.string(),          // sha256 of `${style}|${prompt.toLowerCase().trim()}`
  prompt: v.string(),
  style: v.string(),
  r2Key: v.string(),         // ai-cache/{uuid}.webp — global, shared across users
  hits: v.number(),          // for analytics
}).index("by_hash", ["hash"]),

featureQuota: defineTable({
  userId: v.string(),        // clerkUserId
  feature: v.string(),       // 'imageSearch' | 'aiImageGenerate'
  day: v.string(),           // 'YYYY-MM-DD' UTC
  count: v.number(),
}).index("by_user_feature_day", ["userId", "feature", "day"]),
```

**Components**
- `app/components/app/shared/modals/symbol-editor/ImagesTab.tsx` — clones `SymbolStixTab.tsx` shape: debounced search input, 4-col grid, click-to-select, attribution line under each thumbnail (photographer + license, linkable to `sourceUrl`), "X searches left today" footer. On select: calls `/api/image-search/proxy`, gets Blob, calls `onImageSelected(blob, previewUrl)`. Shows upsell card if `tier !== 'max'`.
- `app/components/app/shared/modals/symbol-editor/AiGenerateTab.tsx` — large preview area, 4 style cards (`Photorealistic`, `Iconic Vector`, `Storybook`, `3D Claymation`), prompt input at bottom, "Discard changes / Add to Symbol" buttons. On Generate: calls `/api/ai-generate/imagen`, displays preview from `/api/assets?key={r2Key}`. On "Add to Symbol": fetches the r2Key as Blob, calls `onImageSelected(blob, previewUrl)`. Shows quota counter and upsell card.

### 3 — Files to modify

- `convex/schema.ts` — add the three tables above.
- `app/components/app/shared/modals/symbol-editor/SymbolEditorModal.tsx:713–726` — replace the two "Coming soon" placeholders with `<ImagesTab>` and `<AiGenerateTab>`. Add `tier` and `userId` props read from `useAppState()` and `useAuth()` respectively (or look them up inside the new tabs — slightly cleaner). Rename the tab label from "Google Images" to "Image Search" in the modal's tab bar (and the matching translation keys).
- `app/components/app/shared/modals/symbol-editor/index.ts` — re-export the two new tab components.
- `messages/en.json` and `messages/hi.json` — add keys under `symbolEditor`:
  - `imageSearchPlaceholder`, `imageSearchAttribution`, `imageSearchesLeft`, `imageSearchTabLabel`
  - `aiPromptPlaceholder`, `aiStylePhotorealistic`, `aiStyleIconic`, `aiStyleStorybook`, `aiStyleClaymation`
  - `aiGenerate`, `aiAddToSymbol`, `aiDiscardChanges`, `aiGenerationsLeft`
  - `maxTierUpsell`, `quotaExceeded`
  - Per `CLAUDE.md` rule 1: real English in `en.json`, `"English value (hi)"` placeholder in `hi.json`.
- `package.json` — add `sharp` (server-side image resize) and `@google-cloud/aiplatform` (Imagen via Vertex).
- `.env.local` — see "Credentials" section below.
- `docs/1-inbox/ideas/05-symbol-editor.md` — replace the placeholder "Tab 2" / "Tab 3" sections (lines 46–54) with the actual implementation.

### 4 — Max-tier gating

Both new features are **Max tier only**. Enforced in two places:

**Server-side (authoritative)** — both routes (`/api/image-search/search`, `/api/ai-generate/imagen`) call `api.users.getMyAccess` from Convex and reject with 403 if `tier !== 'max'` AND `hasFullAccess !== true`. The `hasFullAccess` flag already includes the `customAccess` admin override path — no extra code needed.

**Client-side (UX)** — `ImagesTab` and `AiGenerateTab` read `subscription.tier` via `useAppState()`. If not Max, render an upsell card instead of the search/generate UI.

**Dev/QA path (no env-var bypass)** — admins grant themselves access via the existing `users.subscription.customAccess` field. Set `customAccess.isActive: true` directly in Convex dashboard or via a small one-off mutation.

**Routes return shape** on tier rejection:
```json
{ "error": "max_tier_required", "message": "AI image generation is a Max-tier feature" }
```

### 5 — Limits & caching

| Feature | Tier | Daily limit | Cache | Cache key | TTL |
|---|---|---|---|---|---|
| Image Search (Wikimedia Commons) | Max | **30 / user** | Yes | normalised query + page | 24h |
| Image Search select-and-save | Max | (covered by upload limits) | No | — | — |
| AI Imagen generation (Imagen 4 Fast) | Max | **10 / user** | Yes | `sha256(style + '\|' + prompt)` | forever |

Wikimedia Commons has no per-user rate limit and no key — limits exist only to keep costs predictable when the Imagen tab inevitably grows expensive cousins. 30 search/day per user is generous enough to feel unlimited but caps abuse.

**Cost justification**:
- Imagen 4 Fast ≈ $0.02/image; 10/day max = ~£0.15/day worst case per user. For a £15/mo Max plan that's a 30% margin floor.
- Wikimedia Commons = free, no key, no quota at our scale. Polite use only — set `User-Agent: mo-speech (https://mospeech.com; support@mospeech.com)` per [Wikimedia API etiquette](https://meta.wikimedia.org/wiki/User-Agent_policy).
- AI cache hits don't count against the quota — repeated "tree → iconic vector" across all Max users hits R2, not Imagen.

### 6 — Multi-source merge (deferred)

If real-world testing shows Wikimedia coverage gaps for common AAC vocabulary (likely areas: branded foods, modern toys, trending characters, niche cultural items), bolt on additional providers:

- **Pixabay** (free key, 5000/h limit, beautiful curated photos + AAC-friendly vector art)
- **Unsplash** (free key with attribution requirement, modern lifestyle photography)
- **Pexels** (free key, free CC0 stock)

The route signature already supports this — the search route fans out to multiple `lib/image-providers/*.ts` modules and merges by deduped URL with provider weights. Schema field `provider: string` is already in place. Don't build until v1 ships and gaps are observed.

---

## Credentials

### A. Image Search — none required

Wikimedia Commons API is open. No key, no env var, no signup. Just a polite `User-Agent` header.

### B. Vertex AI / Imagen 4 Fast (for AI Generate tab)

Single shared service account JSON for **TTS + Imagen** in project `mo-speech-prod`. Provisioned 2026-04-28:

- SA: `mo-speech-app@mo-speech-prod.iam.gserviceaccount.com`
- Roles: `Vertex AI User` (`roles/aiplatform.user`), `Service Usage Consumer` (`roles/serviceusage.serviceUsageConsumer`)
- Local path: `~/.gcloud/mo-speech-app-prod.json` (chmod 600)
- Region for Imagen calls: `us-central1` (Imagen 4 Fast is `us-central1`-only per Google's canonical docs; verified 2026-04-28)
- Region for everything else: `europe-west2` (London) by default — user is UK-based, latency matters

Env vars (added during the TTS swap step of the migration):
- `GOOGLE_SERVICE_ACCOUNT_JSON=<inline JSON of mo-speech-app-prod.json>` — used by both `/api/tts` and `/api/ai-generate/imagen`
- `GOOGLE_CLOUD_PROJECT_ID=mo-speech-prod` — added when Imagen route is built
- `GOOGLE_CLOUD_LOCATION=us-central1` — Imagen-specific; do **not** treat as a global region for other services

---

## Google Cloud diagnostic trail

This section is the post-mortem of why CSE was abandoned. Recorded so the next person (likely you in 6 months) doesn't waste a day reinventing the same diagnosis.

### What we tried

1. **Original setup:** API key + CX in `mo-speech-home`, Custom Search API enabled, billing linked. Curl returned `403 PERMISSION_DENIED — This project does not have the access to Custom Search JSON API.`
2. **Verified billing** — linked correctly, screenshot confirmed `mo-speech-home` was on "My Billing Account 1" alongside other working projects.
3. **Verified PSE engine** (`b601bb007b46343a8`) — exists, image search ON, public URL works.
4. **Verified API key** — listed in the right project's Credentials, restricted to `Custom Search API` only, no application restrictions.
5. **Created a fresh API key** in the same project — same 403.
6. **Disabled and re-enabled** Custom Search API — same 403.
7. **Sent `x-goog-user-project: mo-speech-home` header** — error changed to `USER_PROJECT_DENIED — Caller does not have required permission to use project mo-speech-home`. Indicates API-key auth is broken at the project consumer-identity level.
8. **API Explorer** (Google's own console "Try it" panel for the API) — works, returns image results. Uses OAuth on the user's identity, bypassing API-key auth.
9. **Service-account auth** with `Service Usage Consumer` + `cloud-platform` scope — `403 ACCESS_TOKEN_SCOPE_INSUFFICIENT`. Custom Search JSON API doesn't accept OAuth bearer tokens (consistent with Google's docs, even though the API Explorer made it look otherwise).
10. **Brand-new project** (`mo-speech-prod`), fresh billing link, fresh API enable, fresh key, no header — same 403.
11. **YouTube Data API test** in the same fresh project, same key (with YouTube added to restrictions) — **works, returns 200**. So API-key auth itself is healthy.

### Conclusion

The `Custom Search JSON API` is **specifically broken on this Google account** — every other API works with API-key auth, but CSE returns "this project does not have access" regardless of project, billing, or key state. Likely an inherited account-level flag from the original `mo-speech-465721` provisioning or some earlier setup. Google support could clear it via an internal ticket, but the cost (multi-day round-trip) is far higher than the cost of using a different image search provider.

### What we kept

- **`mo-speech-prod` project** — clean state, billing linked, ready to host TTS + Imagen.
- **`mo-speech-app` service account** — has `Vertex AI User` + `Service Usage Consumer`, JSON downloaded to `~/.gcloud/mo-speech-app.json`. The original plan to add `Cloud Text-to-Speech User` was unnecessary — TTS doesn't gate on a dedicated role, only on `serviceusage.services.use` (which `Service Usage Consumer` provides).
- **PSE engine** `b601bb007b46343a8` — orphaned but harmless. Free to delete from the Programmable Search Engine control panel; nothing references it after this revision.

### What we discarded

- **`GOOGLE_CSE_API_KEY`** — to be deleted from `.env.local` once the migration finishes.
- **`GOOGLE_CSE_CX`** — to be deleted from `.env.local` (no longer used).
- **`mo-speech-home` project** — abandoned. Never used by code. Safe to shut down once we're sure nothing was provisioned there beyond the broken CSE setup.

---

## Project audit (revised 2026-04-28)

| Project | Status | Holds | Used by | Action |
|---|---|---|---|---|
| `mo-speech-prod` (new, 2026-04-28) | **Active** | TTS API + Vertex AI API + `mo-speech-app` SA (provisioned 2026-04-28); billing on "My Billing Account 2" | TTS (post-swap), Imagen (when built) | **Target home** for all Google APIs |
| `rational-terra-426105-u4` | Active (legacy) | TTS service account `tts-account@…` | `app/api/tts/route.ts` (live) | Migrate TTS to `mo-speech-prod`, then shut down |
| `mo-speech-465721` (Nov 2025) | Active | Clerk Google sign-in OAuth callback (Web Client 1, verified matches live Clerk social provider 2026-04-28); billing on "My Billing Account" | Clerk only — no app code | Leave (OAuth only, no API quota; moving risks breaking 100+ inherited MVP sign-ins) |
| `mo-speech-home` (2026-04-27) | **Abandoned** | Was the original CSE target; also accidentally received the `mo-speech-app` SA during CSE debugging — that SA was disabled 2026-04-28 with old key file renamed to `~/.gcloud/mo-speech-app.home.json.bak` | Nothing | Delete SA + key + project after 7-day rollback window (target: 2026-05-05) |

---

## Migration checklist

Run in order. Each step is independently revertable.

### Search (new path)

**S1. Wikimedia Commons integration**
- [ ] Build `lib/image-providers/wikimedia.ts` — call the public API with the `User-Agent` header, map response to the unified `ImageResult` shape, filter SVGs.
- [ ] Build `app/api/image-search/search/route.ts` and `app/api/image-search/proxy/route.ts`.
- [ ] Build `convex/imageCache.ts` and add `imageSearchCache` + `aiImageCache` + `featureQuota` to the schema.
- [ ] Build `app/components/app/shared/modals/symbol-editor/ImagesTab.tsx`.
- [ ] Wire it into `SymbolEditorModal.tsx:713–726`. Update tab label to "Image Search".
- [ ] Test end-to-end: search "apple" → see Wikimedia results → click → see preview → save symbol → confirm `imageSourceType: 'googleImages'` row in Convex (schema variant kept for continuity) and webp blob in R2.

### Imagen + TTS consolidation (still needed)

**M1. Provision in `mo-speech-prod`** *(done 2026-04-28 — corrected)*

> **Correction note:** the original M1 was incorrectly marked complete earlier on 2026-04-28. The SA had actually been created on `mo-speech-home` (the abandoned CSE-debug project), not `mo-speech-prod`. Re-provisioned correctly on 2026-04-28; the orphan SA on `mo-speech-home` has been disabled (see M3-bis).

- [x] APIs enabled on `mo-speech-prod`: `texttospeech.googleapis.com`, `aiplatform.googleapis.com` (verified via `gcloud services list --enabled`).
- [x] Billing linked: account `017ECA-5EB58A-913E89` ("My Billing Account 2"), `billingEnabled: true`.
- [x] SA `mo-speech-app@mo-speech-prod.iam.gserviceaccount.com` created with `roles/aiplatform.user` + `roles/serviceusage.serviceUsageConsumer`.
- [x] JSON key downloaded to `~/.gcloud/mo-speech-app-prod.json` (chmod 600). Distinct filename from the orphan key to prevent confusion.
- [x] Smoke-tested: `gcloud auth print-access-token` returns a valid token, and `GET /v1/projects/mo-speech-prod/locations` returns HTTP 200 (proving the role binding works end-to-end).

**M2. Swap TTS credentials** *(done 2026-04-28)*
- [x] Added `GOOGLE_SERVICE_ACCOUNT_JSON` (inline JSON of `mo-speech-app-prod.json`) to `.env.local`.
- [x] Updated `app/api/tts/route.ts:16-17` to read `GOOGLE_SERVICE_ACCOUNT_JSON`.
- [x] Smoke-tested locally: "Let's eat rice" sentence synthesised, audio file written to R2 under `audio/...`, `ttsCache` row created, playback worked. ✅
- [x] Removed legacy `GOOGLE_TTS_CREDENTIALS_JSON` line from `.env.local`.
- [ ] In Vercel/prod env (when ready), do the same swap.

**M3. Decommission old TTS project** *(PAUSED 2026-04-28 — do not disable without verification)*

⚠ The MVP (`mo-speech-mvp-2.0`) is still receiving organic sign-ups and active use. A spot-check on 2026-04-28 found the MVP's only Google-related API route is `/api/speech/token` which serves a Deepgram key (STT, not TTS). Deepgram is unrelated to `rational-terra-426105-u4`, so on the surface this project may genuinely be unused. **But this was not exhaustively verified** — it only checked `app/api/`. Before disabling anything in `rational-terra-426105-u4`:

- [ ] Audit MVP exhaustively: search `app/`, `lib/`, `components/`, `convex/`, `pages/` for any Google Cloud TTS / `texttospeech` / `google-auth-library` / `@google-cloud/*` imports.
- [ ] Check Vercel env vars for the deployed MVP — confirm whether `GOOGLE_TTS_CREDENTIALS_JSON` (or similar) is set in production.
- [ ] If MVP is genuinely Google-free, then disable `tts-account@rational-terra-426105-u4.iam.gserviceaccount.com` (don't delete yet — keeps a 7-day rollback).
- [ ] After 7 days of green prod TTS on the new build: delete the SA and shut down the project.

Cost of leaving it alive while paused: ~£0/mo (SA no longer referenced anywhere, so not minting tokens). No urgency to decommission.

**M3-bis. Decommission orphan SA + abandoned `mo-speech-home`** *(in progress 2026-04-28)*
- [x] Disabled `mo-speech-app@mo-speech-home.iam.gserviceaccount.com` (verified `disabled: True`).
- [x] Renamed local key file: `~/.gcloud/mo-speech-app.json` → `~/.gcloud/mo-speech-app.home.json.bak`.
- [ ] After 7-day rollback window (≥ 2026-05-05): delete the orphan SA, delete the `.home.json.bak` file, then shut down the entire `mo-speech-home` project.

**M4. Wire Imagen**
- [ ] Imagen route reads the same `GOOGLE_SERVICE_ACCOUNT_JSON` (no second SA needed).
- [ ] Add `GOOGLE_CLOUD_PROJECT_ID=mo-speech-prod` and `GOOGLE_CLOUD_LOCATION=us-central1` to `.env.local`.

**M5. Cleanup**
- [ ] Delete `GOOGLE_CSE_API_KEY` and `GOOGLE_CSE_CX` from `.env.local`.
- [ ] Delete the `cse-key` API key from `mo-speech-prod`'s Credentials page.
- [ ] Delete the orphaned PSE engine `b601bb007b46343a8` from the Programmable Search Engine control panel.
- [ ] Shut down `mo-speech-home` project.
- [ ] Document `mo-speech-465721` purpose: "Clerk Google sign-in OAuth callback only. Do not enable other APIs here."

### Env-var convention going forward

- **Inline JSON only** (`GOOGLE_SERVICE_ACCOUNT_JSON`), not file paths (`GOOGLE_APPLICATION_CREDENTIALS`). Reason: Vercel has no writable filesystem for credential files; inline JSON works in both local dev and serverless prod with no special handling.
- **One SA, two roles** (`Vertex AI User` + `Service Usage Consumer`). Covers TTS and Imagen. If a future feature needs a different role, add it to this SA before adding a second SA.
- **Project name in env-var prefix is forbidden** (no `MO_SPEECH_PROD_GOOGLE_…` style). Use feature-neutral names so the same var works across environments.

---

## Consequences

- Two new server routes, two new Convex modules, two new components, three new schema tables.
- New runtime deps: `sharp`, `@google-cloud/aiplatform`.
- Max-tier gating is now load-bearing — the existing `customAccess` admin path becomes the dev/QA bypass (no separate code path).
- `ai-cache/` becomes a new top-level R2 prefix (global, never deleted on profile delete).
- The cache is invisible in v1; a future "community library" phase can surface popular entries (`hits >= 3`) once we have moderation and PII filtering for prompts.
- **Wikimedia attribution must be displayed** — the ImagesTab shows photographer + license under each thumbnail, and the saved symbol carries `attribution` + `license` + `sourceUrl` fields so we can render attribution wherever the symbol is shown long-term. (Schema `googleImages` variant needs to gain these fields — small follow-up.)
- Coverage gaps vs Google CSE: less brand-name / proper-noun coverage. Mitigated by Upload + AI Generate as the product story; multi-source merge available as fallback if observed gaps are bad.
- Consolidation reduced project count from 4 to 3 active (`mo-speech-prod`, `rational-terra-426105-u4` until decommissioned, `mo-speech-465721` for OAuth only).
