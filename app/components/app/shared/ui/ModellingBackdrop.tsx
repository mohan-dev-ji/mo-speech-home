"use client";

// Viewport-level dimming layer for modelling mode.
// Renders a single fixed black div over the whole screen when a session is active.
// Highlighted targets escape via z-index in ModellingOverlayWrapper.
//
// Sits inside ModellingSessionProvider (mounted in AppProviders).
// Opacity transitions smoothly via a continuous element + opacity toggle.

import { useModellingSession } from '@/app/contexts/ModellingSessionContext';

// Above TopBar (70) and Sidebar, below toasts/onboarding/modals (100+).
const BACKDROP_Z_INDEX = 80;

export function ModellingBackdrop() {
  const { isActive } = useModellingSession();

  // pointerEvents stays 'none' even while active so the page scrolls through
  // the dim — students often need to scroll to find the target symbol
  // (learning the path is the whole point). The visual dim makes it clear
  // which UI not to interact with.
  return (
    <div
      aria-hidden
      className="fixed inset-0 bg-black transition-opacity duration-200"
      style={{
        opacity: isActive ? 0.8 : 0,
        zIndex: BACKDROP_Z_INDEX,
        pointerEvents: 'none',
      }}
    />
  );
}
