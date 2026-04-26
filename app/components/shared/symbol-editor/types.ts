import type { Id } from '@/convex/_generated/dataModel';

export type ImageSourceTab = 'symbolstix' | 'upload' | 'google-images' | 'ai-generate';
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
  // Labels
  labelEng: string;
  labelHin: string;
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
  // Target category
  profileCategoryId: Id<'profileCategories'> | '';
};

export const INITIAL_DRAFT: Draft = {
  imageSourceTab: 'symbolstix',
  labelEng: '',
  labelHin: '',
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
