"use client";

// Module detail page — full content view for a single content module (ADR-014).
// The per-type counterpart to PackDetailContent: a module is single-type, so
// exactly one of categories/lists/sentences is populated. Hero + a vocabulary
// breakdown + an Install CTA at the bottom.

import Link from "next/link";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { Badge } from "@/app/components/app/shared/ui/Badge";
import {
  InstallModuleButton,
  type ModuleTree,
} from "@/app/components/marketing/ui/InstallModuleButton";
import {
  moduleClass,
  MODULE_CLASS_BADGE,
  MODULE_CLASS_LABEL_KEY,
} from "@/app/components/marketing/ui/moduleClass";
import { displayString } from "@/lib/languages/displayValue";
import { DEFAULT_LOCALE } from "@/lib/languages/registry";
import { collapseModuleVariants } from "@/lib/languages/variants";
import { CompositionBlock } from "@/app/components/app/shared/ui/composition/CompositionBlock";
import { blocksFromUnits, type CompositionUnitClient } from "@/app/components/app/shared/ui/composition/blocks";

type LocalisedString = Record<string, string>;

type Symbol = {
  order: number;
  imagePath: string | null;
  label: LocalisedString;
};

type ModuleDetail = {
  tree: ModuleTree;
  slug: string;
  name: LocalisedString;
  description: LocalisedString | null;
  coverImagePath: string | null;
  tier: "free" | "pro" | "max";
  isDefault: boolean;
  isStarter: boolean;
  counts: { categories: number; lists: number; sentences: number };
  categories: Array<{
    name: LocalisedString;
    icon: string;
    colour: string;
    imagePath: string | null;
    symbols: Symbol[];
  }>;
  lists: Array<{ name: LocalisedString; items: Symbol[] }>;
  sentences: Array<{
    name: LocalisedString;
    text: LocalisedString | string | null;
    // ADR-016 variant metadata — a module ships every language variant.
    authoredLanguage: string | null;
    variantGroupKey: string | null;
    // ADR-015 — a block sentence's phrase grouping. `slots` is the flat mirror.
    units: CompositionUnitClient[] | null;
    playback: "sequence" | "fluent" | null;
    slots: Symbol[];
  }>;
};

function SymbolTile({ symbol, locale }: { symbol: Symbol; locale: string }) {
  const label = displayString(symbol.label, locale, DEFAULT_LOCALE);
  const src = symbol.imagePath
    ? `/api/assets?key=${encodeURIComponent(symbol.imagePath)}`
    : null;
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Same ground as CompositionBlock's word card, deliberately: SymbolStix
          art is line drawing that needs a light background, so the tile must
          not invert in dark mode the way `bg-muted` did. Sharing the token
          rather than a hex keeps the two rows matched by construction. */}
      <div
        className="w-full aspect-square rounded-md overflow-hidden flex items-center justify-center"
        style={{ background: "var(--theme-symbol-card-bg)" }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={label}
            loading="lazy"
            className="w-full h-full object-contain p-2"
          />
        ) : (
          // The em-dash placeholder sits INSIDE the now-always-light card, so it
          // cannot use `text-muted-foreground` — that lightens in dark mode and
          // would vanish. Pair the card's own ink with its background.
          <span className="text-caption" style={{ color: "var(--theme-symbol-card-text)" }}>
            —
          </span>
        )}
      </div>
      {/* Fluent sentence slots carry no label — the app renders them image-only
          too. Rendering the span anyway left an empty element reserving layout
          space under every sentence tile. Categories and lists always have a
          label, so they are unaffected. */}
      {label && (
        <span className="text-caption text-foreground text-center line-clamp-2 leading-tight">
          {label}
        </span>
      )}
    </div>
  );
}

export function ModuleDetailContent({
  module,
  locale,
}: {
  module: ModuleDetail;
  locale: string;
}) {
  const t = useTranslations("library");
  // One row per logical sentence, in this locale. Without this the page lists
  // the same sentence once per published language variant.
  const sentences = collapseModuleVariants(module.sentences, locale);

  // Prefer `text` over `name`: a variant is created by copying the source's
  // name (English keys) and only its TEXT gets translated — and publish drops
  // variants whose text still needs translating, so a published variant always
  // has translated text and a stale English name. Same order as the app's own
  // renderer in SentencesModeContent.
  const sentenceTitle = (sent: (typeof sentences)[number]) => {
    const text =
      typeof sent.text === "string"
        ? sent.text
        : displayString(sent.text ?? undefined, locale, DEFAULT_LOCALE);
    return text || displayString(sent.name, locale, DEFAULT_LOCALE);
  };

  const name = displayString(module.name, locale, DEFAULT_LOCALE);
  const description = module.description
    ? displayString(module.description, locale, DEFAULT_LOCALE)
    : "";
  const coverSrc = module.coverImagePath
    ? `/api/assets?key=${encodeURIComponent(module.coverImagePath)}`
    : null;
  const cls = moduleClass(module.isDefault, module.tier);
  const tierLabel = t(MODULE_CLASS_LABEL_KEY[cls]);

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <Link
        href={`/${locale}/library/modules`}
        className="inline-flex items-center gap-1 text-small text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ChevronLeft className="w-4 h-4" />
        {t("moduleDetailBack")}
      </Link>

      <header className="grid gap-6 items-start mb-10 md:grid-cols-[1fr_auto]">
        <div className="md:order-2 md:justify-self-end">
          {/* Same light-in-both-themes ground as the tiles and the library
              card covers. Nothing is overlaid here, so the ground is the whole
              change. */}
          <div
            className="w-44 h-44 md:w-56 md:h-56 rounded-lg overflow-hidden flex items-center justify-center"
            style={{ background: "var(--theme-symbol-card-bg)" }}
          >
            {coverSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverSrc}
                alt={name}
                className="w-full h-full object-contain p-4"
              />
            ) : null}
          </div>
        </div>
        <div className="md:order-1 flex flex-col gap-3">
          <div className="flex items-start gap-3 flex-wrap">
            <h1 className="text-display font-semibold text-foreground">{name}</h1>
            <div className="pt-1">
              <Badge variant={MODULE_CLASS_BADGE[cls]}>{tierLabel}</Badge>
            </div>
          </div>
          {description && (
            <p className="text-body text-muted-foreground max-w-prose">
              {description}
            </p>
          )}
          <ul className="flex flex-col gap-0.5 text-caption text-muted-foreground">
            {module.counts.categories > 0 && (
              // A category module is one folder; report its symbols, not the
              // (always-1) category count — matches the library card.
              <li>
                {t("itemsSymbols", {
                  count: module.categories.reduce(
                    (sum, cat) => sum + cat.symbols.length,
                    0,
                  ),
                })}
              </li>
            )}
            {module.counts.lists > 0 && (
              <li>{t("itemsLists", { count: module.counts.lists })}</li>
            )}
            {sentences.length > 0 && (
              <li>{t("itemsSentences", { count: sentences.length })}</li>
            )}
          </ul>
        </div>
      </header>

      {module.categories.length > 0 && (
        <section className="border-t border-border pt-8 mb-10">
          <h2 className="text-subheading font-semibold text-foreground mb-5">
            {t("detailSectionCategories")}
          </h2>
          <div className="flex flex-col gap-8">
            {module.categories.map((cat, ci) => (
              <div key={ci} className="flex flex-col gap-3">
                <h3 className="text-body font-medium text-foreground">
                  {displayString(cat.name, locale, DEFAULT_LOCALE)}
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {cat.symbols.map((sym) => (
                    <SymbolTile key={sym.order} symbol={sym} locale={locale} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {module.lists.length > 0 && (
        <section className="border-t border-border pt-8 mb-10">
          <h2 className="text-subheading font-semibold text-foreground mb-5">
            {t("detailSectionLists")}
          </h2>
          <div className="flex flex-col gap-8">
            {module.lists.map((list, li) => (
              <div key={li} className="flex flex-col gap-3">
                <h3 className="text-body font-medium text-foreground">
                  {displayString(list.name, locale, DEFAULT_LOCALE)}
                </h3>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                  {list.items.map((item) => (
                    <SymbolTile key={item.order} symbol={item} locale={locale} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {sentences.length > 0 && (
        <section className="border-t border-border pt-8 mb-10">
          <h2 className="text-subheading font-semibold text-foreground mb-5">
            {t("detailSectionSentences")}
          </h2>
          <div className="flex flex-col gap-8">
            {sentences.map((sent, si) => {
              // A talker-saved sentence groups words into phrase units. Requires
              // BOTH playback and non-empty units, mirroring the app's
              // isSequenceRow — a legacy row with one but not the other falls
              // back to flat rather than rendering something half-formed.
              //
              // The language is the SENTENCE's authoredLanguage, not the page
              // locale. Collapsing already picked this locale's variant where one
              // exists, so they normally match; they differ exactly when a locale
              // has no variant, and there the authored language is correct — the
              // alternative resolves an English variant's units against `es` and
              // yields a half-Spanish sentence in English word order.
              const blocks =
                sent.playback === "sequence" && sent.units && sent.units.length > 0
                  ? blocksFromUnits(sent.units, sent.authoredLanguage ?? DEFAULT_LOCALE)
                  : null;
              return (
                // Each sentence sits on its own band so the title and its symbols
                // read as one unit. A sentence is only as wide as its words, so
                // without a full-width ground a short one and a long one look
                // like unrelated fragments floating on the page. `zinc-500/5`
                // rather than a solid grey: it tints whatever is behind it, so
                // the band stays equally subtle in light and dark mode.
                <div
                  key={si}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-zinc-500/5 p-4 sm:p-5"
                >
                  <h3 className="text-body font-medium text-foreground">
                    {sentenceTitle(sent)}
                  </h3>
                  {blocks ? (
                    <div className="flex flex-wrap items-end gap-3">
                      {blocks.map((b, i) => (
                        <CompositionBlock key={i} block={b} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {sent.slots.map((slot) => (
                        <div key={slot.order} className="w-20 shrink-0">
                          <SymbolTile symbol={slot} locale={locale} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="border-t border-border pt-8">
        <div className="max-w-md">
          <InstallModuleButton
            slug={module.slug}
            tree={module.tree}
            tier={module.tier}
          />
        </div>
      </section>
    </div>
  );
}
