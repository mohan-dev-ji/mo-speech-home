"use client";
import type { ReactNode } from 'react';

// The shared fullscreen play-modal backdrop (ADR-015): a dimmed + blurred overlay
// that closes on a backdrop click. Used by every fullscreen play modal — sentence,
// block composition, and list item — so the overlay token + blur live in one place.
// Inner content stops propagation itself; `className` sets that modal's content
// layout (flex direction / centering / gap / padding).
export function PlayModalBackdrop({
  onClose,
  className,
  children,
}: {
  onClose: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`fixed inset-0 z-[200] flex backdrop-blur-[11.1px] ${className ?? ''}`}
      style={{ background: 'var(--theme-overlay)' }}
      onClick={onClose}
    >
      {children}
    </div>
  );
}
