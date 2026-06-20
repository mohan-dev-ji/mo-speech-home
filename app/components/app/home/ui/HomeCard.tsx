"use client";

import type { ReactNode } from "react";
import Link from "next/link";

type BaseProps = {
  title: string;
  /** 24px lucide glyph — colour is inherited (`text-theme-alt-text`). */
  icon: ReactNode;
};

type Props = BaseProps &
  (
    | { href: string; onActivate?: never }
    | { href?: never; onActivate: () => void }
  );

const CARD_CLASS =
  "flex flex-col items-center justify-center gap-8 w-full min-h-[200px] md:min-h-[260px] p-theme-general rounded-theme-card bg-theme-card text-theme-secondary-alt-text border border-transparent transition-colors hover:bg-theme-surface hover:text-theme-alt-text hover:border-theme-line cursor-pointer";

/**
 * Home-card — the Figma "Home-card" component (`1431:21111`). One card used by
 * both the nav row (routes to a page → renders a Next `<Link>`, matching the
 * rest of the app's navigation) and the create row (opens a modal → renders a
 * `<button>`). Translucent `card` fill, centred title + glyph with a 32px gap.
 */
export function HomeCard({ title, icon, href, onActivate }: Props) {
  const inner = (
    <>
      <span className="text-theme-h4 font-semibold text-center">{title}</span>
      <span className="inline-flex items-center justify-center [&_svg]:w-10 [&_svg]:h-10">
        {icon}
      </span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={CARD_CLASS}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onActivate} className={CARD_CLASS}>
      {inner}
    </button>
  );
}
