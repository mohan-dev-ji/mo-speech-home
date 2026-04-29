"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProfile } from "@/app/contexts/ProfileContext";
import { useToast } from "@/app/components/shared/Toast";
import { useStudentViewPresence, getOrCreateSessionId } from "@/app/hooks/useStudentViewPresence";

/**
 * Mounted once at AppProviders level.
 *
 * Two responsibilities:
 *   1. While THIS window is in student-view, post heartbeats so other windows know.
 *   2. While this window is in instructor view, watch for OTHER windows in student-view
 *      on the same profile. If the profile is unlocked, raise a toast.
 */
export function InstructorPresenceWatcher() {
  const t = useTranslations("studentViewLock");
  const { viewMode, activeProfileId } = useProfile();
  const { showToast } = useToast();

  // (1) Heartbeat when in student-view
  useStudentViewPresence({
    active: viewMode === "student-view",
    profileId: activeProfileId,
  });

  // (2) Watch for unlocked student sessions while in instructor view
  const isInstructor = viewMode === "instructor";
  const sessions = useQuery(
    api.studentViewSessions.getActiveStudentViewSessions,
    isInstructor && activeProfileId ? { profileId: activeProfileId } : "skip",
  );
  const lockState = useQuery(
    api.studentViewLock.getStudentViewLockState,
    isInstructor && activeProfileId ? { profileId: activeProfileId } : "skip",
  );

  const seenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!isInstructor || !sessions || !lockState) return;
    if (lockState.locked) return;

    const mySessionId = typeof window === "undefined" ? null : getOrCreateSessionId();
    const others = sessions.filter((s) => s.sessionId !== mySessionId);
    if (others.length === 0) return;

    for (const s of others) {
      if (seenRef.current.has(s.sessionId)) continue;
      seenRef.current.add(s.sessionId);
      showToast({
        tone: "warning",
        title: t("toastUnlockedTitle"),
        body: t("toastUnlockedBody"),
        dedupeKey: `unlocked:${s.sessionId}`,
      });
    }
  }, [isInstructor, sessions, lockState, showToast, t]);

  // Reset seen-set when profile changes so toast can re-fire later
  useEffect(() => {
    seenRef.current = new Set();
  }, [activeProfileId]);

  return null;
}
