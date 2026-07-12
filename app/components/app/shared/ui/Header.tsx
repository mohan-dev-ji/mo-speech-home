"use client";

// Pure talker display — chip area, action buttons, and TalkerDropdown.
// Category props and mode toggle removed (see ADR-004).
//
// Figma "Talker" (`3017:2185`): one rounded-card rectangle, clipped via
// `overflow`. The Topline is a thin `primary-50` frame; inside it the
// Symbol-stage (fill = `background`) holds the chips on the left and the control
// IconButtons on the right (`justify-between`). The full-width Dropdown forms
// the bottom edge of the same rectangle.

import { Volume2, Delete, Save } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { TalkerBar } from './TalkerBar';
import type { TalkerSymbolItem, QuickSymbolItem } from './TalkerBar';
import { TalkerDropdown } from './TalkerDropdown';
import { IconButton } from './IconButton';
import { EditPanel } from './EditPanel';

export type { TalkerSymbolItem, QuickSymbolItem } from './TalkerBar';

// ─── Types ────────────────────────────────────────────────────────────────────

type HeaderProps = {
  symbols: TalkerSymbolItem[];
  language: string;
  placeholder?: string;
  onChipTap: (item: TalkerSymbolItem) => void;
  onPlaySentence: () => void;
  onClear: () => void;
  onSave?: () => void;
  onQuickSymbolTap: (item: QuickSymbolItem) => void;
  onRemove?: (instanceId: string) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export function Header({
  symbols,
  language,
  placeholder,
  onChipTap,
  onPlaySentence,
  onClear,
  onSave,
  onQuickSymbolTap,
  onRemove,
  onReorder,
}: HeaderProps) {
  const t = useTranslations('talker');

  const hasSymbols = symbols.length > 0;

  return (
    // data-talker-shell: TalkerDropdown re-syncs its fixed panel anchor to this
    // element's size, so a multi-row talker doesn't slide under the open panel.
    <div data-talker-shell className="flex flex-col items-stretch overflow-clip rounded-theme-card w-full">
      {/* Topline — thin primary-50 frame around the stage */}
      <div
        className="flex items-center justify-center p-theme-general w-full glass-bar"
        style={{ background: 'var(--theme-primary-50)' }}
      >
        {/* Symbol-stage — `background` fill; chips left, control buttons right */}
        <div
          className="flex flex-1 items-stretch justify-between gap-2 min-w-0 overflow-hidden px-3 min-h-[180px] rounded-theme-card"
          style={{ background: 'var(--theme-background)' }}
        >
          <TalkerBar
            symbols={symbols}
            placeholder={placeholder}
            onChipTap={onChipTap}
            onRemove={onRemove}
            onReorder={onReorder}
          />

          {/* Control buttons — play / clear / save */}
          <EditPanel orientation="vertical" className="shrink-0 py-theme-elements">
            <IconButton
              icon={<Volume2 />}
              label={t('playLabel')}
              onClick={onPlaySentence}
              disabled={!hasSymbols}
              style={{ background: 'var(--theme-success)', color: '#fff' }}
            />
            <IconButton
              icon={<Delete />}
              label={t('clearLabel')}
              onClick={onClear}
              disabled={!hasSymbols}
              style={{ background: 'var(--theme-warning)', color: '#fff' }}
            />
            <IconButton
              variant="ghost"
              icon={<Save />}
              label={t('saveLabel')}
              onClick={onSave}
              disabled={!hasSymbols || !onSave}
              style={{ background: 'var(--theme-surface)' }}
            />
          </EditPanel>
        </div>
      </div>

      {/* Dropdown — full-width bottom of the rectangle */}
      <TalkerDropdown language={language} onSymbolTap={onQuickSymbolTap} />
    </div>
  );
}
