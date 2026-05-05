##Sym link env

ln -s /Users/mohanveraitch/Projects/mo-speech-home/.env.local /Users/mohanveraitch/Projects/mo-speech-home/.claude/worktrees/dazzling-lamport-67c4f0/.env.local







In the symbols table we already have a categories and tags columns that I want to use this to help us arrange our symbols for our default categories.
There are 58k symbols can you scan the table and give me your recomendations for default categories we can use for Mo Speech. On this scan can we also think about smaller grouped categories of little words that make up proper sentences. I can always copy these from proloquo as they have the same words on every category page. Ours is better because it is in the dropdown and we can group them
Also let's take into consideration the default categories in proloquo:
- Actions
- Help
- Ppeople
- Things
- Places
- Describe
- Little words
- Chat
- Activities
- Food
- Fun
- Feelings
- Time
- Clues
- Questions?
- Where?
- Which?
- Conjunctions
- Numbers
- Religion
- Home

On your scan can you see if Proloquo got their groups from the already existing metadata in SymbolStix as there are categories and tags columns that we also seeded in our symbols table.



## Symbols Editors

In this session we will build the Symbol Editor

I'm building Mo Speech Home, a full AAC (Augmentative and Alternative Communication) platform. The stack is Next.js 16 / React 19 / TypeScript /     
  Tailwind CSS 4 / Convex 1.x / Clerk v7 / Cloudflare R2.                                                                                              
                                                            
  Read these files before touching any code:                                                                                                           
  - CLAUDE.md (project rules — especially the i18n rule and component location rule)
  - convex/_generated/ai/guidelines.md (Convex patterns)                                                                                               
  - docs/1-inbox/ideas/05-symbol-editor.md (full feature spec)
  - docs/1-inbox/ideas/10-audio-architecture.md (two-tier audio, R2 paths)                                                                             
  - docs/4-builds/features/01-categories.md (edit mode architecture — Level 1 / Level 2 distinction, critical)                                         
  - convex/schema.ts — focus on profileSymbols, audioSource validator, and symbols table                                                               
                                                                                                                                                       
  What it is                                                                                                                                           
                                                                                                                                                       
  SymbolEditorModal is a single shared modal that handles ALL symbol creative editing across the entire app. It lives at                               
  app/components/shared/SymbolEditorModal.tsx. It is never duplicated or specialised per-context.                                                      
                                                                                                                                                       
  It opens in two modes:                                                                                                                               
  - Edit — receives a profileSymbolId, loads the existing record, pre-populates all fields
  - Create — receives a profileCategoryId, starts blank                                                                                                
                                                            
  Two sections                                                                                                                                         
                                                            
  Image section — 4 tabs:                                                                                                                              
  1. SymbolStix — reuse api.symbols.searchSymbols (already built); selecting a result sets imageSource.type = "symbolstix"
  2. Google Images — search field → GET /api/google-images?q= server route → display results → on select, download + convert to .webp server-side →    
  upload to R2 at profiles/{profileId}/symbols/{uuid}.webp                                                                                         
  3. AI Generate — prompt field → POST /api/generate-image server route (Google Imagen) → upload to R2; store prompt for regeneration                  
  4. Device Upload — file picker → compress/convert to .webp client-side → upload to R2                                              
                                                                                                                                                       
  Properties section (always visible):                                                                                                                 
  - Label: text field per language (eng, hin) — pre-populated from symbols.words for SymbolStix symbols                                                
  - Audio: segmented control — Default (SymbolStix R2 file) / Choose Word (search R2 audio library) / Generate (Chirp 3 HD via POST                    
  /api/generate-audio) / Record (MediaRecorder)                                                                                     
  - Display overrides: bgColour, textColour, textSize (sm/md/lg/xl), borderColour, borderWidth, showLabel toggle, showImage toggle, shape              
  (square/rounded/circle)                                                                                                                
  - Live SymbolCard preview updates as properties change                                                                                               
                                                            
  Save flow                                                                                                                                            
                                                                                                                                                       
  Nothing writes to Convex until Save is tapped:
  1. Resolve any pending R2 uploads (image, audio)                                                                                                     
  2. Create or update profileSymbol record                                                                                                             
  3. Call onSave(profileSymbolId) prop and close
  4. Symbol can only be saved to a new or pre-existing category. If not it will not be able to be viewed anywhere by the users.
                                                                                                                                                       
  profileSymbols schema (already defined — do not change):                                                                                             
  imageSource: discriminated union — symbolstix | googleImages | aiGenerated | userUpload                                                              
  label: { eng: string, hin?: string }                                                                                                                 
  audio?: { eng?: audioSource, hin?: audioSource }                                                                                                     
    // audioSource = { type: "r2"|"tts"|"recorded", path: string, ttsText?: string }
  display?: { bgColour, textColour, textSize, borderColour, borderWidth, showLabel, showImage, shape }                                                 
                                                                                                                                                       
  R2 asset proxy — all R2 reads go through /api/assets?key={r2path} (already built). All R2 writes will need a new server route or Convex action.      
                                                                                                                                                       
  Architecture rules that must hold:                                                                                                                   
  - All UI text via useTranslations — add every key to messages/en.json (real English) and messages/hi.json ("English value (hi)" placeholder)         
  - All colours via Tailwind design tokens — no hard-coded colours                                                                                     
  - Components live in app/components/shared/ (this is a shared modal used app-wide)
  - The modal accepts profileSymbolId (edit) or profileCategoryId (create) plus onSave and onClose callbacks — no internal context dependencies        
  - SymbolEditorModal is Phase 4 pulled forward. The Board edit mode (SymbolCardEditable) is already scaffolded and calls                              
  onEditRequest(profileSymbolId) — the category page will open this modal in response. Most pages will use SymbolEditorModal                                                              
                                                                                                                                                       
  Build order within this task:                                                                                                                        
  1. Start with the modal shell + Properties section (label, display overrides, live preview) — no server routes needed                                
  2. Add SymbolStix tab (search already exists)                                                                                                        
  3. Add Device Upload tab (client-side only)                                                                                                          
  4. Add audio: Default + Record (no server routes needed)                                                                                             
  5. Wire the Convex create/update mutations                
  6. Add Google Images, AI Generate, and TTS Generate tabs last (need new server routes)                                                               
                                                                                                                                                       
  Start by reading the spec files listed above. Then write a build plan and confirm before writing any code.             


   Building the AI Generate tab (tab 4) of the Symbol Editor per ADR-005. Credentials are sorted: mo-speech-app@mo-speech-prod SA, key at ~/.gcloud/mo-speech-app-prod.json GOOGLE_SERVICE_ACCOUNT_JSON in .env.local (TTS already migrated and smoke-tested green). Read ADR-005 §"AI Generate" and app/api/tts/route.ts for the auth pattern, then propose the build steps. Two open decisions to confirm: (1) skip sharp, accept Imagen's native ~1MB PNG; (2) skip @google-cloud/aiplatform SDK, use REST + google-auth-library like TTS does.

   A white school bus used in the uk for children with disabilities

   
I'm building Mo Speech Home (Next.js 16 / React 19 / Convex / Clerk /
  Cloudflare R2 / Stripe). I need a "Delete Account" flow.

  Where it lives now: add a red destructive button to
  app/components/app/settings/sections/DevTestPanel.tsx for dev testing.
  Eventually this same flow will be exposed to end users from a real
  settings screen, so write the deletion logic as a clean Convex action
  (or mutation + action pair) that can be called from anywhere — don't
  bake it into the dev panel.

  What "Delete Account" must remove:

  1. Convex content tables (account-scoped — match by accountId === caller
   user._id):
    - profileCategories
    - profileSymbols
    - profileLists (and any list-item rows if a separate table exists —
  check schema)
    - profileSentences (and any sentence-item rows if separate)
  2. Convex profile tables:
    - All studentProfiles where accountId === user._id
    - All modellingSessions and studentViewSessions for those profiles
    - All accountMembers rows where accountId === user._id (collaborators)
  3. Convex user record itself — the row in users for this Clerk user.
  4. R2 storage — wipe both prefixes:
    - accounts/{accountId}/... (current scheme — images, generated TTS
  audio, recorded audio)
    - profiles/{profileId}/... for every deleted student profile (legacy
  scheme, may still hold older assets)
  Use the R2 SDK (@aws-sdk/client-s3) ListObjectsV2 + DeleteObjects
  paginated. There's an existing R2 helper somewhere in the repo — find
  and reuse it rather than instantiating a new client.
  5. Stripe — if the account has an active subscription, cancel it before
  deleting Convex records. Check the users row for a stored
  stripeCustomerId / subscription id.
  6. Clerk — delete the Clerk user via the Clerk backend SDK as the last
  step (so if it fails midway, the Convex records are already gone and we
  don't leave a Clerk user with no data).

  Order of operations matters. Suggest: Stripe cancel → R2 wipe → Convex
  content → Convex profiles + sessions → Convex user record → Clerk user →
   sign out client.

  UX:
  - Two-step confirm: button opens a Dialog with a typed-confirmation
  input ("type DELETE to confirm") plus the user's email shown as a sanity
   check.
  - On success, sign the user out and redirect to the marketing home.
  - Show progress / error messages inline.

  Constraints from the project:
  - Read convex/_generated/ai/guidelines.md first.
  - Read CLAUDE.md (project root) — strict rules about translation keys
  (en.json + hi.json placeholder), AAC theme tokens (bg-theme-*,
  rounded-theme-sm etc., NO hardcoded colours), and component folder
  structure.
  - Use useTranslations for every string; add keys to both locale files.
  - Use the existing Dialog wrapper at
  app/components/shared/ui/Dialog.tsx.
  - Do NOT skip type checking — run npx tsc --noEmit clean before
  declaring done.

  Investigate before writing:
  - convex/schema.ts — confirm the full list of account-scoped tables and
  any I haven't listed.
  - convex/studentProfiles.ts — there's already a deleteStudentProfile
  cascade you can mirror.
  - lib/r2-paths.ts and any app/api/upload-asset / app/api/assets routes —
   find the existing R2 client setup.
  - Whatever Stripe webhook / customer code already exists in
  app/api/stripe/... or convex/stripe.ts.

  Deliver the Convex action(s), the dev panel button + confirmation modal,
   and the locale keys. Keep the deletion logic reusable for the future
  user-facing screen.


   I'm starting Modelling Mode (Phase 5 — the most technically complex feature in Mo Speech Home). Before suggesting anything or writing code, please read in this order:

  1. CLAUDE.md (project rules — especially rule 5 on theme tokens and rule 6 on component folder layout)
  2. docs/1-inbox/ideas/04-modelling-mode.md — full feature spec
  3. docs/1-inbox/ideas/00-build-plan.md — Phase 5 section (around line 346) for ordered build steps and ADR references
  4. docs/4-builds/decisions/ — any ADR mentioning modelling, overlays, or dual-profile (ADR-006 referenced in the build plan)
  5. convex/_generated/ai/guidelines.md — Convex API patterns
  6. convex/schema.ts — confirm modellingSession table state
  7. app/contexts/ModellingSessionContext.tsx — see what's already scaffolded
  8. app/components/shared/ModellingOverlayWrapper.tsx if present, plus SymbolCard.tsx (already wired with componentKey)

  Key constraints to keep in mind:
  - Prerequisite (gate this first): dual-profile testing rig — setViewMode in ProfileContext.tsx needs a UI caller before any modelling work begins. Confirm this exists or plan it as step 1.
  - Wrappers needed on Sidebar.tsx categories nav button (categories-nav-button) and CategoryTile.tsx (category-tile-{categoryId}). SymbolCard is already wrapped.
  - Trigger gating is three-fold: viewMode === 'instructor' AND useSubscription().hasModelling AND stateFlags.modelling_push.
  - Every UI string goes through useTranslations with keys added to both en.json and hi.json (placeholder format "English value (hi)").
  - AAC theme tokens only — no hard-coded colours / radii / spacing.
  - Component placement: app/components/app/{domain}/{sections|ui|modals}/. Page files stay thin.

  After reading, give me:
  1. A short summary of what's already in place vs. what's missing for Phase 5.
  2. The first concrete step to take (likely either the dual-profile rig UI or wiring the missing componentKey wrappers — your call based on what you find).
  3. Any open questions before we start.

  Don't write code yet — let's align on the entry point first.

  ---
  Memory context the new chat won't have but should: I just finished a major component-folder reorganisation. app/components/shared/ no longer exists at the top level; providers now live in app/contexts/
  (including AppStateProvider, ConvexClientProvider, and ModellingSessionContext). If any doc references old paths like app/components/shared/SymbolCard.tsx, that path may have moved — verify before trusting.



  To kick off slice 5.1, start a fresh Claude session with a prompt like:

Phase 5 modelling-mode, slice 5.1 — Convex backend layer. Previous slice (foundation) is merged. Read docs/1-inbox/ideas/00-build-plan.md Phase 5.1 section and docs/1-inbox/ideas/04-modelling-mode.md for the spec. Write a plan covering createModellingSession, advanceStep, cancelModellingSession mutations and getActiveModellingSession, getModellingSessionById queries. Wire ModellingSessionContext to subscribe to the active session for the current student profile. Drop the dev-only __setFakeSession helper (it served its purpose). Don't write code yet — present the plan first.

Three setup reminders for the new worktree:

Symlink .env.local the same way as last time:
ln -s /Users/mohanveraitch/projects/mo-speech-home/.env.local /Users/mohanveraitch/Projects/mo-speech-home/.claude/worktrees/upbeat-swanson-31a8c6/.env.local
Rotate convex dev — kill any running instance in your main checkout first, then start it in the new worktree once you begin touching convex/ files. Slice 5.1 will push schema/function changes, so this matters more than last time.
Don't start pnpm dev in the new worktree — your existing one on :3001 keeps running (memory note from last session).


.claude/worktrees/upbeat-swanson-31a8c6
/Users/mohanveraitch/Projects/mo-speech-home/.claude/worktrees/upbeat-swanson-31a8c6