import type { Id } from '@/convex/_generated/dataModel';

export type ImageSourceTab = 'symbolstix' | 'upload' | 'google-images' | 'ai-generate';
export type AudioMode = 'default' | 'record' | 'choose-word' | 'generate';
export type TextSize = 'sm' | 'md' | 'lg';
export type CardShape = 'square' | 'rounded' | 'circle';

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
  // Audio
  audioMode: AudioMode;
  resolvedAudioPath?: string;
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
