"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id, Doc } from "@/convex/_generated/dataModel";
import { useProfile } from "@/app/contexts/ProfileContext";
import {
  DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/app/components/shared/ui/Dialog";
import { Button } from "@/app/components/shared/ui/Button";
import { Input } from "@/app/components/shared/ui/Input";
import { ChevronDown } from "lucide-react";

// ─── Permission config ────────────────────────────────────────────────────────

type PermissionFlag = {
  flag: string;
  labelKey: keyof ReturnType<ReturnType<typeof useTranslations>>;
  default: boolean;
};

const PERMISSIONS = [
  { flag: "categories_visible", labelKey: "permBoards",       defaultVal: true  },
  { flag: "lists_visible",      labelKey: "permLists",        defaultVal: true  },
  { flag: "sentences_visible",  labelKey: "permSentences",    defaultVal: true  },
  { flag: "first_thens_visible",labelKey: "permFirstThens",   defaultVal: true  },
  { flag: "search_visible",     labelKey: "permSearch",       defaultVal: true  },
  { flag: "settings_visible",   labelKey: "permSettings",     defaultVal: false },
  { flag: "student_can_edit",   labelKey: "permAllowEditing", defaultVal: false },
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
  const deleteProfile  = useMutation(api.studentProfiles.deleteStudentProfile);

  const [name,        setName]        = useState(profile.name);
  const [origName,    setOrigName]    = useState(profile.name);
  const [savingName,  setSavingName]  = useState(false);
  const [deleteOpen,  setDeleteOpen]  = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [error,       setError]       = useState("");

  const flags = profile.stateFlags as Record<string, boolean | string | undefined>;
  const canDelete = allProfiles.length > 1;

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

  const handleToggleFlag = (flag: string, currentVal: boolean) => {
    setFlag({ profileId: profile._id, flag, value: !currentVal });
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteProfile({ profileId: profile._id });
    } catch {
      setError(t("errorGeneric"));
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="space-y-5 pt-3 pb-1">

      {/* Active / switch indicator */}
      {isAppActive ? (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-success shrink-0" />
          <span className="text-caption text-muted-foreground">{t("activeLabel")}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-border shrink-0" />
          <span className="text-caption text-muted-foreground flex-1">{t("notActiveLabel")}</span>
          <Button
            size="sm"
            onClick={() => setActiveProfile(profile._id as Id<"studentProfiles">)}
          >
            {t("switchButton")}
          </Button>
        </div>
      )}

      {/* Profile name */}
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

      {/* Permission toggles */}
      <div>
        <p className="text-small font-semibold text-foreground mb-3">
          {t("permissionsHeading")}
        </p>
        <div className="flex flex-wrap gap-2">
          {PERMISSIONS.map(({ flag, labelKey, defaultVal }) => {
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
                {t(labelKey as any)}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-small text-destructive">{error}</p>}

      {/* Delete (hidden if only one profile) */}
      {canDelete && (
        <div>
          <button
            type="button"
            onClick={() => setDeleteOpen(!deleteOpen)}
            className="flex items-center gap-1 text-small text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("deleteDropdownLabel")}
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${deleteOpen ? "rotate-180" : ""}`}
            />
          </button>
          {deleteOpen && (
            <div className="mt-2">
              <Button
                variant="destructive"
                size="sm"
                loading={deleting}
                onClick={handleDelete}
              >
                {t("deleteConfirmButton")}
              </Button>
            </div>
          )}
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

  const [selectedId,   setSelectedId]   = useState<string>(activeProfileId ?? allProfiles[0]?._id ?? "");
  const [newName,      setNewName]      = useState("");
  const [creating,     setCreating]     = useState(false);
  const [createError,  setCreateError]  = useState("");

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

  const selectedProfile =
    allProfiles.find((p) => p._id === selectedId) ?? allProfiles[0];

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("title")}</DialogTitle>
      </DialogHeader>

      {/* Create new profile row */}
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
        <Button
          size="sm"
          loading={creating}
          disabled={!newName.trim()}
          onClick={handleCreate}
        >
          {t("createButton")}
        </Button>
      </div>
      {createError && <p className="text-small text-destructive">{createError}</p>}

      {/* Profile tabs */}
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
                  {/* Green dot = app-active profile */}
                  {isActive && (
                    <span className="absolute top-2 right-1.5 w-1.5 h-1.5 rounded-full bg-success" />
                  )}
                </button>
              );
            })}
          </div>

          {selectedProfile && (
            <ProfileTabContent
              key={selectedProfile._id}
              profile={selectedProfile}
              isAppActive={selectedProfile._id === activeProfileId}
            />
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
