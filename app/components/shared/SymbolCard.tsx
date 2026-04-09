"use client";

// componentKey: "symbol-{symbolId}" — required for modelling mode targeting.
// All props/callbacks only — no context dependency.

type SymbolCardProps = {
  symbolId: string;
  imagePath?: string;
  label: string;
  language: string;
  showLabel?: boolean;
  showImage?: boolean;
  isModellingTarget?: boolean;
  onTap: () => void;
};

export function SymbolCard({
  imagePath,
  label,
  showLabel = true,
  showImage = true,
  isModellingTarget = false,
  onTap,
}: SymbolCardProps) {
  return (
    <button
      type="button"
      onClick={onTap}
      className={[
        'symbol-card',
        'flex flex-col items-center justify-between',
        'rounded-xl p-2 w-full aspect-square cursor-pointer',
        'transition-transform active:scale-95',
        isModellingTarget ? 'symbol-card--modelling-target' : '',
      ].join(' ')}
    >
      {showImage && (
        <div className="flex-1 flex items-center justify-center w-full min-h-0">
          {imagePath ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imagePath}
              alt={label}
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
          ) : (
            <div className="w-3/4 aspect-square rounded-lg bg-black/10" />
          )}
        </div>
      )}
      {showLabel && (
        <span className="text-caption font-medium text-center leading-tight mt-1 truncate w-full px-0.5">
          {label}
        </span>
      )}
    </button>
  );
}
