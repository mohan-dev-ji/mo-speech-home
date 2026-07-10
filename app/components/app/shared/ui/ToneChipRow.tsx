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
      <div
        role="group"
        aria-label={t("rowLabel")}
        className="flex items-center justify-center gap-theme-gap max-w-full overflow-x-auto"
      >
        {TONE_CHIPS.map(({ tone, emoji }) => {
          const selected = activeTone === tone;
          return (
            <button
              key={tone}
              type="button"
              onClick={() => tap(tone)}
              disabled={busy}
              aria-label={t(tone)}
              aria-pressed={selected}
              className={[
                "shrink-0 w-14 h-14 flex items-center justify-center rounded-theme text-3xl leading-none",
                "transition-[background,transform] duration-150",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-theme-line",
                "disabled:opacity-40 disabled:cursor-default",
                selected
                  ? "bg-theme-button-primary scale-105"
                  : "bg-transparent hover:bg-theme-symbol-bg active:scale-95",
              ].join(" ")}
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
