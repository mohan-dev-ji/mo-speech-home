/**
 * Content-module JSON shapes (ADR-014 §1).
 *
 * A **module** is the atomic installable unit: one curated, named, single-type
 * *folder*. Installing it materialises **one** default folder into the matching
 * tree (module ↔ default folder is 1:1, ADR-014 §3). Each module file lives at
 * `convex/data/<tree>/<slug>.json`; the per-tree `_index.ts` barrel exposes a
 * typed map, and `convex/lib/contentModules.ts` holds the readers.
 *
 * The per-item shapes (a category grid, a list, a sentence) are the canonical
 * single-type folder item shapes. They originally lived in
 * `library_packs/types.ts` (ADR-010) and were re-exported here during the
 * cutover; with the legacy `library_packs` directory now removed (Phase 14.5
 * Stage 2 teardown) the definitions live here directly. The `LibraryPack*`
 * names are retained to avoid churning every content-module consumer.
 *
 * **Localisation:** all user-visible strings are ISO-keyed open records
 * (`LocalisedString`) per ADR-009 §2; display reads via
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
 * A symbol inside a single-type category folder. Two shapes coexist:
 *
 *  1. SymbolStix-backed — has `symbolId` resolving to the global symbols
 *     table; image + default audio are re-resolved on load.
 *  2. Custom — image stored in R2 (uploaded, image-searched, or AI-generated).
 *     Optional recorded voice override. Attribution kept for image-search.
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
   * cache and is not persisted into the module JSON — receivers regenerate
   * from the label or use the SymbolStix default. */
  recordedAudioPath?: string;
};

export type LibraryPackCategory = {
  name: LocalisedString;
  icon: string;
  colour: string;
  /** R2 path for folder cover. */
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
  /**
   * Localised — see schema profileLists.items[].description.
   * The union still admits the legacy plain string during the Phase 8.0
   * migration window; tighten to `LocalisedString` only after the item
   * JSON migration ships.
   */
  description?: LocalisedString | string;
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
  /**
   * Localised — see schema profileSentences.text.
   * Migration window union — same caveat as LibraryPackListItem.description.
   */
  text?: LocalisedString | string;
  slots: LibraryPackSentenceSlot[];
  audioPath?: string;
};

/** Which tree a module installs into. The shared folder primitive's axis. */
export type ModuleTree = "categories" | "lists" | "sentences" | "phrases";

/**
 * Crediting + filtering + updates metadata (ADR-014 §6). Metadata only —
 * NEVER a browse/organisation axis.
 */
export type ModuleProvenance = {
  author?: string;
  version?: string;
  licence?: string;
};

type ContentModuleBase = {
  /** URL-safe identifier; matches the filename without `.json`. */
  slug: string;
  /** Folder name shown in the tree + library card. */
  name: LocalisedString;
  description?: LocalisedString;
  /** Folder presentation (default folder inherits these). */
  icon?: string;
  colour?: string;
  /** R2 cover key, under `<tree>/<slug>/covers/…`. */
  coverImagePath?: string;
  /** Default tier; the per-type lifecycle `tierOverride` can override at runtime. */
  defaultTier: PackTier;
  /** ADR-015 §6 — "core" marks a category module as a core-word module:
   * surfaced in the talker dropdown's Core-words tab (not the main Categories
   * page/library), locked to zinc-500 with no colour swatch. Categories only. */
  surface?: "core";
  /** `isStarter` is retained for the legacy starter folder so it can be flagged. */
  isStarter?: boolean;
  /** Default ("core") module — auto-installed for new accounts + free to access
   * (ADR-014 Task C/D). Present in the git-export artifact so a re-seed restores
   * the flag. The live source of truth is `libraryModules.isDefault`. */
  isDefault?: boolean;
  provenance?: ModuleProvenance;
};

/** A Categories-tree module: one folder of symbol grids. */
export type CategoryModule = ContentModuleBase & {
  tree: "categories";
  items: LibraryPackCategory[];
};

/** A Lists-tree module: one folder of lists. */
export type ListModule = ContentModuleBase & {
  tree: "lists";
  items: LibraryPackList[];
};

/** A Sentences-tree module: one folder of sentences. */
export type SentenceModule = ContentModuleBase & {
  tree: "sentences";
  items: LibraryPackSentence[];
};

/** Display overrides on a phrase word (mirrors a sentence slot's displayProps). */
export type PhraseWordDisplayProps = {
  bgColour?: string;
  textColour?: string;
  textSize?: "sm" | "md" | "lg" | "xl";
  showLabel?: boolean;
  showImage?: boolean;
  cardShape?: "square" | "rounded" | "circle";
};

/** A single word inside a phrase module (ADR-015). One level deep. */
export type LibraryPackPhraseWord = {
  order: number;
  symbolId?: string;
  imagePath?: string;
  label?: LocalisedString;
  displayProps?: PhraseWordDisplayProps;
  imageSourceType?: "symbolstix" | "upload" | "imageSearch" | "aiGenerated";
};

/** A reusable phrase: a named, audio-bearing chunk of words (ADR-015). */
export type LibraryPackPhrase = {
  name: LocalisedString;
  order: number;
  audioPath?: string;
  recordedAudioPath?: string;
  words: LibraryPackPhraseWord[];
};

/** A Phrases-tree module: one bank (folder) of reusable phrases (ADR-015). */
export type PhraseModule = ContentModuleBase & {
  tree: "phrases";
  items: LibraryPackPhrase[];
};

export type ContentModule =
  | CategoryModule
  | ListModule
  | SentenceModule
  | PhraseModule;

/** Maps a tree to its module type — handy for generic helpers. */
export type ModuleForTree<T extends ModuleTree> = T extends "categories"
  ? CategoryModule
  : T extends "lists"
    ? ListModule
    : T extends "sentences"
      ? SentenceModule
      : PhraseModule;
