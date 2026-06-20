"use client";

// White symbol chip area only.
// Tapping a chip calls onChipTap — the parent decides whether to play or remove.
// Action buttons and the dropdown panel live in TalkerSection.

import { SymbolCard } from './SymbolCard';

export type TalkerSymbolItem = {
  instanceId: string;   // unique per tap (uuid), not the symbol ID
  symbolId: string;
  imagePath?: string;
  audioPath?: string;   // R2 key — served via /api/assets proxy
  label: string;
};

// Payload emitted by TalkerDropdown when a quick-access symbol is tapped.
// Omits instanceId — the receiving handler assigns that on insert.
export type QuickSymbolItem = {
  symbolId: string;
  label: string;
  imagePath?: string;
  audioPath?: string;
};

type TalkerBarProps = {
  symbols: TalkerSymbolItem[];
  placeholder?: string;
  onChipTap: (item: TalkerSymbolItem) => void;
};

export function TalkerBar({
  symbols,
  placeholder = 'Tap symbols to build a sentence…',
  onChipTap,
}: TalkerBarProps) {
  return (
    <div className="flex flex-1 min-w-0 self-stretch items-start flex-wrap content-start gap-theme-elements py-theme-elements overflow-y-auto">
      {symbols.length === 0 ? (
        <span
          className="text-caption opacity-50 select-none self-center"
          style={{ color: 'var(--theme-alt-text)' }}
        >
          {placeholder}
        </span>
      ) : (
        symbols.map((item) => (
          // Real (shrunk) SymbolCard — same outline + bg treatment as the
          // category-detail board. The wrapper fixes the square footprint;
          // SymbolCard fills it (it owns its own `inline-size` container).
          <div key={item.instanceId} className="w-40 shrink-0">
            <SymbolCard
              symbolId={item.symbolId}
              imagePath={item.imagePath}
              label={item.label}
              language="en"
              onTap={() => onChipTap(item)}
            />
          </div>
        ))
      )}
    </div>
  );
}
