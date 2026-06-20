"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/app/components/app/shared/ui/Button";
import { IconButton } from "@/app/components/app/shared/ui/IconButton";
import { useToast } from "@/app/components/app/shared/ui/Toast";
import { UpgradeNudge } from "@/app/components/app/shared/ui/UpgradeNudge";
import { PackCard, type LibraryPack } from "@/app/components/app/home/ui/PackCard";
import { displayString } from "@/lib/languages/displayValue";
import { DEFAULT_LOCALE } from "@/lib/languages/registry";

// PackCard is a fixed w-[180px]; transform scale on queued cards is visual only
// and never changes the layout box, so a card always occupies CARD_W.
const CARD_W = 180;
const GAP_MIN = 16; // gap-theme-gap baseline; the strip only ever widens from here
const SLIDE_MS = 300;

/**
 * Per-pack copy block — keyed by slug so each selection remounts and fades in.
 * Mirrors the pack's `/[locale]/library/[slug]` hero: eyebrow + name +
 * description + counts, then the Resource Library CTA.
 */
function CopyBlock({
  pack,
  locale,
  eyebrow,
  buttonLabel,
  href,
}: {
  pack: LibraryPack;
  locale: string;
  eyebrow: string;
  buttonLabel: string;
  href: string;
}) {
  const tl = useTranslations("library");
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const name = displayString(pack.name, locale, DEFAULT_LOCALE);
  const description = displayString(pack.description, locale, DEFAULT_LOCALE);

  return (
    <div
      className={`flex flex-col h-full gap-theme-elements transition-opacity duration-300 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
    >
      <span className="text-theme-xs uppercase tracking-wide text-theme-secondary-alt-text">
        {eyebrow}
      </span>
      <h2 className="text-theme-h4 font-bold text-theme-alt-text">{name}</h2>
      {description && (
        <p className="text-theme-s text-theme-secondary-alt-text">{description}</p>
      )}
      <ul className="flex flex-col gap-0.5 text-theme-xs text-theme-secondary-alt-text">
        {pack.counts.categories > 0 && (
          <li>{tl("itemsCategories", { count: pack.counts.categories })}</li>
        )}
        {pack.counts.lists > 0 && <li>{tl("itemsLists", { count: pack.counts.lists })}</li>}
        {pack.counts.sentences > 0 && (
          <li>{tl("itemsSentences", { count: pack.counts.sentences })}</li>
        )}
      </ul>
      <Link href={href} className="mt-auto pt-3 inline-flex">
        <Button variant="primary" size="sm" icon={<ArrowRight className="w-3.5 h-3.5" />}>
          {buttonLabel}
        </Button>
      </Link>
    </div>
  );
}

/**
 * Library-packs carousel (Figma `1403:22954`, reworked). One pack featured
 * large/sharp at the far-left of the strip with the rest queued smaller +
 * blurred to its right; prev/next chevrons step the selection. The left copy
 * reflects the selected pack (same copy as its `/library/[slug]` page). Reuses
 * the `resourcePacks` Convex layer directly — Load / Already-Loaded state and
 * the `loadResourcePackV2` action are unchanged from the flat version.
 */
export function LibraryPacksSection() {
  const t = useTranslations("home");
  const params = useParams();
  const locale = params.locale as string;
  const { showToast } = useToast();

  const catalogue = useQuery(api.resourcePacks.getPublicLibraryCatalogueV2, {});
  const loadedSlugs = useQuery(api.resourcePacks.getMyLoadedPackSlugs, {});
  const loadPack = useMutation(api.resourcePacks.loadResourcePackV2);

  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [upgradeNudgeOpen, setUpgradeNudgeOpen] = useState(false);

  // ── Carousel state ─────────────────────────────────────────────────────────
  // `order` is the live ring; order[0] is the featured (sharp, far-left) pack and
  // drives the copy. `focusIndex` is which index renders sharp (0 at rest, 1 mid-
  // slide so focus animates with the motion). A step slides one pitch, then the
  // ring rotates and the transform snaps back to 0 with the transition disabled —
  // a seamless infinite loop where the just-viewed card lands at the back.
  const [order, setOrder] = useState<LibraryPack[]>([]);
  const [gap, setGap] = useState(GAP_MIN);
  const [translate, setTranslate] = useState(0);
  const [focusIndex, setFocusIndex] = useState(0);
  const [noTransition, setNoTransition] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);

  const loaded = new Set(loadedSlugs ?? []);

  // Sync the ring from the catalogue (resets rotation only when the pack set changes).
  const catalogueKey = catalogue?.map((p) => p.slug).join(",") ?? "";
  useEffect(() => {
    if (catalogue) setOrder(catalogue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogueKey]);

  // Justify the gap so the viewport shows a whole number of full cards — the
  // leftover width is distributed into the gaps (never clips a partial card).
  const measure = useCallback(() => {
    const el = viewportRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const n = Math.max(1, Math.floor((vw + GAP_MIN) / (CARD_W + GAP_MIN)));
    setGap(n > 1 ? (vw - n * CARD_W) / (n - 1) : GAP_MIN);
  }, []);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);

  // Re-measure when the chevrons mount/unmount (they're siblings of the viewport,
  // so they change its width) and once the catalogue first populates the strip —
  // a ResizeObserver alone can miss these sibling-driven layout shifts.
  useEffect(() => {
    measure();
  }, [measure, catalogueKey, order.length]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  async function handleLoad(slug: string) {
    setLoadingSlug(slug);
    try {
      await loadPack({ packSlug: slug });
      // Queries are reactive — the card flips to Already-Loaded on its own.
    } catch (err) {
      // Free tier loading a Pro/Max pack → nudge upgrade, like the rest of the app.
      const code =
        err instanceof ConvexError ? (err.data as { code?: string })?.code : undefined;
      if (code === "TIER_REQUIRED") {
        setUpgradeNudgeOpen(true);
      } else {
        showToast({ tone: "warning", title: t("packLoadError") });
      }
    } finally {
      setLoadingSlug(null);
    }
  }

  // A short paint delay between toggling the transition off (to snap the
  // transform home) and back on, so the snap itself doesn't animate.
  const SNAP_MS = 40;

  function next() {
    if (busyRef.current || order.length < 2) return;
    busyRef.current = true;
    const pitch = CARD_W + gap;
    setFocusIndex(1); // index 1 sharpens as it slides into the featured slot
    setNoTransition(false);
    setTranslate(-pitch);
    timerRef.current = setTimeout(() => {
      // Rotate front → back and snap the transform home with the transition off.
      setNoTransition(true);
      setOrder((o) => [...o.slice(1), o[0]]);
      setTranslate(0);
      setFocusIndex(0);
      timerRef.current = setTimeout(() => {
        setNoTransition(false);
        busyRef.current = false;
      }, SNAP_MS);
    }, SLIDE_MS);
  }

  function prev() {
    if (busyRef.current || order.length < 2) return;
    busyRef.current = true;
    const pitch = CARD_W + gap;
    // Pre-position the back card at the front, one pitch off-screen left, no anim.
    setNoTransition(true);
    setOrder((o) => [o[o.length - 1], ...o.slice(0, -1)]);
    setTranslate(-pitch);
    setFocusIndex(1); // the still-featured card sits at index 1 for now
    timerRef.current = setTimeout(() => {
      // Then slide it home — the incoming card sharpens as it arrives.
      setNoTransition(false);
      setTranslate(0);
      setFocusIndex(0);
      timerRef.current = setTimeout(() => {
        busyRef.current = false;
      }, SLIDE_MS);
    }, SNAP_MS);
  }

  const featured = order[0];
  const showChevrons = order.length > 1;

  return (
    <section className="flex flex-col lg:flex-row gap-theme-gap rounded-theme-card bg-theme-card p-theme-general">
      {/* Left copy — reflects the featured pack */}
      <div className="flex flex-col lg:w-[340px] shrink-0">
        {featured ? (
          <CopyBlock
            key={featured.slug}
            pack={featured}
            locale={locale}
            eyebrow={t("libraryPacksHeading")}
            buttonLabel={t("resourceLibrary")}
            href={`/${locale}/library`}
          />
        ) : (
          <p className="text-theme-s text-theme-secondary-alt-text">{t("packLoading")}</p>
        )}
      </div>

      {/* Carousel — [‹] [viewport] [›] */}
      <div className="flex items-center gap-theme-elements flex-1 min-w-0">
        {showChevrons && (
          <IconButton
            variant="neutral"
            size="md"
            icon={<ChevronLeft />}
            label={t("carouselPrev")}
            onClick={prev}
          />
        )}

        <div ref={viewportRef} className="overflow-hidden flex-1 min-w-0 py-1">
          {catalogue === undefined ? (
            <p className="text-theme-s text-theme-secondary-alt-text">{t("packLoading")}</p>
          ) : (
            <div
              className={`flex items-center ${
                noTransition ? "" : "transition-transform duration-300 ease-out"
              }`}
              style={{ gap: `${gap}px`, transform: `translateX(${translate}px)` }}
            >
              {order.map((pack, i) => (
                <div
                  key={pack.slug}
                  className={`shrink-0 transition-all duration-300 ${
                    i === focusIndex
                      ? "scale-100 blur-0 opacity-100"
                      : "scale-[0.85] blur-[2px] opacity-60 pointer-events-none"
                  }`}
                  aria-hidden={i !== focusIndex}
                >
                  <PackCard
                    pack={pack}
                    locale={locale}
                    isLoaded={pack.isStarter || loaded.has(pack.slug)}
                    isLoading={loadingSlug === pack.slug}
                    onLoad={() => handleLoad(pack.slug)}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {showChevrons && (
          <IconButton
            variant="neutral"
            size="md"
            icon={<ChevronRight />}
            label={t("carouselNext")}
            onClick={next}
          />
        )}
      </div>

      <UpgradeNudge open={upgradeNudgeOpen} onOpenChange={setUpgradeNudgeOpen} locale={locale} />
    </section>
  );
}
