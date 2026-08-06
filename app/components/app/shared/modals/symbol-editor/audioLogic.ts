// Pure decision helpers for the symbol-editor audio model (audio follows the
// label by default; Generate carries a decoupled spoken text). No React, no I/O
// — kept inspectable and side-effect-free so the components stay thin.
import type { AudioMode } from './types';

/** The subset of a stored per-language audio override the editor reads back. */
export type StoredAudioEntry = {
  type: 'r2' | 'tts' | 'recorded';
  path: string;
  ttsText?: string;
  alternates?: { default?: string; generated?: string; recorded?: string };
};

/**
 * Which editor audio tab a language's stored override maps to on reopen:
 *   none                             -> default (follow label)
 *   tts  & ttsText === current label -> default (cached follow-label clip)
 *   tts  & ttsText !== current label -> generate (decoupled custom text)
 *   recorded                         -> record
 *   r2  (author-time cache)          -> default (resolver ignores r2)
 */
export function deriveAudioMode(
  entry: StoredAudioEntry | undefined,
  label: string,
): { mode: AudioMode; generateText?: string; generatedAudioPath?: string; recordedAudioPath?: string } {
  if (!entry) return { mode: 'default' };
  if (entry.type === 'recorded') return { mode: 'record', recordedAudioPath: entry.path };
  if (entry.type === 'tts') {
    const text = (entry.ttsText ?? '').trim();
    if (text && text === label.trim()) return { mode: 'default' };
    return { mode: 'generate', generateText: entry.ttsText ?? '', generatedAudioPath: entry.path };
  }
  return { mode: 'default' };
}

/**
 * Initial per-language dirty flags. A label is dirty when it is non-empty AND
 * differs from the symbol's own word for that language (a genuine custom
 * label, to be protected). Placeholders (no symbol yet) start clean so the
 * first pick fills them.
 */
export function initLabelDirty(
  label: Record<string, string>,
  symbolWords: Record<string, string>,
  isPlaceholder: boolean,
): Record<string, boolean> {
  if (isPlaceholder) return {};
  const dirty: Record<string, boolean> = {};
  for (const [lang, text] of Object.entries(label)) {
    const t = (text ?? '').trim();
    if (t && t !== (symbolWords[lang] ?? '').trim()) dirty[lang] = true;
  }
  return dirty;
}

export type AudioSavePlan =
  | { action: 'delete' }
  | { action: 'store'; entry: { type: 'tts'; path: string; ttsText: string; language: string } };

/**
 * Decide whether to persist a per-language override once a clip is resolved.
 * If the resolved clip IS the symbol's own default (label matches the symbol
 * word, seeded), store nothing so render re-derives per board voice; otherwise
 * store a per-language tts override carrying the spoken text.
 */
export function planFollowLabelAudio(args: {
  language: string;
  resolvedPath: string;
  symbolDefaultPath?: string;
  spokenText: string;
}): AudioSavePlan {
  if (args.symbolDefaultPath && args.resolvedPath === args.symbolDefaultPath) {
    return { action: 'delete' };
  }
  return {
    action: 'store',
    entry: { type: 'tts', path: args.resolvedPath, ttsText: args.spokenText, language: args.language },
  };
}
