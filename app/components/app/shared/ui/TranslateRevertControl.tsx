"use client";

import { Languages, RotateCcw } from 'lucide-react';
import { IconButton } from '@/app/components/app/shared/ui/IconButton';

export type TranslateRevertState = 'untranslated' | 'translated' | 'none';

/**
 * Edit-mode-only control for per-language content. One slot, two meanings:
 *  - `untranslated` → translate glyph; fires `onTranslate`
 *  - `translated`   → ↺; fires `onRevert` (caller opens the "Use original" confirm)
 *  - `none`         → renders nothing (single-language item)
 *
 * Deliberately dumb: it renders state and fires callbacks. The VERB is
 * surface-specific — machine-translation for labels, but variant AUTHORING for
 * sentences/phrases, which must never be machine-translated (ADR-016).
 */
export function TranslateRevertControl({
  state, onTranslate, onRevert, translateLabel, revertLabel, size = 'sm', className,
}: {
  state: TranslateRevertState;
  onTranslate: () => void;
  onRevert: () => void;
  translateLabel: string;
  revertLabel: string;
  size?: 'sm' | 'md';
  className?: string;
}) {
  if (state === 'none') return null;
  const isTranslate = state === 'untranslated';
  return (
    <IconButton
      size={size}
      variant="neutral"
      className={className}
      icon={isTranslate ? <Languages /> : <RotateCcw />}
      label={isTranslate ? translateLabel : revertLabel}
      onClick={(e) => { e.stopPropagation(); (isTranslate ? onTranslate : onRevert)(); }}
    />
  );
}
