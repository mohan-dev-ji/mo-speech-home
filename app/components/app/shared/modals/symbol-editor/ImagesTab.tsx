"use client";

import { useEffect, useState } from "react";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { Search, X, ExternalLink, Lock, AlertCircle } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAppState } from "@/app/contexts/AppStateProvider";
import type { ImageProvider, ImageSearchResult } from "@/lib/image-providers/types";
import type { Draft } from "./types";

const FEATURE = "imageSearch";
const DAILY_LIMIT = 30;

type SearchResponse = {
  results: ImageSearchResult[];
  cached: boolean;
  providersUsed: ImageProvider[];
  providersEnabled: ImageProvider[];
  remaining: number | null;
};

/**
 * Visual identity per provider. Letter + colour pair appears as a small badge
 * on each thumbnail so the admin can tell at a glance which source they're
 * about to pick. Colours are intentionally fixed (not theme-mapped) so the
 * badge stays legible against any image, on any theme.
 */
const PROVIDER_BADGES: Record<ImageProvider, { letter: string; bg: string }> = {
  wikimedia: { letter: "W", bg: "#555555" },
  pixabay: { letter: "P", bg: "#2EC66B" },
  unsplash: { letter: "U", bg: "#111111" },
  pexels: { letter: "X", bg: "#05A081" },
};

function resultKey(r: ImageSearchResult): string {
  return `${r.provider}:${r.providerId}`;
}

type Props = {
  draft: Draft;
  patch: (partial: Partial<Draft>) => void;
  onImageSelected: (blob: Blob, previewUrl: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
};

export function ImagesTab({
  patch,
  onImageSelected,
  searchQuery,
  setSearchQuery,
}: Props) {
  const t = useTranslations("symbolEditor");
  const { subscription } = useAppState();
  const isMax = subscription.tier === "max";

  const [debouncedSearch, setDebouncedSearch] = useState(searchQuery.trim());
  const [results, setResults] = useState<ImageSearchResult[] | null>(null);
  const [providersUsed, setProvidersUsed] = useState<ImageProvider[]>([]);
  const [providersEnabled, setProvidersEnabled] = useState<ImageProvider[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [isFetchingFull, setIsFetchingFull] = useState(false);

  const remaining = useQuery(
    api.featureQuota.getRemaining,
    isMax ? { feature: FEATURE, limit: DAILY_LIMIT } : "skip"
  );

  // ── Debounce ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 350);
    return () => clearTimeout(id);
  }, [searchQuery]);

  // ── Search ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMax) return;
    if (!debouncedSearch) {
      setResults(null);
      setProvidersUsed([]);
      setProvidersEnabled([]);
      setSearchError(null);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    setSearchError(null);

    fetch("/api/image-search/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: debouncedSearch, page: 0 }),
    })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 429) {
          setResults([]);
          setSearchError(t("imageSearchQuotaExceeded"));
          return;
        }
        if (!res.ok) {
          setResults([]);
          setSearchError(t("imageSearchError"));
          return;
        }
        const json = (await res.json()) as SearchResponse;
        setResults(json.results);
        setProvidersUsed(json.providersUsed ?? []);
        setProvidersEnabled(json.providersEnabled ?? []);
      })
      .catch(() => {
        if (!cancelled) setSearchError(t("imageSearchError"));
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, isMax, t]);

  // ── Select ─────────────────────────────────────────────────────────────────
  async function handleSelect(result: ImageSearchResult) {
    setSelectedKey(resultKey(result));
    setIsFetchingFull(true);
    setSearchError(null);
    try {
      const res = await fetch("/api/image-search/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullImageUrl: result.fullImageUrl,
          provider: result.provider,
          providerId: result.providerId,
        }),
      });
      if (!res.ok) {
        setSearchError(t("imageSearchError"));
        return;
      }
      const blob = await res.blob();
      const previewUrl = URL.createObjectURL(blob);
      onImageSelected(blob, previewUrl);
      // Picking an image always overwrites the description label with the
      // search query (Image Search has no canonical "word" — the query that
      // surfaced the image is the closest equivalent). Decoupled afterwards:
      // editing the label doesn't echo back into the search bar.
      const trimmedQuery = searchQuery.trim();
      patch({
        resolvedImagePath: undefined,
        imageSourceUrl: result.sourceUrl,
        imageAttribution: result.attribution,
        imageLicense: result.license,
        imageProvider: result.provider,
        ...(trimmedQuery ? { labelEng: trimmedQuery } : {}),
      });
    } catch {
      setSearchError(t("imageSearchError"));
    } finally {
      setIsFetchingFull(false);
    }
  }

  // ── Tier gate ──────────────────────────────────────────────────────────────
  if (!isMax) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-full p-6 text-center">
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center"
          style={{ background: "var(--theme-symbol-bg)" }}
        >
          <Lock className="w-6 h-6" style={{ color: "var(--theme-secondary-text)" }} />
        </div>
        <h3 className="text-theme-m font-semibold" style={{ color: "var(--theme-text)" }}>
          {t("imageSearchUpsellTitle")}
        </h3>
        <p
          className="text-theme-s max-w-xs"
          style={{ color: "var(--theme-secondary-text)" }}
        >
          {t("imageSearchUpsellBody")}
        </p>
      </div>
    );
  }

  const someProvidersUnavailable =
    providersEnabled.length > 0 && providersUsed.length < providersEnabled.length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="p-3 shrink-0">
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{
            background: "var(--theme-symbol-bg)",
            border: "1px solid var(--theme-button-highlight)",
          }}
        >
          <Search className="w-4 h-4 shrink-0" style={{ color: "var(--theme-secondary-text)" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("imageSearchPlaceholder")}
            className="flex-1 bg-transparent text-theme-s outline-none"
            style={{ color: "var(--theme-text)" }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setDebouncedSearch("");
              }}
              style={{ color: "var(--theme-secondary-text)" }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto px-3">
        {!debouncedSearch && (
          <div className="flex items-center justify-center h-32">
            <p className="text-theme-s text-center" style={{ color: "var(--theme-secondary-text)" }}>
              {t("imageSearchEmpty")}
            </p>
          </div>
        )}

        {isSearching && (
          <div className="flex items-center justify-center h-32">
            <p className="text-theme-s" style={{ color: "var(--theme-secondary-text)" }}>
              {t("imageSearchLoading")}
            </p>
          </div>
        )}

        {searchError && (
          <div className="flex items-center gap-2 p-3 rounded-theme-sm mb-2"
               style={{ background: "var(--theme-symbol-bg)", color: "var(--theme-warning)" }}>
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-theme-xs">{searchError}</span>
          </div>
        )}

        {!isSearching && debouncedSearch && results?.length === 0 && !searchError && (
          <div className="flex items-center justify-center h-32">
            <p className="text-theme-s text-center" style={{ color: "var(--theme-secondary-text)" }}>
              {t("imageSearchNoResults", { query: debouncedSearch })}
            </p>
          </div>
        )}

        {results && results.length > 0 && (
          <>
            <div
              className="text-theme-xs pb-2"
              style={{ color: "var(--theme-secondary-text)" }}
            >
              {results.length} results · {providersUsed.length} provider
              {providersUsed.length === 1 ? "" : "s"}
              {someProvidersUnavailable ? " · some providers unavailable" : ""}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-3">
              {results.map((r) => {
                const key = resultKey(r);
                const isSelected = selectedKey === key;
                const badge = PROVIDER_BADGES[r.provider];
                return (
                  <div
                    key={key}
                    className="flex flex-col gap-1 rounded-theme-sm p-2"
                    style={{
                      background: isSelected
                        ? "color-mix(in srgb, var(--theme-brand-primary) 12%, transparent)"
                        : "var(--theme-symbol-bg)",
                      border: `2px solid ${isSelected ? "var(--theme-brand-primary)" : "transparent"}`,
                      opacity: isFetchingFull && !isSelected ? 0.5 : 1,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelect(r)}
                      disabled={isFetchingFull}
                      className="relative flex flex-col items-center gap-1 w-full"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={r.thumbnailUrl}
                        alt={r.title}
                        className="w-full aspect-square object-contain rounded bg-white"
                      />
                      <span
                        aria-label={`Source: ${r.provider}`}
                        className="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold leading-none"
                        style={{ background: badge.bg, color: "#ffffff" }}
                      >
                        {badge.letter}
                      </span>
                    </button>
                    <div className="flex items-center justify-between gap-1 min-w-0">
                      <span
                        className="text-theme-xs truncate"
                        style={{ color: "var(--theme-secondary-text)" }}
                        title={`${r.license} · ${r.attribution}`}
                      >
                        {r.license} · {r.attribution}
                      </span>
                      <a
                        href={r.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0"
                        style={{ color: "var(--theme-secondary-text)" }}
                        title={t("imageSearchAttributionLink")}
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Quota footer */}
      {remaining && (
        <div
          className="shrink-0 px-3 py-2 text-theme-xs text-center"
          style={{
            color: "var(--theme-secondary-text)",
            borderTop: "1px solid var(--theme-button-highlight)",
          }}
        >
          {t("imageSearchesLeft", { count: remaining.remaining })}
        </div>
      )}
    </div>
  );
}
