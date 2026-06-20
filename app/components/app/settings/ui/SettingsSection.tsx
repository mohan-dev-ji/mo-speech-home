"use client";

import type { ReactNode } from "react";

/**
 * The repeating section-card shell every Settings module sits in — mirrors the
 * Figma "Languages / Voices / Theme / …" card frames (e.g. `1459:22715`).
 *
 * Translucent raised card (`bg-theme-card`), `rounded-theme-card`, 32px inner
 * padding (`p-theme-banner`), a SemiBold label, then the picker stacked below
 * with a 16px gap. `card` is translucent (per the design-system token
 * semantics); the page background shows through.
 */
export function SettingsSection({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col gap-theme-gap rounded-theme-card bg-theme-card p-theme-banner ${className ?? ""}`}
    >
      <h2 className="text-theme-p font-semibold text-theme-alt-text">{title}</h2>
      {children}
    </section>
  );
}
