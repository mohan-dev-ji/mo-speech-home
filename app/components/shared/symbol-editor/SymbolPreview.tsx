"use client";

import type { Draft, TextSize, CardShape } from './types';

type Props = {
  imageSrc?: string;
  label: string;
  draft: Draft;
};

const TEXT_SIZE_CLASS: Record<TextSize, string> = {
  sm: 'text-xs font-bold',
  md: 'text-sm font-bold',
  lg: 'text-base font-semibold',
  xl: 'text-lg font-semibold',
};

const SHAPE_CLASS: Record<CardShape, string> = {
  square: 'rounded-none',
  rounded: 'rounded-xl',
  circle: 'rounded-full overflow-hidden',
};

export function SymbolPreview({ imageSrc, label, draft }: Props) {
  return (
    <div
      className={`w-full aspect-square flex flex-col items-center justify-between p-3 ${SHAPE_CLASS[draft.shape]}`}
      style={{
        backgroundColor: draft.bgColour,
        border: `${draft.borderWidth}px solid ${draft.borderColour}`,
      }}
    >
      {draft.showImage && (
        <div className="flex-1 flex items-center justify-center w-full min-h-0">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt={label}
              className="max-w-full max-h-full object-contain"
              draggable={false}
            />
          ) : (
            <div className="w-3/4 aspect-square rounded-lg" style={{ background: 'rgba(0,0,0,0.08)' }} />
          )}
        </div>
      )}
      {draft.showLabel && label && (
        <span
          className={`${TEXT_SIZE_CLASS[draft.textSize]} text-center leading-tight mt-1 truncate w-full px-0.5`}
          style={{ color: draft.textColour }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
