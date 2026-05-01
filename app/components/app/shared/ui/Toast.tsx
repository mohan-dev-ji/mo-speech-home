"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";

type ToastTone = "info" | "warning";
type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
  dedupeKey?: string;
};

type ToastContextValue = {
  showToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
  dismissToast: () => {},
});

const AUTO_DISMISS_MS = 8000;
const MAX_VISIBLE = 3;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback((toast: Omit<Toast, "id">) => {
    setToasts((cur) => {
      if (toast.dedupeKey && cur.some((t) => t.dedupeKey === toast.dedupeKey)) {
        return cur;
      }
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const next = [...cur, { ...toast, id }];
      const timer = setTimeout(() => dismissToast(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
      return next.slice(-MAX_VISIBLE);
    });
  }, [dismissToast]);

  useEffect(() => {
    const localTimers = timers.current;
    return () => {
      localTimers.forEach((t) => clearTimeout(t));
      localTimers.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[360px]"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="pointer-events-auto flex items-start gap-3 rounded-theme bg-theme-card text-theme-alt-text px-theme-btn-x py-theme-btn-y shadow-lg"
            style={{
              borderLeft: `4px solid ${t.tone === "warning" ? "var(--theme-error, #d97706)" : "var(--theme-brand-primary)"}`,
            }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-small font-semibold">{t.title}</p>
              {t.body && (
                <p className="text-small mt-1" style={{ color: "var(--theme-secondary-alt-text)" }}>
                  {t.body}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              className="shrink-0 -mr-1 -mt-1 p-1 rounded-theme-sm transition-colors hover:bg-white/10"
              aria-label="Dismiss notification"
              style={{ color: "var(--theme-secondary-alt-text)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
