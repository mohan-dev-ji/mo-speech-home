"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import {
  DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/app/components/shared/ui/Dialog";
import { Button } from "@/app/components/shared/ui/Button";

const LOCALE_KEY = "mo-speech-locale";

export function VoiceModal({ onClose }: { onClose: () => void }) {
  const params = useParams();
  const currentLocale = (params?.locale as string) ?? "en";
  const [selectedLocale, setSelectedLocale] = useState(currentLocale);

  const handleConfirm = () => {
    localStorage.setItem(LOCALE_KEY, selectedLocale);
    if (selectedLocale !== currentLocale) {
      window.location.href = `/${selectedLocale}/settings`;
    } else {
      onClose();
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Voice</DialogTitle>
      </DialogHeader>

      <div className="space-y-5">
        {/* Language selection */}
        <div>
          <p className="text-small font-medium text-foreground mb-3">Language</p>
          <div className="space-y-2">
            {[
              { code: "en", label: "English" },
              { code: "hi", label: "हिंदी (Hindi)" },
            ].map(({ code, label }) => (
              <label key={code} className="flex items-center gap-3 p-3 rounded-theme border border-border hover:bg-muted cursor-pointer transition-colors">
                <input
                  type="radio"
                  name="language"
                  value={code}
                  checked={selectedLocale === code}
                  onChange={() => setSelectedLocale(code)}
                  className="accent-primary"
                />
                <span className="text-small">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Voice selection — scaffold */}
        <div>
          <p className="text-small font-medium text-foreground mb-2">Voice</p>
          <div className="rounded-theme border border-dashed border-border p-6 text-center">
            <p className="text-theme-s text-theme-secondary-text">Voice selection — Phase 4</p>
          </div>
        </div>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </DialogClose>
        <Button onClick={handleConfirm}>Confirm</Button>
      </DialogFooter>
    </>
  );
}
