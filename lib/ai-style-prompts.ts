/**
 * AI image style presets for the Symbol Editor "AI Generate" tab.
 *
 * Each preset wraps the user's prompt with style-specific guidance so
 * instructors don't need to write good prompts. Single source of truth —
 * referenced by the server route and by the tab's style cards.
 */

export type StyleId = 'photorealistic' | 'iconic' | 'storybook' | 'claymation';

export const STYLE_PRESETS: Record<
  StyleId,
  { label: string; template: (prompt: string) => string }
> = {
  photorealistic: {
    label: 'Photorealistic',
    template: (p) =>
      `studio product shot of ${p}, isolated on a pure white background, single subject only, no ground, no shadow, no scenery, no environment, no text, no watermark`,
  },
  iconic: {
    label: 'Iconic Vector',
    template: (p) =>
      `a simple flat vector icon of ${p}, bold black outlines, single subject only, isolated on a pure white background, die-cut sticker style, no ground, no scenery, no text`,
  },
  storybook: {
    label: 'Storybook',
    template: (p) =>
      `a friendly children's storybook illustration of ${p}, single subject only, isolated on a pure white background, soft pastel colours, no ground, no scenery, no environment, no text`,
  },
  claymation: {
    label: '3D Claymation',
    template: (p) =>
      `a soft 3D claymation render of ${p}, single subject only, isolated on a pure white background, cute, no ground, no shadow, no scenery, no text`,
  },
};

export const STYLE_IDS = Object.keys(STYLE_PRESETS) as StyleId[];

export function isStyleId(value: unknown): value is StyleId {
  return typeof value === 'string' && value in STYLE_PRESETS;
}
