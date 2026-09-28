"use client";

import { Lock } from "lucide-react";

type Props = {
  title: string;
  body: string;
};

/**
 * The lock panel a non-Max account sees in place of a Max-only image tab
 * (Upload, My Images, Image Search, AI Generate — FEAT-108). Callers pass
 * already-translated copy.
 */
export function MaxLockPanel({ title, body }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 h-full p-6 text-center">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{ background: "var(--theme-symbol-bg)" }}
      >
        <Lock className="w-6 h-6" style={{ color: "var(--theme-secondary-text)" }} />
      </div>
      <h3 className="text-theme-m font-semibold" style={{ color: "var(--theme-text)" }}>
        {title}
      </h3>
      <p
        className="text-theme-s max-w-xs"
        style={{ color: "var(--theme-secondary-text)" }}
      >
        {body}
      </p>
    </div>
  );
}
