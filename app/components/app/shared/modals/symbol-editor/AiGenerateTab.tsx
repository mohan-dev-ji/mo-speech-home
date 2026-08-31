"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { Sparkles, Lock, AlertCircle, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAppState } from "@/app/contexts/AppStateProvider";
import { STYLE_PRESETS, STYLE_IDS, type StyleId } from "@/lib/ai-style-prompts";
import type { Draft } from "./types";
import { toResizedWebp } from "./resizeImage";
import {
  AI_IMAGE_DAILY_LIMIT_DEFAULT,
  AI_IMAGE_MONTHLY_LIMIT_DEFAULT,
} from "@/lib/ai-image-limits";

const FEATURE = "aiImageGenerate";

type Props = {
  draft: Draft;
  patch: (partial: Partial<Draft>) => void;
  onImageSelected: (blob: Blob, previewUrl: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
};

const STYLE_TRANSLATION_KEYS: Record<StyleId, string> = {
  photorealistic: "aiStylePhotorealistic",
  iconic: "aiStyleIconic",
  storybook: "aiStyleStorybook",
  claymation: "aiStyleClaymation",
};

export function AiGenerateTab({
  patch,
  onImageSelected,
  searchQuery,
  setSearchQuery,
}: Props) {
  const t = useTranslations("symbolEditor");
  const { subscription } = useAppState();
  const isMax = subscription.tier === "max";

  const [style, setStyle] = useState<StyleId>("iconic");
  // The AI prompt IS the shared search query — typing here updates the same
  // string that SymbolStix and Image Search read from.
  const prompt = searchQuery;
  const setPrompt = setSearchQuery;
  const [isGenerating, setIsGenerating] = useState(false);
  // THE SESSION REEL (ADR-023). With no server-side cache, an image that is
  // dropped is gone for good — so everything generated this session stays in
  // memory until the modal closes. Blobs are already resized to the 512px
  // webp on arrival, so ten of them cost ~200KB, not ~9MB.
  const REEL_MAX = 10;
  const [reel, setReel] = useState<{ blob: Blob; url: string }[]>([]);
  const [reelIndex, setReelIndex] = useState(0);
  const current = reel[reelIndex] ?? null;
  const [error, setError] = useState<string | null>(null);

  // A ref mirroring the reel, so unmount cleanup can revoke every URL without
  // reading a stale closure and without setting state during unmount.
  const reelRef = useRef<{ blob: Blob; url: string }[]>([]);
  useEffect(() => {
    reelRef.current = reel;
  }, [reel]);

  // Revoke on unmount ONLY — the empty dependency array is deliberate.
  // Revoking on each reel change would kill URLs the reel is still showing.
  useEffect(() => {
    return () => {
      reelRef.current.forEach((e) => URL.revokeObjectURL(e.url));
    };
  }, []);

  const quota = useQuery(
    api.featureQuota.getRemainingDual,
    isMax
      ? {
          feature: FEATURE,
          dailyLimit: AI_IMAGE_DAILY_LIMIT_DEFAULT,
          monthlyLimit: AI_IMAGE_MONTHLY_LIMIT_DEFAULT,
        }
      : "skip"
  );

  // ── Generate ─────────────────────────────────────────────────────────────
  async function handleGenerate() {
    const trimmed = prompt.trim();
    if (!trimmed || isGenerating) return;
    setError(null);
    setIsGenerating(true);
    try {
      const res = await fetch("/api/ai-generate/imagen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed, style }),
      });
      if (res.status === 429) {
        const body = (await res.json().catch(() => null)) as
          | { meter?: "day" | "month"; limit?: number }
          | null;
        setError(
          body?.meter === "month"
            ? t("aiQuotaExceededMonth", { limit: body.limit ?? AI_IMAGE_MONTHLY_LIMIT_DEFAULT })
            : t("aiQuotaExceeded", { limit: body?.limit ?? AI_IMAGE_DAILY_LIMIT_DEFAULT })
        );
        return;
      }
      // 422 = the model REFUSED this prompt+style, rather than failing
      // (MOS-40). Deterministic: the identical request will be refused
      // identically, so "please try again" is actively bad advice — it costs
      // the user another attempt to learn nothing. Different copy, telling
      // them to change the wording instead. The quota is refunded server-side
      // either way, so a refusal no longer consumes one of the ten.
      if (res.status === 422) {
        setError(t("aiGenerationRefused"));
        return;
      }
      if (!res.ok) {
        setError(t("aiGenerationError"));
        return;
      }
      // Server returns the PNG bytes inline (avoids cross-origin R2 fetch).
      // Resize HERE, not at adoption. The preview is then the exact artefact
      // that gets saved — no surprise on save — and the reel holds ~20KB
      // webps instead of ~880KB PNGs.
      const raw = await res.blob();
      const blob = await toResizedWebp(raw);
      const url = URL.createObjectURL(blob);
      // Computed here rather than inside a setState updater: revoking a URL
      // is a side effect and React 19 double-invokes updaters in StrictMode.
      // Safe against races because `isGenerating` serialises generation.
      const next = [...reel, { blob, url }];
      if (next.length > REEL_MAX) {
        URL.revokeObjectURL(next[0].url);
        next.shift();
      }
      setReel(next);
      setReelIndex(next.length - 1);
    } catch {
      setError(t("aiGenerationError"));
    } finally {
      setIsGenerating(false);
    }
  }

  // ── Add to Symbol — hand the already-resized reel entry to the modal ─────
  async function handleAddToSymbol() {
    if (!current) return;
    // Already a 512px webp — resized on arrival, so there is nothing to do
    // here but hand it over.
    onImageSelected(current.blob, current.url);
    // Adding the generated image always overwrites the description label
    // with the prompt — the prompt IS the word/concept the user generated
    // for. Decoupled afterwards: editing the label doesn't echo back.
    const trimmedPrompt = prompt.trim();
    patch({
      resolvedImagePath: undefined,
      // Clear any prior image-search attribution from a different tab.
      imageSourceUrl: undefined,
      imageAttribution: undefined,
      imageLicense: undefined,
      imageProvider: undefined,
      imageTitle: undefined,
      ...(trimmedPrompt ? { labelEng: trimmedPrompt, aiPrompt: trimmedPrompt } : {}),
    });
  }

  // Steps back rather than binning everything: the previous image was paid
  // for and cannot be regenerated identically.
  function handleDiscard() {
    setError(null);
    if (reel.length === 0) return;
    const next = reel.filter((_, i) => i !== reelIndex);
    URL.revokeObjectURL(reel[reelIndex].url);
    setReel(next);
    setReelIndex(Math.max(0, Math.min(reelIndex, next.length - 1)));
  }

  // ── Tier gate ────────────────────────────────────────────────────────────
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
          {t("aiUpsellTitle")}
        </h3>
        <p
          className="text-theme-s max-w-xs"
          style={{ color: "var(--theme-secondary-text)" }}
        >
          {t("aiUpsellBody")}
        </p>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
      {/* Preview */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.url}
            alt={prompt}
            className="max-w-full max-h-full object-contain rounded-theme bg-white"
            style={{ border: "1px solid var(--theme-button-highlight)" }}
          />
        ) : isGenerating ? (
          <div className="flex flex-col items-center gap-2">
            <Sparkles
              className="w-8 h-8 animate-pulse"
              style={{ color: "var(--theme-brand-primary)" }}
            />
            <p className="text-theme-s" style={{ color: "var(--theme-secondary-text)" }}>
              {t("aiGenerating")}
            </p>
          </div>
        ) : (
          <p
            className="text-theme-s text-center max-w-xs"
            style={{ color: "var(--theme-secondary-text)" }}
          >
            {t("aiEmptyState")}
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div
          className="mx-3 mb-2 flex items-center gap-2 p-3 rounded-theme-sm shrink-0"
          style={{ background: "var(--theme-symbol-bg)", color: "var(--theme-warning)" }}
        >
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-theme-xs flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            style={{ color: "var(--theme-secondary-text)" }}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Style cards */}
      <div className="px-3 pb-2 shrink-0">
        <div className="grid grid-cols-4 gap-1.5">
          {STYLE_IDS.map((id) => {
            const isSelected = style === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setStyle(id)}
                className="rounded-theme-sm py-2 px-1 text-theme-xs font-medium"
                style={{
                  background: isSelected
                    ? "color-mix(in srgb, var(--theme-brand-primary) 15%, transparent)"
                    : "var(--theme-symbol-bg)",
                  border: `2px solid ${
                    isSelected ? "var(--theme-brand-primary)" : "transparent"
                  }`,
                  color: isSelected
                    ? "var(--theme-brand-primary)"
                    : "var(--theme-secondary-text)",
                }}
              >
                {t(STYLE_TRANSLATION_KEYS[id])}
              </button>
            );
          })}
        </div>
      </div>

      {/* Prompt + actions */}
      <div className="px-3 pb-3 shrink-0 flex flex-col gap-2">
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{
            background: "var(--theme-symbol-bg)",
            border: "1px solid var(--theme-button-highlight)",
          }}
        >
          <Sparkles
            className="w-4 h-4 shrink-0"
            style={{ color: "var(--theme-secondary-text)" }}
          />
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isGenerating) handleGenerate();
            }}
            placeholder={t("aiPromptPlaceholder")}
            maxLength={500}
            className="flex-1 bg-transparent text-theme-s outline-none"
            style={{ color: "var(--theme-text)" }}
          />
        </div>

        {current ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              className="flex-1 py-2 rounded-theme-sm text-theme-s font-semibold"
              style={{
                background: "var(--theme-symbol-bg)",
                color: "var(--theme-secondary-text)",
                border: "1px solid var(--theme-button-highlight)",
              }}
            >
              {t("aiDiscardChanges")}
            </button>
            <button
              type="button"
              onClick={handleAddToSymbol}
              className="flex-1 py-2 rounded-theme-sm text-theme-s font-semibold"
              style={{
                background: "var(--theme-brand-primary)",
                color: "var(--theme-alt-text)",
                opacity: 1,
              }}
            >
              {t("aiAddToSymbol")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="w-full py-2 rounded-theme-sm text-theme-s font-semibold"
            style={{
              background: "var(--theme-brand-primary)",
              color: "var(--theme-alt-text)",
              opacity: isGenerating || !prompt.trim() ? 0.5 : 1,
            }}
          >
            {isGenerating ? t("aiGenerating") : t("aiGenerate")}
          </button>
        )}
      </div>

      {/* Quota footer */}
      {quota && (
        <div
          className="shrink-0 px-3 py-2 text-theme-xs text-center"
          style={{
            color: "var(--theme-secondary-text)",
            borderTop: "1px solid var(--theme-button-highlight)",
          }}
        >
          {t("aiGenerationsLeft", {
            daily: quota.daily.remaining,
            monthly: quota.monthly.remaining,
          })}
        </div>
      )}
    </div>
  );
}
