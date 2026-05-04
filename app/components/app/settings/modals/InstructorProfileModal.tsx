"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProfile } from "@/app/contexts/ProfileContext";
import { useTheme, THEME_TOKENS, type ThemeSlug } from "@/app/contexts/ThemeContext";
import { useAppState } from "@/app/contexts/AppStateProvider";
import {
  DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/app/components/app/shared/ui/Dialog";
import { Button } from "@/app/components/app/shared/ui/Button";

// ─── Theme swatches ───────────────────────────────────────────────────────────

const THEME_SWATCHES: { slug: ThemeSlug; swatch: string; name: string }[] = [
  { slug: "default", swatch: "#62748E", name: "Classic" },
  { slug: "sky",     swatch: "#00A6F4", name: "Sky"     },
  { slug: "amber",   swatch: "#E17100", name: "Amber"   },
  { slug: "fuchsia", swatch: "#E12AFB", name: "Fuchsia" },
  { slug: "lime",    swatch: "#5EA500", name: "Lime"    },
  { slug: "rose",    swatch: "#FF2056", name: "Rose"    },
];

type GridSize = "large" | "medium" | "small";
type TextSize = "large" | "medium" | "small" | "xs";

const GRID_OPTIONS: { size: GridSize; label: string; hint: string }[] = [
  { size: "large",  label: "Large",  hint: "4 cols"  },
  { size: "medium", label: "Medium", hint: "8 cols"  },
  { size: "small",  label: "Small",  hint: "12 cols" },
];

const TEXT_OPTIONS: { size: TextSize; label: string; hint: string }[] = [
  { size: "large",  label: "Large",  hint: "h2"     },
  { size: "medium", label: "Medium", hint: "h4"     },
  { size: "small",  label: "Small",  hint: "p bold" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function InstructorProfileModal({ onClose }: { onClose: () => void }) {
  const params = useParams();
  const { userRecord } = useAppState();
  const { stateFlags, setInstructorTheme } = useProfile();
  const { activeThemeId } = useTheme();

  const setMyLocale         = useMutation(api.users.setMyLocale);
  const setMyGridSize       = useMutation(api.users.setMyInstructorGridSize);
  const setMyTextSize       = useMutation(api.users.setMyInstructorSymbolTextSize);
  const setMyFlag           = useMutation(api.users.setMyInstructorFlag);

  const currentLocale  = (userRecord?.locale ?? params?.locale ?? "en") as string;
  const currentTheme   = (userRecord?.themeSlug ?? activeThemeId ?? "default") as ThemeSlug;
  const currentGrid    = stateFlags.grid_size;
  const currentTextSize = stateFlags.symbol_text_size;
  const currentLabelVisible = stateFlags.symbol_label_visible;

  const [locale,       setLocale]       = useState(currentLocale);
  const [theme,        setThemeSel]     = useState<ThemeSlug>(currentTheme);
  const [grid,         setGrid]         = useState<GridSize>(currentGrid);
  const [textSize,     setTextSize]     = useState<TextSize>(currentTextSize);
  const [labelVisible, setLabelVisible] = useState(currentLabelVisible);
  const [saving,       setSaving]       = useState(false);

  // Preview theme immediately on swatch click
  const handleThemeClick = (slug: ThemeSlug) => {
    setThemeSel(slug);
    setInstructorTheme(slug); // applies CSS vars instantly
  };

  // Grid change auto-derives text size
  const handleGridChange = (size: GridSize) => {
    setGrid(size);
    const derived: TextSize = size === "large" ? "medium" : size === "medium" ? "small" : "xs";
    setTextSize(derived);
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      // Theme is saved immediately on swatch click via setInstructorTheme — don't re-save here
      // or a stale initial `theme` state can overwrite the DB with "default" on locale change.
      const mutations: Promise<unknown>[] = [
        setMyGridSize({ gridSize: grid }),
        setMyTextSize({ textSize }),
        setMyFlag({ flag: "symbol_label_visible", value: labelVisible }),
      ];
      if (locale !== currentLocale) {
        mutations.push(setMyLocale({ locale }));
      }
      await Promise.all(mutations);
      if (locale !== currentLocale) {
        // Persist via NEXT_LOCALE cookie so future visits to bare `/` respect
        // this choice. AppStateProvider's mismatch redirect handles the URL swap.
        document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000;samesite=lax`;
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Instructor Profile</DialogTitle>
      </DialogHeader>

      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">

        {/* ── Language ──────────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <p className="text-theme-s font-semibold text-theme-secondary-text">Language</p>
          <div className="flex gap-2">
            {[
              { code: "en", label: "English" },
              { code: "hi", label: "हिंदी"   },
            ].map(({ code, label }) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                className={`flex-1 py-2 rounded-theme text-theme-s font-medium border transition-colors ${
                  locale === code
                    ? "bg-theme-button-highlight text-theme-text border-transparent"
                    : "bg-theme-primary text-theme-alt-text border-theme-line hover:opacity-90"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {locale !== currentLocale && (
            <p className="text-theme-s text-theme-secondary-text">
              The app will reload in the selected language.
            </p>
          )}
        </section>

        {/* ── Theme ─────────────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <p className="text-theme-s font-semibold text-theme-secondary-text">Theme</p>
          <div className="flex flex-wrap gap-theme-elements">
            {THEME_SWATCHES.map(({ slug, swatch, name }) => (
              <button
                key={slug}
                type="button"
                onClick={() => handleThemeClick(slug)}
                className={`flex items-center gap-2 px-theme-btn-x py-theme-btn-y rounded-theme-sm text-theme-s font-medium transition-colors ${
                  theme === slug
                    ? "bg-theme-button-highlight text-theme-text"
                    : "bg-theme-primary text-theme-alt-text hover:opacity-90"
                }`}
              >
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: swatch }} />
                {name}
              </button>
            ))}
          </div>
        </section>

        {/* ── Grid ──────────────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <p className="text-theme-s font-semibold text-theme-secondary-text">Symbol grid</p>
          <div className="flex gap-theme-elements">
            {GRID_OPTIONS.map(({ size, label, hint }) => (
              <button
                key={size}
                type="button"
                onClick={() => handleGridChange(size)}
                className={`flex flex-col items-center gap-1 flex-1 px-theme-btn-x py-theme-btn-y rounded-theme text-center transition-colors ${
                  grid === size
                    ? "bg-theme-button-highlight text-theme-text"
                    : "bg-theme-primary text-theme-alt-text hover:opacity-90"
                }`}
              >
                <span className="text-theme-p font-semibold">{label}</span>
                <span className="text-theme-s opacity-70">{hint}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Symbols ───────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-theme-s font-semibold text-theme-secondary-text">Symbols</p>

          {/* Label visible toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={labelVisible}
              onChange={(e) => setLabelVisible(e.target.checked)}
              className="w-4 h-4 rounded accent-[color:var(--theme-brand-primary)] cursor-pointer"
            />
            <span className="text-theme-p text-theme-alt-text">Display text label</span>
          </label>

          {/* Text size */}
          <div className={labelVisible ? "" : "opacity-40 pointer-events-none"}>
            <p className="text-theme-s text-theme-secondary-text mb-2">Text size</p>
            <div className="flex gap-theme-elements">
              {TEXT_OPTIONS.map(({ size, label, hint }) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setTextSize(size)}
                  className={`flex flex-col items-center gap-1 flex-1 px-theme-btn-x py-theme-btn-y rounded-theme text-center transition-colors ${
                    textSize === size
                      ? "bg-theme-button-highlight text-theme-text"
                      : "bg-theme-primary text-theme-alt-text hover:opacity-90"
                  }`}
                >
                  <span className="text-theme-p font-semibold">{label}</span>
                  <span className="text-theme-s opacity-70">{hint}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </DialogClose>
        <Button onClick={handleConfirm} loading={saving}>Confirm</Button>
      </DialogFooter>
    </>
  );
}
