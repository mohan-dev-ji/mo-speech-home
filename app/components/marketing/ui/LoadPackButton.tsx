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

// Tint the active CTA by the pack's tier so the colour reinforces what the
// user is unlocking (or already on). Free packs get green, Pro packs get
// the brand colour, Max packs get amber.
//
// References the raw `:root` colour variables (`--success`, `--primary`,
// `--warning`) directly. These are reliably exposed at runtime — the
// `--color-tier-*` tokens defined in `@theme inline` in globals.css are
// only guaranteed to generate Tailwind utilities, not always to surface
// as document-level CSS custom properties. Using the underlying tokens
// keeps the brand-repaint property (change one `:root` value and tier
// colour follows) without depending on `@theme inline`'s var exposure.
const TIER_BG_STYLE: Record<
  "free" | "pro" | "max",
  React.CSSProperties
> = {
  free: { backgroundColor: "rgb(var(--success))" },
  pro:  { backgroundColor: "rgb(var(--primary))" },
  max:  { backgroundColor: "rgb(var(--warning))" },
};

type Props = {
  packSlug: string;
  packTier: "free" | "pro" | "max";
  isStarter: boolean;
  // `locale` no longer needed — the locale-aware router auto-prefixes — but
  // kept for callers (LibraryPackCard) that may still pass it; ignored here.
  locale?: string;
};

const RESUME_KEY = "library:resume";

/**
 * Auth-aware CTA for a library pack card. Renders one of:
 * - "Sign up to load" (logged out)
 * - "Already on your account" (signed in + starter pack)
 * - "Upgrade to load" (signed in, free tier, gated pack)
 * - "Load into profile" (signed in, tier sufficient)
 *
 * Reads access via getMyAccess directly — useSubscription is unavailable here
 * because AppStateProvider lives inside the AAC shell, not the public route.
 *
 * Per ADR-010 (Phase 5): packs are identified by slug, not Convex Id.
 */
export function LoadPackButton({ packSlug, packTier, isStarter }: Props) {
  const t = useTranslations("library");
  const router = useRouter();
  const { isLoaded, isSignedIn } = useUser();
  const access = useQuery(
    api.users.getMyAccess,
    isSignedIn ? {} : "skip"
  );
  const loadedPackSlugs = useQuery(
    api.resourcePacks.getMyLoadedPackSlugs,
    isSignedIn ? {} : "skip"
  );
  const loadPack = useMutation(api.resourcePacks.loadResourcePackV2);
  const { showToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  if (
    !isLoaded ||
    (isSignedIn && (access === undefined || loadedPackSlugs === undefined))
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
        style={TIER_BG_STYLE[packTier]}
        onClick={() => {
          try {
            localStorage.setItem(
              RESUME_KEY,
              JSON.stringify({ packSlug, ts: Date.now() })
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

  const alreadyLoaded =
    isStarter || (loadedPackSlugs?.includes(packSlug) ?? false);

  if (alreadyLoaded) {
    return (
      <Button variant="secondary" size="md" disabled className="w-full">
        {t("ctaAlreadyOnAccount")}
      </Button>
    );
  }

  const tier = access?.tier ?? "free";
  const hasFullAccess = access?.hasFullAccess ?? false;
  const tierSufficient =
    packTier === "free" ||
    (packTier === "pro" && hasFullAccess && (tier === "pro" || tier === "max")) ||
    (packTier === "max" && hasFullAccess && tier === "max");

  if (!tierSufficient) {
    return (
      <Button
        variant="primary"
        size="md"
        className="w-full"
        style={TIER_BG_STYLE[packTier]}
        onClick={() =>
          router.push(`/settings?modal=plan`)
        }
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
      style={TIER_BG_STYLE[packTier]}
      onClick={async () => {
        setSubmitting(true);
        try {
          await loadPack({ packSlug });
          track("pack_loaded", {
            slug: packSlug,
            tier_at_load: packTier,
            source: "library",
          });
          showToast({ tone: "info", title: t("loadSuccessToast") });
          router.push("/categories");
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
            if (code === "ALREADY_LOADED") {
              showToast({ tone: "info", title: t("errorAlreadyLoaded") });
              return;
            }
          }
          showToast({ tone: "warning", title: t("loadErrorToast") });
        } finally {
          setSubmitting(false);
        }
      }}
    >
      {submitting ? t("ctaLoading") : t("ctaLoad")}
    </Button>
  );
}
