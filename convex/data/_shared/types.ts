/**
 * Content-module JSON shapes (ADR-014 §1).
 *
 * A **module** is the atomic installable unit: one curated, named, single-type
 * *folder*. Installing it materialises **one** default folder into the matching
 * tree (module ↔ default folder is 1:1, ADR-014 §3). Each module file lives at
 * `convex/data/<tree>/<slug>.json`; the per-tree `_index.ts` barrel exposes a
 * typed map, and `convex/lib/contentModules.ts` holds the readers.
 *
 * The per-item shapes (a category grid, a list, a sentence) are identical to the
 * bundled-pack item shapes — re-used from `library_packs/types.ts` during the
 * cutover so there is a single source of truth. When ADR-010's `library_packs`
 * directory is finally dropped (its deferred-cleanup phase), move those item
 * types here and delete the re-export.
 *
 * **Localisation:** all user-visible strings are ISO-keyed open records
 * (`LocalisedString`) per ADR-009 §2; display reads via
 * `lib/languages/displayValue.ts`.
 */

import type {
  LocalisedString,
  PackTier,
  LibraryPackCategory,
  LibraryPackList,
  LibraryPackSentence,
} from "../library_packs/types";

export type { LocalisedString, PackTier };
export type {
  LibraryPackCategory,
  LibraryPackList,
  LibraryPackSentence,
} from "../library_packs/types";

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
