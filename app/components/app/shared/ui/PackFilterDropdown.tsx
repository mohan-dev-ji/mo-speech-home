"use client";

import { Filter } from "lucide-react";
import { Dropdown, type DropdownOption } from "./Dropdown";

export type PackFilterOption = DropdownOption;

type Props = {
  /** Current selection; defaults to `'all'` when no `?pack=` query param is present. */
  value: string;
  options: PackFilterOption[];
  onChange: (value: string) => void;
  /** Accessible button label, e.g. "Filter by pack". Consumer provides localised copy. */
  ariaLabel: string;
};

/**
 * The pack filter on listing pages — a `Dropdown` (the Figma atom) with a
 * Filter glyph. View-mode-aware options are computed by the parent. Styling
 * lives in `Dropdown` so it stays cohesive with the topbar mode-view dropdown
 * and search bar (all `surface`).
 */
export function PackFilterDropdown({ value, options, onChange, ariaLabel }: Props) {
  return (
    <Dropdown
      value={value}
      options={options}
      onChange={onChange}
      ariaLabel={ariaLabel}
      icon={<Filter className="w-3.5 h-3.5" />}
    />
  );
}
