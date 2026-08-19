"use client";
import { useEffect, useRef, useState } from 'react';
import { useProfile } from '@/app/contexts/ProfileContext';

const PULSE_MS = 200;

// The tap-to-replay pulse shared by the fullscreen play modals (ADR-015).
// Neither modal has a Replay button any more: the symbols themselves are the
// replay target, and this brief scale-up is the only feedback that the tap
// landed — so both modals pulse identically rather than drifting apart.
//
// `isOpen` also pulses the auto-play, so opening and re-tapping feel the same.
export function usePlayPulse(isOpen: boolean) {
  const [zoom, setZoom] = useState(false);
  const zoomTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { studentProfile } = useProfile();

  const reduceMotion =
    studentProfile?.stateFlags?.reduce_motion === true ||
    (typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  // Re-armed on every call (the timer is cleared first) so rapid taps keep
  // pulsing instead of sticking at the top of the scale.
  function pulse() {
    if (reduceMotion) return;
    if (zoomTimer.current) clearTimeout(zoomTimer.current);
    setZoom(true);
    zoomTimer.current = setTimeout(() => { zoomTimer.current = null; setZoom(false); }, PULSE_MS);
  }

  function reset() {
    if (zoomTimer.current) { clearTimeout(zoomTimer.current); zoomTimer.current = null; }
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    setZoom(false);
  }

  useEffect(() => {
    if (isOpen) {
      // The short delay lets the modal paint at rest first — pulse in the same
      // flush as the mount and there is no "before" for the browser to animate
      // from, so the scale-up is skipped. A timeout, not rAF: rAF is paused in a
      // background tab, which would leave the pulse queued and fire it late,
      // whenever the tab is next looked at.
      openTimer.current = setTimeout(() => { openTimer.current = null; pulse(); }, 30);
    }
    return () => {
      if (zoomTimer.current) { clearTimeout(zoomTimer.current); zoomTimer.current = null; }
      if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return { zoom, pulse, reset };
}
