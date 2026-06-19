"use client";

import { Volume2 } from "lucide-react";

/**
 * A single voice option — mirrors the Figma "voice" / VoiceCard (`1454:25145`).
 *
 * Selected = `--theme-primary` fill + `button-primary` (light) text. Unselected
 * = `button-primary` card + `button-secondary` text at 50% opacity (sunk into
 * the bg), rising to 100% on hover. A full-width Preview chip plays via `onPreview`.
 */
export function VoiceCard({
  title,
  subtitle,
  selected,
  onSelect,
  onPreview,
  previewLabel,
}: {
  title: string;
  subtitle: string;
  selected: boolean;
  onSelect: () => void;
  onPreview: () => void;
  previewLabel: string;
}) {
  return (
    <div
      className={`flex flex-1 flex-col gap-theme-elements rounded-theme-sm p-theme-general transition-opacity ${
        selected
          ? "bg-theme-primary text-theme-button-primary"
          : "bg-theme-button-primary text-theme-button-secondary opacity-50 hover:opacity-100"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-col items-start text-left"
        aria-pressed={selected}
      >
        <span className="text-theme-p font-semibold">{title}</span>
        <span className="text-theme-p">{subtitle}</span>
      </button>
      <button
        type="button"
        onClick={onPreview}
        className="flex items-center justify-between gap-theme-elements rounded-theme-button bg-theme-button-primary px-theme-btn-x py-theme-btn-y text-theme-button-secondary elevation-subtle"
      >
        <span className="text-theme-p">{previewLabel}</span>
        <Volume2 className="size-4 shrink-0" aria-hidden />
      </button>
    </div>
  );
}
