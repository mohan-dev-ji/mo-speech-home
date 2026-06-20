"use client";

import { Tab } from "./Tab";

export type TabItem = { id: string; label: string };

/**
 * Row of {@link Tab}s — mirrors the Figma "Tab-bar" component (`3028:4366`).
 *
 * Full-width, evenly-divided tabs with a shared `--theme-line` bottom border
 * that the active tab's underline sits on top of. Reused for BOTH the main
 * six-tab Settings bar and the secondary student-selector bar, so it accepts an
 * arbitrary tab list.
 */
export function TabBar({
  tabs,
  activeId,
  onSelect,
  className,
}: {
  tabs: TabItem[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`flex items-center gap-theme-gap border-b-[3px] border-theme-line ${className ?? ""}`}
    >
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          label={tab.label}
          active={tab.id === activeId}
          onClick={() => onSelect(tab.id)}
        />
      ))}
    </div>
  );
}
