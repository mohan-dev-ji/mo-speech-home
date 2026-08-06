import type { Id } from '@/convex/_generated/dataModel';

export type ImageSourceTab = 'symbolstix' | 'upload' | 'image-search' | 'ai-generate';
export type AudioMode = 'default' | 'record' | 'generate';
export type TextSize = 'sm' | 'md' | 'lg' | 'xl';
export type CardShape = 'square' | 'rounded' | 'circle';

export type ActiveAudioSource = 'default' | 'generate' | 'record';

export type Draft = {
  imageSourceTab: ImageSourceTab;
  // SymbolStix
  symbolstixId?: Id<'symbols'>;
  symbolstixImagePath?: string;
  symbolstixAudioEng?: string;
  symbolstixAudioHin?: string;
  // Custom image (upload / google / ai) — resolved R2 path
  resolvedImagePath?: string;
  // External-image attribution — populated when Image Search picks a result.
  // Provider-agnostic: works for Wikimedia, Pixabay, Unsplash, Pexels. The
  // first three persist (mapped onto profileSymbols.imageSource fields);
  // imageProvider is draft-only and is implicit from the licence string +
  // source URL once persisted.
  imageSourceUrl?: string;
  imageAttribution?: string;
  imageLicense?: string;
  imageProvider?: string;
  // Labels. `labelEng` is the English master (also drives SymbolStix/AI/image
  // search + validation). `labelLoc` holds every NON-English localised label
  // (hi, es, pa, …), keyed by ISO code — edited via the dynamic per-language
  // field. Phase 15: replaces the old single `labelHin` field.
  labelEng: string;
  labelLoc: Record<string, string>;
  // Canonical words of the currently-picked SymbolStix symbol, keyed by ISO
  // code. Empty for non-symbolstix sources (no canonical word). Used to decide
  // label-on-pick overwrite, the reset affordance, and whether audio needs a
  // per-language override.
  symbolWords: Record<string, string>;
  // Per-language "the user hand-typed this label" flag. A dirty language is not
  // overwritten when the user picks a different symbol.
  labelDirty: Record<string, boolean>;
  // Generate tab's own spoken text, decoupled from the label (the deferred
  // Proloquo-style pronunciation field, scoped to Generate). Seeded from the
  // label when the tab is first opened; then independently editable.
  generateText?: string;
  // Audio — `audioMode` is purely tab navigation; `activeAudioSource` is what plays.
  audioMode: AudioMode;
  activeAudioSource: ActiveAudioSource | null;
  defaultAudioPath?: string;          // SymbolStix default for the picked symbol
  generatedAudioPath?: string;        // R2 key from Generate (was: ttsR2Key)
  recordedAudioPath?: string;         // R2 key from Record (rehydrated or post-upload)
  // Display
  bgColour: string;
  textColour: string;
  borderColour: string;
  borderWidth: number;
  showLabel: boolean;
  showImage: boolean;
  textSize: TextSize;
  shape: CardShape;
  // Phase 15 (Thread 1): per-symbol language pin. undefined = Auto (follow board).
  pinnedLanguage?: string;
  // Target category
  profileCategoryId: Id<'profileCategories'> | '';
};

export const INITIAL_DRAFT: Draft = {
  imageSourceTab: 'symbolstix',
  labelEng: '',
  labelLoc: {},
  symbolWords: {},
  labelDirty: {},
  audioMode: 'default',
  activeAudioSource: null,
  bgColour: '#ffffff',
  textColour: '#111827',
  borderColour: '#d1d5db',
  borderWidth: 2,
  showLabel: true,
  showImage: true,
  textSize: 'sm',
  shape: 'rounded',
  profileCategoryId: '',
};

/**
 * System-default display values. The save handler compares draft fields
 * against these and OMITS any matching field from the persisted `display`
 * object — so the saved profileSymbol (and any pack snapshot built from
 * it) carries only true overrides. Matches the convention of the original
 * starter-pack symbols, which have no `display` field at all.
 *
 * Does NOT include bgColour / borderColour — those use category-relative
 * defaults (`getCategoryColour`) and are stripped by their own logic in
 * the save handler.
 */
export const DEFAULT_DISPLAY = {
  textColour: INITIAL_DRAFT.textColour,
  borderWidth: INITIAL_DRAFT.borderWidth,
  showLabel: INITIAL_DRAFT.showLabel,
  showImage: INITIAL_DRAFT.showImage,
  textSize: INITIAL_DRAFT.textSize,
  shape: INITIAL_DRAFT.shape,
} as const;
