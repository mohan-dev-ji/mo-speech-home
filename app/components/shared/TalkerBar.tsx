"use client";

// White symbol chip area only.
// Tapping a chip calls onChipTap — the parent decides whether to play or remove.
// Action buttons and the dropdown panel live in TalkerSection.

export type TalkerSymbolItem = {
  instanceId: string;   // unique per tap (uuid), not the symbol ID
  symbolId: string;
  imagePath?: string;
  audioPath?: string;   // R2 key — served via /api/assets proxy
  label: string;
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
    <div
      className="flex items-start flex-wrap content-start gap-2 px-3 py-2 min-h-[160px] overflow-y-auto rounded-theme w-full"
      style={{ background: 'var(--theme-alt-card)' }}
    >
      {symbols.length === 0 ? (
        <span
          className="text-caption opacity-50 select-none self-center"
          style={{ color: 'var(--theme-text)' }}
        >
          {placeholder}
        </span>
      ) : (
        symbols.map((item) => (
          <button
            key={item.instanceId}
            type="button"
            onClick={() => onChipTap(item)}
            className="flex flex-col items-center shrink-0 w-28 h-[140px] rounded-lg p-2 transition-transform active:scale-95"
            style={{ background: 'var(--theme-symbol-bg)', color: 'var(--theme-text)' }}
          >
            {/* Image fills all available height above the label */}
            <div className="flex-1 flex items-center justify-center w-full min-h-0">
              {item.imagePath ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imagePath}
                  alt={item.label}
                  className="max-w-full max-h-full object-contain"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full rounded bg-black/10" />
              )}
            </div>
            <span className="text-xs leading-tight truncate w-full text-center mt-1 shrink-0">
              {item.label}
            </span>
          </button>
        ))
      )}
    </div>
  );
}
