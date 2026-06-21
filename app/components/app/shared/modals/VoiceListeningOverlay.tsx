"use client";

// MVP-style listening overlay shown while voice search is active. Connecting →
// spinner + "Connecting…"; ready → pulsing mic + "Listening… speak now" and a
// "via Browser / via Cloud" line keyed off the recognition method. Backdrop or
// the X cancels. Token-styled (surface / modal roundness / modal elevation).

import { createPortal } from "react-dom";
import { Mic, X } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ListeningState, VoiceMethod } from "@/app/hooks/useVoiceSearch";

type Props = {
  state: ListeningState;
  method: VoiceMethod;
  onCancel: () => void;
};

export function VoiceListeningOverlay({ state, method, onCancel }: Props) {
  const t = useTranslations("search");
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-6"
      style={{ background: "var(--theme-overlay)" }}
      onClick={onCancel}
    >
      <div
        className="relative flex flex-col items-center gap-theme-gap px-theme-general py-theme-general rounded-theme-modal bg-theme-surface elevation-modal w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("voiceStop")}
          className="absolute top-3 right-3 text-theme-secondary-alt-text hover:text-theme-alt-text transition-colors cursor-pointer"
        >
          <X className="w-6 h-6" />
        </button>

        <div
          className={`flex items-center justify-center size-16 rounded-theme-chip ${
            state === "ready" ? "bg-theme-warning animate-pulse" : "bg-theme-button-secondary"
          }`}
        >
          {state === "connecting" ? (
            <div className="size-6 rounded-full border-2 border-white border-t-transparent animate-spin" />
          ) : (
            <Mic className="w-7 h-7 text-white" />
          )}
        </div>

        <p className="text-theme-p text-theme-alt-text text-center">
          {state === "connecting" ? t("connecting") : t("speakNow")}
        </p>
        <p className="text-theme-s text-theme-secondary-alt-text text-center">
          {method === "webspeech" ? t("viaBrowser") : t("viaCloud")}
        </p>
      </div>
    </div>,
    document.body
  );
}
