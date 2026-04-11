"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser, useReverification } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAppState } from "@/app/components/AppStateProvider";
import { useTheme, THEME_TOKENS, type ThemeSlug } from "@/app/contexts/ThemeContext";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/app/components/shared/ui/Dialog";
import { Button } from "@/app/components/shared/ui/Button";
import { Input } from "@/app/components/shared/ui/Input";
import { PricingToggle } from "@/app/components/marketing/ui/PricingToggle";
import { UpgradeButton } from "@/app/components/dashboard/ui/UpgradeButton";
import { Check, Camera } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import type { SubscriptionTier, SubscriptionPlan } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCALE_KEY = "mo-speech-locale";

const SETTINGS_ITEMS = [
  { id: "profile",  label: "Profile" },
  { id: "plan",     label: "Plan" },
  { id: "voice",    label: "Voice" },
  { id: "theme",    label: "Theme" },
  { id: "symbols",  label: "Symbols" },
  { id: "grid",     label: "Grid" },
  { id: "navbar",   label: "Navigational Side Bar" },
  { id: "invites",  label: "Invites" },
] as const;

type SettingId = typeof SETTINGS_ITEMS[number]["id"];

const PAID_PLANS: Record<"pro" | "max", {
  name: string;
  price: { monthly: string; yearly: string };
  features: string[];
}> = {
  pro: {
    name: "Pro",
    price: { monthly: "£9.99", yearly: "£79" },
    features: [
      "Categories + all four modes",
      "Modelling mode",
      "Resource library packs",
      "Create/edit custom symbols",
      "Natural voice sentences",
    ],
  },
  max: {
    name: "Max",
    price: { monthly: "£14.99", yearly: "£119" },
    features: [
      "Everything in Pro",
      "Premium themes",
      "Family member invitations",
      "Mo Speech School connection",
      "Voice cloning (coming soon)",
    ],
  },
};

const THEME_META: Record<ThemeSlug, { name: string }> = {
  default:  { name: "Classic" },
  sky:      { name: "Sky" },
  amber:    { name: "Amber" },
  fuchsia:  { name: "Fuchsia" },
  lime:     { name: "Lime" },
  rose:     { name: "Rose" },
};

// ─── Plan modal helpers ───────────────────────────────────────────────────────

function PlanCTA({
  targetTier,
  billingPlan,
  currentTier,
  currentStatus,
  currentPlan,
  onPortal,
  portalLoading,
}: {
  targetTier: "pro" | "max";
  billingPlan: SubscriptionPlan;
  currentTier: SubscriptionTier;
  currentStatus: string;
  currentPlan: SubscriptionPlan | null;
  onPortal: () => void;
  portalLoading: boolean;
}) {
  const [switchLoading, setSwitchLoading] = useState(false);

  const handleSwitch = async () => {
    setSwitchLoading(true);
    try {
      await fetch("/api/stripe/switch-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: targetTier, plan: billingPlan }),
      });
    } finally {
      setSwitchLoading(false);
    }
  };

  const isFreeUser   = currentTier === "free";
  const isCurrentTier = currentTier === targetTier;
  const isActive     = currentStatus === "active";
  const isCancelled  = currentStatus === "cancelled";

  if (isFreeUser) {
    return <UpgradeButton tier={targetTier} plan={billingPlan} label={`Start ${PAID_PLANS[targetTier].name}`} />;
  }
  if (isCurrentTier && isActive) {
    return (
      <div className="space-y-2">
        <Button variant="secondary" size="sm" disabled className="w-full cursor-default opacity-60">Current plan</Button>
        {currentPlan && currentPlan !== billingPlan && (
          <Button variant="secondary" size="sm" onClick={handleSwitch} loading={switchLoading} className="w-full">
            Switch to {billingPlan}
          </Button>
        )}
      </div>
    );
  }
  if (isCurrentTier && isCancelled) {
    return (
      <Button variant="secondary" size="sm" onClick={onPortal} loading={portalLoading} className="w-full">
        Resubscribe
      </Button>
    );
  }
  return (
    <Button size="sm" onClick={handleSwitch} loading={switchLoading} className="w-full">
      Switch to {PAID_PLANS[targetTier].name}
    </Button>
  );
}

const THEME_SWATCHES: { slug: ThemeSlug; swatch: string }[] = [
  { slug: 'default', swatch: '#62748E' },
  { slug: 'sky',     swatch: '#00A6F4' },
  { slug: 'amber',   swatch: '#E17100' },
  { slug: 'fuchsia', swatch: '#E12AFB' },
  { slug: 'lime',    swatch: '#5EA500' },
  { slug: 'rose',    swatch: '#FF2056' },
];

// ─── Scaffold modal ───────────────────────────────────────────────────────────

function ScaffoldModal({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      <div className="py-8 flex items-center justify-center">
        <p className="text-theme-s text-theme-secondary-text">Coming in a future phase.</p>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}

// ─── Profile modal ────────────────────────────────────────────────────────────

function ProfileModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const deleteMyUser = useMutation(api.users.deleteMyUser);

  const updatePasswordVerified = useReverification(
    async (newPassword: string) => user?.updatePassword({ newPassword })
  );
  const deleteUserVerified = useReverification(async () => user?.delete());

  const [firstName,       setFirstName]       = useState("");
  const [lastName,        setLastName]        = useState("");
  const [email,           setEmail]           = useState("");
  const [newPassword,     setNewPassword]     = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [origFirst,       setOrigFirst]       = useState("");
  const [origLast,        setOrigLast]        = useState("");
  const [origEmail,       setOrigEmail]       = useState("");
  const [saving,          setSaving]          = useState(false);
  const [photoLoading,    setPhotoLoading]    = useState(false);
  const [error,           setError]           = useState("");
  const [success,         setSuccess]         = useState("");
  const [deleteOpen,      setDeleteOpen]      = useState(false);
  const [deleting,        setDeleting]        = useState(false);
  const [passwordError,   setPasswordError]   = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const first = user.firstName ?? "";
    const last  = user.lastName  ?? "";
    const em    = user.primaryEmailAddress?.emailAddress ?? "";
    setFirstName(first); setOrigFirst(first);
    setLastName(last);   setOrigLast(last);
    setEmail(em);        setOrigEmail(em);
  }, [user]);

  if (!isLoaded) return null;

  const hasChanges =
    firstName !== origFirst || lastName !== origLast ||
    email !== origEmail     || newPassword.length > 0;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    try { await user?.setProfileImage({ file }); }
    catch { setError("Failed to update photo."); }
    finally {
      setPhotoLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const saveChanges = async (includePassword = false) => {
    setSaving(true); setError("");
    try {
      if (firstName !== origFirst || lastName !== origLast) {
        await user?.update({ firstName, lastName });
        setOrigFirst(firstName); setOrigLast(lastName);
      }
      if (email !== origEmail) {
        await user?.createEmailAddress({ email });
        setSuccess("Verification email sent. It will become your primary once confirmed.");
        setOrigEmail(email);
      }
      if (includePassword && newPassword) {
        await updatePasswordVerified(newPassword);
        setNewPassword(""); setConfirmPassword("");
      }
      if (!success) setSuccess("Changes saved.");
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Failed to save changes.");
    } finally { setSaving(false); }
  };

  const handleSave = async () => {
    setError(""); setSuccess(""); setPasswordError("");
    if (newPassword && newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match."); return;
    }
    await saveChanges(!!newPassword);
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/delete-account", { method: "POST" });
      if (!res.ok) throw new Error("Stripe cleanup failed");
      await deleteMyUser();
      await deleteUserVerified();
      router.push("/");
    } catch {
      setError("Failed to delete account. Please try again.");
      setDeleting(false); setDeleteOpen(false);
    }
  };

  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("") ||
    user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() || "?";

  return (
    <>
      <DialogHeader>
        <DialogTitle>Profile</DialogTitle>
      </DialogHeader>

      <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
        {/* Avatar */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={photoLoading}
            className="relative w-14 h-14 rounded-full overflow-hidden ring-2 ring-border hover:ring-primary transition-all group shrink-0"
            aria-label="Change photo"
          >
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              <span className="w-full h-full flex items-center justify-center bg-muted text-subheading font-medium">{initials}</span>
            )}
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
              <Camera className="w-3.5 h-3.5 text-white" />
            </span>
          </button>
          <div>
            <button onClick={() => fileInputRef.current?.click()} disabled={photoLoading}
              className="text-small text-primary hover:underline disabled:opacity-50">
              {photoLoading ? "Uploading…" : "Change photo"}
            </button>
            <p className="text-caption text-muted-foreground">JPG, PNG or GIF. Max 10MB.</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
        </div>

        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <Input label="First name" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
          <Input label="Last name"  value={lastName}  onChange={e => setLastName(e.target.value)}  placeholder="Last name" />
        </div>

        {/* Email */}
        <Input label="Email address" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />

        {/* Password */}
        <Input label="New password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Leave blank to keep current" error={passwordError} />
        {newPassword && (
          <Input label="Confirm password" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Confirm new password" />
        )}

        {(error || success) && (
          <p className={`text-small ${error ? "text-destructive" : "text-success"}`}>{error || success}</p>
        )}

        {/* Danger zone */}
        <div className="pt-2 border-t border-border">
          <p className="text-caption text-muted-foreground mb-2">Permanently deletes your account and cancels any active subscription.</p>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>Delete my account</Button>
        </div>
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </DialogClose>
        <Button onClick={handleSave} loading={saving} disabled={!hasChanges}>Save</Button>
      </DialogFooter>

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account?</DialogTitle>
          </DialogHeader>
          <p className="text-small text-muted-foreground">This will cancel your subscription, delete all your data, and cannot be undone.</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
            <Button variant="destructive" loading={deleting} onClick={handleDeleteAccount}>Yes, delete my account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Plan modal ───────────────────────────────────────────────────────────────

function PlanModal({ onClose }: { onClose: () => void }) {
  const { userRecord, subscription } = useAppState();
  const [billingPlan, setBillingPlan]   = useState<"monthly" | "yearly">("monthly");
  const [portalLoading, setPortalLoading] = useState(false);

  const handlePortal = async () => {
    if (!userRecord?.subscription.stripeCustomerId) return;
    setPortalLoading(true);
    try {
      const res  = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } finally { setPortalLoading(false); }
  };

  const isSubscribed = subscription.status === "active" || subscription.status === "cancelled";
  const currentBillingInterval: SubscriptionPlan | null =
    subscription.plan?.includes("yearly") ? "yearly" :
    subscription.plan ? "monthly" : null;

  return (
    <>
      <DialogHeader>
        <div className="flex items-center justify-between">
          <DialogTitle>Plan</DialogTitle>
          <PricingToggle value={billingPlan} onChange={setBillingPlan} />
        </div>
        {isSubscribed && (
          <p className="text-small text-muted-foreground mt-1">
            Changes take effect at the start of your next billing period. No refunds.
          </p>
        )}
      </DialogHeader>

      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {/* Free tier */}
        <div className={`rounded-lg border p-4 ${subscription.tier === "free" ? "border-primary ring-1 ring-primary" : "border-border"}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-small">Free</span>
            <span className="text-subheading font-bold">£0</span>
          </div>
          <ul className="space-y-1 mb-4">
            {["Symbol search (voice + text)", "Core vocabulary dropdown", "Full SymbolStix library (58k)", "Base colour themes"].map(f => (
              <li key={f} className="flex items-center gap-2 text-small text-muted-foreground">
                <Check className="w-3.5 h-3.5 text-success shrink-0" />{f}
              </li>
            ))}
          </ul>
          {subscription.tier === "free" ? (
            <Button variant="secondary" size="sm" disabled className="w-full opacity-60 cursor-default">Current plan</Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={handlePortal} loading={portalLoading} className="w-full">
              Cancel subscription
            </Button>
          )}
        </div>

        {/* Pro + Max */}
        {(["pro", "max"] as const).map(tier => {
          const p = PAID_PLANS[tier];
          const isCurrentTier = subscription.tier === tier;
          return (
            <div key={tier} className={`rounded-lg border p-4 ${isCurrentTier && isSubscribed ? "border-primary ring-1 ring-primary" : "border-border"}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-small">{p.name}</span>
                <div className="text-right">
                  <span className="font-bold">{billingPlan === "monthly" ? p.price.monthly : p.price.yearly}</span>
                  <span className="text-small text-muted-foreground ml-1">/ {billingPlan === "monthly" ? "mo" : "yr"}</span>
                </div>
              </div>
              <ul className="space-y-1 mb-4">
                {p.features.map(f => (
                  <li key={f} className="flex items-center gap-2 text-small text-muted-foreground">
                    <Check className="w-3.5 h-3.5 text-success shrink-0" />{f}
                  </li>
                ))}
              </ul>
              <PlanCTA
                targetTier={tier}
                billingPlan={billingPlan}
                currentTier={subscription.tier}
                currentStatus={subscription.status}
                currentPlan={currentBillingInterval}
                onPortal={handlePortal}
                portalLoading={portalLoading}
              />
            </div>
          );
        })}

        {/* Manage billing link for subscribed users */}
        {isSubscribed && (
          <div className="flex justify-end pt-1">
            <Button variant="secondary" size="sm" loading={portalLoading} onClick={handlePortal}>
              Manage billing
            </Button>
          </div>
        )}
      </div>

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}

// ─── Voice modal ──────────────────────────────────────────────────────────────

function VoiceModal({ onClose }: { onClose: () => void }) {
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

// ─── Theme modal ──────────────────────────────────────────────────────────────

function ThemeModal({ onClose }: { onClose: () => void }) {
  const { activeThemeId, setTheme } = useTheme();
  const currentSlug = (activeThemeId ?? "default") as ThemeSlug;
  const [selected, setSelected] = useState<ThemeSlug>(currentSlug);

  const handleConfirm = () => {
    setTheme(selected, THEME_TOKENS[selected]);
    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Theme</DialogTitle>
      </DialogHeader>

      <div className="space-y-5">
        {/* Theme buttons */}
        <div>
          <p className="text-theme-s font-semibold text-theme-secondary-text mb-3">Colour theme</p>
          <div className="flex flex-wrap gap-theme-elements">
            {THEME_SWATCHES.map(({ slug, swatch }) => {
              const active = selected === slug;
              return (
                <button
                  key={slug}
                  onClick={() => setSelected(slug)}
                  className={`flex items-center gap-2 px-theme-btn-x py-theme-btn-y rounded-theme-sm text-theme-s font-medium transition-colors ${
                    active
                      ? 'bg-theme-button-highlight text-theme-text'
                      : 'bg-theme-primary text-theme-alt-text hover:opacity-90'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: swatch }} />
                  {THEME_META[slug].name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Text size — scaffold */}
        <div>
          <p className="text-small font-medium text-foreground mb-2">Text Size</p>
          <div className="rounded-theme border border-dashed border-border p-4 text-center">
            <p className="text-theme-s text-theme-secondary-text">Text size control — Phase 7</p>
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

// ─── Settings page ────────────────────────────────────────────────────────────

function BillingBanner() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "en";
  const router = useRouter();
  const searchParams = useSearchParams();
  const success   = searchParams.get("success")   === "true";
  const cancelled = searchParams.get("cancelled") === "true";

  useEffect(() => {
    if (success || cancelled) {
      const t = setTimeout(() => router.replace(`/${locale}/settings`), 4000);
      return () => clearTimeout(t);
    }
  }, [success, cancelled, router, locale]);

  if (!success && !cancelled) return null;
  return success ? (
    <div className="rounded-theme bg-green-950 border border-green-800 px-4 py-3 text-small text-green-200">
      Subscription activated. Welcome aboard!
    </div>
  ) : (
    <div className="rounded-theme bg-muted border border-border px-4 py-3 text-small text-muted-foreground">
      Checkout cancelled — no charge was made.
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense>
      <BillingBanner />
      <SettingsContent />
    </Suspense>
  );
}

function SettingsContent() {
  const [activeModal, setActiveModal] = useState<SettingId | null>(null);

  const open  = (id: SettingId) => setActiveModal(id);
  const close = () => setActiveModal(null);

  const modalProps = { onClose: close };

  const renderModal = () => {
    switch (activeModal) {
      case "profile": return <ProfileModal {...modalProps} />;
      case "plan":    return <PlanModal    {...modalProps} />;
      case "voice":   return <VoiceModal   {...modalProps} />;
      case "theme":   return <ThemeModal   {...modalProps} />;
      case "symbols": return <ScaffoldModal title="Symbols"               {...modalProps} />;
      case "grid":    return <ScaffoldModal title="Grid"                  {...modalProps} />;
      case "navbar":  return <ScaffoldModal title="Navigational Side Bar" {...modalProps} />;
      case "invites": return <ScaffoldModal title="Invites"               {...modalProps} />;
    }
  };

  const modalSize: Partial<Record<SettingId, string>> = {
    plan:    "max-w-lg",
    profile: "max-w-md",
    theme:   "max-w-md",
    voice:   "max-w-sm",
  };

  return (
    <div className="p-theme-general flex flex-col gap-theme-gap">
      {/* Header card */}
      <div className="rounded-theme bg-theme-primary px-6 py-8">
        <h1 className="text-theme-h4 font-semibold text-theme-alt-text">Settings</h1>
      </div>

      {/* Settings grid */}
      <div className="grid grid-cols-2 gap-theme-gap">
        {SETTINGS_ITEMS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => open(id)}
            className="rounded-theme bg-theme-card text-left px-6 py-8 hover:bg-theme-banner transition-colors"
          >
            <span className="text-theme-p text-theme-alt-text">{label}</span>
          </button>
        ))}
      </div>

      {/* Modals */}
      <Dialog open={activeModal !== null} onOpenChange={isOpen => { if (!isOpen) close(); }}>
        <DialogContent className={modalSize[activeModal ?? "symbols"] ?? "max-w-md"}>
          {renderModal()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
