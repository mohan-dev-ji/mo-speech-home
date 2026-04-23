export type DisplayFormat = 'rows' | 'columns' | 'grid';

export type ListItem = {
  localId: string;
  imagePath?: string;
  order: number;
  description?: string;
  audioPath?: string;
};
