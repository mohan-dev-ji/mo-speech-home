"use client";

import { useTranslations } from "next-intl";

type ModuleClass = "default" | "free" | "pro" | "max";

/**
 * The single admin-only publish-status pill on a module's group tile. Shows the
 * published class (Default/Free/Pro/Max) or "Draft" when the module has never
 * been published. Derives purely from the row's `publishedModuleClass` — no pack
 * lookup. Callers gate rendering on admin view.
 */
export function ModuleClassBadge({
  publishedClass,
}: {
  publishedClass?: ModuleClass;
}) {
  const t = useTranslations("moduleClass");
  const isDraft = !publishedClass;
  return (
    <span
      role="note"
      className={[
        "inline-flex items-center max-w-full rounded-full font-semibold",
        "px-2 py-0.5 text-[10px] uppercase tracking-wide text-white",
        isDraft ? "bg-zinc-700" : "bg-zinc-900",
      ].join(" ")}
    >
      {t(publishedClass ?? "draft")}
    </span>
  );
}
