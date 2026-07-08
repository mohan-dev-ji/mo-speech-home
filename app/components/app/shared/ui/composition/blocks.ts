// Shared composition-block model for the block play modal (ADR-015).
//
// A resolved-for-render/play composition block. `imageUrl` is ready for <img src>;
// `audioKey` is a RAW R2 key for playKey(). The helpers below normalise the two
// storage conventions: talker word imagePaths are full /api/assets URLs, while
// unit + phrase-word imagePaths are raw keys.

import type { Doc } from '@/convex/_generated/dataModel';
import type { TalkerSymbolItem } from '@/app/contexts/TalkerContext';
import { displayString } from '@/lib/languages/displayValue';
import { DEFAULT_LOCALE } from '@/lib/languages/registry';

// `locale` (Phase 15, 3e) = the language the block's text actually resolved to,
// so the play modal can synthesise it in a voice for THAT language (voice follows
// text). Absent for live talker blocks (they're in the board language already).
export type PlayWord   = { kind: 'word';   label: string; imageUrl?: string; audioKey?: string; locale?: string };
export type PlayPhrase = { kind: 'phrase'; name: string;  imageUrl?: string; audioKey?: string; locale?: string;
                           words: { label: string; imageUrl?: string }[] };
export type PlayBlock  = PlayWord | PlayPhrase;

// The `units` element type from getProfileSentences — stays in sync with schema.
export type CompositionUnitClient = NonNullable<Doc<'profileSentences'>['units']>[number];

export function toAssetUrl(p?: string): string | undefined {
  if (!p) return undefined;
  return p.startsWith('/api/assets') ? p : `/api/assets?key=${p}`;
}

export function toAudioKey(p?: string): string | undefined {
  if (!p) return undefined;
  const prefix = '/api/assets?key=';
  return p.startsWith(prefix) ? p.slice(prefix.length) : p;
}

// Talker bar items → blocks. Word imagePaths are full URLs; phrase word
// imagePaths/audioPaths are raw keys — the helpers normalise both.
export function blocksFromTalker(items: TalkerSymbolItem[]): PlayBlock[] {
  return items.map((item): PlayBlock => {
    if (item.kind === 'phrase') {
      return {
        kind: 'phrase',
        name: item.phraseName ?? item.label,
        audioKey: toAudioKey(item.audioPath),
        words: (item.words ?? []).map((w) => ({
          label: w.label,
          imageUrl: toAssetUrl(w.imagePath),
        })),
      };
    }
    return {
      kind: 'word',
      label: item.label,
      imageUrl: toAssetUrl(item.imagePath),
      audioKey: toAudioKey(item.audioPath),
    };
  });
}

// Saved-sentence composition units → blocks. Unit imagePaths/audioPaths are raw
// keys; labels/names are localised records resolved via displayString. A phrase
// prefers its human recording over the TTS clip.
export function blocksFromUnits(units: CompositionUnitClient[], language: string): PlayBlock[] {
  return units.map((u): PlayBlock => {
    if (u.kind === 'phrase') {
      return {
        kind: 'phrase',
        name: displayString(u.name, language, DEFAULT_LOCALE),
        audioKey: toAudioKey(u.recordedAudioPath ?? u.audioPath),
        words: u.words.map((w) => ({
          label: displayString(w.label, language, DEFAULT_LOCALE),
          imageUrl: toAssetUrl(w.imagePath),
        })),
      };
    }
    return {
      kind: 'word',
      label: displayString(u.label, language, DEFAULT_LOCALE),
      imageUrl: toAssetUrl(u.imagePath),
      audioKey: toAudioKey(u.audioPath),
    };
  });
}
