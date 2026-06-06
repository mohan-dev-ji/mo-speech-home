"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProfile } from "@/app/contexts/ProfileContext";
import { useTheme } from "@/app/contexts/ThemeContext";
import { useAppState } from "@/app/contexts/AppStateProvider";
import {
  DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/app/components/app/shared/ui/Dialog";
import { Button } from "@/app/components/app/shared/ui/Button";
import { UpgradeNudge } from "@/app/components/app/shared/ui/UpgradeNudge";
import { getLanguage } from "@/lib/languages/registry";
import { canAccessThemeTier } from "@/lib/themes/registry";
import { displayValue } from "@/lib/languages/displayValue";
import { track } from "@/lib/analytics";
import { Volume2, Lock } from "lucide-react";

type GridSize = "large" | "medium" | "small";
type TextSize = "large" | "medium" | "small" | "xs";

// Labels/hints are i18n keys (resolved via `t` in the component) — never
// hard-code copy (Critical Rule #1). Size labels are shared between the two.
const GRID_OPTIONS: { size: GridSize; labelKey: string; hintKey: string }[] = [
  { size: "large",  labelKey: "sizeLarge",  hintKey: "gridHintLarge"  },
  { size: "medium", labelKey: "sizeMedium", hintKey: "gridHintMedium" },
  { size: "small",  labelKey: "sizeSmall",  hintKey: "gridHintSmall"  },
];

const TEXT_OPTIONS: { size: TextSize; labelKey: string; hintKey: string }[] = [
  { size: "large",  labelKey: "sizeLarge",  hintKey: "textHintLarge"  },
  { size: "medium", labelKey: "sizeMedium", hintKey: "textHintMedium" },
  { size: "small",  labelKey: "sizeSmall",  hintKey: "textHintSmall"  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function InstructorProfileModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("instructorProfile");
  const params = useParams();
  const { userRecord, subscription } = useAppState();
  const { stateFlags, setInstructorTheme } = useProfile();
  const { activeThemeId } = useTheme();

  const setMyLocale         = useMutation(api.users.setMyLocale);
  const setMyGridSize       = useMutation(api.users.setMyInstructorGridSize);
  const setMyTextSize       = useMutation(api.users.setMyInstructorSymbolTextSize);
  const setMyFlag           = useMutation(api.users.setMyInstructorFlag);
  const setMyVoiceDefault   = useMutation(api.users.setMyVoiceDefault);

  // Visible languages drive the picker — `includeBeta: true` so Spanish /
  // Korean show with a "preview" pill before they're stable. Per ADR-009 §3.
  // Machine-translated stays hidden in instructor view; admins can preview
  // those via /admin/languages directly.
  const visibleLanguages =
    useQuery(api.languages.getVisibleLanguages, { includeBeta: true }) ?? [];

  const currentLocale  = (userRecord?.locale ?? params?.locale ?? "en") as string;
  const currentTheme   = (userRecord?.themeSlug ?? activeThemeId ?? "default") as string;
  const currentGrid    = stateFlags.grid_size;
  const currentTextSize = stateFlags.symbol_text_size;
  const currentLabelVisible = stateFlags.symbol_label_visible;

  // Theme picker is data-driven: visible themes + tier come from the catalogue
  // (builtin + admin-published), gated against the account tier. Per ADR-011 §2.
  const uiLocale = useLocale();
  const themeCatalogue = useQuery(api.themes.getPublicThemeCatalogue) ?? [];
  const [themeNudgeOpen, setThemeNudgeOpen] = useState(false);

  const [locale,       setLocale]       = useState(currentLocale);
  const [theme,        setThemeSel]     = useState<string>(currentTheme);
  const [grid,         setGrid]         = useState<GridSize>(currentGrid);
  const [textSize,     setTextSize]     = useState<TextSize>(currentTextSize);
  const [labelVisible, setLabelVisible] = useState(currentLabelVisible);
  const [saving,       setSaving]       = useState(false);

  // ── Voices (for the currently-selected language only) ──
  // The picker shows the voices for whatever language is selected above. The
  // account stores a default voice per language (users.voiceDefaults); editing
  // here sets the default for the selected `locale`.
  const localeVoices = getLanguage(locale)?.voices ?? [];
  // Local per-language overrides; the stored default (or first registry voice)
  // shows as selected until the instructor picks a different one.
  const [voiceSel, setVoiceSel] = useState<Record<string, string>>({});
  const selectedVoiceId =
    voiceSel[locale] ?? userRecord?.voiceDefaults?.[locale] ?? localeVoices[0]?.ttsVoiceId;

  const previewVoice = async (voiceId: string) => {
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Hello", voiceId }),
      });
      if (!res.ok) return;
      const { r2Key } = await res.json();
      if (r2Key) new Audio(`/api/assets?key=${r2Key}`).play().catch(() => {});
    } catch {
      /* preview is best-effort */
    }
  };

  // Preview theme immediately on swatch click. Gated themes open the upgrade
  // nudge instead of selecting (the server mutation also rejects, defensively).
  const handleThemeClick = (slug: string, requiredTier: "free" | "pro" | "max") => {
    if (!canAccessThemeTier(subscription.tier, requiredTier)) {
      track("theme_locked_click", {
        slug,
        required_tier: requiredTier,
        tier: subscription.tier,
      });
      setThemeNudgeOpen(true);
      return;
    }
    const previousTheme = theme;
    setThemeSel(slug);
    setInstructorTheme(slug); // applies CSS vars instantly
    if (slug !== previousTheme) {
      track("theme_changed", {
        from_theme: previousTheme,
        to_theme: slug,
        tier: subscription.tier,
      });
    }
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
      // Persist any changed per-language voice defaults.
      for (const [lang, voiceId] of Object.entries(voiceSel)) {
        if (voiceId && voiceId !== userRecord?.voiceDefaults?.[lang]) {
          mutations.push(setMyVoiceDefault({ lang, voiceId }));
        }
      }
      await Promise.all(mutations);
      if (locale !== currentLocale) {
        // Persist via NEXT_LOCALE cookie so future visits to bare `/` respect
        // this choice. AppStateProvider's mismatch redirect handles the URL swap.
        document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000;samesite=lax`;
        track("language_switched", { from: currentLocale, to: locale });
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
      </DialogHeader>

      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-1">

        {/* ── Language ──────────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <p className="text-theme-s font-semibold text-theme-secondary-text">{t("sectionLanguage")}</p>
          <div className="flex flex-wrap gap-2">
            {visibleLanguages.map(({ code, nativeLabel, status }) => (
              <button
                key={code}
                type="button"
                onClick={() => setLocale(code)}
                className={`flex-1 min-w-[5rem] py-2 px-3 rounded-theme text-theme-s font-medium border transition-colors inline-flex items-center justify-center gap-1.5 ${
                  locale === code
                    ? "bg-theme-button-highlight text-theme-text border-transparent"
                    : "bg-theme-primary text-theme-alt-text border-theme-line hover:opacity-90"
                }`}
              >
                <span>{nativeLabel}</span>
                {status === "beta" && (
                  <span className="text-[0.65rem] uppercase tracking-wider opacity-70">
                    {t("preview")}
                  </span>
                )}
              </button>
            ))}
          </div>
          {locale !== currentLocale && (
            <p className="text-theme-s text-theme-secondary-text">
              {t("languageReloadNotice")}
            </p>
          )}
        </section>

        {/* ── Voices (selected language only) ───────────────────────────────── */}
        {localeVoices.length > 1 && (
          <section className="space-y-2">
            <p className="text-theme-s font-semibold text-theme-secondary-text">{t("sectionVoices")}</p>
            <div className="flex flex-wrap gap-theme-elements">
              {localeVoices.map((vc) => {
                const selected = selectedVoiceId === vc.ttsVoiceId;
                return (
                  <div key={vc.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setVoiceSel((prev) => ({ ...prev, [locale]: vc.ttsVoiceId }))}
                      className={`w-28 h-28 flex flex-col items-center justify-center gap-1 px-2 rounded-theme text-center transition-colors ${
                        selected
                          ? "bg-theme-button-highlight text-theme-text"
                          : "bg-theme-primary text-theme-alt-text hover:opacity-90"
                      }`}
                    >
                      <span className="text-theme-p font-semibold">
                        {vc.gender === "female" ? t("genderFemale") : t("genderMale")}
                      </span>
                      <span className="text-[0.65rem] font-mono opacity-80 break-all leading-tight">{vc.ttsVoiceId}</span>
                      <span className="text-theme-s opacity-70 leading-tight">{vc.region}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => previewVoice(vc.ttsVoiceId)}
                      aria-label={t("voicePreview")}
                      className="absolute top-1 right-1 p-1.5 rounded-theme-sm bg-theme-primary text-theme-alt-text hover:opacity-90 transition-colors"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Theme ─────────────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <p className="text-theme-s font-semibold text-theme-secondary-text">{t("sectionTheme")}</p>
          <div className="flex flex-wrap gap-theme-elements">
            {themeCatalogue.map((th) => {
              const locked = !canAccessThemeTier(subscription.tier, th.effectiveTier);
              const label = displayValue(th.name, uiLocale, "en") ?? th.slug;
              return (
                <button
                  key={th.slug}
                  type="button"
                  onClick={() => handleThemeClick(th.slug, th.effectiveTier)}
                  className={`flex items-center gap-2 px-theme-btn-x py-theme-btn-y rounded-theme-sm text-theme-s font-medium transition-colors ${
                    theme === th.slug
                      ? "bg-theme-button-highlight text-theme-text"
                      : "bg-theme-primary text-theme-alt-text hover:opacity-90"
                  }`}
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: th.previewColour }} />
                  {label}
                  {locked && <Lock className="w-3 h-3 shrink-0" aria-hidden />}
                </button>
              );
            })}
          </div>
        </section>

        {/* ── Grid ──────────────────────────────────────────────────────────── */}
        <section className="space-y-2">
          <p className="text-theme-s font-semibold text-theme-secondary-text">{t("sectionGrid")}</p>
          <div className="flex gap-theme-elements">
            {GRID_OPTIONS.map(({ size, labelKey, hintKey }) => (
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
                <span className="text-theme-p font-semibold">{t(labelKey)}</span>
                <span className="text-theme-s opacity-70">{t(hintKey)}</span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Symbols ───────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-theme-s font-semibold text-theme-secondary-text">{t("sectionSymbols")}</p>

          {/* Label visible toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={labelVisible}
              onChange={(e) => setLabelVisible(e.target.checked)}
              className="w-4 h-4 rounded accent-[color:var(--theme-brand-primary)] cursor-pointer"
            />
            <span className="text-theme-p text-theme-alt-text">{t("displayTextLabel")}</span>
          </label>

          {/* Text size */}
          <div className={labelVisible ? "" : "opacity-40 pointer-events-none"}>
            <p className="text-theme-s text-theme-secondary-text mb-2">{t("textSize")}</p>
            <div className="flex gap-theme-elements">
              {TEXT_OPTIONS.map(({ size, labelKey, hintKey }) => (
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
                  <span className="text-theme-p font-semibold">{t(labelKey)}</span>
                  <span className="text-theme-s opacity-70">{t(hintKey)}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" onClick={onClose}>{t("cancelButton")}</Button>
        </DialogClose>
        <Button onClick={handleConfirm} loading={saving}>{t("confirmButton")}</Button>
      </DialogFooter>

      <UpgradeNudge
        open={themeNudgeOpen}
        onOpenChange={setThemeNudgeOpen}
        feature="premiumThemes"
        locale={uiLocale}
      />
    </>
  );
}
