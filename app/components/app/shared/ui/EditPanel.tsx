"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Edit-panel — the Figma "Edit-panel" component (`3017:2263`): a cluster of
 * `IconButton`s for edit affordances (delete / edit / save / move). Composition
 * only — the consumer passes whichever IconButtons it needs (the category tile
 * uses 2; the library cluster has 4).
 *
 * `orientation` mirrors the Figma variant; `gap` = `theme-elements` (8). The
 * panel has **no x/y padding** of its own (Figma steer) so it slots into any
 * host without inflating its padding — the host owns the surrounding spacing.
 * Pass `className="flex-wrap"` to let a horizontal cluster wrap within a fixed
 * width (e.g. so a tile grows taller instead of wider in dense grids).
 */

type Orientation = "horizontal" | "vertical";

interface EditPanelProps {
  orientation?: Orientation;
  className?: string;
  children: ReactNode;
}

export function EditPanel({
  orientation = "horizontal",
  className,
  children,
}: EditPanelProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-theme-elements",
        orientation === "vertical" && "flex-col",
        className
      )}
    >
      {children}
    </div>
  );
}
