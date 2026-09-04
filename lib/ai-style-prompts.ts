/**
 * AI image style presets for the Symbol Editor "AI Generate" tab.
 *
 * Each preset wraps the user's prompt with style-specific guidance so
 * instructors don't need to write good prompts. Single source of truth —
 * referenced by the server route and by the tab's style cards.
 */

/**
 * The image generator. Lives here, beside the templates, because the two are
 * verified together: the four style templates below are known-good against
 * THIS model and no other (MOS-40). Changing the model means re-verifying
 * every template and regenerating the style thumbnails.
 *
 * Google retired the Imagen publisher models from Vertex (confirmed 2026-08).
 * Image generation lives in the Gemini image family.
 *
 * Note the request/response shape in `app/api/ai-generate/imagen/route.ts` is
 * Gemini's `:generateContent` contract and moves too if a future model changes it.
 *
 * It used to live in `lib/cache-identity.ts` because it was also the AI
 * cache's identity. ADR-023 deleted that cache; only the model remains.
 */
export const AI_IMAGE_MODEL = "gemini-2.5-flash-image";

export type StyleId = 'photorealistic' | 'iconic' | 'storybook' | 'claymation';

/**
 * `thumbnail` is a sample of what the style ACTUALLY produces, committed at
 * `public/ai-styles/`. It lives beside the template deliberately: the two are
 * a matched pair, and a thumbnail generated from a different template is worse
 * than no thumbnail because it misrepresents what the user will get.
 *
 * REGENERATE THE SET WHENEVER A TEMPLATE OR THE MODEL CHANGES —
 * `scripts/generate-style-thumbnails.mjs`, whose default subject is the
 * committed set's subject so a routine regeneration cannot silently swap it.
 */
export const STYLE_PRESETS: Record<
  StyleId,
  { label: string; thumbnail: string; template: (prompt: string) => string }
> = {
  photorealistic: {
    label: 'Photorealistic',
    thumbnail: '/ai-styles/photorealistic.webp',
    // `no watermark` REMOVED 2026-08-30 (MOS-40) — DO NOT PUT IT BACK.
    //
    // That one token made every Photorealistic generation fail. Gemini
    // returned HTTP 200 with `promptFeedback.blockReason: "SAFETY"` and no
    // candidate at all — blocked BEFORE generation, so the subject was
    // irrelevant; `a cello` was refused as reliably as anything else.
    //
    // Proven by a controlled A/B against Vertex, same subject, same process,
    // seconds apart, one token different:
    //
    //     studio product shot of a cello, …, no text, no watermark  -> REFUSED
    //     studio product shot of a cello, …, no text                -> IMAGE
    //
    // Image models refuse watermark-adjacent wording as an anti-circumvention
    // guard regardless of intent: asking for "no watermark" reads like an
    // attempt to strip one. This was the ONLY template of the four containing
    // it, and the only style that ever failed.
    //
    // It worked until the provider changed. All six cached Photorealistic
    // images date from 2026-05-17 under Imagen; there is not one success on
    // `gemini-2.5-flash-image`, whose prompt filter is stricter. So the other
    // three templates are known-good against THIS model, not against models
    // in general — re-verify them if the model changes again.
    template: (p) =>
      `studio product shot of ${p}, isolated on a pure white background, single subject only, no ground, no shadow, no scenery, no environment, no text`,
  },
  iconic: {
    label: 'Iconic Vector',
    thumbnail: '/ai-styles/iconic.webp',
    template: (p) =>
      `a simple flat vector icon of ${p}, bold black outlines, single subject only, isolated on a pure white background, die-cut sticker style, no ground, no scenery, no text`,
  },
  storybook: {
    label: 'Storybook',
    thumbnail: '/ai-styles/storybook.webp',
    template: (p) =>
      `a friendly children's storybook illustration of ${p}, single subject only, isolated on a pure white background, soft pastel colours, no ground, no scenery, no environment, no text`,
  },
  claymation: {
    label: '3D Claymation',
    thumbnail: '/ai-styles/claymation.webp',
    template: (p) =>
      `a soft 3D claymation render of ${p}, single subject only, isolated on a pure white background, cute, no ground, no shadow, no scenery, no text`,
  },
};

export const STYLE_IDS = Object.keys(STYLE_PRESETS) as StyleId[];

export function isStyleId(value: unknown): value is StyleId {
  return typeof value === 'string' && value in STYLE_PRESETS;
}
