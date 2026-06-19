"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/app/components/app/shared/ui/Button";
import { useToast } from "@/app/components/app/shared/ui/Toast";
import { UpgradeNudge } from "@/app/components/app/shared/ui/UpgradeNudge";
import { PackCard } from "@/app/components/app/home/ui/PackCard";

/**
 * Library-packs zone (Figma `1403:22954` + the Pack-card row). Reuses the
 * marketing resource-pack Convex layer directly — no marketing UI — so it works
 * inside the always-signed-in app: catalogue + loaded-slugs decide each card's
 * Load / Already-Loaded state, and `loadResourcePackV2` performs the load.
 */
export function LibraryPacksSection() {
  const t = useTranslations("home");
  const params = useParams();
  const locale = params.locale as string;
  const { showToast } = useToast();

  const catalogue = useQuery(api.resourcePacks.getPublicLibraryCatalogueV2, {});
  const loadedSlugs = useQuery(api.resourcePacks.getMyLoadedPackSlugs, {});
  const loadPack = useMutation(api.resourcePacks.loadResourcePackV2);

  // Slug currently being loaded — drives that card's spinner.
  const [loadingSlug, setLoadingSlug] = useState<string | null>(null);
  const [upgradeNudgeOpen, setUpgradeNudgeOpen] = useState(false);

  const loaded = new Set(loadedSlugs ?? []);

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

  return (
    <section className="flex flex-col lg:flex-row gap-theme-gap rounded-theme-card bg-theme-card p-theme-general">
      {/* Copy block */}
      <div className="flex flex-col gap-theme-elements lg:w-[340px] shrink-0">
        <h2 className="text-theme-h4 font-bold text-theme-alt-text">
          {t("libraryPacksHeading")}
        </h2>
        <p className="text-theme-s text-theme-secondary-alt-text">{t("libraryPacksBody1")}</p>
        <p className="text-theme-s text-theme-secondary-alt-text">{t("libraryPacksBody2")}</p>
        <Link href={`/${locale}/library`} className="mt-2 inline-flex">
          <Button variant="primary" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>
            {t("addMorePacks")}
          </Button>
        </Link>
      </div>

      {/* Pack-card row */}
      <div className="flex gap-theme-gap overflow-x-auto flex-1 pb-1">
        {catalogue === undefined ? (
          <p className="text-theme-s text-theme-secondary-alt-text">{t("packLoading")}</p>
        ) : (
          catalogue.map((pack) => (
            <PackCard
              key={pack.slug}
              pack={pack}
              locale={locale}
              isLoaded={pack.isStarter || loaded.has(pack.slug)}
              isLoading={loadingSlug === pack.slug}
              onLoad={() => handleLoad(pack.slug)}
            />
          ))
        )}
      </div>

      <UpgradeNudge open={upgradeNudgeOpen} onOpenChange={setUpgradeNudgeOpen} locale={locale} />
    </section>
  );
}
