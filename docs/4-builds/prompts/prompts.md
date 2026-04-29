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