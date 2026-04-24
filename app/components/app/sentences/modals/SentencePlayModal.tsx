"use client";

import { useEffect } from 'react';
import { X } from 'lucide-react';

type Slot = {
  order: number;
  imagePath?: string;
};

type SentencePlayModalProps = {
  isOpen: boolean;
  sentenceText: string;
  slots: Slot[];
  audioPath?: string;
  onClose: () => void;
};

export function SentencePlayModal({
  isOpen, sentenceText, slots, audioPath, onClose,
}: SentencePlayModalProps) {
  useEffect(() => {
    if (isOpen && audioPath) {
      new Audio(`/api/assets?key=${audioPath}`).play().catch(() => {});
    }
  }, [isOpen, audioPath]);

  if (!isOpen) return null;

  const filledSlots = slots.filter((s) => s.imagePath);

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-8 p-8"
      style={{ background: 'var(--theme-overlay)' }}
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 flex items-center justify-center w-10 h-10 rounded-full"
        style={{ background: 'rgba(255,255,255,0.2)', color: 'var(--theme-text-on-brand)' }}
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {filledSlots.length > 0 && (
        <div
          className="flex gap-4 flex-wrap justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          {filledSlots.map((slot, i) => (
            <div
              key={i}
              className="w-[100px] h-[100px] rounded-theme-sm overflow-hidden flex items-center justify-center"
              style={{ background: 'var(--theme-symbol-card-bg)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/assets?key=${slot.imagePath}`}
                alt=""
                className="w-full h-full object-contain p-2"
                draggable={false}
              />
            </div>
          ))}
        </div>
      )}

      <div
        className="max-w-2xl w-full px-8 py-6 rounded-2xl text-center"
        style={{ background: 'var(--theme-symbol-card-bg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <span
          className="font-semibold"
          style={{
            color: 'var(--theme-symbol-card-text)',
            fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
            lineHeight: 1.3,
          }}
        >
          {sentenceText}
        </span>
      </div>
    </div>
  );
}
