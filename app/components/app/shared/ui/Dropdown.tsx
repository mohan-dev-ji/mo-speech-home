"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export type DropdownOption = {
  value: string;
  label: string;
};

type DropdownProps = {
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  /** Accessible label, e.g. "Filter by pack". Consumer supplies localised copy. */
  ariaLabel: string;
  /** Optional left icon (e.g. a Filter glyph). */
  icon?: ReactNode;
  /** Min width of the trigger; defaults to 140px. */
  minWidth?: number;
  className?: string;
};

/**
 * The Figma "Dropdown" atom — `bg-theme-surface` + `border-theme-line` +
 * `text-theme-alt-text` + chevron. The `surface` background is the shared
 * visual through-line across the topbar mode-view Dropdown, the active
 * Navbar-button, and the search bar (see the inventory's cohesion note).
 *
 * Self-contained: closes on outside-click and Escape so it never traps focus.
 */
export function Dropdown({
  value,
  options,
  onChange,
  ariaLabel,
  icon,
  minWidth = 140,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const current =
    options.find((o) => o.value === value)?.label ?? options[0]?.label ?? "";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className={`relative ${className ?? ""}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{ minWidth }}
        className="flex items-center gap-theme-elements px-theme-btn-x py-theme-btn-y rounded-theme-button border border-theme-line bg-theme-surface text-theme-alt-text text-theme-s font-medium transition-colors hover:bg-theme-card"
      >
        {icon && <span className="shrink-0 inline-flex">{icon}</span>}
        <span className="flex-1 text-left truncate">{current}</span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" />
      </button>
      {open && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className="absolute top-full left-0 mt-1 rounded-theme-card border border-theme-line bg-theme-surface elevation-modal z-50 overflow-hidden max-h-[60vh] overflow-y-auto"
          style={{ minWidth: Math.max(minWidth, 180) }}
        >
          {options.map((opt) => {
            const selected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-theme-s transition-colors hover:bg-theme-card ${
                  selected
                    ? "text-theme-primary font-medium"
                    : "text-theme-alt-text"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
