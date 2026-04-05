"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <p className="text-caption text-muted-foreground uppercase tracking-widest mb-2">
          Error
        </p>
        <h1 className="text-heading font-bold mb-3">Something went wrong</h1>
        <p className="text-muted-foreground max-w-sm mb-6">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="text-caption text-muted-foreground font-mono mb-4">
            ID: {error.digest}
          </p>
        )}
      </div>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-small font-medium hover:opacity-90 transition-opacity"
      >
        Try again
      </button>
    </div>
  );
}
