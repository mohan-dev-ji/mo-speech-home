"use client";

import { useRef, useState } from "react";
import { useQuery } from "convex/react";
import { useTranslations } from "next-intl";
import { Sparkles, Lock, AlertCircle, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAppState } from "@/app/contexts/AppStateProvider";
import { STYLE_PRESETS, STYLE_IDS, type StyleId } from "@/lib/ai-style-prompts";
import {
  AI_IMAGE_DAILY_LIMIT_DEFAULT,
  AI_IMAGE_MONTHLY_LIMIT_DEFAULT,
} from "@/lib/ai-image-limits";

const FEATURE = "aiImageGenerate";

type Props = {
  /**
   * A generation succeeded and is already in the account's library — the route
   * wrote the 512px webp to R2 and indexed it before returning. The modal
   * switches to My Images and highlights `imageKey`; adoption happens there, by
   * reference, so this tab never hands over bytes and never touches the draft.
   *
   * `style` and `attempts` ride along because the adoption event is fired by
   * the modal (from My Images) and this tab is the only place that knows how
   * many generations this session paid for.
   */
  onGenerated: (result: { imageKey: string; style: StyleId; attempts: number }) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
};

const STYLE_TRANSLATION_KEYS: Record<StyleId, string> = {
  photorealistic: "aiStylePhotorealistic",
  iconic: "aiStyleIconic",
  storybook: "aiStyleStorybook",
  claymation: "aiStyleClaymation",
};

const STYLE_BLURB_KEYS: Record<StyleId, string> = {
  photorealistic: "aiStyleBlurbPhotorealistic",
  iconic: "aiStyleBlurbIconic",
  storybook: "aiStyleBlurbStorybook",
  claymation: "aiStyleBlurbClaymation",
};

// A value no template and no user can contain, used to find where the user's
// words land inside the wrapped prompt. Splitting on this is exact; searching
// the wrapped string for what the user typed is NOT — the templates contain
// words people plausibly type ("white", "text", "no ground"), and the
// highlight would land on the template's own wording instead of theirs.
const PROMPT_SLOT = "\u0000";

/**
 * CREATE ONLY. There is no result view here and no session reel: every
 * generation is written to the account's image library server-side (phase-36),
 * so the images this tab produces are looked at, kept and adopted in My Images.
 * The reel existed because an un-adopted generation was gone the moment the
 * modal closed — that is no longer true of anything.
 */
export function AiGenerateTab({
  onGenerated,
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
  const [error, setError] = useState<string | null>(null);

  // Exactly what the route will send: it calls the same template with the
  // same trimmed prompt, so this display cannot drift from the real request.
  const typedPrompt = prompt.trim();
  // The slot carries the typed prompt's FIRST character so the template picks
  // the same article the route will ("a kite" / "an apple") — the templates
  // choose "a"/"an" from the subject's first letter, and a bare sentinel would
  // always read "a". The NUL sentinel keeps the split exact.
  const slot = `${typedPrompt.charAt(0)}${PROMPT_SLOT}`;
  const wrappedParts = STYLE_PRESETS[style].template(slot).split(slot);

  // Monotonic count of successful generations this session — what the modal
  // reports as `ai_generate_adopted.attempts` when one of them is adopted.
  // This number is what retunes the 20/day + 100/month allowance (FEAT-008
  // §6), so it counts what was SPENT, never what survived.
  const attemptsRef = useRef(0);

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
      //
      // EVERY failure path stays on this tab. There is nothing in the gallery
      // to show for a request that produced no image, and the one thing the
      // user needs to change — the prompt — is right here.
      if (res.status === 422) {
        setError(t("aiGenerationRefused"));
        return;
      }
      if (!res.ok) {
        setError(t("aiGenerationError"));
        return;
      }
      // JSON, not bytes: the image is already in R2 and already indexed in
      // `accountImages`, so all the client needs is the key of the row that
      // just appeared at the top of My Images.
      const body = (await res.json()) as { imageKey?: string };
      if (!body.imageKey) {
        setError(t("aiGenerationError"));
        return;
      }
      attemptsRef.current += 1;
      // Report THIS request's style, not the live selection — by the time the
      // modal fires the adoption event the user may have clicked another
      // style card while looking at the gallery.
      onGenerated({ imageKey: body.imageKey, style, attempts: attemptsRef.current });
    } catch {
      setError(t("aiGenerationError"));
    } finally {
      setIsGenerating(false);
    }
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
      {/* Guidance / spinner */}
      <div className="flex-1 flex items-center justify-center p-4 min-h-0 overflow-y-auto">
        {isGenerating ? (
          <div className="flex flex-col items-center gap-2">
            <Sparkles
              className="w-8 h-8 animate-pulse"
              style={{ color: "var(--theme-brand-primary)" }}
            />
            {/* Names the destination BEFORE the tab switches. Arriving in My
                Images then reads as the thing that was announced, rather than
                as the app taking the wheel. */}
            <p
              className="text-theme-s max-w-xs text-center"
              style={{ color: "var(--theme-secondary-text)" }}
            >
              {t("aiGeneratingToLibrary")}
            </p>
          </div>
        ) : (
          // THE CREATE STAGE, and now the only stage. The lead never changes;
          // the second paragraph follows the selected style, which is what
          // makes clicking a thumbnail informative rather than just a
          // selection.
          <div className="flex flex-col gap-3 max-w-sm text-center">
            <p className="text-theme-s" style={{ color: "var(--theme-text)" }}>
              {t("aiGuidanceLead")}
            </p>
            <p
              className="text-theme-xs"
              style={{ color: "var(--theme-secondary-text)" }}
            >
              {t(STYLE_BLURB_KEYS[style])}
            </p>
            {wrappedParts.length === 2 && (
              <div
                className="w-full rounded-theme-sm p-2 text-left"
                style={{
                  background: "var(--theme-symbol-bg)",
                  border: "1px solid var(--theme-button-highlight)",
                }}
              >
                <p
                  className="text-theme-xs mb-1 font-medium"
                  style={{ color: "var(--theme-secondary-text)" }}
                >
                  {t("aiPromptPreviewLabel")}
                </p>
                <p
                  className="text-theme-xs leading-relaxed"
                  style={{ color: "var(--theme-secondary-text)" }}
                >
                  {wrappedParts[0]}
                  <span
                    style={{
                      color: "var(--theme-brand-primary)",
                      fontWeight: 600,
                    }}
                  >
                    {typedPrompt || t("aiPromptSlotPlaceholder")}
                  </span>
                  {wrappedParts[1]}
                </p>
              </div>
            )}
          </div>
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

      {/* Style cards. Phones: a 2×2 grid of text buttons, thumbnails hidden —
          four 4-up thumbnail cards do not fit a 393px column (Figma 3361:6997).
          md up: the 4-up thumbnail cards. */}
      <div className="px-3 pb-2 shrink-0">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-1.5">
          {STYLE_IDS.map((id) => {
            const isSelected = style === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setStyle(id)}
                aria-pressed={isSelected}
                className="flex flex-col items-center justify-center gap-1 rounded-theme-sm py-2.5 px-2 md:p-1 text-theme-s md:text-theme-xs font-medium"
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
                {/* Decorative: the visible label already names the style, so
                    announcing it twice is noise for a screen-reader user. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={STYLE_PRESETS[id].thumbnail}
                  alt=""
                  aria-hidden="true"
                  className="hidden md:block w-full aspect-square object-contain rounded-theme-sm bg-white"
                  loading="lazy"
                />
                <span>{t(STYLE_TRANSLATION_KEYS[id])}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Prompt + Generate */}
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
          {prompt && (
            <button
              type="button"
              onClick={() => setPrompt("")}
              aria-label={t("aiClearPrompt")}
              className="shrink-0"
              style={{ color: "var(--theme-secondary-text)" }}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

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
          {/* The button says only that it is working — the sentence naming
              where the image is going belongs to the spinner, which has the
              room for it. */}
          {isGenerating ? t("aiGenerating") : t("aiGenerate")}
        </button>
      </div>

      {/* Quota footer */}
      {quota && (
        <div
          className="shrink-0 px-3 py-2 text-theme-xs text-center"
          style={{
            color: "var(--theme-secondary-text)",
            borderTop: "1px solid var(--theme-alt-line)",
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
