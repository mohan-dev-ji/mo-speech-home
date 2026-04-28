export type DisplayFormat = 'rows' | 'columns' | 'grid';

export type ListItem = {
  localId: string;
  imagePath?: string;
  order: number;
  description?: string;
  audioPath?: string;
  activeAudioSource?: 'default' | 'generate' | 'record';
  defaultAudioPath?: string;
  generatedAudioPath?: string;
  recordedAudioPath?: string;
  imageSourceType?: 'symbolstix' | 'upload' | 'imageSearch' | 'aiGenerated';
};
