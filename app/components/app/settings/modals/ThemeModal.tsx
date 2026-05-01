"use client";

import { useState } from "react";
import { useTheme, THEME_TOKENS, type ThemeSlug } from "@/app/contexts/ThemeContext";
import {
  DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/app/components/app/shared/ui/Dialog";
import { Button } from "@/app/components/app/shared/ui/Button";

const THEME_SWATCHES: { slug: ThemeSlug; swatch: string }[] = [
  { slug: "default", swatch: "#62748E" },
  { slug: "sky",     swatch: "#00A6F4" },
  { slug: "amber",   swatch: "#E17100" },
  { slug: "fuchsia", swatch: "#E12AFB" },
  { slug: "lime",    swatch: "#5EA500" },
  { slug: "rose",    swatch: "#FF2056" },
];

const THEME_META: Record<ThemeSlug, { name: string }> = {
  default:  { name: "Classic" },
  sky:      { name: "Sky" },
  amber:    { name: "Amber" },
  fuchsia:  { name: "Fuchsia" },
  lime:     { name: "Lime" },
  rose:     { name: "Rose" },
};

export function ThemeModal({ onClose }: { onClose: () => void }) {
  const { activeThemeId, setTheme } = useTheme();
  const currentSlug = (activeThemeId ?? "default") as ThemeSlug;
  const [selected, setSelected] = useState<ThemeSlug>(currentSlug);

  const handleConfirm = () => {
    setTheme(selected, THEME_TOKENS[selected]);
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Theme</DialogTitle>
      </DialogHeader>

      <div className="space-y-5">
        {/* Theme buttons */}
        <div>
          <p className="text-theme-s font-semibold text-theme-secondary-text mb-3">Colour theme</p>
          <div className="flex flex-wrap gap-theme-elements">
            {THEME_SWATCHES.map(({ slug, swatch }) => {
              const active = selected === slug;
              return (
                <button
                  key={slug}
                  onClick={() => setSelected(slug)}
                  className={`flex items-center gap-2 px-theme-btn-x py-theme-btn-y rounded-theme-sm text-theme-s font-medium transition-colors ${
                    active
                      ? "bg-theme-button-highlight text-theme-text"
                      : "bg-theme-primary text-theme-alt-text hover:opacity-90"
                  }`}
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: swatch }} />
                  {THEME_META[slug].name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Text size — scaffold */}
        <div>
          <p className="text-small font-medium text-foreground mb-2">Text Size</p>
          <div className="rounded-theme border border-dashed border-border p-4 text-center">
            <p className="text-theme-s text-theme-secondary-text">Text size control — Phase 7</p>
          </div>
        </div>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </DialogClose>
        <Button onClick={handleConfirm}>Confirm</Button>
      </DialogFooter>
    </>
  );
}
