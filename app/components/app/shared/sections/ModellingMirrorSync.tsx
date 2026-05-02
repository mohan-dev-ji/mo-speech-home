"use client";

// Two session-driven navigation effects:
//
// 1. On session start: every subscribed window jumps to /home so all parties
//    start from the same anchor screen. Step 0's target (Sidebar nav button)
//    is visible there, and student-view will navigate forward from /home by
//    clicking highlights.
//
// 2. Step-by-step mirror nav (instructor only): as currentStep advances, the
//    instructor window follows the student's path so the same target is on
//    screen for both. Per spec: "Instructor screen enters mirror view — they
//    see the student's progress in real time".
//
// Student-view doesn't auto-navigate per step — clicking a highlight is what
// drives them forward, so they self-navigate.
//
// Mounted in AppProviders alongside the other modelling overlays.

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "@/i18n/navigation";
import type { Id } from "@/convex/_generated/dataModel";
import { useModellingSession } from "@/app/contexts/ModellingSessionContext";
import { useProfile } from "@/app/contexts/ProfileContext";

function targetPathForStep(
  steps: { screen: string; highlight: string }[],
  currentStep: number,
): string | null {
  const step = steps[currentStep];
  if (!step) return null;

  if (step.screen === "categories") return "/categories";

  if (step.screen === "category-detail") {
    // Extract categoryId from the earlier "categories" step's highlight,
    // which has the form "category-tile-{categoryId}".
    const catStep = steps.find((s) => s.screen === "categories");
    const match = catStep?.highlight.match(/^category-tile-(.+)$/);
    const categoryId = match?.[1];
    if (categoryId) return `/categories/${categoryId}`;
  }

  // step.screen === "home" → Sidebar nav button is global; the on-start
  // effect already moves the window to /home, so no nav is needed here.
  return null;
}

export function ModellingMirrorSync() {
  const { activeSession, isActive, currentStep } = useModellingSession();
  const { viewMode } = useProfile();
  const router = useRouter();
  const pathname = usePathname();

  // Track which session we've already handled the on-start nav for, so we
  // don't keep navigating to /home on every render. Reset when the session
  // ends so a fresh session triggers the nav again.
  const onStartHandledRef = useRef<Id<"modellingSessions"> | null>(null);

  // Effect 1: on session start, jump everyone to /home.
  useEffect(() => {
    if (!isActive || !activeSession) {
      onStartHandledRef.current = null;
      return;
    }
    if (onStartHandledRef.current === activeSession.sessionId) return;

    onStartHandledRef.current = activeSession.sessionId;
    if (pathname !== "/home") {
      router.replace("/home");
    }
  }, [isActive, activeSession, pathname, router]);

  // Effect 2: instructor follows the student through subsequent steps.
  useEffect(() => {
    if (viewMode !== "instructor") return;
    if (!isActive || !activeSession) return;

    const target = targetPathForStep(activeSession.steps, currentStep);
    if (!target) return;
    if (pathname === target) return;

    router.replace(target);
  }, [viewMode, isActive, activeSession, currentStep, pathname, router]);

  return null;
}
