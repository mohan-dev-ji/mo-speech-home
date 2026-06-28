"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex/_generated/api";
import { Button } from "@/app/components/app/shared/ui/Button";
import { useToast } from "@/app/components/app/shared/ui/Toast";
import { track } from "@/lib/analytics";

export type ModuleTree = "categories" | "lists" | "sentences";

// Same tier-tint convention as LoadPackButton — colour reinforces what the
// user unlocks. References the raw `:root` colour variables directly.
const TIER_BG_STYLE: Record<"free" | "pro" | "max", React.CSSProperties> = {
  free: { backgroundColor: "rgb(var(--success))" },
  pro: { backgroundColor: "rgb(var(--primary))" },
  max: { backgroundColor: "rgb(var(--warning))" },
};

// Per-tree wiring: install mutation, installed-slugs query, and the tree page
// to land on after a successful install. Keyed so the button stays generic.
const TREE_CONFIG = {
  categories: {
    install: api.contentModules.categories.installCategoryModule,
    installedSlugs: api.contentModules.categories.getMyInstalledCategorySlugs,
    landing: "/categories",
  },
  lists: {
    install: api.contentModules.lists.installListModule,
    installedSlugs: api.contentModules.lists.getMyInstalledListSlugs,
    landing: "/lists",
  },
  sentences: {
    install: api.contentModules.sentences.installSentenceModule,
    installedSlugs: api.contentModules.sentences.getMyInstalledSentenceSlugs,
    landing: "/sentences",
  },
} as const;

const RESUME_KEY = "library:resume";

/**
 * Auth-aware CTA for a content-module card (ADR-014 §3). Mirrors
 * {@link LoadPackButton} but installs a single module into the matching tree.
 * Renders one of: sign-up (logged out) · already-installed · upgrade (gated) ·
 * install. "Already installed" comes from the per-tree installed-slugs query —
 * NOT from `isStarter` — because modules are per-account installable/deletable.
 */
export function InstallModuleButton({
  slug,
  tree,
  tier,
}: {
  slug: string;
  tree: ModuleTree;
  tier: "free" | "pro" | "max";
}) {
  const t = useTranslations("library");
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const cfg = TREE_CONFIG[tree];

  const access = useQuery(api.users.getMyAccess, isSignedIn ? {} : "skip");
  const installedSlugs = useQuery(
    cfg.installedSlugs,
    isSignedIn ? {} : "skip"
  );
  const install = useMutation(cfg.install);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  if (
    !isLoaded ||
    (isSignedIn && (access === undefined || installedSlugs === undefined))
  ) {
    return (
      <Button variant="primary" size="md" disabled className="w-full">
        {t("ctaLoading")}
      </Button>
    );
  }

  if (!isSignedIn) {
    return (
      <Button
        variant="primary"
        size="md"
        className="w-full"
        style={TIER_BG_STYLE[tier]}
        onClick={() => {
          try {
            localStorage.setItem(
              RESUME_KEY,
              JSON.stringify({ moduleSlug: slug, tree, ts: Date.now() })
            );
          } catch {
            // localStorage may be blocked (Safari private mode etc.) — non-fatal
          }
          router.push("/sign-up");
        }}
      >
        {t("ctaSignUp")}
      </Button>
    );
  }

  if (installedSlugs?.includes(slug)) {
    // Install-only card (ADR-014 §5, owner decision 2026-06-28): uninstall lives
    // in-app, in the tree's edit-mode trash — never on this marketing surface.
    return (
      <Button variant="secondary" size="md" disabled className="w-full">
        {t("ctaAlreadyInstalled")}
      </Button>
    );
  }

  const userTier = access?.tier ?? "free";
  const hasFullAccess = access?.hasFullAccess ?? false;
  const tierSufficient =
    tier === "free" ||
    (tier === "pro" && hasFullAccess && (userTier === "pro" || userTier === "max")) ||
    (tier === "max" && hasFullAccess && userTier === "max");

  if (!tierSufficient) {
    return (
      <Button
        variant="primary"
        size="md"
        className="w-full"
        style={TIER_BG_STYLE[tier]}
        onClick={() => router.push(`/settings?modal=plan`)}
      >
        {t("ctaUpgrade")}
      </Button>
    );
  }

  return (
    <Button
      variant="primary"
      size="md"
      loading={submitting}
      disabled={submitting}
      className="w-full"
      style={TIER_BG_STYLE[tier]}
      onClick={async () => {
        setSubmitting(true);
        try {
          await install({ slug });
          track("module_installed", { slug, tree, tier_at_install: tier });
          showToast({ tone: "info", title: t("installSuccessToast") });
          router.push(cfg.landing);
        } catch (e: unknown) {
          if (
            e instanceof ConvexError &&
            typeof e.data === "object" &&
            e.data !== null &&
            "code" in e.data
          ) {
            const code = (e.data as { code: string }).code;
            if (code === "TIER_REQUIRED") {
              router.push(`/settings?modal=plan`);
              return;
            }
            if (code === "ALREADY_INSTALLED") {
              showToast({ tone: "info", title: t("errorAlreadyInstalled") });
              return;
            }
          }
          showToast({ tone: "warning", title: t("installErrorToast") });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {submitting ? t("ctaLoading") : t("ctaInstall")}
    </Button>
  );
}
