"use client";
import type { ReactNode } from 'react';

// The shared card that wraps a composition unit in edit mode — a phrase builder
// OR a single word — so both read as one component family (Figma "Symbol" edit
// card): a theme-card surface with a dashed enter-mode border, content on top,
// and the edit controls centred inside at the bottom. `incomplete` flips the
// border to the warning colour (a phrase with < 2 words).
export function UnitCardShell({
  incomplete, children, controls,
}: {
  incomplete?: boolean;
  children: ReactNode;
  controls?: ReactNode;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 p-3 rounded-theme-card border-2 border-dashed"
      style={{ background: 'var(--theme-card)', borderColor: incomplete ? 'var(--theme-warning)' : 'var(--theme-enter-mode)' }}
    >
      {children}
      {controls}
    </div>
  );
}
