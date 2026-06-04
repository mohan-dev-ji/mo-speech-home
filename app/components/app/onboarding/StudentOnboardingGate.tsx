"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useProfile } from "@/app/contexts/ProfileContext";
import { useAppState } from "@/app/contexts/AppStateProvider";
import { Button } from "@/app/components/app/shared/ui/Button";
import { Input } from "@/app/components/app/shared/ui/Input";

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
  const setMyLocale = useMutation(api.users.setMyLocale);
  // Dynamic published-language list (beta included), en/hi fallback for first paint.
  const visibleLanguages = useQuery(api.languages.getVisibleLanguages, {
    includeBeta: true,
  });
  const languageOptions = visibleLanguages ?? [
    { code: "en", nativeLabel: "English", status: "stable" as const },
    { code: "hi", nativeLabel: "हिन्दी", status: "stable" as const },
  ];

  const [name, setName] = useState("");
  const [language, setLanguage] = useState<string>("en");
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
      // Set the account locale FIRST so the new profile (same language) starts a
      // consistent monolingual account and never trips the Free language gate
      // (ADR-011 §3 — locale + first profile must match).
      await setMyLocale({ locale: language });
      await createStudentProfile({ name: name.trim(), language, dateOfBirth });
      // Persist the choice for bare-`/` visits; routing follows via AppStateProvider.
      document.cookie = `NEXT_LOCALE=${language};path=/;max-age=31536000;samesite=lax`;
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
            <div className="flex flex-wrap gap-2">
              {languageOptions.map(({ code, nativeLabel, status }) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLanguage(code)}
                  className={`flex-1 min-w-[6rem] py-2 rounded-md border text-small font-medium transition-colors inline-flex items-center justify-center gap-1.5 ${
                    language === code
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-muted"
                  }`}
                >
                  {nativeLabel}
                  {status === "beta" && (
                    <span className="inline-flex items-center rounded-full bg-warning/20 text-warning text-caption px-1.5 py-0">
                      preview
                    </span>
                  )}
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
