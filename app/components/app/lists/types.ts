export type DisplayFormat = 'rows' | 'columns' | 'grid';

export type ListItem = {
  localId: string;
  imagePath?: string;
  order: number;
  // UI-resolved description string. The Convex field is a localised record
  // (`Record<string, string>`) per ADR-009 §2; the section component
  // unwraps via `displayString()` when hydrating `localItems` and rewraps
  // under the current locale key on persist.
  description?: string;
  audioPath?: string;
  activeAudioSource?: 'default' | 'generate' | 'record';
  defaultAudioPath?: string;
  generatedAudioPath?: string;
  recordedAudioPath?: string;
  imageSourceType?: 'symbolstix' | 'upload' | 'imageSearch' | 'aiGenerated';
};
