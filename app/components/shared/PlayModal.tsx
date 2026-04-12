"use client";

// Fullscreen overlay that plays a symbol's audio on open and shows label + image.
// Used in banner mode: tapping a symbol card triggers this instead of adding to talker bar.
// All props/callbacks only — no context dependency.

import { X } from 'lucide-react';

type PlayModalProps = {
  isOpen: boolean;
  symbolId: string;
  imagePath?: string;
  label: string;
  language: string;       // kept for future multi-language audio resolution
  onClose: () => void;
};

export function PlayModal({ isOpen, imagePath, label, onClose }: PlayModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center"
      style={{ background: 'var(--theme-overlay)' }}
      onClick={onClose}
    >
      {/* Close */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full"
        style={{ background: 'rgba(255,255,255,0.2)', color: 'var(--theme-text-on-brand)' }}
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Symbol */}
      <div
        className="flex flex-col items-center gap-6 rounded-2xl p-8 max-w-[260px] w-full"
        style={{ background: 'var(--theme-symbol-card-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {imagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imagePath}
            alt={label}
            className="w-full aspect-square object-contain"
            draggable={false}
          />
        ) : (
          <div className="w-full aspect-square rounded-xl bg-black/10" />
        )}
        <span
          className="text-heading font-semibold text-center"
          style={{ color: 'var(--theme-symbol-card-text)' }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
