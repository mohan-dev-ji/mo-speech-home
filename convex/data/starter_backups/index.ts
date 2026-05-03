/**
 * Starter pack backups.
 *
 * Each backup is a JSON file in this directory. Backups are added by running
 * `pnpm tsx scripts/backup-starter.ts "<label>"` which writes a new file with
 * a timestamp + label name AND patches this index to expose it to the restore
 * mutation (`migrations.restoreStarterPackFromBackup`).
 *
 * To restore an old backup: from the Convex dashboard, run
 * `migrations.restoreStarterPackFromBackup({ backupName: "<key>", adminClerkUserId: "..." })`.
 *
 * Files are committed to git so backups are version-controlled. The shape of
 * each backup is defined by the `StarterBackup` type below.
 *
 * `materialiseStarterPack` (the factory-reset path that rebuilds from
 * `DEFAULT_CATEGORIES`) is distinct from this backup mechanism — backups capture
 * post-edit state, factory reset rebuilds from the source-of-truth recipe.
 */

export type StarterBackupSymbol = {
  symbolId: string;
  labelOverride?: { eng?: string; hin?: string };
  display?: unknown;
  order: number;
};

export type StarterBackupCategory = {
  sourceProfileCategoryId?: string;
  name: { eng: string; hin?: string };
  icon: string;
  colour: string;
  imagePath?: string;
  symbols: StarterBackupSymbol[];
};

export type StarterBackupListItem = {
  order: number;
  symbolId?: string;
  imagePath?: string;
  description?: string;
  audioPath?: string;
  activeAudioSource?: "default" | "generate" | "record";
  defaultAudioPath?: string;
  generatedAudioPath?: string;
  recordedAudioPath?: string;
  imageSourceType?: "symbolstix" | "upload" | "imageSearch" | "aiGenerated";
};

export type StarterBackupList = {
  sourceProfileListId?: string;
  name: { eng: string; hin?: string };
  order: number;
  items: StarterBackupListItem[];
  displayFormat?: "rows" | "columns" | "grid";
  showNumbers?: boolean;
  showChecklist?: boolean;
  showFirstThen?: boolean;
};

export type StarterBackupSentenceSlot = {
  order: number;
  symbolId?: string;
  imagePath?: string;
  displayProps?: unknown;
};

export type StarterBackupSentence = {
  sourceProfileSentenceId?: string;
  name: { eng: string; hin?: string };
  order: number;
  text?: string;
  slots: StarterBackupSentenceSlot[];
  audioPath?: string;
};

export type StarterBackup = {
  version: 1;
  createdAt: string; // ISO 8601
  label: string;
  categories: StarterBackupCategory[];
  lists: StarterBackupList[];
  sentences: StarterBackupSentence[];
};

// ─── Registry ────────────────────────────────────────────────────────────────
//
// Each backup file added to this directory must be imported and registered
// here. The `scripts/backup-starter.ts` script patches this map automatically
// when it writes a new backup.
//
// AUTOGEN-START: imports
// (no backups yet — first will be added by scripts/backup-starter.ts)
// AUTOGEN-END: imports

export const STARTER_BACKUPS: Record<string, StarterBackup> = {
  // AUTOGEN-START: entries
  // (no backups yet)
  // AUTOGEN-END: entries
};

export type StarterBackupName = keyof typeof STARTER_BACKUPS;
