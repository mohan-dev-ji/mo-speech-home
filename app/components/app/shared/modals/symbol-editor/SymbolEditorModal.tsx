"use client";

import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useTranslations } from 'next-intl';
import { AlertCircle } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { DEFAULT_VOICE_ID } from '@/lib/r2-paths';
import { resolveSymbolAudioPath } from '@/lib/audio/resolveAudioPath';
import { voiceForLanguage, personaOf } from '@/lib/audio/resolveVoiceId';
import { SymbolPreview } from './SymbolPreview';
import { PropertiesPanel } from './PropertiesPanel';
import { SymbolStixTab } from './SymbolStixTab';
import { UploadTab } from './UploadTab';
import { ImagesTab } from './ImagesTab';
import { AiGenerateTab } from './AiGenerateTab';
import { MyImagesTab, type LibraryImage } from './MyImagesTab';
import { INITIAL_DRAFT, DEFAULT_DISPLAY, type Draft, type ImageSourceTab } from './types';
import { getCategoryColour } from '@/app/lib/categoryColours';
import { deriveAudioMode, initLabelDirty, planFollowLabelAudio, type StoredAudioEntry } from './audioLogic';
import { track } from '@/lib/analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Image provenance + credit reported by every save path (phase-30 §2). An Image
 * Search result carries a licence obligation to display credit, so the editor
 * hands `attribution` / `license` / `imageSourceUrl` back to the caller for
 * persistence instead of dropping them. Always reported as an explicit key —
 * `undefined` means "this image has no credit", which is how switching from an
 * Image Search picture to a SymbolStix one CLEARS the old credit rather than
 * letting it ride along on an unrelated image.
 */
export type ImageCreditResult = {
  imageSourceType?: 'symbolstix' | 'upload' | 'imageSearch' | 'aiGenerated';
  imageSourceUrl?: string;
  attribution?: string;
  license?: string;
};

export type ListItemSaveResult = ImageCreditResult & {
  imagePath?: string;
  description?: string;
  audioPath?: string;
  activeAudioSource?: 'default' | 'generate' | 'record';
  defaultAudioPath?: string;
  generatedAudioPath?: string;
  recordedAudioPath?: string;
};

// `imageOnly` mode — a pure image picker (no label/audio/display, no preview
// play). Used for group/category cover images and list-item images.
export type ImageOnlySaveResult = ImageCreditResult & {
  imagePath?: string;
};

export type SentenceSlotSaveResult = ImageCreditResult & {
  imagePath?: string;
  // What was in the SymbolStix search box at save time. The box seeds FROM the
  // slot's stored label, so an untouched box reports the same word back — which
  // is what makes the slot's word change only when the user types a new search,
  // never merely because they clicked a different symbol.
  searchWord?: string;
  // Canonical words of the currently-picked SymbolStix symbol, keyed by ISO
  // code. Empty for Upload / Image Search / AI Generate, which have no word set.
  symbolWords?: Record<string, string>;
  // NOTE: no displayProps. Sentence slots never rendered it — see the editor's
  // Display/Text/Shape sections, which are categoryBoard-only.
};

export type SymbolEditorModalProps = {
  isOpen: boolean;
  profileSymbolId?: Id<'profileSymbols'>;        // edit mode (categoryBoard)
  profileCategoryId?: Id<'profileCategories'>;    // create mode default category
  // Fixed-slot placement (talker dropbar core board): create the new symbol at
  // this exact slot (= order) instead of prepending at 0. categoryBoard create
  // mode only; ignored on edit.
  createSlot?: number;
  accountId: Id<'users'>;                         // R2 key prefix + ownership context
  language: string;
  voiceId?: string;                               // defaults to DEFAULT_VOICE_ID
  editorMode?: 'categoryBoard' | 'listItem' | 'sentenceSlot' | 'imageOnly';  // defaults to 'categoryBoard'
  initialLabel?: string;                          // pre-populate label / description field
  // The item's label IN THE BOARD LANGUAGE, with NO English fallback applied
  // (listItem only). `initialLabel` is a display string — callers resolve it
  // through `displayString`, so on a Hindi board a unit labelled only in
  // English arrives as the English word. Seeding the Hindi field from that
  // would let an untouched save write English under the `hi` key, which is the
  // bug this pair of props exists to prevent. Absent = "no label in this
  // language yet" = the field renders EMPTY, which is what makes a missing
  // translation visible instead of silently overwritten.
  initialLabelInLanguage?: string;
  // Seed ONLY the SymbolStix search box, without touching the label field.
  // sentenceSlot mode has no label field (its panel is gated out), so it needs
  // a way to pre-fill the search that doesn't drag the label machinery in.
  initialSearchQuery?: string;
  onClose: () => void;
  // The second argument is the category the symbol was filed into. Callers that
  // preset the category already know it; Home's Create-a-Symbol card doesn't —
  // the picker inside this modal is where it gets chosen, so it has to come back
  // out for the post-save redirect.
  onSave: (id: Id<'profileSymbols'>, profileCategoryId: Id<'profileCategories'>) => void;
  onListItemSave?: (result: ListItemSaveResult) => void;
  onSentenceSlotSave?: (result: SentenceSlotSaveResult) => void;
  // imageOnly mode — pure image picker (group covers, list items).
  onImageOnlySave?: (result: ImageOnlySaveResult) => void;
  initialImagePath?: string;
  initialAudioPath?: string;
  // Override the modal header title
  modalTitle?: string;
  // List-item rehydration — restores active-source audio + image-source-tab on re-edit
  initialActiveAudioSource?: 'default' | 'generate' | 'record';
  initialDefaultAudioPath?: string;
  initialGeneratedAudioPath?: string;
  initialRecordedAudioPath?: string;
  initialImageSourceType?: 'symbolstix' | 'upload' | 'imageSearch' | 'aiGenerated';
  // Stored Image Search credit for the item being edited (phase-30 §2). Seeds the
  // credit line AND is what an untouched save hands back, so reopening a slot to
  // change nothing does not quietly strip a CC BY-SA attribution.
  initialImageSourceUrl?: string;
  initialAttribution?: string;
  initialLicense?: string;
  // Which image tab to open on when the caller has NO stored provenance to give.
  // Sentence word units (ADR-015 `compositionWord`) store no `imageSourceType`,
  // so without this they fell through to the 'upload' default and opened on the
  // wrong tab. A stored `initialImageSourceType` still wins over this.
  initialImageTab?: ImageSourceTab;
  // Pre-select a SymbolStix symbol (e.g. opened from a search result) so the
  // editor opens locked onto it — image + ids + label + default audio seeded,
  // category left unpicked. categoryBoard create mode only.
  initialSymbolstixId?: Id<'symbols'>;
  initialSymbolstixImagePath?: string;
  initialLabelHin?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uploadBlobToR2(blob: Blob, key: string): Promise<void> {
  const fd = new FormData();
  fd.append('file', blob);
  fd.append('key', key);
  const res = await fetch('/api/upload-asset', { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Upload failed');
}

/**
 * The ONE tab -> image-source mapping. Every save path used to carry its own
 * copy of this ternary chain, which is how the fifth tab could silently save as
 * an upload: 'my-images' is a CONTAINER, not a source, so a fallback-to-upload
 * chain gets it wrong for every library image that came from Image Search or
 * AI Generate.
 *
 * Returns the CREDIT vocabulary (`ImageCreditResult['imageSourceType']`, which
 * says 'upload'). The persisted `profileSymbols.imageSource.type` says
 * 'userUpload' for the same thing — the two vocabularies are mapped at the
 * point of persistence, not here.
 *
 * The switch below covers exactly five tabs: `symbolstix`, `image-search`,
 * and `upload` (the default case) hand a blob straight to the draft the
 * moment the user picks something, so "which tab is active" already tells
 * you the source; `my-images` returns the row's own `libraryImageSource`,
 * translated into this vocabulary, or `undefined` if nothing has been picked
 * yet; `ai-generate` always returns `undefined` — since phase-36 Task 3 the
 * AI tab never writes to the draft at all; a
 * generation only reaches the draft by being adopted from `my-images` (see
 * `handleImageReferenced`), so sitting on that tab implies nothing about the
 * draft's image and must fall through to "no change", exactly like browsing
 * `my-images` with nothing picked. Returning `'aiGenerated'` here for a tab
 * that hasn't adopted anything would retype an existing upload/search symbol
 * as AI-sourced the moment the user opened that tab and hit Save.
 *
 * Returns `undefined` for two cases: `imageSourceTab === 'ai-generate'`
 * (see above), and `imageSourceTab === 'my-images'` with no
 * `libraryImageSource` — the tab is a click away (`patch({
 * imageSourceTab: value })` on the tab bar), so a user can land here just by
 * BROWSING the library, without picking a row via "Add to symbol". Neither is
 * "this is now an upload" — every caller MUST treat `undefined` as "keep
 * whatever image source was already on this draft" and fall back accordingly
 * (`initialImageSourceType` for the restore-image modes, the existing
 * symbol's own persisted type for categoryBoard), never coerce it to a
 * default.
 *
 * REFERENCE PATH ONLY. This answers "what does the current tab/selection
 * imply", which is only meaningful when nothing is queued to upload. Once a
 * blob is pending, its provenance is fixed at hand-over time (see
 * `pendingImageSourceType`, set in `handleImageSelected`) — the tab can move
 * on (e.g. to 'my-images' to browse) without that blob's source changing.
 * The four blob-upload branches in `handleSave` must use
 * `pendingImageSourceType`, never this function, for the type of an image
 * they are about to upload.
 */
function imageSourceTypeForDraft(d: Draft): ImageCreditResult['imageSourceType'] | undefined {
  switch (d.imageSourceTab) {
    case 'symbolstix':   return 'symbolstix';
    case 'image-search': return 'imageSearch';
    case 'ai-generate':  return undefined; // adoption always goes through 'my-images'
    case 'my-images':
      // The library row's own provenance, captured when the user added it.
      return d.libraryImageSource === 'imageSearch'  ? 'imageSearch'
           : d.libraryImageSource === 'aiGenerated'  ? 'aiGenerated'
           : d.libraryImageSource === 'userUpload'   ? 'upload'
           : undefined; // browsing, nothing picked yet
    default:             return 'upload';
  }
}

/**
 * The categoryBoard save has no `initialImageSourceType` prop to fall back on
 * (that prop only feeds the restore-image modes — listItem, imageOnly,
 * sentenceSlot). Its equivalent "what was already here" is the existing
 * profileSymbol's own persisted `imageSource.type`, in the schema's
 * vocabulary — this maps that back to the credit vocabulary
 * `imageSourceTypeForDraft` returns, so the two can feed the same fallback
 * chain. `undefined` covers `placeholder` (nothing to fall back to) and a
 * brand-new symbol (no existing row at all).
 */
function creditTypeFromSchemaType(
  type: 'symbolstix' | 'userUpload' | 'imageSearch' | 'aiGenerated' | 'placeholder' | undefined
): ImageCreditResult['imageSourceType'] | undefined {
  switch (type) {
    case 'symbolstix':  return 'symbolstix';
    case 'userUpload':  return 'upload';
    case 'imageSearch': return 'imageSearch';
    case 'aiGenerated': return 'aiGenerated';
    default:            return undefined;
  }
}

// Pick an R2 extension from a blob mime type. UploadTab encodes to webp; the
// Wikimedia proxy returns whatever Wikimedia served (typically jpeg/png).
function extForBlob(blob: Blob): string {
  const t = blob.type.toLowerCase();
  if (t.includes('png')) return 'png';
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('gif')) return 'gif';
  return 'webp';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SymbolEditorModal({
  isOpen,
  profileSymbolId,
  profileCategoryId: initCategoryId,
  createSlot,
  accountId,
  language,
  voiceId = DEFAULT_VOICE_ID,
  editorMode = 'categoryBoard',
  initialLabel,
  initialLabelInLanguage,
  initialSearchQuery,
  onClose,
  onSave,
  onListItemSave,
  onSentenceSlotSave,
  onImageOnlySave,
  initialImagePath,
  initialAudioPath,
  modalTitle,
  initialActiveAudioSource,
  initialDefaultAudioPath,
  initialGeneratedAudioPath,
  initialRecordedAudioPath,
  initialImageSourceType,
  initialImageSourceUrl,
  initialAttribution,
  initialLicense,
  initialImageTab,
  initialSymbolstixId,
  initialSymbolstixImagePath,
  initialLabelHin,
}: SymbolEditorModalProps) {
  const t = useTranslations('symbolEditor');
  const isEditMode = !!profileSymbolId;
  // Pure image picker (group/category covers, list-item images): no label/audio/
  // display panel, no preview play — just choose an image.
  const imageOnly = editorMode === 'imageOnly';

  // ── State ──────────────────────────────────────────────────────────────────

  // ── Initial draft ──────────────────────────────────────────────────────────
  // listItem rehydration uses the active-source model: each source is held
  // independently and `activeAudioSource` selects which one playback uses.
  // Image restore for the active-source model — used by listItem AND imageOnly
  // (list-item re-edit reopens on its saved image/source). Group covers are
  // imageOnly with no initial image, so this yields {} and the draft default
  // (symbolstix tab) stands.
  const restoresImage = editorMode === 'listItem' || imageOnly;
  const listItemImageTab: ImageSourceTab | undefined =
    restoresImage && initialImageSourceType
      ? (initialImageSourceType === 'symbolstix'   ? 'symbolstix'   :
         initialImageSourceType === 'imageSearch'  ? 'image-search' :
         initialImageSourceType === 'aiGenerated'  ? 'ai-generate'  : 'upload')
      : undefined;

  const listItemImageSeed =
    restoresImage && initialImagePath
      ? (listItemImageTab === 'symbolstix'
          ? { imageSourceTab: 'symbolstix' as const, symbolstixImagePath: initialImagePath }
          // No stored provenance → fall back to the caller's preferred tab before
          // 'upload'. The image stays as `resolvedImagePath` rather than
          // `symbolstixImagePath`, so we don't assert a provenance we don't have:
          // the preview still shows it (previewImageSrc falls through to
          // resolvedImagePath) and an untouched save still preserves it.
          : { imageSourceTab: (listItemImageTab ?? initialImageTab ?? 'upload') as ImageSourceTab, resolvedImagePath: initialImagePath })
      : {};

  // Back-compat: items saved before the active-source model only carry `audioPath`.
  // Treat that as the default source so re-saving an untouched item doesn't erase it.
  const seededDefaultAudioPath =
    editorMode === 'listItem'
      ? (initialDefaultAudioPath
          ?? (!initialActiveAudioSource && !initialGeneratedAudioPath && !initialRecordedAudioPath
              ? initialAudioPath
              : undefined))
      : undefined;

  const initialActive: Draft['activeAudioSource'] =
    editorMode === 'listItem'
      ? (initialActiveAudioSource ?? (seededDefaultAudioPath ? 'default' : null))
      : null;

  const initialAudioMode = initialActive ?? 'default';

  // Pre-selected SymbolStix symbol (search → editor): seed the image tab + ids,
  // the Hindi label, and the default audio so the editor opens locked onto it.
  const symbolstixSeed =
    !isEditMode && initialSymbolstixId
      ? {
          imageSourceTab: 'symbolstix' as const,
          symbolstixId: initialSymbolstixId,
          symbolstixImagePath: initialSymbolstixImagePath,
          ...(initialLabelHin ? { labelLoc: { hi: initialLabelHin } } : {}),
          ...(initialDefaultAudioPath
            ? {
                defaultAudioPath: initialDefaultAudioPath,
                activeAudioSource: 'default' as const,
                audioMode: 'default' as const,
              }
            : {}),
        }
      : {};

  const [draft, setDraft] = useState<Draft>({
    ...INITIAL_DRAFT,
    audioMode: initialAudioMode,
    activeAudioSource: initialActive,
    profileCategoryId: initCategoryId ?? '',
    ...(initialLabel ? { labelEng: initialLabel } : {}),
    // imageOnly opens on the SymbolStix tab so the admin/instructor
    // can search for an iconic symbol matching the category name (the
    // search bar lazy-inits from `initialLabel` — see searchQuery state).
    // Existing folder image isn't seeded into the upload tab; if the user
    // closes without picking anything, the parent's existing image is
    // preserved untouched.
    //
    // sentenceSlot opens on the SymbolStix tab so editing a slot mirrors
    // editing a list item — the common case is "find a better symbol",
    // not "replace with an upload". The existing image stays seeded as
    // `resolvedImagePath`, which is both shown by the live preview (via
    // the `pendingImagePreviewUrl ?? resolvedImagePath` fallback in
    // `previewImageSrc`) AND used by the save handler when the user
    // doesn't pick a new SymbolStix result.
    ...(editorMode === 'sentenceSlot' && initialImagePath
      ? { resolvedImagePath: initialImagePath, imageSourceTab: 'symbolstix' as const }
      : {}),
    ...listItemImageSeed,
    // listItem on a non-English board: seed the field's own language from the
    // item's stored label for THAT language only (see `initialLabelInLanguage`).
    // `labelEng` above still holds the English master, so saving keeps it.
    ...(editorMode === 'listItem' && language !== 'en' && initialLabelInLanguage
      ? { labelLoc: { [language]: initialLabelInLanguage } }
      : {}),
    // Stored image credit (phase-30 §2) — categoryBoard seeds its own from the
    // profileSymbol in the rehydration effect below; every other mode gets it
    // from the caller's props.
    ...(initialImageSourceUrl ? { imageSourceUrl: initialImageSourceUrl } : {}),
    ...(initialAttribution ? { imageAttribution: initialAttribution } : {}),
    ...(initialLicense ? { imageLicense: initialLicense } : {}),
    ...(editorMode === 'listItem'
      ? {
          defaultAudioPath:   seededDefaultAudioPath,
          generatedAudioPath: initialGeneratedAudioPath,
          recordedAudioPath:  initialRecordedAudioPath,
        }
      : {}),
    ...symbolstixSeed,
  });

  const [pendingImageBlob, setPendingImageBlob] = useState<Blob | null>(null);
  const [pendingImagePreviewUrl, setPendingImagePreviewUrl] = useState<string | null>(null);
  // The credit-vocabulary source that PRODUCED `pendingImageBlob`, captured at
  // hand-over time in `handleImageSelected` — not re-derived from the current
  // tab at save time. The tab bar can move on (`patch({ imageSourceTab })`)
  // without clearing this blob, so by the time Save runs, `draft.imageSourceTab`
  // may no longer be the tab that produced it. `undefined` = no pending blob,
  // or (defensively) a blob handed over from a tab that should never do that.
  const [pendingImageSourceType, setPendingImageSourceType] = useState<ImageCreditResult['imageSourceType']>(undefined);
  // The library row an AI generation just created, for MyImagesTab to arrive
  // on already selected. State, not a ref: it is a prop the tab renders from.
  const [aiHighlightKey, setAiHighlightKey] = useState<string | null>(null);
  // This session's most recent generation. A ref because nothing renders from
  // it — it exists so that adopting a row FROM MY IMAGES can tell "the image I
  // just paid for" from "an image I made last week", and fire
  // `ai_generate_adopted` for only the first. `attempts` is AiGenerateTab's
  // monotonic count of generations spent this session (FEAT-008 §6).
  const lastGenerationRef = useRef<{ imageKey: string; style: string; attempts: number } | null>(null);
  const [pendingAudioBlob, setPendingAudioBlob] = useState<Blob | null>(null);
  const [pendingAudioBlobUrl, setPendingAudioBlobUrl] = useState<string | null>(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  const imagePreviewUrlRef = useRef<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Shared search query — persists as the user jumps between SymbolStix,
  // Image Search and AI Generate tabs. Each tab still runs its own debounce
  // + results pipeline against this single source of truth.
  //
  // Lazy-init from `initialLabel` so opening the editor on a list item that
  // already has a description (e.g. "wash hands") auto-populates the search
  // bar — the SymbolStix results land instantly without the user retyping.
  // For edit mode, a separate effect below seeds the search bar with the
  // existing symbol's saved label once it loads from Convex (initialLabel
  // isn't always supplied by callers in edit flows).
  // The user can then refine the search independently of the label field.
  // Resets when the modal closes so it doesn't bleed into the next open.
  const [searchQuery, setSearchQuery] = useState(() => initialSearchQuery ?? initialLabel ?? '');
  useEffect(() => {
    if (!isOpen) setSearchQuery('');
  }, [isOpen]);

  // ── Convex ─────────────────────────────────────────────────────────────────

  const existingSymbol = useQuery(
    api.profileSymbols.getProfileSymbol,
    profileSymbolId ? { profileSymbolId } : 'skip'
  );

  const categories = useQuery(
    api.profileCategories.getProfileCategories,
    editorMode === 'categoryBoard' ? {} : 'skip'
  );

  // Edit-mode: once `existingSymbol` arrives, mirror its board-language label
  // (falling back to English, then any available label) into the search bar
  // so the SymbolStix / Image Search / AI Generate tabs all start with the
  // symbol's current description as their query. Fires once per open —
  // refreshing the symbol mid-edit doesn't re-seed.
  const editSearchSeededRef = useRef(false);
  useEffect(() => {
    if (!isEditMode) return;
    if (!existingSymbol) return;
    if (editSearchSeededRef.current) return;
    setSearchQuery(existingSymbol.label[language] ?? existingSymbol.label.en ?? Object.values(existingSymbol.label)[0] ?? '');
    editSearchSeededRef.current = true;
  }, [isEditMode, existingSymbol, language]);

  useEffect(() => {
    if (!isOpen) editSearchSeededRef.current = false;
  }, [isOpen]);

  const createProfileSymbol = useMutation(api.profileSymbols.createProfileSymbol);
  const updateProfileSymbol = useMutation(api.profileSymbols.updateProfileSymbol);
  const recordImageCredit = useMutation(api.imageCredits.recordImageCredit);
  const recordAccountImage = useMutation(api.accountImages.record);

  // ── Pre-populate draft in edit mode ────────────────────────────────────────

  useEffect(() => {
    if (!existingSymbol) return;
    const ps = existingSymbol;

    // Map saved per-locale audio (English slot for now — Phase 8.5 widens
    // this) to the active-source model. Per ADR-009 §4 the SymbolStix
    // default path is convention-resolved via `resolveSymbolAudioPath` from
    // the seeded-voice boolean map on the underlying symbol.
    // Load the override for the effective editing language (pin, else board) —
    // NOT a hard-coded English slot. Matches the per-language save below, so
    // re-opening on a hi/es board shows that language's own override.
    const effLang = ps.pinnedLanguage ?? language;
    const effLabel = (effLang === 'en' ? (ps.label.en ?? '') : (ps.label[effLang] ?? ps.label.en ?? ''));
    const symbolWords = (ps.symbolRecord?.words as Record<string, string> | undefined) ?? {};
    const langEntry = (ps.audio as Record<string, StoredAudioEntry> | undefined)?.[effLang];

    const symbolAudioMap =
      (ps.symbolRecord?.audio as Record<string, boolean> | undefined) ?? {};
    const englishWord = ps.symbolRecord?.words.en ?? '';
    const defaultPath =
      resolveSymbolAudioPath(
        voiceId,
        englishWord,
        symbolAudioMap[voiceId] === true,
      ) ?? undefined;

    const derived = deriveAudioMode(langEntry, effLabel);
    const activeSource: Draft['activeAudioSource'] =
      derived.mode === 'record'   ? 'record'   :
      derived.mode === 'generate' ? 'generate' :
      (defaultPath ? 'default' : null);
    const generatedAudioPath = derived.generatedAudioPath;
    const recordedAudioPath = derived.recordedAudioPath;

    // Placeholder type (created by the category-create modal) lands on the
    // SymbolStix tab. The label has already been pre-populated above into
    // searchQuery, so the search auto-runs and the user picks a match in
    // one tap. No image path / wikimedia metadata to rehydrate.
    const isPlaceholder = ps.imageSource.type === 'placeholder';
    setDraft({
      imageSourceTab:
        ps.imageSource.type === 'symbolstix' ? 'symbolstix' :
        ps.imageSource.type === 'userUpload' ? 'upload' :
        ps.imageSource.type === 'imageSearch' ? 'image-search' :
        ps.imageSource.type === 'aiGenerated' ? 'ai-generate' : 'symbolstix',
      symbolstixId: ps.imageSource.type === 'symbolstix' ? ps.imageSource.symbolId : undefined,
      symbolstixImagePath: ps.symbolRecord?.imagePath,
      symbolstixAudioEng: defaultPath,
      // Hindi-voice seeded recordings aren't shipped at Phase 8.0 — once
      // Phase 8.4 adds them, mirror the English-voice resolver call against
      // the active Hindi voiceId.
      symbolstixAudioHin: undefined,
      resolvedImagePath:
        ps.imageSource.type !== 'symbolstix' && !isPlaceholder
          ? (ps.imageSource as { imagePath: string }).imagePath
          : undefined,
      imageSourceUrl:
        ps.imageSource.type === 'imageSearch'
          ? (ps.imageSource as { imageSourceUrl?: string }).imageSourceUrl
          : undefined,
      imageAttribution:
        ps.imageSource.type === 'imageSearch'
          ? (ps.imageSource as { attribution?: string }).attribution
          : undefined,
      imageLicense:
        ps.imageSource.type === 'imageSearch'
          ? (ps.imageSource as { license?: string }).license
          : undefined,
      aiPrompt:
        ps.imageSource.type === 'aiGenerated'
          ? (ps.imageSource as { aiPrompt?: string }).aiPrompt
          : undefined,
      labelEng: ps.label.en ?? '',
      // All non-English localised labels, keyed by ISO code (Phase 15).
      labelLoc: { ...ps.label },
      symbolWords,
      labelDirty: initLabelDirty(ps.label as Record<string, string>, symbolWords, ps.imageSource.type === 'placeholder'),
      generateText: derived.mode === 'generate' ? (derived.generateText ?? '') : undefined,
      audioMode: derived.mode,
      activeAudioSource: activeSource,
      defaultAudioPath: defaultPath,
      generatedAudioPath,
      recordedAudioPath,
      bgColour: ps.display?.bgColour ?? INITIAL_DRAFT.bgColour,
      textColour: ps.display?.textColour ?? INITIAL_DRAFT.textColour,
      borderColour: ps.display?.borderColour ?? INITIAL_DRAFT.borderColour,
      borderWidth: ps.display?.borderWidth ?? INITIAL_DRAFT.borderWidth,
      showLabel: ps.display?.showLabel ?? true,
      showImage: ps.display?.showImage ?? true,
      textSize: ps.display?.textSize ?? 'sm',
      shape: ps.display?.shape ?? 'rounded',
      pinnedLanguage: ps.pinnedLanguage, // Phase 15 (Thread 1)
      profileCategoryId: ps.profileCategoryId,
    });
  }, [existingSymbol]);

  // ── Auto-match bg/border to the category's palette (NEW symbols only) ──────
  //
  // For category-board new symbols we seed bgColour from the category's c100
  // (light tint) and borderColour from c500 (saturated), so a freshly added
  // symbol visually belongs to its parent category by default. If the admin
  // manually overrides either colour after this fires, it sticks — the effect
  // only re-runs when the picked category changes (tracked via a ref).
  //
  // Edit mode is intentionally exempt — the existing-symbol pre-populate
  // effect above already pulls saved colours and we don't want to clobber
  // them on open.
  const matchedCategoryRef = useRef<string | null>(null);

  // Track where the backdrop click originated so a text-selection drag
  // that starts inside the modal and releases on the backdrop doesn't
  // count as a "click outside". Without this, highlighting a word and
  // dragging past the edge of the content fires a click on the backdrop
  // (the common ancestor of the mousedown / mouseup targets) and closes
  // the modal — confusing behaviour vs. the other modals (which use
  // Radix Dialog and get this right out of the box).
  const backdropPointerDownRef = useRef(false);
  useEffect(() => {
    if (isEditMode) return;
    if (editorMode !== 'categoryBoard') return;
    if (!categories) return;
    const cid = draft.profileCategoryId;
    if (!cid) return;
    if (matchedCategoryRef.current === cid) return;

    const cat = categories.find((c) => c._id === cid);
    if (!cat) return;

    const pair = getCategoryColour(cat.colour);
    setDraft((d) => ({ ...d, bgColour: pair.c100, borderColour: pair.c500 }));
    matchedCategoryRef.current = cid;
  }, [isEditMode, editorMode, categories, draft.profileCategoryId]);

  // Reset the ref each time the modal closes, so reopening for a NEW symbol
  // re-applies the match cleanly (state is preserved across open/close cycles
  // in some parents).
  useEffect(() => {
    if (!isOpen) matchedCategoryRef.current = null;
  }, [isOpen]);

  // ── Edit-mode category-colour fallback ─────────────────────────────────────
  //
  // For EDIT mode: if a saved symbol has no display.bgColour / borderColour
  // (legacy data, or symbols seeded before per-symbol colours existed), fall
  // back to the parent category's c100 / c500 instead of the generic
  // white / grey defaults from INITIAL_DRAFT. Symbols that DO have saved
  // colours are left untouched. Fires once per open to avoid clobbering
  // user edits to bg/border made later in the session.
  const editFallbackAppliedRef = useRef(false);
  useEffect(() => {
    if (!isEditMode) return;
    if (editorMode !== 'categoryBoard') return;
    if (!existingSymbol) return;
    if (!categories) return;
    if (editFallbackAppliedRef.current) return;

    const savedBg = existingSymbol.display?.bgColour;
    const savedBorder = existingSymbol.display?.borderColour;

    // Both already saved → nothing to do.
    if (savedBg !== undefined && savedBorder !== undefined) {
      editFallbackAppliedRef.current = true;
      return;
    }

    const cat = categories.find((c) => c._id === existingSymbol.profileCategoryId);
    if (!cat) {
      editFallbackAppliedRef.current = true;
      return;
    }

    const pair = getCategoryColour(cat.colour);
    setDraft((d) => ({
      ...d,
      ...(savedBg === undefined ? { bgColour: pair.c100 } : {}),
      ...(savedBorder === undefined ? { borderColour: pair.c500 } : {}),
    }));
    editFallbackAppliedRef.current = true;
  }, [isEditMode, editorMode, existingSymbol, categories]);

  // Reset the edit-mode fallback ref on close (paired with the matched-ref
  // reset above) so reopening on a different symbol re-applies the fallback
  // logic.
  useEffect(() => {
    if (!isOpen) editFallbackAppliedRef.current = false;
  }, [isOpen]);

  // Revoke image preview URL on unmount only
  useEffect(() => {
    return () => {
      if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current);
      previewAudioRef.current?.pause();
    };
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function patch(partial: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...partial }));
  }

  function handleImageSelected(blob: Blob, previewUrl: string) {
    if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current);
    imagePreviewUrlRef.current = previewUrl;
    setPendingImageBlob(blob);
    setPendingImagePreviewUrl(previewUrl);
    // Capture provenance NOW, from whichever tab is handing over the blob —
    // never re-derived later from `draft.imageSourceTab`, which can have moved
    // on to 'my-images' (or anywhere else) by the time Save runs. Exactly TWO
    // tabs still hand over bytes: Upload and Image Search. SymbolStix never
    // did; My Images adds by reference (`handleImageReferenced`); and since
    // phase-36 AI Generate writes straight to the library server-side and is
    // adopted from My Images like any other row — so a generation can no
    // longer arrive here as a blob either. Anything else is logged rather than
    // silently mis-attributed.
    setPendingImageSourceType(
      draft.imageSourceTab === 'upload'       ? 'upload' :
      draft.imageSourceTab === 'image-search' ? 'imageSearch' :
      (() => {
        if (process.env.NODE_ENV !== 'production') {
          console.error(
            `[SymbolEditorModal] handleImageSelected fired from tab '${draft.imageSourceTab}', which must never hand over a blob`
          );
        }
        return undefined;
      })()
    );
  }

  /**
   * My Images: attach an image the account ALREADY owns, by reference. The
   * draft points at the library row's own R2 key — nothing is fetched, nothing
   * is re-uploaded, and no second object is minted for the same picture. Every
   * save path below already keeps `draft.resolvedImagePath` when there is no
   * pending blob, so this is all it takes.
   *
   * Clears any pending blob first (the user may have picked an upload before
   * switching tabs) and revokes its preview url, exactly as
   * `handleImageSelected` does — the modal owns those urls.
   */
  function handleImageReferenced(row: LibraryImage) {
    if (imagePreviewUrlRef.current) URL.revokeObjectURL(imagePreviewUrlRef.current);
    imagePreviewUrlRef.current = null;
    setPendingImageBlob(null);
    setPendingImagePreviewUrl(null);
    setPendingImageSourceType(undefined);
    // ADOPTION IS THE EVENT, and this is now where it happens — the AI tab
    // hands over nothing, so the image the user paid for is adopted from the
    // library like any other row. Fires only for THIS session's generation:
    // re-using a picture made last week is not a new adoption, and counting it
    // as one would inflate the attempts-per-kept-image number the 20/day +
    // 100/month allowance gets retuned against (FEAT-008 §6). Never the prompt
    // — it is user content and, in an AAC app, frequently about a specific
    // child. Style is a fixed enum and safe.
    const justGenerated = lastGenerationRef.current;
    const isJustGenerated = justGenerated?.imageKey === row.imageKey;
    if (justGenerated && isJustGenerated) {
      track('ai_generate_adopted', {
        style: justGenerated.style,
        attempts: justGenerated.attempts,
      });
      // One adoption per generation: without this, re-adding the same
      // generated tile (e.g. after a "used by N other items" cancel, or a
      // second visit to My Images) would fire `ai_generate_adopted` again
      // for a picture already counted as kept.
      lastGenerationRef.current = null;
    }
    const fromSearch = row.source === 'imageSearch';
    // Adopting a FRESH generation still overwrites the description label with
    // the prompt — the prompt IS the word the user just generated for, and
    // they typed it seconds ago. Deliberately NOT applied to older library
    // rows: adopting a picture from the gallery must not silently retype a
    // symbol with a sentence someone wrote weeks ago (see the my-images
    // "no longer retypes the symbol" fix). Decoupled afterwards either way —
    // editing the label doesn't echo back.
    const freshPrompt = isJustGenerated ? row.prompt?.trim() : undefined;
    patch({
      imageSourceTab: 'my-images',
      resolvedImagePath: row.imageKey,
      libraryImageSource: row.source,
      // Provenance travels WITH the image: re-using an Image Search picture
      // must not drop the attribution its licence obliges us to display, and
      // re-using an AI image keeps the prompt that produced it.
      aiPrompt: row.source === 'aiGenerated' ? row.prompt : undefined,
      imageSourceUrl:   fromSearch ? row.imageSourceUrl : undefined,
      imageAttribution: fromSearch ? row.attribution    : undefined,
      imageLicense:     fromSearch ? row.license        : undefined,
      imageTitle:       fromSearch ? row.imageTitle     : undefined,
      // Draft-only, and not stored on the library row — nothing to restore.
      imageProvider: undefined,
      ...(freshPrompt ? { labelEng: freshPrompt } : {}),
    });
  }

  /**
   * A generation succeeded. Nothing is adopted yet and the draft is NOT
   * touched: the image exists in the account's library and the user chooses it
   * there, by reference, exactly as they would any other library row. All this
   * does is take them to it and remember which row it is.
   */
  function handleAiGenerated(result: { imageKey: string; style: string; attempts: number }) {
    lastGenerationRef.current = result;
    setAiHighlightKey(result.imageKey);
    patch({ imageSourceTab: 'my-images' });
  }

  function handleAudioBlobChange(blob: Blob | null, blobUrl: string | null) {
    setPendingAudioBlob(blob);
    setPendingAudioBlobUrl(blobUrl);
  }

  // ── Preview play overlay ───────────────────────────────────────────────────

  // Resolve the R2 key the Default (follow-label) audio should play/persist for
  // the effective language. Returns the symbol's own clip when the label matches
  // the symbol word; otherwise resolves the label through /api/tts (symbols
  // folder -> tts cache -> generate). No `literal` flag (keep symbols-folder reuse).
  async function resolveDefaultKey(): Promise<string | undefined> {
    const lang = draft.pinnedLanguage ?? language;
    const labelText = (lang === 'en' ? draft.labelEng : (draft.labelLoc[lang] || draft.labelEng)).trim();
    if (!labelText) return undefined;
    const symbolWord = (draft.symbolWords[lang] ?? '').trim();
    if (labelText === symbolWord) return draft.defaultAudioPath; // symbol's own clip
    const res = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: labelText, voiceId: voiceForLanguage(lang, personaOf(voiceId)) }),
    });
    if (!res.ok) throw new Error('tts');
    const { r2Key } = (await res.json()) as { r2Key: string };
    return r2Key;
  }

  function handlePreviewPlay() {
    // categoryBoard: the selected TAB (`audioMode`) is the source of truth,
    // matching what Save persists (see the category-board branch of
    // handleSave below). listItem keeps the legacy active-source model
    // untouched — that flow is intentionally out of scope for this fix.
    const activeMode = editorMode === 'categoryBoard' ? draft.audioMode : draft.activeAudioSource;

    if (activeMode === 'default') {
      resolveDefaultKey()
        .then((key) => {
          if (!key) return;
          previewAudioRef.current?.pause();
          const a = new Audio(`/api/assets?key=${key}`);
          previewAudioRef.current = a;
          setIsPreviewPlaying(true);
          a.addEventListener('ended', () => setIsPreviewPlaying(false));
          a.addEventListener('error', () => setIsPreviewPlaying(false));
          a.play().catch(() => setIsPreviewPlaying(false));
        })
        .catch(() => setIsPreviewPlaying(false));
      return;
    }

    let audioUrl: string | null = null;

    if (activeMode === 'generate' && draft.generatedAudioPath) {
      audioUrl = `/api/assets?key=${draft.generatedAudioPath}`;
    } else if (activeMode === 'record') {
      if (pendingAudioBlobUrl) audioUrl = pendingAudioBlobUrl;
      else if (draft.recordedAudioPath) audioUrl = `/api/assets?key=${draft.recordedAudioPath}`;
    }

    if (!audioUrl) return;

    previewAudioRef.current?.pause();
    const audio = new Audio(audioUrl);
    previewAudioRef.current = audio;

    const done = () => setIsPreviewPlaying(false);
    audio.addEventListener('ended', done);
    audio.addEventListener('error', done);

    setIsPreviewPlaying(true);
    audio.play().catch(done);
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  /**
   * The credit to persist for an image whose resolved source is `type`
   * (phase-30 §2). Credit only ever belongs to an Image Search picture, so any
   * other source reports every field as `undefined` — that is what CLEARS a
   * stale attribution when the user swaps an Image Search photo for a SymbolStix
   * symbol, an upload or an AI generation. (The image tabs do not reliably clear
   * the draft themselves — UploadTab and SymbolStixTab leave the fields alone —
   * so the gate has to live here, at the point of persistence.)
   */
  function creditFor(type: ImageCreditResult['imageSourceType']): ImageCreditResult {
    if (type !== 'imageSearch') {
      return {
        imageSourceType: type,
        imageSourceUrl: undefined,
        attribution: undefined,
        license: undefined,
      };
    }
    return {
      imageSourceType: type,
      imageSourceUrl: draft.imageSourceUrl,
      attribution: draft.imageAttribution,
      license: draft.imageLicense,
    };
  }

  /**
   * Record this image's credit in the per-account registry, keyed by its R2
   * object key (phase-31). Called from EVERY save path that pushes a new image
   * to R2, so no surface has to remember to plumb credit fields through.
   *
   * Only `imageSearch` and `aiGenerated` are recordable — SymbolStix is licensed
   * wholesale and not credited per image, and an upload has no external
   * provenance to preserve. Both fall out of this function silently and by
   * design (see convex/schema.ts → `imageCredits`).
   *
   * Deliberately fire-and-forget and deliberately swallowing. Recording a credit
   * is strictly secondary to saving the image: a missing registry row is
   * recoverable by the backfill, a failed image save is not. Nothing in here may
   * reject into `handleSave`'s try/catch, and nothing may make the user wait.
   */
  function recordImageCreditSafely(
    imageKey: string,
    type: ImageCreditResult['imageSourceType']
  ) {
    if (type !== 'imageSearch' && type !== 'aiGenerated') return;
    // An AI generation has no photographer, licence or source URL to carry —
    // the row exists for model provenance, not attribution.
    const provenance =
      type === 'imageSearch'
        ? {
            ...(draft.imageTitle ? { imageTitle: draft.imageTitle } : {}),
            ...(draft.imageSourceUrl ? { imageSourceUrl: draft.imageSourceUrl } : {}),
            ...(draft.imageAttribution ? { attribution: draft.imageAttribution } : {}),
            ...(draft.imageLicense ? { license: draft.imageLicense } : {}),
          }
        : {};
    const firstUsedFor = draft.labelEng.trim();
    try {
      void recordImageCredit({
        imageKey,
        imageSourceType: type,
        ...provenance,
        ...(firstUsedFor ? { firstUsedFor } : {}),
      }).catch((err) => {
        console.warn('[imageCredits] credit not recorded for', imageKey, err);
      });
    } catch (err) {
      console.warn('[imageCredits] credit not recorded for', imageKey, err);
    }
  }

  /**
   * Index this image in the account's own library (`accountImages`) so it shows
   * up in the My Images tab. Called from EVERY save path that pushes a new
   * image to R2 — before phase-36 only the AI-generate route wrote these rows,
   * so uploads and Image Search picks never reached the library.
   *
   * SymbolStix is not an account image (it is shared, licensed wholesale and
   * lives under a different prefix) and falls out silently.
   *
   * Deliberately fire-and-forget and deliberately swallowing, exactly like
   * `recordImageCreditSafely`: the upload is the primary act, the index row is
   * secondary and recoverable by `scripts/backfill-account-images.mjs`. Nothing
   * in here may reject into `handleSave`'s try/catch, and nothing may make the
   * user wait.
   */
  function recordAccountImageSafely(
    imageKey: string,
    type: ImageCreditResult['imageSourceType']
  ) {
    // Only the two tabs that still upload bytes reach here. An AI generation
    // is indexed by the route that produced it (phase-36) — this modal never
    // sees those bytes, so there is no 'aiGenerated' case left to write.
    if (type !== 'imageSearch' && type !== 'upload') return;
    // Credit vocabulary says 'upload'; the library table says 'userUpload'.
    const source = type === 'upload' ? 'userUpload' as const : type;
    try {
      void recordAccountImage({
        imageKey,
        source,
      }).catch((err) => {
        console.warn('[accountImages] image not indexed for', imageKey, err);
      });
    } catch (err) {
      console.warn('[accountImages] image not indexed for', imageKey, err);
    }
  }

  async function handleSave() {
    setSaveError(null);

    // ── Image-only mode (group/category cover image, list-item image) ─────
    if (imageOnly) {
      const hasImage =
        draft.imageSourceTab === 'symbolstix'
          ? !!draft.symbolstixImagePath
          : !!(pendingImageBlob || draft.resolvedImagePath);
      if (!hasImage) { setSaveError(t('errorNoImage')); return; }
      setIsSaving(true);
      try {
        let imagePath = draft.resolvedImagePath;
        // My Images attaches an image BY REFERENCE — no blob, so the branch
        // below never runs and the type has to come from the library row's own
        // provenance rather than the caller's stored value.
        let imageSourceType: ImageCreditResult['imageSourceType'] =
          draft.imageSourceTab === 'my-images'
            // `undefined` = browsing the tab with nothing picked — keep the
            // caller's previously-stored source rather than coercing to upload.
            ? (imageSourceTypeForDraft(draft) ?? initialImageSourceType)
            : initialImageSourceType;
        // Upload pending bytes for every non-SymbolStix tab — upload,
        // image-search proxy, and AI generate all land a blob here that
        // needs to go to R2 before we can persist a path.
        if (pendingImageBlob && draft.imageSourceTab !== 'symbolstix') {
          const key = `accounts/${accountId}/images/${crypto.randomUUID()}.${extForBlob(pendingImageBlob)}`;
          await uploadBlobToR2(pendingImageBlob, key);
          imagePath = key;
          // The tab that produced this blob, captured at hand-over time — NOT
          // the current tab, which may have moved on to 'my-images' since.
          imageSourceType = pendingImageSourceType ?? imageSourceType;
          recordImageCreditSafely(key, imageSourceType);
          recordAccountImageSafely(key, imageSourceType);
        }
        if (draft.imageSourceTab === 'symbolstix' && draft.symbolstixImagePath) {
          imagePath = draft.symbolstixImagePath;
          imageSourceType = 'symbolstix';
        }
        onImageOnlySave?.({ imagePath, ...creditFor(imageSourceType) });
        onClose();
      } catch {
        setSaveError(t('errorSave'));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // ── Sentence slot mode ────────────────────────────────────────────────
    if (editorMode === 'sentenceSlot') {
      setIsSaving(true);
      try {
        let imagePath: string | undefined = draft.resolvedImagePath;
        // Sentence slots (and phrase words, which share this mode) now record
        // where the image came from — phase-30 §2. Untouched saves fall back to
        // the caller's stored value so reopening a slot preserves its credit.
        // My Images attaches by reference — no blob, so the type comes from
        // the library row's own provenance, not the caller's stored value.
        let imageSourceType: ImageCreditResult['imageSourceType'] =
          draft.imageSourceTab === 'my-images'
            // `undefined` = browsing the tab with nothing picked — keep the
            // caller's previously-stored source rather than coercing to upload.
            ? (imageSourceTypeForDraft(draft) ?? initialImageSourceType)
            : initialImageSourceType;
        if (draft.imageSourceTab === 'symbolstix' && draft.symbolstixImagePath) {
          imagePath = draft.symbolstixImagePath;
          imageSourceType = 'symbolstix';
        } else if (pendingImageBlob) {
          const key = `accounts/${accountId}/images/${crypto.randomUUID()}.${extForBlob(pendingImageBlob)}`;
          await uploadBlobToR2(pendingImageBlob, key);
          imagePath = key;
          // The tab that produced this blob, captured at hand-over time — NOT
          // the current tab, which may have moved on to 'my-images' since.
          imageSourceType = pendingImageSourceType ?? imageSourceType;
          recordImageCreditSafely(key, imageSourceType);
          recordAccountImageSafely(key, imageSourceType);
        }
        onSentenceSlotSave?.({
          imagePath,
          searchWord: searchQuery.trim() || undefined,
          symbolWords: draft.symbolWords,
          ...creditFor(imageSourceType),
        });
        onClose();
      } catch {
        setSaveError(t('errorSave'));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // ── List item mode ────────────────────────────────────────────────────
    if (editorMode === 'listItem') {
      setIsSaving(true);
      // The text the user actually sees and edits in the Description field.
      const descriptionText = (
        language === 'en' ? draft.labelEng : (draft.labelLoc[language] ?? '')
      ).trim();
      try {
        // Resolve image and remember which tab it came from
        let imagePath: string | undefined = draft.resolvedImagePath;
        // My Images attaches by reference — no blob, so the type comes from
        // the library row's own provenance, not the caller's stored value.
        let imageSourceType: ImageCreditResult['imageSourceType'] =
          draft.imageSourceTab === 'my-images'
            // `undefined` = browsing the tab with nothing picked — keep the
            // caller's previously-stored source rather than coercing to upload.
            ? (imageSourceTypeForDraft(draft) ?? initialImageSourceType)
            : initialImageSourceType;
        if (draft.imageSourceTab === 'symbolstix' && draft.symbolstixImagePath) {
          imagePath = draft.symbolstixImagePath;
          imageSourceType = 'symbolstix';
        } else if (pendingImageBlob) {
          const key = `accounts/${accountId}/images/${crypto.randomUUID()}.${extForBlob(pendingImageBlob)}`;
          await uploadBlobToR2(pendingImageBlob, key);
          imagePath = key;
          // The tab that produced this blob, captured at hand-over time — NOT
          // the current tab, which may have moved on to 'my-images' since.
          imageSourceType = pendingImageSourceType ?? imageSourceType;
          recordImageCreditSafely(key, imageSourceType);
          recordAccountImageSafely(key, imageSourceType);
        }

        // Upload pending recording before save (only if record is the active source —
        // an in-flight blob the user didn't switch to is discarded on save).
        let recordedAudioPath = draft.recordedAudioPath;
        if (pendingAudioBlob && draft.activeAudioSource === 'record') {
          const ext = pendingAudioBlob.type.includes('ogg') ? 'ogg' : 'webm';
          const key = `accounts/${accountId}/audio/${crypto.randomUUID()}.${ext}`;
          await uploadBlobToR2(pendingAudioBlob, key);
          recordedAudioPath = key;
        }

        // Resolve the active audio path for runtime playback.
        const audioPath =
          draft.activeAudioSource === 'default'  ? draft.defaultAudioPath :
          draft.activeAudioSource === 'generate' ? draft.generatedAudioPath :
          draft.activeAudioSource === 'record'   ? recordedAudioPath :
          undefined;

        onListItemSave?.({
          imagePath,
          // MUST read the same language the Description field edits
          // (`labelFieldLang` in PropertiesPanel = the board language for
          // listItem). Reading `labelEng` here is what stored the English word
          // under a `hi` key: the consumer keys the returned text by
          // `[language]`, so the two halves of the round trip disagreed.
          description: descriptionText || undefined,
          audioPath,
          activeAudioSource: draft.activeAudioSource ?? undefined,
          defaultAudioPath: draft.defaultAudioPath,
          generatedAudioPath: draft.generatedAudioPath,
          recordedAudioPath,
          ...creditFor(imageSourceType),
        });
        onClose();
      } catch {
        setSaveError(t('errorSave'));
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // ── Category board mode ───────────────────────────────────────────────
    if (!draft.labelEng.trim()) { setSaveError(t('errorNoLabel')); return; }
    if (!draft.profileCategoryId) { setSaveError(t('errorNoCategory')); return; }

    const hasImage =
      draft.imageSourceTab === 'symbolstix'
        ? !!draft.symbolstixId
        : !!(pendingImageBlob || draft.resolvedImagePath);
    if (!hasImage) { setSaveError(t('errorNoImage')); return; }

    setIsSaving(true);
    try {
      // 1. Upload pending image (upload tab, Image Search proxy, or AI Generate)
      let resolvedImagePath = draft.resolvedImagePath;
      // Set only when a blob is uploaded in THIS save, to the tab that produced
      // it (captured at hand-over time) — never re-derived from the current
      // tab, which may have moved on to 'my-images' since. `resolvedSourceType`
      // below must defer to this whenever it is set, so the recorded credit/
      // library type and the persisted `imageSource.type` cannot diverge.
      let uploadedType: ImageCreditResult['imageSourceType'] | undefined;
      if (pendingImageBlob && draft.imageSourceTab !== 'symbolstix') {
        const key = `accounts/${accountId}/images/${crypto.randomUUID()}.${extForBlob(pendingImageBlob)}`;
        await uploadBlobToR2(pendingImageBlob, key);
        resolvedImagePath = key;
        uploadedType = pendingImageSourceType;
        recordImageCreditSafely(key, uploadedType);
        recordAccountImageSafely(key, uploadedType);
      }

      // 2. Upload pending audio recording (only if the record tab is selected)
      let recordedAudioPath = draft.recordedAudioPath;
      if (pendingAudioBlob && draft.audioMode === 'record') {
        const ext = pendingAudioBlob.type.includes('ogg') ? 'ogg' : 'webm';
        const key = `accounts/${accountId}/audio/${crypto.randomUUID()}.${ext}`;
        await uploadBlobToR2(pendingAudioBlob, key);
        recordedAudioPath = key;
      }

      // 3. Build imageSource
      type IS =
        | { type: 'symbolstix'; symbolId: Id<'symbols'> }
        | { type: 'userUpload'; imagePath: string }
        | { type: 'imageSearch'; imagePath: string; imageSourceUrl?: string; attribution?: string; license?: string }
        | { type: 'aiGenerated'; imagePath: string; aiPrompt?: string };

      // Branch on the RESOLVED source, not the raw tab: 'my-images' is a
      // container, so its images persist as whatever the library row says they
      // are (`imageSourceTypeForDraft`). 'upload' here is the credit
      // vocabulary's name for what the schema calls 'userUpload'.
      //
      // `uploadedType` wins whenever this save actually uploaded a blob — that
      // blob's provenance was fixed at hand-over time and must not be re-derived
      // from the current tab (which may since have moved to 'my-images'). Only
      // when no blob was uploaded does this fall through to
      // `imageSourceTypeForDraft` (the current selection/reference), which
      // itself returns undefined when the user opened My Images to browse but
      // picked nothing — categoryBoard has no `initialImageSourceType` prop to
      // fall back on (that only feeds the restore-image modes), so its "what
      // was already here" is the existing profileSymbol's own persisted source
      // instead.
      const resolvedSourceType =
        uploadedType ?? imageSourceTypeForDraft(draft) ?? creditTypeFromSchemaType(existingSymbol?.imageSource.type);
      const imageSource: IS =
        resolvedSourceType === 'symbolstix'
          ? { type: 'symbolstix', symbolId: draft.symbolstixId! }
          : resolvedSourceType === 'imageSearch'
          ? {
              type: 'imageSearch',
              imagePath: resolvedImagePath!,
              imageSourceUrl: draft.imageSourceUrl,
              attribution: draft.imageAttribution,
              license: draft.imageLicense,
            }
          : resolvedSourceType === 'aiGenerated'
          ? { type: 'aiGenerated', imagePath: resolvedImagePath!, ...(draft.aiPrompt ? { aiPrompt: draft.aiPrompt } : {}) }
          : { type: 'userUpload', imagePath: resolvedImagePath! };

      // 4. Resolve THIS language's audio override per the selected mode
      // (record / generate / default — the "audio follows label" model).
      type AR = {
        type: 'r2' | 'tts' | 'recorded';
        path: string;
        ttsText?: string;
        language?: string;
        alternates?: { default?: string; generated?: string; recorded?: string };
      };
      const audioLang = draft.pinnedLanguage ?? language;
      const prevAudio = (existingSymbol?.audio as Record<string, AR> | undefined) ?? {};
      const nextAudio: Record<string, AR> = { ...prevAudio };

      // Resolve THIS language's audio per the selected tab. Other languages'
      // overrides are preserved untouched (per-language forks). A TTS failure
      // throws and is caught below, blocking the save.
      if (draft.audioMode === 'record' && recordedAudioPath) {
        nextAudio[audioLang] = { type: 'recorded', path: recordedAudioPath, language: audioLang };
      } else if (draft.audioMode === 'generate' && draft.generateText?.trim()) {
        const genVoiceId = voiceForLanguage(audioLang, personaOf(voiceId));
        const res = await fetch('/api/tts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: draft.generateText.trim(), voiceId: genVoiceId }),
        });
        if (!res.ok) throw new Error('tts');
        const { r2Key } = (await res.json()) as { r2Key: string };
        const plan = planFollowLabelAudio({ language: audioLang, resolvedPath: r2Key, symbolDefaultPath: draft.defaultAudioPath, spokenText: draft.generateText.trim() });
        if (plan.action === 'store') nextAudio[audioLang] = plan.entry; else delete nextAudio[audioLang];
      } else {
        // Default -> follow the label.
        const key = await resolveDefaultKey(); // throws on TTS failure
        const labelText = (audioLang === 'en' ? draft.labelEng : (draft.labelLoc[audioLang] || draft.labelEng)).trim();
        if (!key || !labelText) {
          delete nextAudio[audioLang];
        } else {
          const plan = planFollowLabelAudio({ language: audioLang, resolvedPath: key, symbolDefaultPath: draft.defaultAudioPath, spokenText: labelText });
          if (plan.action === 'store') nextAudio[audioLang] = plan.entry; else delete nextAudio[audioLang];
        }
      }
      const audio: Record<string, AR> | undefined =
        Object.keys(nextAudio).length ? nextAudio : undefined;

      // Strip bgColour / borderColour from the saved display when they
      // match the parent category's palette — this lets the symbol fall
      // back to the live category colour at render time so future
      // category-colour changes propagate automatically. Only explicit
      // user customisations (values that differ from the category's c100
      // / c500) are persisted.
      const targetCatId = draft.profileCategoryId as Id<'profileCategories'>;
      const targetCat = categories?.find((c) => c._id === targetCatId);
      const targetPair = targetCat ? getCategoryColour(targetCat.colour) : null;
      const bgMatchesCategory =
        targetPair !== null &&
        draft.bgColour.toLowerCase() === targetPair.c100.toLowerCase();
      const borderMatchesCategory =
        targetPair !== null &&
        draft.borderColour.toLowerCase() === targetPair.c500.toLowerCase();

      // Build display as a diff against system defaults — only persist
      // fields the user actually overrode. Keeps profileSymbols and pack
      // snapshots in the same clean shape as the original starter-pack
      // entries (which carry no display object when on defaults). If no
      // field deviates, pass undefined so the mutation clears the field
      // entirely.
      const displayDiff = {
        ...(bgMatchesCategory ? {} : { bgColour: draft.bgColour }),
        ...(draft.textColour !== DEFAULT_DISPLAY.textColour ? { textColour: draft.textColour } : {}),
        ...(borderMatchesCategory ? {} : { borderColour: draft.borderColour }),
        ...(draft.borderWidth !== DEFAULT_DISPLAY.borderWidth ? { borderWidth: draft.borderWidth } : {}),
        ...(draft.showLabel !== DEFAULT_DISPLAY.showLabel ? { showLabel: draft.showLabel } : {}),
        ...(draft.showImage !== DEFAULT_DISPLAY.showImage ? { showImage: draft.showImage } : {}),
        ...(draft.textSize !== DEFAULT_DISPLAY.textSize ? { textSize: draft.textSize } : {}),
        ...(draft.shape !== DEFAULT_DISPLAY.shape ? { shape: draft.shape } : {}),
      };
      const display = Object.keys(displayDiff).length > 0 ? displayDiff : undefined;

      // Build the label record. Spread existing locales first so any
      // translation the editor doesn't manage (es, pa, etc.) passes
      // through unchanged — without the spread, an admin editing a
      // pack-loaded symbol via image-search would silently wipe its
      // Spanish translation on save. en is always overridden from the
      // draft; hi is overridden if non-empty, dropped if cleared (matches
      // the original editor behaviour for the two inputs it owns).
      const label: Record<string, string> = {
        ...(existingSymbol?.label ?? {}),
        en: draft.labelEng.trim(),
      };
      // Merge the localised labels edited via the dynamic field; trim + drop
      // empties. English is authoritative from `labelEng` above (never overridden).
      for (const [k, v] of Object.entries(draft.labelLoc)) {
        if (k === 'en') continue;
        const trimmed = (v ?? '').trim();
        if (trimmed) label[k] = trimmed;
        else delete label[k];
      }

      const catId = draft.profileCategoryId as Id<'profileCategories'>;

      let savedId: Id<'profileSymbols'>;
      if (isEditMode) {
        savedId = (await updateProfileSymbol({
          profileSymbolId: profileSymbolId!,
          profileCategoryId: catId,
          imageSource,
          label,
          audio,
          display,
          // Phase 15 (Thread 1): undefined = Auto (clears the pin).
          pinnedLanguage: draft.pinnedLanguage,
        })) as Id<'profileSymbols'>;
      } else {
        savedId = await createProfileSymbol({
          profileCategoryId: catId,
          imageSource,
          label,
          audio,
          display,
          ...(draft.pinnedLanguage ? { pinnedLanguage: draft.pinnedLanguage } : {}),
          ...(createSlot !== undefined ? { slot: createSlot } : {}),
        });
      }

      onSave(savedId, catId);
      setSaveSuccess(true);
      setTimeout(() => { setSaveSuccess(false); onClose(); }, 700);
    } catch {
      setSaveError(t('errorSave'));
    } finally {
      setIsSaving(false);
    }
  }

  // ── Early return ───────────────────────────────────────────────────────────

  if (!isOpen) return null;

  // ── Tab config ─────────────────────────────────────────────────────────────

  const imageTabConfig: { value: ImageSourceTab; label: string }[] = [
    { value: 'symbolstix', label: t('tabSymbolstix') },
    { value: 'upload', label: t('tabUpload') },
    { value: 'image-search', label: t('tabImageSearch') },
    { value: 'ai-generate', label: t('tabAiGenerate') },
    { value: 'my-images', label: t('tabMyImages') },
  ];

  // ── Derived ────────────────────────────────────────────────────────────────

  const previewImageSrc =
    draft.imageSourceTab === 'symbolstix' && draft.symbolstixImagePath
      ? `/api/assets?key=${draft.symbolstixImagePath}`
      : pendingImagePreviewUrl
      ?? (draft.resolvedImagePath ? `/api/assets?key=${draft.resolvedImagePath}` : undefined);

  // Preview reflects the effective language (pin if set, else board), English fallback.
  const previewLang = draft.pinnedLanguage ?? language;
  const previewLabel =
    previewLang === 'en' ? draft.labelEng : (draft.labelLoc[previewLang] || draft.labelEng);

  const defaultTitle =
    imageOnly                     ? t('titleImageOnly') :
    editorMode === 'sentenceSlot' ? t('titleSentenceSlot') :
    editorMode === 'listItem'     ? t('titleListItem') :
    isEditMode ? t('titleEdit') : t('titleCreate');

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end md:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onMouseDown={(e) => {
        backdropPointerDownRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropPointerDownRef.current) {
          onClose();
        }
        backdropPointerDownRef.current = false;
      }}
    >
      <div
        className="relative flex flex-col md:flex-row w-full md:max-w-5xl h-[92dvh] md:h-[85vh] rounded-t-2xl md:rounded-2xl overflow-hidden"
        style={{ background: 'var(--theme-alt-card)' }}
      >

        {/* ── LEFT PANEL ──────────────────────────────────────────────────── */}
        <div
          className="flex flex-col md:w-[340px] shrink-0 border-b md:border-b-0 md:border-r h-[46%] md:h-full"
          style={{ borderColor: 'var(--theme-button-highlight)' }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: 'var(--theme-symbol-bg)', borderBottom: '1px solid var(--theme-button-highlight)' }}
          >
            <h2 className="text-theme-s font-bold" style={{ color: 'var(--theme-text)' }}>
              {modalTitle ?? defaultTitle}
            </h2>
          </div>

          {/* Live preview card — imageOnly has no label + no play (straight picker) */}
          {/* The preview takes the leftover height in the modes that render no
              properties panel (imageOnly, and sentenceSlot since its sections
              became categoryBoard-only) — otherwise the column's only flex-1
              child is gone and the action buttons float up under the preview. */}
          <div className={`px-6 pt-3 pb-2 ${imageOnly || editorMode === 'sentenceSlot' ? 'flex-1 flex items-center justify-center' : 'shrink-0'}`}>
            <div className="w-1/2 mx-auto">
              <SymbolPreview
                imageSrc={previewImageSrc}
                label={imageOnly ? '' : previewLabel}
                draft={draft}
                onPlay={imageOnly ? undefined : handlePreviewPlay}
                isPlaying={isPreviewPlaying}
              />
            </div>
          </div>

          {/* Image credit (phase-30 §2). An Image Search picture carries a
              licence obligation to display its attribution, so the credit is
              shown for the image currently attached — in EVERY editor mode, so
              a list item, sentence slot and phrase word surface it exactly like
              a category symbol. Renders only when there is credit to show:
              SymbolStix, uploads and AI generations have none, and each of
              those tabs clears the draft fields when it takes over the image. */}
          {(draft.imageAttribution || draft.imageLicense) && (
            <div className="shrink-0 px-6 pb-2 text-center">
              <p className="text-theme-xs" style={{ color: 'var(--theme-secondary-text)' }}>
                {t('imageCredit', {
                  credit: [draft.imageLicense, draft.imageAttribution]
                    .filter(Boolean)
                    .join(' · '),
                })}
              </p>
              {draft.imageSourceUrl && (
                <a
                  href={draft.imageSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-theme-xs underline"
                  style={{ color: 'var(--theme-brand-primary)' }}
                >
                  {t('imageCreditSource')}
                </a>
              )}
            </div>
          )}

          {/* Properties — hidden in image-only mode, and in sentenceSlot mode,
              where every section is now categoryBoard-only (Display/Text/Shape
              wrote displayProps, which no sentence renderer reads). Without this
              guard the panel would render as an empty bordered container. */}
          {!imageOnly && editorMode !== 'sentenceSlot' && (
            <PropertiesPanel
              draft={draft}
              patch={patch}
              language={language}
              categories={categories}
              pendingAudioBlobUrl={pendingAudioBlobUrl}
              onAudioBlobChange={handleAudioBlobChange}
              editorMode={editorMode}
              voiceId={voiceId}
              resolveDefaultKey={resolveDefaultKey}
            />
          )}

          {/* Action buttons */}
          <div
            className="shrink-0 px-4 py-4 flex flex-col gap-2"
            style={{ borderTop: '1px solid var(--theme-button-highlight)' }}
          >
            {saveError && (
              <div className="flex items-center gap-1.5 text-theme-xs" style={{ color: 'var(--theme-warning)' }}>
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 rounded-theme-sm text-theme-s font-semibold"
                style={{
                  background: 'var(--theme-symbol-bg)',
                  color: 'var(--theme-secondary-text)',
                  border: '1px solid var(--theme-button-highlight)',
                }}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 py-2.5 rounded-theme-sm text-theme-s font-semibold"
                style={{
                  background: 'var(--theme-brand-primary)',
                  color: 'var(--theme-alt-text)',
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                {isSaving ? t('saving') : saveSuccess ? t('saveSuccess') : t('save')}
              </button>
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL: image source tabs ──────────────────────────────── */}
        <div className="flex flex-col flex-1 min-h-0 h-[54%] md:h-full">

          {/* Tab bar */}
          <div
            className="flex shrink-0 border-b overflow-x-auto"
            style={{ borderColor: 'var(--theme-button-highlight)' }}
          >
            {imageTabConfig.map(({ value, label }) => {
              const isActive = draft.imageSourceTab === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => patch({ imageSourceTab: value })}
                  className="px-4 py-3 text-theme-s font-medium shrink-0 relative whitespace-nowrap"
                  style={{ color: isActive ? 'var(--theme-brand-primary)' : 'var(--theme-secondary-text)' }}
                >
                  {label}
                  {isActive && (
                    <span
                      className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t"
                      style={{ background: 'var(--theme-brand-primary)' }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {draft.imageSourceTab === 'symbolstix' && (
              <SymbolStixTab
                language={language}
                voiceId={voiceId}
                draft={draft}
                patch={patch}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            )}
            {draft.imageSourceTab === 'upload' && (
              <UploadTab
                draft={draft}
                patch={patch}
                pendingImagePreviewUrl={pendingImagePreviewUrl}
                onImageSelected={handleImageSelected}
              />
            )}
            {draft.imageSourceTab === 'image-search' && (
              <ImagesTab
                draft={draft}
                patch={patch}
                onImageSelected={handleImageSelected}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            )}
            {/* Kept mounted for the modal's lifetime (never conditionally
                rendered), hidden via display instead. The generation itself is
                now safe either way — it is written to the library before the
                route answers — but the STYLE and PROMPT the user composed live
                in this tab's own state, and a generation ends by sending them
                to My Images to look at the result. Unmounting on that switch
                would empty the form they would come straight back to. */}
            <div className={draft.imageSourceTab === 'ai-generate' ? 'h-full' : 'hidden'}>
              <AiGenerateTab
                onGenerated={handleAiGenerated}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
              />
            </div>
            {/* Kept mounted for the same reason AiGenerateTab is: the grid
                holds its own pagination cursor and tile selection, and
                unmounting it on a tab click would throw the user back to page
                one every time they glanced at another source. */}
            <div className={draft.imageSourceTab === 'my-images' ? 'h-full' : 'hidden'}>
              <MyImagesTab
                onImageReferenced={handleImageReferenced}
                highlightKey={aiHighlightKey}
                draftImageKey={draft.resolvedImagePath}
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
