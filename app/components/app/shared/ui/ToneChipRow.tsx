"use client";

// Emoji tone row for the play modals (Phase 15, Thread 2 — Figma Frame 3).
// A plain row of emoji beneath the existing ▶ replay control. The ▶ replay is
// the free Wavenet voice; every emoji here plays a fluent whole-utterance
// Gemini clip WITH tone — a Max-tier feature — so tapping any chip on a
// non-Max plan opens the UpgradeNudge instead of playing. Server-side the
// /api/tts route enforces the same gate (defence in depth).

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useAppState } from "@/app/contexts/AppStateProvider";
import { UpgradeNudge } from "@/app/components/app/shared/ui/UpgradeNudge";
import { TONE_CHIPS, type Tone } from "@/lib/audio/tonePresets";

// The "now playing" yellow bloom, shape-following (drop-shadow, not a box) so it
// hugs the emoji rather than drawing the rounded card we removed. Same
// --theme-play-glow colour the block/sentence glow uses.
const PLAY_GLOW_FILTER =
  "drop-shadow(0 0 6px var(--theme-play-glow)) drop-shadow(0 0 16px var(--theme-play-glow))";

export function ToneChipRow({
  activeTone,
  busy = false,
  onSelect,
}: {
  /** The tone currently sounding — drives the selected highlight. */
  activeTone?: Tone | null;
  /** True while a clip is being resolved/synthesised — disables the row. */
  busy?: boolean;
  /** Called with the chosen tone once the Max gate is cleared. */
  onSelect: (tone: Tone) => void;
}) {
  const t = useTranslations("tone");
  const locale = useLocale();
  const { subscription } = useAppState();
  const isMax = subscription.tier === "max";
  const [nudgeOpen, setNudgeOpen] = useState(false);

  function tap(tone: Tone) {
    if (!isMax) {
      setNudgeOpen(true);
      return;
    }
    onSelect(tone);
  }

  return (
    <>
      {/* No overflow-x here: a scaled/glowing child inside an overflow-auto row
          spawns scrollbars while a clip plays. Three 72px emoji fit every width. */}
      <div
        role="group"
        aria-label={t("rowLabel")}
        className="flex flex-wrap items-center justify-center gap-theme-gap"
      >
        {TONE_CHIPS.map(({ tone, emoji }) => {
          const selected = activeTone === tone;
          // Loading = the tapped chip while its clip synthesises (a cold first
          // play takes a few seconds). It pulses; a playing clip (selected &&
          // !busy) is a steady glow — so a silent wait can't masquerade as
          // playback.
          const loading = selected && busy;
          return (
            <button
              key={tone}
              type="button"
              onClick={() => tap(tone)}
              disabled={busy}
              aria-label={t(tone)}
              aria-pressed={selected}
              aria-busy={loading}
              className={[
                "shrink-0 bg-transparent leading-none rounded-theme",
                "transition-transform duration-150 will-change-transform",
                "hover:scale-105 active:scale-95",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--theme-play-glow)]",
                "disabled:cursor-default",
                selected ? "scale-110" : "",
                loading ? "motion-safe:animate-pulse" : "",
              ].join(" ")}
              style={{
                fontSize: "var(--tone-emoji-size)",
                filter: selected ? PLAY_GLOW_FILTER : undefined,
              }}
            >
              <span aria-hidden="true">{emoji}</span>
            </button>
          );
        })}
      </div>

      <UpgradeNudge
        open={nudgeOpen}
        onOpenChange={setNudgeOpen}
        feature="expressiveTone"
        locale={locale}
      />
    </>
  );
}
