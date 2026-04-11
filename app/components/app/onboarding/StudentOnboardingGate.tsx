"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useProfile } from "@/app/contexts/ProfileContext";
import { useAppState } from "@/app/components/AppStateProvider";
import { Button } from "@/app/components/shared/ui/Button";
import { Input } from "@/app/components/shared/ui/Input";

/**
 * Blocks the app with a full-screen overlay until the instructor creates a student profile.
 * Shown once on first sign-in. Cannot be dismissed — profile creation is required to proceed.
 */
export function StudentOnboardingGate() {
  const t = useTranslations("onboarding");
  const { activeProfileId, profileLoading } = useProfile();
  const { isLoading: appLoading } = useAppState();
  const membership = useQuery(api.accountMembers.getMyMembership);
  const membershipLoading = membership === undefined;
  const isCollaborator = membership?.status === "active";

  const createStudentProfile = useMutation(api.studentProfiles.createStudentProfile);

  const [name, setName] = useState("");
  const [language, setLanguage] = useState<"eng" | "hin">("eng");
  const [dob, setDob] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Don't render until all queries have resolved
  // Collaborators always skip — they load the instructor's profile, not their own
  if (appLoading || profileLoading || membershipLoading) return null;
  if (activeProfileId !== null || isCollaborator) return null;

  const handleCreate = async () => {
    if (!name.trim()) {
      setError(t("nameRequired"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const dateOfBirth = dob ? new Date(dob).getTime() : undefined;
      await createStudentProfile({ name: name.trim(), language, dateOfBirth });
      // ProfileContext re-queries on mutation success — gate auto-hides
    } catch {
      setError(t("errorGeneric"));
      setSaving(false);
    }
  };

  return (
    // Blocking full-screen overlay — no close affordance
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/60" />
      <div className="relative z-10 w-full max-w-sm mx-4 bg-theme-alt-card border border-theme-line rounded-theme p-6 shadow-xl">
        {/* Header */}
        <div className="mb-5">
          <h2 className="font-semibold text-theme-h4 text-theme-text">{t("title")}</h2>
          <p className="text-theme-s text-theme-secondary-text mt-1">{t("subtitle")}</p>
        </div>

        <div className="space-y-4">
          {/* Student name */}
          <Input
            label={t("studentName")}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("studentNamePlaceholder")}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
            autoFocus
          />

          {/* Language preference */}
          <div className="space-y-1.5">
            <span className="text-small font-medium text-foreground">{t("language")}</span>
            <div className="flex gap-2">
              {(["eng", "hin"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={`flex-1 py-2 rounded-md border text-small font-medium transition-colors ${
                    language === lang
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted"
                  }`}
                >
                  {lang === "eng" ? t("languageEng") : t("languageHin")}
                </button>
              ))}
            </div>
          </div>

          {/* Date of birth (optional) */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-small font-medium text-foreground">{t("dob")}</span>
              <span className="text-xs text-muted-foreground">{t("dobOptional")}</span>
            </div>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().split("T")[0]}
              className="w-full px-3 py-2 text-body bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-foreground"
            />
          </div>

          {error && <p className="text-small text-destructive">{error}</p>}
        </div>

        <div className="mt-6">
          <Button
            onClick={handleCreate}
            loading={saving}
            disabled={!name.trim()}
            className="w-full"
          >
            {t("cta")}
          </Button>
        </div>
      </div>
    </div>
  );
}
