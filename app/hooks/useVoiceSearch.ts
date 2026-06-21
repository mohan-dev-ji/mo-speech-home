"use client";

// Voice search for the symbol search bar — ported from the MVP
// (mo-speech-mvp-2.0 `AppStateContext.jsx`). Chrome uses the native Web Speech
// API; other browsers fall back to Deepgram (cloud STT) via a short-lived token
// from `/api/speech/token`. The recognised transcript is handed to `onTranscript`
// (the consumer sets the search query, which is already reactive).

import { useCallback, useEffect, useRef, useState } from "react";
import { speechLocale } from "@/lib/languages/speechLocale";

export type VoiceMethod = "webspeech" | "deepgram";
export type ListeningState = "idle" | "connecting" | "ready";
export type VoiceError =
  | "no-speech"
  | "not-allowed"
  | "no-mic"
  | "network"
  | "auth"
  | "unsupported"
  | "failed";

type UseVoiceSearchArgs = {
  language: string;
  onTranscript: (text: string) => void;
};

const WEBSPEECH_TIMEOUT_MS = 10_000;
const DEEPGRAM_TIMEOUT_MS = 15_000;

export function useVoiceSearch({ language, onTranscript }: UseVoiceSearchArgs) {
  const [method, setMethod] = useState<VoiceMethod>("webspeech");
  const [isListening, setIsListening] = useState(false);
  const [listeningState, setListeningState] = useState<ListeningState>("idle");
  const [error, setError] = useState<VoiceError | null>(null);

  // Teardown handles for every path.
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const deepgramConnRef = useRef<{ finish: () => void } | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep the latest callback without resubscribing the recognizers.
  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  // Pick the method once on mount — capability detection needs window/navigator,
  // which only exist client-side, so it can't run during the SSR render.
  useEffect(() => {
    const hasWebSpeech =
      typeof window !== "undefined" &&
      ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
    const isChrome =
      typeof navigator !== "undefined" &&
      /Chrome/.test(navigator.userAgent) &&
      /Google Inc/.test(navigator.vendor);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount capability detection
    setMethod(hasWebSpeech && isChrome ? "webspeech" : "deepgram");
  }, []);

  const stop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch { /* already stopped */ }
      recognitionRef.current = null;
    }
    if (deepgramConnRef.current) {
      try { deepgramConnRef.current.finish(); } catch { /* already closed */ }
      deepgramConnRef.current = null;
    }
    if (mediaRecorderRef.current) {
      try { mediaRecorderRef.current.stop(); } catch { /* already stopped */ }
      mediaRecorderRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setIsListening(false);
    setListeningState("idle");
  }, []);

  // ── Web Speech API (Chrome) ───────────────────────────────────────────────
  const startWebSpeech = useCallback(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setError("unsupported");
      return;
    }
    const recognition = new Ctor();
    recognition.lang = speechLocale(language);
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setListeningState("ready");
      timeoutRef.current = setTimeout(() => stop(), WEBSPEECH_TIMEOUT_MS);
    };
    recognition.onend = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsListening(false);
      setListeningState("idle");
    };
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.trim();
      if (transcript) onTranscriptRef.current(transcript);
    };
    recognition.onerror = (event) => {
      if (event.error === "no-speech") setError("no-speech");
      else if (event.error === "not-allowed" || event.error === "service-not-allowed") setError("not-allowed");
      else if (event.error === "network") setError("network");
      else setError("failed");
      stop();
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [language, stop]);

  // ── Deepgram (non-Chrome fallback) ────────────────────────────────────────
  const startDeepgram = useCallback(async () => {
    setIsListening(true);
    setListeningState("connecting");
    timeoutRef.current = setTimeout(() => stop(), DEEPGRAM_TIMEOUT_MS);

    try {
      const tokenRes = await fetch("/api/speech/token", { method: "POST" });
      if (!tokenRes.ok) throw new Error("token");
      const { token } = (await tokenRes.json()) as { token: string };

      const { createClient, LiveTranscriptionEvents } = await import("@deepgram/sdk");
      const deepgram = createClient({ accessToken: token });
      const connection = deepgram.listen.live({
        model: "nova-2",
        language: speechLocale(language),
        smart_format: true,
        interim_results: false,
      });
      deepgramConnRef.current = connection;

      // Wait for the socket to open (or fail fast).
      await new Promise<void>((resolve, reject) => {
        connection.on(LiveTranscriptionEvents.Open, () => resolve());
        connection.on(LiveTranscriptionEvents.Error, reject);
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      let mimeType: string | undefined = "audio/webm";
      if (!MediaRecorder.isTypeSupported("audio/webm")) {
        if (MediaRecorder.isTypeSupported("audio/mp4")) mimeType = "audio/mp4";
        else if (MediaRecorder.isTypeSupported("audio/wav")) mimeType = "audio/wav";
        else mimeType = undefined;
      }
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && connection.getReadyState() === 1) {
          connection.send(event.data);
        }
      };

      // Accumulate final chunks; flush after ~1s of silence.
      let fullTranscript = "";
      let flushTimer: ReturnType<typeof setTimeout> | null = null;
      connection.on(LiveTranscriptionEvents.Transcript, (data: {
        is_final: boolean;
        channel?: { alternatives?: { transcript?: string }[] };
      }) => {
        const transcript = data.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
        if (transcript && data.is_final) {
          fullTranscript += (fullTranscript ? " " : "") + transcript;
          if (flushTimer) clearTimeout(flushTimer);
          flushTimer = setTimeout(() => {
            if (fullTranscript.trim()) onTranscriptRef.current(fullTranscript.trim());
            stop();
          }, 1000);
        }
      });

      connection.on(LiveTranscriptionEvents.Error, () => {
        setError("network");
        stop();
      });

      mediaRecorder.start(100);
      setListeningState("ready");
    } catch (err) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      const name = (err as { name?: string })?.name;
      const message = (err as { message?: string })?.message;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") setError("not-allowed");
      else if (name === "NotFoundError") setError("no-mic");
      else if (message === "token") setError("auth");
      else setError("failed");
      setIsListening(false);
      setListeningState("idle");
    }
  }, [language, stop]);

  const start = useCallback(() => {
    setError(null);
    if (method === "webspeech") startWebSpeech();
    else void startDeepgram();
  }, [method, startWebSpeech, startDeepgram]);

  // Tear down any active recognition when the consumer unmounts.
  useEffect(() => () => stop(), [stop]);

  return { start, stop, isListening, listeningState, method, error };
}
