/**
 * Library pack JSON shape.
 *
 * Each pack in the catalogue is a single JSON file in this directory, slug-keyed
 * (`<slug>.json`). The bundled `_index.ts` barrel imports them all and exposes
 * a typed `LIBRARY_PACKS` map. See `convex/lib/libraryPacks.ts` for the readers.
 *
 * The shape mirrors today's `resourcePacks` snapshot fields exactly (per
 * ADR-010), so the materialisation path stays familiar. Source-pointer Convex
 * Id fields (`sourceProfileCategoryId` etc.) are intentionally omitted — JSON
 * has no Ids; the snapshot stands on its own.
 *
 * Custom R2 paths inside a pack live under `library_packs/<slug>/…` in the
 * shared bucket. SymbolStix paths remain global and are referenced by
 * `symbolId` only (resolved at materialisation time).
 */

export type PackTier = "free" | "pro" | "max";

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

export type LibraryPackCategorySymbol = {
  /** Loose ref — may be a symbolstix ID or a custom token. */
  symbolId: string;
  labelOverride?: { eng?: string; hin?: string };
  display?: SymbolDisplay;
  order: number;
};

export type LibraryPackCategory = {
  name: { eng: string; hin?: string };
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
  description?: string;
  audioPath?: string;
  activeAudioSource?: LibraryPackListItemAudioSource;
  defaultAudioPath?: string;
  generatedAudioPath?: string;
  recordedAudioPath?: string;
  imageSourceType?: "symbolstix" | "upload" | "imageSearch" | "aiGenerated";
};

export type LibraryPackList = {
  name: { eng: string; hin?: string };
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
  name: { eng: string; hin?: string };
  order: number;
  text?: string;
  slots: LibraryPackSentenceSlot[];
  audioPath?: string;
};

export type LibraryPack = {
  /** URL-safe identifier; matches the filename without `.json`. */
  slug: string;
  name: { eng: string; hin?: string };
  description: { eng: string; hin?: string };
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
