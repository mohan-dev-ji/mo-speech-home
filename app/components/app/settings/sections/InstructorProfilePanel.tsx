"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProfile } from "@/app/contexts/ProfileContext";
import { useTheme } from "@/app/contexts/ThemeContext";
import { useAppState } from "@/app/contexts/AppStateProvider";
import { UpgradeNudge } from "@/app/components/app/shared/ui/UpgradeNudge";
import { SettingsSection } from "@/app/components/app/settings/ui/SettingsSection";
import { LanguagePicker } from "@/app/components/app/settings/ui/LanguagePicker";
import { VoiceCard } from "@/app/components/app/settings/ui/VoiceCard";
import { ThemePicker } from "@/app/components/app/settings/ui/ThemePicker";
import { GridSizePicker, type GridSize } from "@/app/components/app/settings/ui/GridSizePicker";
import { SymbolsControls, type TextSize } from "@/app/components/app/settings/ui/SymbolsControls";
import { NavbarControls } from "@/app/components/app/settings/ui/NavbarControls";
import { getLanguage } from "@/lib/languages/registry";
import { canAccessThemeTier } from "@/lib/themes/registry";
import { track } from "@/lib/analytics";

const GRID_SIZES: GridSize[] = ["large", "medium", "small"];
const TEXT_SIZES: Exclude<TextSize, "xs">[] = ["large", "medium", "small"];
const SIZE_LABEL_KEY: Record<string, string> = {
  large: "sizeLarge",
  medium: "sizeMedium",
  small: "sizeSmall",
};

/** Grid size auto-derives a matching symbol text size (same map as the old modal). */
function deriveTextSize(grid: GridSize): TextSize {
  return grid === "large" ? "medium" : grid === "medium" ? "small" : "xs";
}

/**
 * Instructor Profile tab — ports `InstructorProfileModal` into inline,
 * auto-saving section-cards. Languages → Voices → Theme → Grid → Symbols, each
 * persisting immediately via the same `users.*` mutations. Instructor settings
 * write the `users` table (instructor scope).
 */
export function InstructorProfilePanel() {
  const t = useTranslations("instructorProfile");
  const tNav = useTranslations("navbar");
  const params = useParams();
  const uiLocale = useLocale();
  const { userRecord, subscription } = useAppState();
  const { stateFlags, setInstructorTheme } = useProfile();
  const { activeThemeId } = useTheme();

  const setMyLocale = useMutation(api.users.setMyLocale);
  const setMyGridSize = useMutation(api.users.setMyInstructorGridSize);
  const setMyTextSize = useMutation(api.users.setMyInstructorSymbolTextSize);
  const setMyFlag = useMutation(api.users.setMyInstructorFlag);
  const setMyVoiceDefault = useMutation(api.users.setMyVoiceDefault);

  const visibleLanguages =
    useQuery(api.languages.getVisibleLanguages, { includeBeta: true }) ?? [];
  const themeCatalogue = useQuery(api.themes.getPublicThemeCatalogue) ?? [];
  const [themeNudgeOpen, setThemeNudgeOpen] = useState(false);

  const currentLocale = (userRecord?.locale ?? params?.locale ?? "en") as string;
  const currentTheme = (userRecord?.themeSlug ?? activeThemeId ?? "default") as string;
  const grid = stateFlags.grid_size as GridSize;
  const textSize = stateFlags.symbol_text_size as TextSize;
  const labelVisible = stateFlags.symbol_label_visible;

  // Voices for the instructor's current language only (the account stores a
  // default voice per language in users.voiceDefaults).
  const localeVoices = getLanguage(currentLocale)?.voices ?? [];
  const selectedVoiceId =
    userRecord?.voiceDefaults?.[currentLocale] ?? localeVoices[0]?.ttsVoiceId;

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

  // Changing the instructor UI language persists immediately + sets the
  // NEXT_LOCALE cookie; AppStateProvider's mismatch redirect swaps the URL
  // locale (which reloads the app in the new language). Guarded so it only
  // fires on a real change, never on initial render.
  const handleLanguage = async (code: string) => {
    if (code === currentLocale) return;
    await setMyLocale({ locale: code });
    document.cookie = `NEXT_LOCALE=${code};path=/;max-age=31536000;samesite=lax`;
    track("language_switched", { from: currentLocale, to: code });
  };

  const handleTheme = (slug: string, requiredTier: "free" | "pro" | "max") => {
    if (!canAccessThemeTier(subscription.tier, requiredTier)) {
      track("theme_locked_click", { slug, required_tier: requiredTier, tier: subscription.tier });
      setThemeNudgeOpen(true);
      return;
    }
    if (slug !== currentTheme) {
      track("theme_changed", { from_theme: currentTheme, to_theme: slug, tier: subscription.tier });
    }
    setInstructorTheme(slug); // applies CSS vars instantly + persists
  };

  const handleGrid = async (size: GridSize) => {
    await Promise.all([
      setMyGridSize({ gridSize: size }),
      setMyTextSize({ textSize: deriveTextSize(size) }),
    ]);
  };

  return (
    <div className="flex flex-col gap-theme-gap">
      <SettingsSection title={t("sectionLanguage")}>
        <LanguagePicker
          languages={visibleLanguages}
          value={currentLocale}
          onSelect={handleLanguage}
          previewLabel={t("preview")}
        />
      </SettingsSection>

      {localeVoices.length > 1 && (
        <SettingsSection title={t("sectionVoices")}>
          <div className="flex flex-wrap gap-theme-gap">
            {localeVoices.map((vc) => (
              <VoiceCard
                key={vc.id}
                title={vc.gender === "female" ? t("genderFemale") : t("genderMale")}
                subtitle={vc.region ?? vc.ttsVoiceId}
                selected={selectedVoiceId === vc.ttsVoiceId}
                onSelect={() => setMyVoiceDefault({ lang: currentLocale, voiceId: vc.ttsVoiceId })}
                onPreview={() => previewVoice(vc.ttsVoiceId)}
                previewLabel={t("voicePreview")}
              />
            ))}
          </div>
        </SettingsSection>
      )}

      <SettingsSection title={t("sectionTheme")}>
        <ThemePicker
          themes={themeCatalogue}
          value={currentTheme}
          onSelect={handleTheme}
          isLocked={(tier) => !canAccessThemeTier(subscription.tier, tier)}
          uiLocale={uiLocale}
        />
      </SettingsSection>

      <SettingsSection title={t("sectionGrid")}>
        <GridSizePicker
          value={grid}
          onChange={handleGrid}
          options={GRID_SIZES.map((size) => ({ size, label: t(SIZE_LABEL_KEY[size]) }))}
        />
      </SettingsSection>

      <SettingsSection title={t("sectionSymbols")}>
        <SymbolsControls
          labelVisible={labelVisible}
          onToggleLabel={(value) => setMyFlag({ flag: "symbol_label_visible", value })}
          displayTextLabel={t("displayTextLabel")}
          textSize={textSize}
          onTextSizeChange={(size) => setMyTextSize({ textSize: size })}
          textSizeLabel={t("textSize")}
          options={TEXT_SIZES.map((size) => ({ size, label: t(SIZE_LABEL_KEY[size]) }))}
        />
      </SettingsSection>

      <SettingsSection title={tNav("title")}>
        <NavbarControls
          minimal={stateFlags.navbar_minimal}
          onRight={stateFlags.navbar_on_right}
          onToggleMinimal={(value) => setMyFlag({ flag: "navbar_minimal", value })}
          onSetRight={(value) => setMyFlag({ flag: "navbar_on_right", value })}
        />
      </SettingsSection>

      <UpgradeNudge
        open={themeNudgeOpen}
        onOpenChange={setThemeNudgeOpen}
        feature="premiumThemes"
        locale={uiLocale}
      />
    </div>
  );
}
