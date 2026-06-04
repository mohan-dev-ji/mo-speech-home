"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { useProfile } from "@/app/contexts/ProfileContext";
import { useAppState } from "@/app/contexts/AppStateProvider";
import { type ThemeSlug } from "@/app/contexts/ThemeContext";
import { track } from "@/lib/analytics";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/app/components/app/shared/ui/Dialog";
import { Button } from "@/app/components/app/shared/ui/Button";
import { Input } from "@/app/components/app/shared/ui/Input";
import { HeaderModeControl } from "@/app/components/app/shared/ui/HeaderModeControl";
import { UpgradeNudge } from "@/app/components/app/shared/ui/UpgradeNudge";
import { useSubscription } from "@/hooks/useSubscription";
import { getLanguage } from "@/lib/languages/registry";
import { resolveVoiceId } from "@/lib/audio/resolveVoiceId";
import { ChevronDown, Volume2, Lock } from "lucide-react";

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

// ─── Permissions ─────────────────────────────────────────────────────────────
// Page permissions hide the nav link AND block the route in student-view.
// Editing permissions gate features inside pages; they do not affect routing.

const PAGE_PERMISSIONS = [
  { flag: "home_visible",       labelKey: "permHome",       defaultVal: true  },
  { flag: "search_visible",     labelKey: "permSearch",     defaultVal: true  },
  { flag: "categories_visible", labelKey: "permCategories", defaultVal: true  },
  { flag: "lists_visible",      labelKey: "permLists",      defaultVal: true  },
  { flag: "sentences_visible",  labelKey: "permSentences",    defaultVal: true  },
  { flag: "settings_visible",   labelKey: "permSettings",   defaultVal: false },
] as const;

// Always visible — surfaces in any header configuration.
const EDITING_PERMISSIONS = [
  { flag: "quick_settings_visible", labelKey: "permQuickSettings",  defaultVal: false },
] as const;

// Only revealed when the header is in banner mode (`header_in_banner_mode`
// is true). These three permissions all gate features that are accessible
// from the banner — editing affordances, the pack filter, and the
// student-view Model button. With banner off, none of them have anywhere
// to render, so they're hidden to reduce noise. Toggling banner mode on
// reveals them (with their stored values intact).
const BANNER_MODE_EDITING_PERMISSIONS = [
  { flag: "student_can_edit",   labelKey: "permAllowEditing",   defaultVal: false },
  { flag: "student_can_filter", labelKey: "permAllowFiltering", defaultVal: false },
  // Opt the student in to self-initiating modelling sessions from
  // student-view (independent AAC users). Default off — most students
  // participate passively in instructor-pushed sessions. Doesn't gate the
  // instructor's own Model button, which is Pro+ only.
  { flag: "modelling_push",     labelKey: "permAllowModelling", defaultVal: false },
] as const;

// ─── Profile tab content ──────────────────────────────────────────────────────

function ProfileTabContent({
  profile,
  isAppActive,
}: {
  profile: Doc<"studentProfiles">;
  isAppActive: boolean;
}) {
  const t = useTranslations("studentProfile");
  const { setActiveProfile, allProfiles } = useProfile();
  const { subscription, userRecord } = useAppState();
  const { canUseMultipleLanguages } = useSubscription();

  // Visible-language list — beta languages show with a "preview" pill.
  // Falls back to a hard-coded en/hi pair until the Convex query hydrates
  // so the modal renders correctly on first paint.
  const visibleLanguages = useQuery(api.languages.getVisibleLanguages, {
    includeBeta: true,
  });

  const updateProfile  = useMutation(api.studentProfiles.updateStudentProfile);
  const setFlag        = useMutation(api.studentProfiles.setStateFlag);
  const setGridMut     = useMutation(api.studentProfiles.setGridSize);
  const setTextSizeMut = useMutation(api.studentProfiles.setSymbolTextSize);
  const deleteProfile  = useMutation(api.studentProfiles.deleteStudentProfile);

  const [name,        setName]        = useState(profile.name);
  const [origName,    setOrigName]    = useState(profile.name);
  const [savingName,  setSavingName]  = useState(false);
  const [deleteOpen,  setDeleteOpen]  = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [error,       setError]       = useState("");
  const [langNudgeOpen, setLangNudgeOpen] = useState(false);

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
    // If the current voice override doesn't belong to the new language, clear
    // it so the student falls back to that language's account default / first
    // registry voice (resolveVoiceId guards this too, but clearing keeps the
    // stored value honest).
    const newVoices = getLanguage(lang)?.voices ?? [];
    const keepVoice =
      !!profile.voiceId && newVoices.some((vc) => vc.ttsVoiceId === profile.voiceId);
    updateProfile({
      profileId: profile._id,
      language: lang,
      ...(keepVoice ? {} : { voiceId: null }),
    });
    // Student-profile language is conceptually distinct from instructor UI
    // locale, but for V1 we use the same event name — PostHog can be filtered
    // by URL / source if we ever need to split the two streams.
    track("language_switched", { from: currentLang, to: lang });
  };

  // ── Voice ──
  // Voices come from the language registry for the profile's current language.
  // Selection is always explicit; the *resolved* voice (override → account
  // default → first registry voice) is shown pre-selected so one tile is always
  // active even before the instructor picks.
  const voices = getLanguage(currentLang)?.voices ?? [];
  const selectedVoiceId = resolveVoiceId({
    studentVoiceId: profile.voiceId,
    voiceDefaults: userRecord?.voiceDefaults,
    lang: currentLang,
  });
  const handleVoiceChange = (voiceId: string) => {
    updateProfile({ profileId: profile._id, voiceId });
  };
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

  const currentThemeSlug = ((profile as any).themeSlug ?? "default") as ThemeSlug;
  const handleThemeChange = (slug: ThemeSlug) => {
    if (slug === currentThemeSlug) return; // no-op when re-clicking the active swatch
    updateProfile({ profileId: profile._id, themeSlug: slug });
    track("theme_changed", {
      from_theme: currentThemeSlug,
      to_theme: slug,
      tier: subscription.tier,
    });
  };

  // ── Grid ──

  const currentGrid = (flags.grid_size as GridSize | undefined) ?? "large";
  const handleGridChange = (size: GridSize) => {
    const derived: TextSize = size === "large" ? "medium" : size === "medium" ? "small" : "xs";
    setGridMut({ profileId: profile._id, gridSize: size });
    setTextSizeMut({ profileId: profile._id, textSize: derived });
  };

  // ── Symbols ──

  const labelVisible = flags.symbol_label_visible !== undefined ? !!flags.symbol_label_visible : true;
  const currentTextSize = (flags.symbol_text_size as TextSize | undefined) ?? "small";

  const handleLabelToggle = () => {
    setFlag({ profileId: profile._id, flag: "symbol_label_visible", value: !labelVisible });
  };

  const handleTextSizeChange = (size: TextSize) => {
    setTextSizeMut({ profileId: profile._id, textSize: size });
  };

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

  return (
    <div className="space-y-5 pt-3 pb-1">

      {/* Active / switch */}
      {isAppActive ? (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success shrink-0" />
          <span className="text-caption text-muted-foreground">{t("activeLabel")}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-border shrink-0" />
          <span className="text-caption text-muted-foreground flex-1">{t("notActiveLabel")}</span>
          <Button size="sm" onClick={() => setActiveProfile(profile._id as Id<"studentProfiles">)}>
            {t("switchButton")}
          </Button>
        </div>
      )}

      {/* Name */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            label={t("profileNameLabel")}
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

      {/* Language */}
      <div>
        <p className="text-small font-semibold text-foreground mb-2">{t("sectionLanguage")}</p>
        {canUseMultipleLanguages ? (
          /* Pro/Max: full per-profile picker (beta languages get a preview pill). */
          <div className="flex flex-wrap gap-2">
            {(visibleLanguages ??
              [
                { code: "en", nativeLabel: "English", status: "stable" as const },
                { code: "hi", nativeLabel: "हिन्दी", status: "stable" as const },
              ]
            ).map(({ code, nativeLabel, status }) => (
              <button
                key={code}
                type="button"
                onClick={() => handleLangChange(code)}
                className={`flex-1 min-w-[6rem] py-2 rounded-md text-small font-medium border transition-colors inline-flex items-center justify-center gap-1.5 ${
                  currentLang === code
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {nativeLabel}
                {status === "beta" && (
                  <span className="inline-flex items-center rounded-full bg-warning/20 text-warning text-caption px-1.5 py-0">
                    preview
                  </span>
                )}
              </button>
            ))}
          </div>
        ) : (
          /* Free: the student inherits the account language; the picker is a
             locked upgrade affordance (ADR-011 §3). */
          <button
            type="button"
            onClick={() => setLangNudgeOpen(true)}
            className="w-full flex items-center justify-between gap-2 py-2 px-3 rounded-md border border-border bg-background text-small text-muted-foreground hover:bg-muted transition-colors"
          >
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0" />
              {t("languageInheritedNote", {
                language: getLanguage(currentLang)?.nativeLabel ?? currentLang,
              })}
            </span>
            <span className="text-caption font-medium text-primary shrink-0">
              {t("languageUpgradeCta")}
            </span>
          </button>
        )}
      </div>

      {/* Voices — only shown when the current language offers a choice */}
      {voices.length > 1 && (
        <div>
          <p className="text-small font-semibold text-foreground mb-2">{t("sectionVoices")}</p>
          <div className="flex flex-wrap gap-2">
            {voices.map((vc) => {
              const selected = selectedVoiceId === vc.ttsVoiceId;
              return (
                <div key={vc.id} className="relative">
                  <button
                    type="button"
                    onClick={() => handleVoiceChange(vc.ttsVoiceId)}
                    className={`w-28 h-28 flex flex-col items-center justify-center gap-1 px-2 rounded-md border text-center transition-colors ${
                      selected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <span className="text-small font-semibold">
                      {vc.gender === "female" ? t("genderFemale") : t("genderMale")}
                    </span>
                    <span className="text-[0.65rem] font-mono opacity-80 break-all leading-tight">{vc.ttsVoiceId}</span>
                    <span className="text-caption opacity-70 leading-tight">{vc.region}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => previewVoice(vc.ttsVoiceId)}
                    aria-label={t("voicePreview")}
                    className="absolute top-1 right-1 p-1.5 rounded-md border border-border bg-background text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <Volume2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Theme */}
      <div>
        <p className="text-small font-semibold text-foreground mb-2">{t("sectionTheme")}</p>
        <div className="flex flex-wrap gap-2">
          {THEME_SWATCHES.map(({ slug, swatch, name: themeName }) => (
            <button
              key={slug}
              type="button"
              onClick={() => handleThemeChange(slug)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-small font-medium border transition-colors ${
                currentThemeSlug === slug
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: swatch }} />
              {themeName}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div>
        <p className="text-small font-semibold text-foreground mb-2">{t("sectionGrid")}</p>
        <div className="flex gap-2">
          {(["large", "medium", "small"] as GridSize[]).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => handleGridChange(size)}
              className={`flex-1 py-2 rounded-md text-small font-medium border transition-colors capitalize ${
                currentGrid === size
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Symbols */}
      <div className="space-y-2">
        <p className="text-small font-semibold text-foreground">{t("sectionSymbols")}</p>
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={labelVisible}
            onChange={handleLabelToggle}
            className="w-4 h-4 rounded accent-primary cursor-pointer"
          />
          <span className="text-small text-foreground">Show text label</span>
        </label>
        <div className={`flex gap-2 ${!labelVisible ? "opacity-40 pointer-events-none" : ""}`}>
          {(["large", "medium", "small"] as TextSize[]).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => handleTextSizeChange(size)}
              className={`flex-1 py-2 rounded-md text-small font-medium border transition-colors capitalize ${
                currentTextSize === size
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {size}
            </button>
          ))}
        </div>
      </div>

      {/* Top bar — sits above Header so the layout reads top → bottom of
          the actual student-view chrome. Contains permissions that live in
          the top bar (Quick Settings dropdown) regardless of banner/talker. */}
      <div className="space-y-2">
        <p className="text-small font-semibold text-foreground">
          {t("sectionTopBar")}
        </p>
        <div className="flex flex-wrap gap-2">
          {EDITING_PERMISSIONS.map(({ flag, labelKey, defaultVal }) => {
            const value = flags[flag] !== undefined ? !!flags[flag] : defaultVal;
            return (
              <button
                key={flag}
                type="button"
                onClick={() => handleToggleFlag(flag, value)}
                className={`px-3 py-1.5 rounded-md text-small font-medium border transition-colors ${
                  value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {t(labelKey as Parameters<typeof t>[0])}
              </button>
            );
          })}
        </div>
      </div>

      {/* Header (talker/banner) + banner-mode permissions.
          The three banner-only toggles (Allow Editing, Allow Filtering by
          Pack, Allow Modelling) sit directly under the Talker | Banner
          chooser so the relationship is obvious: turn banner on, the row
          appears beneath it. */}
      <div className="space-y-2">
        <HeaderModeControl
          headerOn={flags.talker_visible !== undefined ? !!flags.talker_visible : true}
          inBannerMode={!!flags.header_in_banner_mode}
          onToggleHeader={(next) => setFlag({ profileId: profile._id, flag: "talker_visible", value: next })}
          onSetBannerMode={(next) => setFlag({ profileId: profile._id, flag: "header_in_banner_mode", value: next })}
        />

        {!!flags.header_in_banner_mode && (
          <div className="flex flex-wrap gap-2 pt-1">
            {BANNER_MODE_EDITING_PERMISSIONS.map(({ flag, labelKey, defaultVal }) => {
              const value = flags[flag] !== undefined ? !!flags[flag] : defaultVal;
              return (
                <button
                  key={flag}
                  type="button"
                  onClick={() => handleToggleFlag(flag, value)}
                  className={`px-3 py-1.5 rounded-md text-small font-medium border transition-colors ${
                    value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {t(labelKey as Parameters<typeof t>[0])}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Permissions — page-access only. Feature-level (editing) toggles
          now live inside their related sections above (Top bar, Header). */}
      <div>
        <p className="text-small font-semibold text-foreground mb-3">
          {t("permissionsHeading")}
        </p>
        <div className="flex flex-wrap gap-2">
          {PAGE_PERMISSIONS.map(({ flag, labelKey, defaultVal }) => {
            const value = flags[flag] !== undefined ? !!flags[flag] : defaultVal;
            return (
              <button
                key={flag}
                type="button"
                onClick={() => handleToggleFlag(flag, value)}
                className={`px-3 py-1.5 rounded-md text-small font-medium border transition-colors ${
                  value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                }`}
              >
                {t(labelKey as Parameters<typeof t>[0])}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-small text-destructive">{error}</p>}

      {/* Delete */}
      {canDelete && (
        <div>
          <button
            type="button"
            onClick={() => setDeleteOpen(!deleteOpen)}
            className="flex items-center gap-1 text-small text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("deleteDropdownLabel")}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${deleteOpen ? "rotate-180" : ""}`} />
          </button>
          {deleteOpen && (
            <div className="mt-2 space-y-2">
              <p className="text-small text-destructive">{t("deleteWarning")}</p>
              <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
                {t("deleteConfirmButton")}
              </Button>
            </div>
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
        </div>
      )}

      <UpgradeNudge
        open={langNudgeOpen}
        onOpenChange={setLangNudgeOpen}
        feature="multiLanguage"
        locale={currentLang}
      />
    </div>
  );
}

// ─── ProfileModal ─────────────────────────────────────────────────────────────

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("studentProfile");
  const { allProfiles, activeProfileId } = useProfile();
  const { userRecord } = useAppState();
  const createProfile = useMutation(api.studentProfiles.createStudentProfile);
  // New profiles inherit the account's current language so a Free (monolingual)
  // account never trips the language gate by creating an off-language profile.
  const accountLang = userRecord?.locale ?? "en";

  const [selectedId,  setSelectedId]  = useState<string>(activeProfileId ?? allProfiles[0]?._id ?? "");
  const [newName,     setNewName]     = useState("");
  const [creating,    setCreating]    = useState(false);
  const [createError, setCreateError] = useState("");

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    setCreateError("");
    try {
      const id = await createProfile({ name: trimmed, language: accountLang });
      setNewName("");
      setSelectedId(id);
    } catch {
      setCreateError(t("errorGeneric"));
    } finally {
      setCreating(false);
    }
  };

  const selectedProfile = allProfiles.find((p) => p._id === selectedId) ?? allProfiles[0];

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
      </DialogHeader>

      {/* Create new profile */}
      <div className="flex gap-2">
        <input
          className="flex-1 px-3 py-2 text-small bg-background border border-border rounded-md
                     focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary
                     text-foreground placeholder:text-muted-foreground"
          placeholder={t("newProfilePlaceholder")}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
        />
        <Button size="sm" loading={creating} disabled={!newName.trim()} onClick={handleCreate}>
          {t("createButton")}
        </Button>
      </div>
      {createError && <p className="text-small text-destructive">{createError}</p>}

      {/* Tabs */}
      {allProfiles.length > 0 && (
        <>
          <div className="flex border-b border-border -mx-6 px-6 overflow-x-auto">
            {allProfiles.map((profile) => {
              const isSelected = profile._id === selectedId;
              const isActive   = profile._id === activeProfileId;
              return (
                <button
                  key={profile._id}
                  type="button"
                  onClick={() => setSelectedId(profile._id)}
                  className={`relative shrink-0 px-4 py-2.5 text-small font-medium whitespace-nowrap transition-colors ${
                    isSelected
                      ? "text-primary border-b-2 border-primary -mb-px"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {profile.name}
                  {isActive && (
                    <span className="absolute top-2 right-1.5 w-1.5 h-1.5 rounded-full bg-success" />
                  )}
                </button>
              );
            })}
          </div>

          {selectedProfile && (
            <div className="overflow-y-auto max-h-[55vh]">
              <ProfileTabContent
                key={selectedProfile._id}
                profile={selectedProfile}
                isAppActive={selectedProfile._id === activeProfileId}
              />
            </div>
          )}
        </>
      )}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" onClick={onClose}>{t("cancelButton")}</Button>
        </DialogClose>
        <Button onClick={onClose}>{t("confirmButton")}</Button>
      </DialogFooter>
    </>
  );
}
