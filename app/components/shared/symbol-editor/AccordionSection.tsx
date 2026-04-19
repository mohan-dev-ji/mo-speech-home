"use client";

import { ChevronDown, ChevronRight } from 'lucide-react';

type Props = {
  label: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

export function AccordionSection({ label, isOpen, onToggle, children }: Props) {
  return (
    <div className="border-b last:border-b-0" style={{ borderColor: 'var(--theme-button-highlight)' }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-theme-s font-semibold" style={{ color: 'var(--theme-text)' }}>
          {label}
        </span>
        {isOpen
          ? <ChevronDown className="w-4 h-4 shrink-0" style={{ color: 'var(--theme-secondary-text)' }} />
          : <ChevronRight className="w-4 h-4 shrink-0" style={{ color: 'var(--theme-secondary-text)' }} />
        }
      </button>
      {isOpen && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {children}
        </div>
      )}
    </div>
  );
}
