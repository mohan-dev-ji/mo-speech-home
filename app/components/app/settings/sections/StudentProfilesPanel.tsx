"use client";

import { useState, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { useProfile } from "@/app/contexts/ProfileContext";
import { useAppState } from "@/app/contexts/AppStateProvider";
import { useSubscription } from "@/hooks/useSubscription";
import { canAccessThemeTier } from "@/lib/themes/registry";
import { track } from "@/lib/analytics";
import { getLanguage } from "@/lib/languages/registry";
import { resolveVoiceId } from "@/lib/audio/resolveVoiceId";
import { Button } from "@/app/components/app/shared/ui/Button";
import { Input } from "@/app/components/app/shared/ui/Input";
import { HeaderModeControl } from "@/app/components/app/shared/ui/HeaderModeControl";
import { UpgradeNudge } from "@/app/components/app/shared/ui/UpgradeNudge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/app/components/app/shared/ui/Dialog";
import { SettingsSection } from "@/app/components/app/settings/ui/SettingsSection";
import { TabBar } from "@/app/components/app/settings/ui/TabBar";
import { LanguagePicker } from "@/app/components/app/settings/ui/LanguagePicker";
import { VoiceCard } from "@/app/components/app/settings/ui/VoiceCard";
import { ThemePicker } from "@/app/components/app/settings/ui/ThemePicker";
import { GridSizePicker, type GridSize } from "@/app/components/app/settings/ui/GridSizePicker";
import { SymbolsControls, type TextSize } from "@/app/components/app/settings/ui/SymbolsControls";
import { NavbarControls } from "@/app/components/app/settings/ui/NavbarControls";
import { ChevronDown, Lock, Plus } from "lucide-react";

const GRID_SIZES: GridSize[] = ["large", "medium", "small"];
const TEXT_SIZES: Exclude<TextSize, "xs">[] = ["large", "medium", "small"];
const SIZE_LABEL_KEY: Record<string, string> = { large: "sizeLarge", medium: "sizeMedium", small: "sizeSmall" };

function deriveTextSize(grid: GridSize): TextSize {
  return grid === "large" ? "medium" : grid === "medium" ? "small" : "xs";
}

const PAGE_PERMISSIONS = [
  { flag: "home_visible", labelKey: "permHome", defaultVal: true },
  { flag: "search_visible", labelKey: "permSearch", defaultVal: true },
  { flag: "categories_visible", labelKey: "permCategories", defaultVal: true },
  { flag: "lists_visible", labelKey: "permLists", defaultVal: true },
  { flag: "sentences_visible", labelKey: "permSentences", defaultVal: true },
  { flag: "settings_visible", labelKey: "permSettings", defaultVal: false },
] as const;

const EDITING_PERMISSIONS = [
  { flag: "quick_settings_visible", labelKey: "permQuickSettings", defaultVal: false },
] as const;

const BANNER_MODE_EDITING_PERMISSIONS = [
  { flag: "student_can_edit", labelKey: "permAllowEditing", defaultVal: false },
  { flag: "student_can_filter", labelKey: "permAllowFiltering", defaultVal: false },
  { flag: "modelling_push", labelKey: "permAllowModelling", defaultVal: false },
] as const;

/**
 * A permission/flag toggle pill, styled like the Figma button variant: on =
 * `--theme-primary` bg + `button-primary` text; off = `button-primary` bg +
 * `button-secondary` text at 50% opacity (sunk into the bg), rising to 100% on
 * hover. Kept local rather than reusing `Button variant="toggle"` (whose active
 * state is the pale `button-highlight` token, shared with `ToggleButton` app-wide).
 */
function TogglePill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-theme-button border px-theme-btn-x py-theme-btn-y text-theme-s font-medium transition ${
        active
          ? "border-transparent bg-theme-primary text-theme-button-primary"
          : "border-theme-line bg-theme-button-primary text-theme-button-secondary opacity-50 hover:opacity-100"
      }`}
    >
      {children}
    </button>
  );
}

// ─── Per-profile form ─────────────────────────────────────────────────────────

function StudentProfileForm({
  profile,
  isAppActive,
}: {
  profile: Doc<"studentProfiles">;
  isAppActive: boolean;
}) {
  const t = useTranslations("studentProfile");
  const tNav = useTranslations("navbar");
  const uiLocale = useLocale();
  const { setActiveProfile, allProfiles } = useProfile();
  const { subscription, userRecord } = useAppState();
  const { canUseMultipleLanguages } = useSubscription();

  const visibleLanguages = useQuery(api.languages.getVisibleLanguages, { includeBeta: true });
  const themeCatalogue = useQuery(api.themes.getPublicThemeCatalogue) ?? [];

  const updateProfile = useMutation(api.studentProfiles.updateStudentProfile);
  const setFlag = useMutation(api.studentProfiles.setStateFlag);
  const setGridMut = useMutation(api.studentProfiles.setGridSize);
  const setTextSizeMut = useMutation(api.studentProfiles.setSymbolTextSize);
  const deleteProfile = useMutation(api.studentProfiles.deleteStudentProfile);

  const [name, setName] = useState(profile.name);
  const [origName, setOrigName] = useState(profile.name);
  const [savingName, setSavingName] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [langNudgeOpen, setLangNudgeOpen] = useState(false);
  const [themeNudgeOpen, setThemeNudgeOpen] = useState(false);

  const flags = profile.stateFlags as Record<string, boolean | string | undefined>;
  const canDelete = allProfiles.length > 1;

  // ── Name ──
  const handleSaveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === origName) return;
    setSavingName(true);
    setError("");
    try {
      await updateProfile({ profileId: profile._id, name: trimmed });
      setOrigName(trimmed);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setSavingName(false);
    }
  };

  // ── Language ──
  const currentLang = profile.language ?? "en";
  const handleLangChange = (lang: string) => {
    if (lang === currentLang) return;
    const newVoices = getLanguage(lang)?.voices ?? [];
    const keepVoice = !!profile.voiceId && newVoices.some((vc) => vc.ttsVoiceId === profile.voiceId);
    updateProfile({
      profileId: profile._id,
      language: lang,
      ...(keepVoice ? {} : { voiceId: null }),
    });
    track("language_switched", { from: currentLang, to: lang });
  };

  // ── Voice ──
  const voices = getLanguage(currentLang)?.voices ?? [];
  const selectedVoiceId = resolveVoiceId({
    studentVoiceId: profile.voiceId,
    voiceDefaults: userRecord?.voiceDefaults,
    lang: currentLang,
  });
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

  // ── Theme ──
  const currentThemeSlug = (profile.themeSlug ?? "default") as string;
  const handleThemeChange = (slug: string, requiredTier: "free" | "pro" | "max") => {
    if (!canAccessThemeTier(subscription.tier, requiredTier)) {
      track("theme_locked_click", { slug, required_tier: requiredTier, tier: subscription.tier });
      setThemeNudgeOpen(true);
      return;
    }
    if (slug === currentThemeSlug) return;
    updateProfile({ profileId: profile._id, themeSlug: slug });
    track("theme_changed", { from_theme: currentThemeSlug, to_theme: slug, tier: subscription.tier });
  };

  // ── Grid ──
  const currentGrid = (flags.grid_size as GridSize | undefined) ?? "large";
  const handleGridChange = (size: GridSize) => {
    setGridMut({ profileId: profile._id, gridSize: size });
    setTextSizeMut({ profileId: profile._id, textSize: deriveTextSize(size) });
  };

  // ── Symbols ──
  const labelVisible = flags.symbol_label_visible !== undefined ? !!flags.symbol_label_visible : true;
  const currentTextSize = (flags.symbol_text_size as TextSize | undefined) ?? "small";

  // ── Permissions ──
  const handleToggleFlag = (flag: string, currentVal: boolean) => {
    setFlag({ profileId: profile._id, flag, value: !currentVal });
  };

  // ── Delete ──
  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProfile({ profileId: profile._id });
    } catch {
      setError(t("errorGeneric"));
      setDeleting(false);
      setConfirmOpen(false);
      setDeleteOpen(false);
    }
  };

  const languageOptions = visibleLanguages ?? [
    { code: "en", nativeLabel: "English", status: "stable" as const },
    { code: "hi", nativeLabel: "हिन्दी", status: "stable" as const },
  ];

  return (
    <div className="flex flex-col gap-theme-gap">
      {/* Active / switch */}
      <div className="flex items-center gap-theme-elements">
        <span className={`size-2 shrink-0 rounded-full ${isAppActive ? "bg-theme-success" : "bg-theme-line"}`} />
        <span className="flex-1 text-theme-s text-theme-secondary-alt-text">
          {isAppActive ? t("activeLabel") : t("notActiveLabel")}
        </span>
        {!isAppActive && (
          <Button size="sm" onClick={() => setActiveProfile(profile._id as Id<"studentProfiles">)}>
            {t("switchButton")}
          </Button>
        )}
      </div>

      {/* Name */}
      <SettingsSection title={t("profileNameLabel")}>
        <div className="flex items-end gap-theme-elements">
          <div className="flex-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => { if (e.key === "Enter") handleSaveName(); }}
            />
          </div>
          {name.trim() !== origName && (
            <Button size="sm" onClick={handleSaveName} loading={savingName}>
              {t("saveNameButton")}
            </Button>
          )}
        </div>
      </SettingsSection>

      {/* Language */}
      <SettingsSection title={t("sectionLanguage")}>
        {canUseMultipleLanguages ? (
          <LanguagePicker
            languages={languageOptions}
            value={currentLang}
            onSelect={handleLangChange}
            previewLabel={t("preview")}
          />
        ) : (
          <button
            type="button"
            onClick={() => setLangNudgeOpen(true)}
            className="flex w-full items-center justify-between gap-theme-elements rounded-theme-button border border-theme-line bg-theme-button-primary px-theme-btn-x py-theme-btn-y text-theme-p text-theme-button-secondary transition-opacity hover:opacity-90"
          >
            <span className="inline-flex items-center gap-1.5">
              <Lock className="size-3.5 shrink-0" />
              {t("languageInheritedNote", {
                language: getLanguage(currentLang)?.nativeLabel ?? currentLang,
              })}
            </span>
            <span className="shrink-0 text-theme-s font-medium text-theme-primary">
              {t("languageUpgradeCta")}
            </span>
          </button>
        )}
      </SettingsSection>

      {/* Voices */}
      {voices.length > 1 && (
        <SettingsSection title={t("sectionVoices")}>
          <div className="flex flex-wrap gap-theme-gap">
            {voices.map((vc) => (
              <VoiceCard
                key={vc.id}
                title={vc.gender === "female" ? t("genderFemale") : t("genderMale")}
                subtitle={vc.region ?? vc.ttsVoiceId}
                selected={selectedVoiceId === vc.ttsVoiceId}
                onSelect={() => updateProfile({ profileId: profile._id, voiceId: vc.ttsVoiceId })}
                onPreview={() => previewVoice(vc.ttsVoiceId)}
                previewLabel={t("voicePreview")}
              />
            ))}
          </div>
        </SettingsSection>
      )}

      {/* Theme */}
      <SettingsSection title={t("sectionTheme")}>
        <ThemePicker
          themes={themeCatalogue}
          value={currentThemeSlug}
          onSelect={handleThemeChange}
          isLocked={(tier) => !canAccessThemeTier(subscription.tier, tier)}
          uiLocale={uiLocale}
        />
      </SettingsSection>

      {/* Grid */}
      <SettingsSection title={t("sectionGrid")}>
        <GridSizePicker
          value={currentGrid}
          onChange={handleGridChange}
          options={GRID_SIZES.map((size) => ({ size, label: t(SIZE_LABEL_KEY[size]) }))}
        />
      </SettingsSection>

      {/* Symbols */}
      <SettingsSection title={t("sectionSymbols")}>
        <SymbolsControls
          labelVisible={labelVisible}
          onToggleLabel={(value) => setFlag({ profileId: profile._id, flag: "symbol_label_visible", value })}
          displayTextLabel={t("displayTextLabel")}
          textSize={currentTextSize}
          onTextSizeChange={(size) => setTextSizeMut({ profileId: profile._id, textSize: size })}
          textSizeLabel={t("textSize")}
          options={TEXT_SIZES.map((size) => ({ size, label: t(SIZE_LABEL_KEY[size]) }))}
        />
      </SettingsSection>

      {/* Navigation sidebar — per-student handedness + minimal rail */}
      <SettingsSection title={tNav("title")}>
        <NavbarControls
          minimal={!!flags.navbar_minimal}
          onRight={!!flags.navbar_on_right}
          onToggleMinimal={(value) => setFlag({ profileId: profile._id, flag: "navbar_minimal", value })}
          onSetRight={(value) => setFlag({ profileId: profile._id, flag: "navbar_on_right", value })}
        />
      </SettingsSection>

      {/* Top bar permissions */}
      <SettingsSection title={t("sectionTopBar")}>
        <div className="flex flex-wrap gap-theme-elements">
          {EDITING_PERMISSIONS.map(({ flag, labelKey, defaultVal }) => {
            const value = flags[flag] !== undefined ? !!flags[flag] : defaultVal;
            return (
              <TogglePill
                key={flag}
                active={value}
                onClick={() => handleToggleFlag(flag, value)}
              >
                {t(labelKey as Parameters<typeof t>[0])}
              </TogglePill>
            );
          })}
        </div>
      </SettingsSection>

      {/* Header (talker/banner) + banner-mode permissions */}
      <SettingsSection title={t("sectionHeader")}>
        <HeaderModeControl
          headerOn={flags.talker_visible !== undefined ? !!flags.talker_visible : true}
          inBannerMode={!!flags.header_in_banner_mode}
          onToggleHeader={(next) => setFlag({ profileId: profile._id, flag: "talker_visible", value: next })}
          onSetBannerMode={(next) => setFlag({ profileId: profile._id, flag: "header_in_banner_mode", value: next })}
        />
        {!!flags.header_in_banner_mode && (
          <div className="flex flex-wrap gap-theme-elements">
            {BANNER_MODE_EDITING_PERMISSIONS.map(({ flag, labelKey, defaultVal }) => {
              const value = flags[flag] !== undefined ? !!flags[flag] : defaultVal;
              return (
                <TogglePill
                  key={flag}
                  active={value}
                  onClick={() => handleToggleFlag(flag, value)}
                >
                  {t(labelKey as Parameters<typeof t>[0])}
                </TogglePill>
              );
            })}
          </div>
        )}
      </SettingsSection>

      {/* Page permissions */}
      <SettingsSection title={t("permissionsHeading")}>
        <div className="flex flex-wrap gap-theme-elements">
          {PAGE_PERMISSIONS.map(({ flag, labelKey, defaultVal }) => {
            const value = flags[flag] !== undefined ? !!flags[flag] : defaultVal;
            return (
              <TogglePill
                key={flag}
                active={value}
                onClick={() => handleToggleFlag(flag, value)}
              >
                {t(labelKey as Parameters<typeof t>[0])}
              </TogglePill>
            );
          })}
        </div>
      </SettingsSection>

      {error && <p className="text-theme-s text-theme-warning">{error}</p>}

      {/* Delete profile (danger zone) */}
      {canDelete && (
        <SettingsSection title={t("deleteDropdownLabel")}>
          <button
            type="button"
            onClick={() => setDeleteOpen(!deleteOpen)}
            className="flex items-center gap-1 text-theme-s text-theme-secondary-alt-text transition-colors hover:text-theme-alt-text"
          >
            {t("deleteWarning")}
            <ChevronDown className={`size-3.5 transition-transform ${deleteOpen ? "rotate-180" : ""}`} />
          </button>
          {deleteOpen && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
              {t("deleteConfirmButton")}
            </Button>
          )}

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("deleteModalTitle", { name: profile.name })}</DialogTitle>
                <DialogDescription>{t("deleteModalBody")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="secondary" disabled={deleting}>{t("cancelButton")}</Button>
                </DialogClose>
                <Button variant="destructive" loading={deleting} onClick={handleDelete}>
                  {t("deleteConfirmButton")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </SettingsSection>
      )}

      <UpgradeNudge open={langNudgeOpen} onOpenChange={setLangNudgeOpen} feature="multiLanguage" locale={currentLang} />
      <UpgradeNudge open={themeNudgeOpen} onOpenChange={setThemeNudgeOpen} feature="premiumThemes" locale={uiLocale} />
    </div>
  );
}

// ─── Student Profiles tab ─────────────────────────────────────────────────────

/**
 * Student Profiles tab — ports `ProfileModal` + `ProfileTabContent` into the
 * tabbed page: a secondary student-selector TabBar + Create-new-profile button,
 * then the selected profile's auto-saving section-cards. All settings write the
 * `studentProfiles` table (per-student scope).
 */
export function StudentProfilesPanel() {
  const t = useTranslations("studentProfile");
  const { allProfiles, activeProfileId } = useProfile();
  const { userRecord } = useAppState();
  const createProfile = useMutation(api.studentProfiles.createStudentProfile);
  const accountLang = userRecord?.locale ?? "en";

  const [selectedId, setSelectedId] = useState<string>(activeProfileId ?? allProfiles[0]?._id ?? "");
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    setCreateError("");
    try {
      const id = await createProfile({ name: trimmed, language: accountLang });
      setNewName("");
      setShowCreate(false);
      setSelectedId(id);
    } catch {
      setCreateError(t("errorGeneric"));
    } finally {
      setCreating(false);
    }
  };

  const selectedProfile = allProfiles.find((p) => p._id === selectedId) ?? allProfiles[0];

  return (
    <div className="flex flex-col gap-theme-gap">
      {/* Secondary selector — one tab per student profile */}
      {allProfiles.length > 0 && (
        <TabBar
          tabs={allProfiles.map((p) => ({ id: p._id, label: p.name }))}
          activeId={selectedProfile?._id ?? ""}
          onSelect={setSelectedId}
        />
      )}

      {/* Create new profile */}
      <div className="flex flex-col gap-theme-elements">
        {showCreate ? (
          <div className="flex items-end gap-theme-elements">
            <div className="flex-1">
              <Input
                placeholder={t("newProfilePlaceholder")}
                value={newName}
                autoFocus
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
              />
            </div>
            <Button size="sm" loading={creating} disabled={!newName.trim()} onClick={handleCreate}>
              {t("createButton")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { setShowCreate(false); setNewName(""); }}>
              {t("cancelButton")}
            </Button>
          </div>
        ) : (
          <Button variant="primary" className="self-start" icon={<Plus className="size-4" />} onClick={() => setShowCreate(true)}>
            {t("createButton")}
          </Button>
        )}
        {createError && <p className="text-theme-s text-theme-warning">{createError}</p>}
      </div>

      {selectedProfile && (
        <StudentProfileForm
          key={selectedProfile._id}
          profile={selectedProfile}
          isAppActive={selectedProfile._id === activeProfileId}
        />
      )}
    </div>
  );
}
