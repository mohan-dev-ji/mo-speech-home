"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { useProfile } from "@/app/contexts/ProfileContext";
import { type ThemeSlug } from "@/app/contexts/ThemeContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from "@/app/components/shared/ui/Dialog";
import { Button } from "@/app/components/shared/ui/Button";
import { Input } from "@/app/components/shared/ui/Input";
import { HeaderModeControl } from "@/app/components/app/shared/HeaderModeControl";
import { ChevronDown } from "lucide-react";

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

const EDITING_PERMISSIONS = [
  { flag: "quick_settings_visible", labelKey: "permQuickSettings", defaultVal: false },
  { flag: "student_can_edit",       labelKey: "permAllowEditing",  defaultVal: false },
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

  const currentLang = profile.language ?? "eng";
  const handleLangChange = (lang: string) => {
    updateProfile({ profileId: profile._id, language: lang });
  };

  // ── Theme ──

  const currentThemeSlug = ((profile as any).themeSlug ?? "default") as ThemeSlug;
  const handleThemeChange = (slug: ThemeSlug) => {
    updateProfile({ profileId: profile._id, themeSlug: slug });
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
        <div className="flex gap-2">
          {[
            { code: "eng", label: "English" },
            { code: "hin", label: "हिंदी"   },
          ].map(({ code, label }) => (
            <button
              key={code}
              type="button"
              onClick={() => handleLangChange(code)}
              className={`flex-1 py-2 rounded-md text-small font-medium border transition-colors ${
                currentLang === code
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

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

      {/* Header (talker/banner) */}
      <HeaderModeControl
        headerOn={flags.talker_visible !== undefined ? !!flags.talker_visible : true}
        inBannerMode={!!flags.header_in_banner_mode}
        onToggleHeader={(next) => setFlag({ profileId: profile._id, flag: "talker_visible", value: next })}
        onSetBannerMode={(next) => setFlag({ profileId: profile._id, flag: "header_in_banner_mode", value: next })}
      />

      {/* Permissions */}
      <div>
        <p className="text-small font-semibold text-foreground mb-3">
          {t("permissionsHeading")}
        </p>

        {/* Page access — hides nav link and blocks route in student-view */}
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

        {/* Divider between page-access and editing permissions */}
        <hr className="border-border my-3" />

        {/* Editing permissions — feature-level toggles inside pages */}
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
    </div>
  );
}

// ─── ProfileModal ─────────────────────────────────────────────────────────────

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("studentProfile");
  const { allProfiles, activeProfileId } = useProfile();
  const createProfile = useMutation(api.studentProfiles.createStudentProfile);

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
      const id = await createProfile({ name: trimmed, language: "eng" });
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
