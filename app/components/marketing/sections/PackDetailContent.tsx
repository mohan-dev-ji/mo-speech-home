"use client";

// Pack detail page — full content view for a single library pack.
//
// Layout:
//   Hero       — cover, name, tier badge, marketing description, counts
//   Categories — for each category, a grid of symbol tiles
//   Lists      — for each list, a grid of items
//   Sentences  — for each sentence, slots inline like the sentence builder
//   Load CTA   — single Load Into Profile button at the bottom
//
// Sections are visually separated by `border-t` dividers. Each symbol/slot
// renders with its label below so the page reads as a vocabulary catalogue.

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/app/components/app/shared/ui/Badge";
import { LoadPackButton } from "@/app/components/marketing/ui/LoadPackButton";
import { displayString } from "@/lib/languages/displayValue";
import { DEFAULT_LOCALE } from "@/lib/languages/registry";

type LocalisedString = Record<string, string>;

const tierBadgeVariant: Record<
  "free" | "pro" | "max",
  "success" | "default" | "warning"
> = {
  free: "success",
  pro: "default",
  max: "warning",
};

type Symbol = {
  order: number;
  imagePath: string | null;
  label: LocalisedString;
};

type PackDetail = {
  slug: string;
  name: LocalisedString;
  description: LocalisedString;
  coverImagePath: string;
  tier: "free" | "pro" | "max";
  isStarter: boolean;
  counts: { categories: number; lists: number; sentences: number };
  categories: Array<{
    name: LocalisedString;
    icon: string;
    colour: string;
    imagePath: string | null;
    symbols: Symbol[];
  }>;
  lists: Array<{
    name: LocalisedString;
    items: Symbol[];
  }>;
  sentences: Array<{
    name: LocalisedString;
    // Convex returns either the localised record or, for legacy pre-migration
    // pack rows, a plain string. Resolved via `displayString()` when rendered.
    text: LocalisedString | string | null;
    slots: Symbol[];
  }>;
};

function SymbolTile({
  symbol,
  locale,
}: {
  symbol: Symbol;
  locale: string;
}) {
  const label = displayString(symbol.label, locale, DEFAULT_LOCALE);
  const src = symbol.imagePath
    ? `/api/assets?key=${encodeURIComponent(symbol.imagePath)}`
    : null;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="w-full aspect-square bg-muted rounded-md overflow-hidden flex items-center justify-center">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={label}
            loading="lazy"
            className="w-full h-full object-contain p-2"
          />
        ) : (
          <span className="text-caption text-muted-foreground">—</span>
        )}
      </div>
      <span className="text-caption text-foreground text-center line-clamp-2 leading-tight">
        {label}
      </span>
    </div>
  );
}

export function PackDetailContent({
  pack,
  locale,
}: {
  pack: PackDetail;
  locale: string;
}) {
  const t = useTranslations("library");
  const name = displayString(pack.name, locale, DEFAULT_LOCALE);
  const description = displayString(pack.description, locale, DEFAULT_LOCALE);
  const coverSrc = `/api/assets?key=${encodeURIComponent(pack.coverImagePath)}`;
  const tierLabel =
    pack.tier === "free"
      ? t("tierBadgeFree")
      : pack.tier === "pro"
        ? t("tierBadgePro")
        : t("tierBadgeMax");

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      {/* Back link */}
      <Link
        href={`/${locale}/library`}
        className="inline-flex items-center gap-1 text-small text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        {t("detailBack")}
      </Link>

      {/* Hero — two-column on md+. Col 1: title, description, counts.
          Col 2: pack image, right-justified. On mobile the layout collapses
          to a single column with the image first so the visual identity of
          the pack leads, then the copy below.
          NB Tailwind arbitrary-value syntax uses `_` for the CSS space
          separator — `[1fr_auto]`, NOT `[1fr,auto]` (the comma form silently
          falls back to single-column). */}
      <header className="grid gap-6 items-start mb-10 md:grid-cols-[1fr_auto]">
        <div className="md:order-2 md:justify-self-end">
          <div className="w-44 h-44 md:w-56 md:h-56 bg-muted rounded-lg overflow-hidden flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverSrc}
              alt={name}
              className="w-full h-full object-contain p-4"
            />
          </div>
        </div>
        <div className="md:order-1 flex flex-col gap-3">
          <div className="flex items-start gap-3 flex-wrap">
            <h1 className="text-display font-semibold text-foreground">
              {name}
            </h1>
            <div className="pt-1">
              <Badge variant={tierBadgeVariant[pack.tier]}>{tierLabel}</Badge>
            </div>
          </div>
          {description && (
            <p className="text-body text-muted-foreground max-w-prose">
              {description}
            </p>
          )}
          <ul className="flex flex-col gap-0.5 text-caption text-muted-foreground">
            {pack.counts.categories > 0 && (
              <li>{t("itemsCategories", { count: pack.counts.categories })}</li>
            )}
            {pack.counts.lists > 0 && (
              <li>{t("itemsLists", { count: pack.counts.lists })}</li>
            )}
            {pack.counts.sentences > 0 && (
              <li>{t("itemsSentences", { count: pack.counts.sentences })}</li>
            )}
          </ul>
        </div>
      </header>

      {/* Categories */}
      {pack.categories.length > 0 && (
        <section className="border-t border-border pt-8 mb-10">
          <h2 className="text-subheading font-semibold text-foreground mb-5">
            {t("detailSectionCategories")}
          </h2>
          <div className="flex flex-col gap-8">
            {pack.categories.map((cat, ci) => (
              <div key={ci} className="flex flex-col gap-3">
                <h3 className="text-body font-medium text-foreground">
                  {displayString(cat.name, locale, DEFAULT_LOCALE)}
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {cat.symbols.map((sym) => (
                    <SymbolTile
                      key={sym.order}
                      symbol={sym}
                      locale={locale}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lists */}
      {pack.lists.length > 0 && (
        <section className="border-t border-border pt-8 mb-10">
          <h2 className="text-subheading font-semibold text-foreground mb-5">
            {t("detailSectionLists")}
          </h2>
          <div className="flex flex-col gap-8">
            {pack.lists.map((list, li) => (
              <div key={li} className="flex flex-col gap-3">
                <h3 className="text-body font-medium text-foreground">
                  {displayString(list.name, locale, DEFAULT_LOCALE)}
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {list.items.map((item) => (
                    <SymbolTile
                      key={item.order}
                      symbol={item}
                      locale={locale}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sentences */}
      {pack.sentences.length > 0 && (
        <section className="border-t border-border pt-8 mb-10">
          <h2 className="text-subheading font-semibold text-foreground mb-5">
            {t("detailSectionSentences")}
          </h2>
          <div className="flex flex-col gap-8">
            {pack.sentences.map((sent, si) => (
              <div key={si} className="flex flex-col gap-3">
                <h3 className="text-body font-medium text-foreground">
                  {displayString(sent.name, locale, DEFAULT_LOCALE)}
                </h3>
                {/* Slots inline left-to-right; wrap on narrow screens. */}
                <div className="flex flex-wrap gap-3">
                  {sent.slots.map((slot) => (
                    <div key={slot.order} className="w-20 shrink-0">
                      <SymbolTile symbol={slot} locale={locale} />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Bottom Load CTA */}
      <section className="border-t border-border pt-8">
        <div className="max-w-md">
          <LoadPackButton
            packSlug={pack.slug}
            packTier={pack.tier}
            isStarter={pack.isStarter}
            locale={locale}
          />
        </div>
      </section>
    </div>
  );
}
