"use client";

// Floating annotation that points at the active modelling target.
// Two modes:
//
//  - on-screen: positioned next to the target with a left/right chevron,
//    located via [data-component-key="..."] + getBoundingClientRect.
//  - off-screen: pinned to the relevant viewport edge with an up/down/left/
//    right chevron showing the student which way to scroll. The student
//    learning the symbol's location is the whole point of modelling — we
//    don't auto-scroll for them.
//
// Re-positions on scroll and resize so the annotation stays in sync as the
// student scrolls toward an off-screen target.
//
// Sits inside ModellingSessionProvider (mounted in AppProviders).
// Z-index 95 — above ModellingBackdrop (80) and highlighted target (90),
// below toasts/modals (100+).

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { useModellingSession } from '@/app/contexts/ModellingSessionContext';
import { useProfile } from '@/app/contexts/ProfileContext';

const ANNOTATION_Z_INDEX = 95;
const TARGET_GAP_PX = 16;
const EDGE_INSET_PX = 24;
const MAX_TARGET_RETRY_FRAMES = 12;

type Position =
  | {
      mode: 'on-screen';
      left: number;
      top: number;
      placement: 'left' | 'right';
    }
  | {
      mode: 'off-screen';
      direction: 'up' | 'down' | 'left' | 'right';
      contentTop: number;
      contentBottom: number;
      contentLeft: number;
      contentRight: number;
      contentCentreX: number;
      contentCentreY: number;
    };

// The off-screen indicator pins to the bounds of the target's nearest
// `[data-modelling-content]` ancestor — the page's scrollable grid area —
// so it doesn't float into the banner above. Falls back to the viewport
// for targets without such a marker (e.g. the global Sidebar nav button).
function getContentBounds(target: Element): {
  top: number;
  bottom: number;
  left: number;
  right: number;
} {
  const el = target.closest('[data-modelling-content]');
  if (el) {
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
  }
  return {
    top: 0,
    bottom: window.innerHeight,
    left: 0,
    right: window.innerWidth,
  };
}

function computePosition(highlightKey: string): Position | null {
  const target = document.querySelector(`[data-component-key="${highlightKey}"]`);
  if (!target) return null;

  const rect = target.getBoundingClientRect();
  const content = getContentBounds(target);

  const offscreenY = rect.bottom < content.top || rect.top > content.bottom;
  const offscreenX = rect.right < content.left || rect.left > content.right;

  if (offscreenY || offscreenX) {
    let direction: 'up' | 'down' | 'left' | 'right';
    if (offscreenY) {
      direction = rect.top > content.bottom ? 'down' : 'up';
    } else {
      direction = rect.left > content.right ? 'right' : 'left';
    }
    return {
      mode: 'off-screen',
      direction,
      contentTop: content.top,
      contentBottom: content.bottom,
      contentLeft: content.left,
      contentRight: content.right,
      contentCentreX: (content.left + content.right) / 2,
      contentCentreY: (content.top + content.bottom) / 2,
    };
  }

  const targetCentreX = rect.left + rect.width / 2;
  const placement: 'left' | 'right' =
    targetCentreX < window.innerWidth / 2 ? 'right' : 'left';
  const top = rect.top + rect.height / 2;
  const left =
    placement === 'right'
      ? rect.right + TARGET_GAP_PX
      : rect.left - TARGET_GAP_PX;
  return { mode: 'on-screen', left, top, placement };
}

export function ModellingAnnotation() {
  const { activeSession, isActive, currentStep } = useModellingSession();
  const { studentProfile } = useProfile();
  const [position, setPosition] = useState<Position | null>(null);

  const highlightKey =
    isActive && activeSession
      ? activeSession.steps[currentStep]?.highlight
      : undefined;

  const reduceMotion =
    studentProfile?.stateFlags?.reduce_motion === true ||
    (typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Initial computation — retries while the target's page is still mounting.
  useEffect(() => {
    if (!highlightKey) {
      setPosition(null);
      return;
    }

    let cancelled = false;
    let frame = 0;
    let rafId = 0;

    const tick = () => {
      if (cancelled) return;
      const pos = computePosition(highlightKey);
      if (!pos) {
        if (frame++ < MAX_TARGET_RETRY_FRAMES) {
          rafId = requestAnimationFrame(tick);
        } else {
          setPosition(null);
        }
        return;
      }
      setPosition(pos);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [highlightKey]);

  // Recompute on scroll / resize so the annotation tracks as the student
  // scrolls toward the target. capture: true catches scrolls inside nested
  // overflow containers (the category board uses one) — those don't bubble
  // to window by default.
  const recompute = useCallback(() => {
    if (!highlightKey) return;
    const pos = computePosition(highlightKey);
    if (pos) setPosition(pos);
  }, [highlightKey]);

  useEffect(() => {
    if (!highlightKey) return;
    window.addEventListener('scroll', recompute, { passive: true, capture: true });
    window.addEventListener('resize', recompute);
    return () => {
      window.removeEventListener('scroll', recompute, true);
      window.removeEventListener('resize', recompute);
    };
  }, [highlightKey, recompute]);

  if (!isActive || !activeSession || !position) return null;

  const { symbolPreview } = activeSession;

  const card = (
    <div
      className="bg-theme-symbol-bg rounded-theme p-theme-symbol flex flex-col items-center gap-theme-elements shadow-2xl"
      style={{
        minWidth: 96,
        maxWidth: 160,
        border: '2px solid var(--theme-brand-primary)',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/assets?key=${symbolPreview.imagePath}`}
        alt=""
        className="w-16 h-16 object-contain"
        draggable={false}
      />
      <span className="text-theme-s font-semibold text-theme-text text-center break-words">
        {symbolPreview.word}
      </span>
    </div>
  );

  if (position.mode === 'off-screen') {
    const Arrow =
      position.direction === 'down'
        ? ChevronDown
        : position.direction === 'up'
          ? ChevronUp
          : position.direction === 'right'
            ? ChevronRight
            : ChevronLeft;

    // Pin to the relevant edge of the content area (the scrollable grid),
    // not the full viewport — this keeps the indicator out of the banner
    // above the grid. Horizontal off-screen is included for completeness
    // but rare in practice.
    const verticalEdge = position.direction === 'down' || position.direction === 'up';
    const edgeStyle: React.CSSProperties = verticalEdge
      ? position.direction === 'down'
        ? {
            top: position.contentBottom - EDGE_INSET_PX,
            left: position.contentCentreX,
            transform: 'translate(-50%, -100%)',
          }
        : {
            top: position.contentTop + EDGE_INSET_PX,
            left: position.contentCentreX,
            transform: 'translate(-50%, 0)',
          }
      : position.direction === 'right'
        ? {
            top: position.contentCentreY,
            left: position.contentRight - EDGE_INSET_PX,
            transform: 'translate(-100%, -50%)',
          }
        : {
            top: position.contentCentreY,
            left: position.contentLeft + EDGE_INSET_PX,
            transform: 'translate(0, -50%)',
          };

    return (
      <div
        aria-hidden
        className="fixed pointer-events-none flex items-center gap-2"
        style={{
          zIndex: ANNOTATION_Z_INDEX,
          ...edgeStyle,
          flexDirection: verticalEdge ? 'column' : 'row',
        }}
      >
        {(position.direction === 'up' || position.direction === 'left') && (
          <Arrow
            size={48}
            strokeWidth={3}
            className="drop-shadow-lg animate-pulse"
            style={{ color: 'var(--theme-brand-primary)' }}
          />
        )}
        {card}
        {(position.direction === 'down' || position.direction === 'right') && (
          <Arrow
            size={48}
            strokeWidth={3}
            className="drop-shadow-lg animate-pulse"
            style={{ color: 'var(--theme-brand-primary)' }}
          />
        )}
      </div>
    );
  }

  // on-screen mode
  const transformX = position.placement === 'right' ? '0%' : '-100%';
  const InlineArrow = position.placement === 'right' ? ChevronLeft : ChevronRight;

  return (
    <div
      aria-hidden
      className="fixed pointer-events-none flex items-center gap-2"
      style={{
        zIndex: ANNOTATION_Z_INDEX,
        left: position.left,
        top: position.top,
        transform: `translate(${transformX}, -50%)`,
        flexDirection: position.placement === 'right' ? 'row' : 'row-reverse',
        transition: reduceMotion
          ? undefined
          : 'left 200ms ease-out, top 200ms ease-out',
      }}
    >
      <InlineArrow
        size={32}
        strokeWidth={3}
        className="drop-shadow-lg"
        style={{ color: 'var(--theme-brand-primary)' }}
      />
      {card}
    </div>
  );
}
