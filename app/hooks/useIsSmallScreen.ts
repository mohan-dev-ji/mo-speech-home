"use client";

import { useEffect, useState } from "react";

/**
 * Reactive boolean for "viewport is below the Tailwind `md` breakpoint
 * (768px)". Mirrors the same threshold our responsive utility classes use,
 * so logic that needs to do more than CSS — e.g. forcing a display mode,
 * hiding a dropdown — stays aligned with the visual breakpoints.
 *
 * SSR-safe: renders `false` on the server (the desktop assumption matches
 * Next.js's hydration default for unknown viewports). Updates on resize.
 */
export function useIsSmallScreen(maxWidthPx: number = 767): boolean {
  const [isSmall, setIsSmall] = useState(false);

  useEffect(() => {
    const query = `(max-width: ${maxWidthPx}px)`;
    const mql = window.matchMedia(query);
    const update = () => setIsSmall(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [maxWidthPx]);

  return isSmall;
}
