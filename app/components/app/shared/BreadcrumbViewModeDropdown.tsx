"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Check, ChevronDown, Lock, Unlock } from "lucide-react";
import { useProfile } from "@/app/contexts/ProfileContext";
import type { Id } from "@/convex/_generated/dataModel";

export function BreadcrumbViewModeDropdown() {
  const t = useTranslations("studentViewLock");
  const tCommon = useTranslations("common");
  const {
    viewMode,
    setViewMode,
    activeProfileId,
    studentProfile,
    allProfiles,
    setActiveProfile,
  } = useProfile();

  const lockState = useQuery(
    api.studentViewLock.getStudentViewLockState,
    activeProfileId ? { profileId: activeProfileId } : "skip",
  );
  const lockMutation = useMutation(api.studentViewLock.lockStudentView);
  const unlockMutation = useMutation(api.studentViewLock.unlockStudentView);

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const isStudent = viewMode === "student-view";
  const isActiveProfileLocked = !!lockState?.locked;
  const dropdownDisabled = isStudent && isActiveProfileLocked;

  const label = isStudent
    ? (studentProfile?.name ?? tCommon("studentView"))
    : tCommon("instructor");

  // Student-view + profile is locked → render a disabled badge, no menu.
  if (dropdownDisabled) {
    return (
      <div
        className="inline-flex items-center gap-1.5 text-small font-medium px-2.5 py-1 rounded-md opacity-60 cursor-not-allowed select-none"
        style={{
          color: "var(--theme-secondary-alt-text)",
          border: "1px solid rgba(255,255,255,0.2)",
        }}
        aria-disabled="true"
      >
        <Lock className="w-3 h-3" aria-hidden />
        <span>{label}</span>
      </div>
    );
  }

  function selectInstructor() {
    if (!isStudent) {
      setOpen(false);
      return;
    }
    setViewMode("instructor");
    setOpen(false);
  }

  function selectStudentProfile(profileId: Id<"studentProfiles">) {
    const sameProfile = profileId === activeProfileId;
    if (isStudent && sameProfile) {
      setOpen(false);
      return;
    }
    if (!sameProfile) setActiveProfile(profileId);
    if (!isStudent) setViewMode("student-view");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-small font-medium px-2.5 py-1 rounded-md transition-colors hover:bg-white/5"
        style={{
          color: "var(--theme-secondary-alt-text)",
          border: "1px solid rgba(255,255,255,0.2)",
        }}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown className="w-3 h-3" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-full left-0 mt-1 min-w-[240px] rounded-theme bg-theme-card text-theme-alt-text shadow-lg border border-theme-line z-80 overflow-hidden"
        >
          <MenuItem
            label={tCommon("instructor")}
            description={t("instructorDescription")}
            active={!isStudent}
            onClick={selectInstructor}
          />

          {allProfiles.length === 0 ? (
            <MenuItem
              label={tCommon("studentView")}
              description={t("studentDescription")}
              active={false}
              onClick={() => setOpen(false)}
            />
          ) : (
            allProfiles.map((p) => {
              const isActive = isStudent && p._id === activeProfileId;
              return (
                <ProfileRow
                  key={p._id}
                  label={p.name}
                  description={t("studentProfileDescription")}
                  active={isActive}
                  profileId={p._id}
                  onSelect={() => selectStudentProfile(p._id)}
                  onLock={async () => {
                    await lockMutation({ profileId: p._id });
                    setOpen(false);
                  }}
                  onUnlock={async () => {
                    await unlockMutation({ profileId: p._id });
                  }}
                  lockLabel={t("lockStudentView")}
                  unlockLabel={t("unlockStudentView")}
                />
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  label,
  description,
  active,
  onClick,
}: {
  label: string;
  description: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="w-full text-left px-3 py-2 flex items-start gap-2 transition-colors hover:bg-white/5"
    >
      <span className="w-4 h-4 mt-0.5 shrink-0">
        {active && <Check className="w-4 h-4" aria-hidden />}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-small font-medium">{label}</span>
        <span className="block text-small mt-0.5" style={{ color: "var(--theme-secondary-alt-text)" }}>
          {description}
        </span>
      </span>
    </button>
  );
}

function ProfileRow({
  label,
  description,
  active,
  profileId,
  onSelect,
  onLock,
  onUnlock,
  lockLabel,
  unlockLabel,
}: {
  label: string;
  description: string;
  active: boolean;
  profileId: Id<"studentProfiles">;
  onSelect: () => void;
  onLock: () => void;
  onUnlock: () => void;
  lockLabel: string;
  unlockLabel: string;
}) {
  const lockState = useQuery(api.studentViewLock.getStudentViewLockState, { profileId });
  const isLocked = !!lockState?.locked;

  return (
    <div className="flex items-stretch hover:bg-white/5 transition-colors">
      <button
        type="button"
        role="menuitem"
        onClick={onSelect}
        className="flex-1 text-left px-3 py-2 flex items-start gap-2"
      >
        <span className="w-4 h-4 mt-0.5 shrink-0">
          {active && <Check className="w-4 h-4" aria-hidden />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-small font-medium">{label}</span>
          <span className="block text-small mt-0.5" style={{ color: "var(--theme-secondary-alt-text)" }}>
            {description}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={isLocked ? onUnlock : onLock}
        aria-label={isLocked ? unlockLabel : lockLabel}
        title={isLocked ? unlockLabel : lockLabel}
        className="px-3 flex items-center transition-colors hover:bg-white/10 border-l border-theme-line"
      >
        {isLocked
          ? <Lock className="w-4 h-4" aria-hidden />
          : <Unlock className="w-4 h-4 opacity-60" aria-hidden />}
      </button>
    </div>
  );
}
