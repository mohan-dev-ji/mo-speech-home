/**
 * Library pack JSON shape.
 *
 * Each pack in the catalogue is a single JSON file in this directory, slug-keyed
 * (`<slug>.json`). The bundled `_index.ts` barrel imports them all and exposes
 * a typed `LIBRARY_PACKS` map. See `convex/lib/libraryPacks.ts` for the readers.
 *
 * The shape mirrors the runtime `resourcePacks` snapshot fields exactly (per
 * ADR-010), so the materialisation path stays familiar. Source-pointer Convex
 * Id fields (`sourceProfileCategoryId` etc.) are intentionally omitted — JSON
 * has no Ids; the snapshot stands on its own.
 *
 * Custom R2 paths inside a pack live under `library_packs/<slug>/…` in the
 * shared bucket. SymbolStix paths remain global and are referenced by
 * `symbolId` only (resolved at materialisation time).
 *
 * **Localisation:** all user-visible string fields are ISO-keyed open records
 * (`LocalisedString`) per ADR-009 §2. Display reads through
 * `lib/languages/displayValue.ts`.
 */

export type PackTier = "free" | "pro" | "max";

/**
 * ISO-keyed open record for localised strings. e.g. { en: "Hello", hi: "नमस्ते" }.
 * Adding a language is adding a key, not a type change.
 */
export type LocalisedString = Record<string, string>;

export type SymbolDisplay = {
  bgColour?: string;
  textColour?: string;
  textSize?: "sm" | "md" | "lg" | "xl";
  borderColour?: string;
  borderWidth?: number;
  showLabel?: boolean;
  showImage?: boolean;
  shape?: "square" | "rounded" | "circle";
};

/**
 * A symbol inside a published category. Two shapes coexist:
 *
 *  1. SymbolStix-backed — has `symbolId` resolving to the global symbols
 *     table; image + default audio are re-resolved on load.
 *  2. Custom — image stored under `library_packs/<slug>/images/…` (uploaded,
 *     image-searched, or AI-generated). Optional recorded voice override under
 *     `library_packs/<slug>/audio/…`. Attribution kept for image-search.
 *
 * The discriminator is `imageSourceType`. Absent or `"symbolstix"` → kind 1.
 * Anything else → kind 2. Existing JSONs predate the field; absence means
 * SymbolStix, preserving back-compat.
 */
export type LibraryPackCategorySymbol = {
  order: number;
  display?: SymbolDisplay;

  /** SymbolStix kind. */
  symbolId?: string;
  labelOverride?: LocalisedString;

  /** Custom-image kind. */
  imageSourceType?: "symbolstix" | "upload" | "imageSearch" | "aiGenerated";
  imagePath?: string;
  label?: LocalisedString;
  /** Image-search attribution. */
  imageSourceUrl?: string;
  attribution?: string;
  license?: string;
  /** AI generation prompt — kept for regen. */
  aiPrompt?: string;
  /** Custom voice recording (only). TTS audio is durable in the global TTS
   * cache and is not persisted into the pack JSON — receivers regenerate
   * from the label or use the SymbolStix default. */
  recordedAudioPath?: string;
};

export type LibraryPackCategory = {
  name: LocalisedString;
  icon: string;
  colour: string;
  /** R2 path for folder cover, under `library_packs/<slug>/covers/…`. */
  imagePath?: string;
  symbols: LibraryPackCategorySymbol[];
};

export type LibraryPackListItemAudioSource = "default" | "generate" | "record";

export type LibraryPackListItem = {
  order: number;
  /** Loose ref to a symbolstix id; present for symbolstix-sourced items so
   * re-materialise can pick up updated images. */
  symbolId?: string;
  imagePath?: string;
  /** Localised — see schema profileLists.items[].description. */
  description?: LocalisedString;
  audioPath?: string;
  activeAudioSource?: LibraryPackListItemAudioSource;
  defaultAudioPath?: string;
  generatedAudioPath?: string;
  recordedAudioPath?: string;
  imageSourceType?: "symbolstix" | "upload" | "imageSearch" | "aiGenerated";
};

export type LibraryPackList = {
  name: LocalisedString;
  order: number;
  items: LibraryPackListItem[];
  displayFormat?: "rows" | "columns" | "grid";
  showNumbers?: boolean;
  showChecklist?: boolean;
  showFirstThen?: boolean;
};

export type LibraryPackSentenceSlotDisplay = {
  bgColour?: string;
  textColour?: string;
  textSize?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  showImage?: boolean;
  cardShape?: "square" | "rounded" | "circle";
};

export type LibraryPackSentenceSlot = {
  order: number;
  symbolId?: string;
  imagePath?: string;
  displayProps?: LibraryPackSentenceSlotDisplay;
};

export type LibraryPackSentence = {
  name: LocalisedString;
  order: number;
  /** Localised — see schema profileSentences.text. */
  text?: LocalisedString;
  slots: LibraryPackSentenceSlot[];
  audioPath?: string;
};

export type LibraryPack = {
  /** URL-safe identifier; matches the filename without `.json`. */
  slug: string;
  name: LocalisedString;
  description: LocalisedString;
  /** R2 cover key. Under `library_packs/<slug>/covers/…` for new packs;
   * legacy paths preserved as-is during migration. */
  coverImagePath: string;
  /** Default tier; the prod `packLifecycle.tierOverride` can override at runtime. */
  defaultTier: PackTier;
  /** Exactly one pack in the catalogue should have isStarter: true. */
  isStarter?: boolean;
  /** Pack content. `categories` is optional so a pack can be lists/sentences-only. */
  categories?: LibraryPackCategory[];
  lists: LibraryPackList[];
  sentences: LibraryPackSentence[];
};
