"use client";

import { useEffect, useState } from "react";

// Numeric mirror of CategoryBoardGrid's GRID_SIZE_CLASSES. Kept in lockstep with
// that component: same tiers, same counts. The talker core grid needs the column
// count as a NUMBER (it drives slot math — rows/totalCells — not just a CSS
// class), so it can't reuse the Tailwind-class form directly.
//   base = mobile (<768) · md = 768–1023 · lg = 1024+
export const GRID_COLUMN_MAP = {
  large:  { base: 2, md: 2, lg: 4 },
  medium: { base: 3, md: 4, lg: 8 },
  small:  { base: 4, md: 8, lg: 12 },
} as const;

type GridSize = "large" | "medium" | "small";

/**
 * Active column count for the current viewport tier, given the profile
 * grid-size setting. Mirrors CategoryBoardGrid's responsive column map but
 * returns a number (the talker grid uses the count in slot math, not only in a
 * CSS class). SSR-safe: returns the `lg` count on the server, then updates on
 * mount / resize — matches the desktop hydration assumption used by
 * useIsSmallScreen.
 */
export function useGridColumns(gridSize: GridSize | undefined): number {
  const tiers = GRID_COLUMN_MAP[gridSize ?? "large"];
  const [cols, setCols] = useState<number>(tiers.lg);

  useEffect(() => {
    const mdQuery = window.matchMedia("(min-width: 768px)");
    const lgQuery = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      setCols(lgQuery.matches ? tiers.lg : mdQuery.matches ? tiers.md : tiers.base);
    };
    update();
    mdQuery.addEventListener("change", update);
    lgQuery.addEventListener("change", update);
    return () => {
      mdQuery.removeEventListener("change", update);
      lgQuery.removeEventListener("change", update);
    };
  }, [tiers.base, tiers.md, tiers.lg]);

  return cols;
}
