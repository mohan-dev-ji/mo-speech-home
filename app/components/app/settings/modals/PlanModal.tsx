"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useUser, useReverification } from "@clerk/nextjs";
import { useAppState } from "@/app/contexts/AppStateProvider";
import {
  DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/app/components/app/shared/ui/Dialog";
import { Dialog, DialogContent } from "@/app/components/app/shared/ui/Dialog";
import { Button } from "@/app/components/app/shared/ui/Button";
import { Input } from "@/app/components/app/shared/ui/Input";
import { PricingToggle } from "@/app/components/marketing/ui/PricingToggle";
import { Check, AlertCircle, CheckCircle, Camera } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type BillingInterval = "monthly" | "yearly";

type ActionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

// ─── PlanCard ─────────────────────────────────────────────────────────────────

function PlanCard({ name, price, features, highlighted, children }: {
  name: string;
  price: string;
  features: string[];
  highlighted: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={cn(
      "rounded-theme border p-4 flex flex-col",
      highlighted ? "border-primary ring-1 ring-primary" : "border-theme-line"
    )}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-theme-p font-semibold text-theme-text">{name}</span>
        <span className="font-bold text-theme-text">{price}</span>
      </div>
      <ul className="space-y-1 mb-4 flex-1">
        {features.map((f, i) => (
          <li key={i} className="flex items-center gap-2 text-theme-s text-theme-secondary-text">
            <Check className="w-3.5 h-3.5 text-success shrink-0" />
            {f}
          </li>
        ))}
      </ul>
      {children}
    </div>
  );
}

// ─── Instructor account section ──────────────────────────────────────────────

function InstructorAccountSection() {
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const updatePasswordVerified = useReverification(
    async (newPassword: string) => user?.updatePassword({ newPassword })
  );

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

  if (!isLoaded || !user) return null;

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

  const handleSave = async () => {
    setError(""); setSuccess(""); setPasswordError("");
    if (newPassword && newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match."); return;
    }
    setSaving(true);
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
      if (newPassword) {
        await updatePasswordVerified(newPassword);
        setNewPassword(""); setConfirmPassword("");
      }
      if (!success) setSuccess("Changes saved.");
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Failed to save changes.");
    } finally { setSaving(false); }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/delete-account", { method: "POST" });
      if (!res.ok) throw new Error("Account deletion failed");
      router.push("/");
    } catch {
      setError("Failed to delete account. Please try again.");
      setDeleting(false); setDeleteOpen(false);
    }
  };

  const initials =
    [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join("") ||
    user.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() || "?";

  return (
    <div className="pt-4 border-t border-theme-line space-y-4">
      <p className="text-theme-p font-semibold text-theme-alt-text">Your account</p>

      {/* Avatar */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={photoLoading}
          className="relative w-14 h-14 rounded-full overflow-hidden ring-2 ring-border hover:ring-primary transition-all group shrink-0"
          aria-label="Change photo"
        >
          {user.imageUrl ? (
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

      <Button size="sm" onClick={handleSave} loading={saving} disabled={!hasChanges}>Save account</Button>

      {/* Danger zone */}
      <div className="pt-2 border-t border-border">
        <p className="text-caption text-muted-foreground mb-2">Permanently deletes your account and cancels any active subscription.</p>
        <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>Delete my account</Button>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete account?</DialogTitle></DialogHeader>
          <p className="text-small text-muted-foreground">This will cancel your subscription, delete all your data, and cannot be undone.</p>
          <DialogFooter>
            <DialogClose asChild><Button variant="secondary">Cancel</Button></DialogClose>
            <Button variant="destructive" loading={deleting} onClick={handleDeleteAccount}>Yes, delete my account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── PlanModal ───────────────────────────────────────────────────────────────

export function PlanModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations("plan");
  const { subscription } = useAppState();
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [actionState, setActionState] = useState<ActionState>({ status: "idle" });

  const { tier, status, plan, subscriptionEndsAt } = subscription;
  const isActive    = status === "active";
  const isCancelled = status === "cancelled";
  const isExpired   = status === "expired";
  const isSubscribed = isActive || isCancelled;

  // Derive the current billing interval from the stored plan ID
  const currentInterval: BillingInterval | null =
    plan?.includes("yearly") ? "yearly" : plan ? "monthly" : null;

  const isLoading = actionState.status === "loading";

  // ─── API helper ──────────────────────────────────────────────────────────────

  const callApi = async (url: string, body?: object, successMsg?: string) => {
    setActionState({ status: "loading" });
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setActionState({ status: "error", message: t("errorGeneric") });
        return;
      }
      // Stripe checkout returns a redirect URL
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setActionState({ status: "success", message: successMsg ?? "" });
    } catch {
      setActionState({ status: "error", message: t("errorGeneric") });
    }
  };

  // ─── Free card CTA ───────────────────────────────────────────────────────────

  const renderFreeCTA = () => {
    if (tier === "free" || isExpired) {
      return (
        <Button variant="secondary" size="sm" disabled className="w-full opacity-60 cursor-default">
          {t("ctaCurrentPlan")}
        </Button>
      );
    }
    if (isCancelled && subscriptionEndsAt) {
      return (
        <p className="text-theme-s text-theme-secondary-text text-center py-1">
          {t("ctaCancellingOn", { date: formatDate(subscriptionEndsAt) })}
        </p>
      );
    }
    if (isActive) {
      return (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => callApi("/api/stripe/cancel", undefined, t("cancelSuccess"))}
          loading={isLoading}
          className="w-full"
        >
          {t("ctaCancelSubscription")}
        </Button>
      );
    }
    return null;
  };

  // ─── Paid tier CTA ───────────────────────────────────────────────────────────

  const renderPaidCTA = (targetTier: "pro" | "max") => {
    const tierName = targetTier === "pro" ? t("proName") : t("maxName");
    const isCurrentTier = tier === targetTier;

    // Free or expired: go to checkout (need payment details)
    if (tier === "free" || isExpired) {
      return (
        <Button
          size="sm"
          onClick={() => callApi("/api/stripe/checkout", { tier: targetTier, plan: billingInterval })}
          loading={isLoading}
          className="w-full"
        >
          {targetTier === "pro" ? t("ctaStartPro") : t("ctaStartMax")}
        </Button>
      );
    }

    // Currently on this tier
    if (isCurrentTier) {
      if (isActive) {
        // Same billing interval as toggle — already on this plan
        if (currentInterval === billingInterval) {
          return (
            <Button variant="secondary" size="sm" disabled className="w-full opacity-60 cursor-default">
              {t("ctaCurrentPlan")}
            </Button>
          );
        }
        // Different billing interval — offer seamless switch
        return (
          <Button
            size="sm"
            onClick={() => callApi(
              "/api/stripe/switch-plan",
              { tier: targetTier, plan: billingInterval },
              t("switchSuccess")
            )}
            loading={isLoading}
            className="w-full"
          >
            {billingInterval === "yearly" ? t("ctaSwitchToYearly") : t("ctaSwitchToMonthly")}
          </Button>
        );
      }
      // Cancelling — reactivate, or reactivate + switch interval in one step
      if (isCancelled) {
        if (currentInterval === billingInterval) {
          // Same interval: simple reactivate (remove cancel_at_period_end)
          return (
            <Button
              size="sm"
              onClick={() => callApi("/api/stripe/reactivate", undefined, t("reactivateSuccess"))}
              loading={isLoading}
              className="w-full"
            >
              {t("ctaReactivate")}
            </Button>
          );
        }
        // Different interval: switch-plan clears cancel_at_period_end AND changes interval
        return (
          <Button
            size="sm"
            onClick={() => callApi(
              "/api/stripe/switch-plan",
              { tier: targetTier, plan: billingInterval },
              t("switchSuccess")
            )}
            loading={isLoading}
            className="w-full"
          >
            {billingInterval === "yearly" ? t("ctaSwitchToYearly") : t("ctaSwitchToMonthly")}
          </Button>
        );
      }
    }

    // Different tier — seamless upgrade or downgrade (no Stripe redirect)
    const isUpgrade = tier === "pro" && targetTier === "max";
    return (
      <Button
        size="sm"
        variant={isUpgrade ? "primary" : "secondary"}
        onClick={() => callApi(
          "/api/stripe/switch-plan",
          { tier: targetTier, plan: billingInterval },
          t("switchSuccess")
        )}
        loading={isLoading}
        className="w-full"
      >
        {isUpgrade
          ? t("ctaUpgradeTo", { name: tierName })
          : t("ctaDowngradeTo", { name: tierName })}
      </Button>
    );
  };

  // ─── Price display ────────────────────────────────────────────────────────────

  const proPrice = billingInterval === "monthly"
    ? `${t("proMonthlyPrice")} ${t("perMonth")}`
    : `${t("proYearlyPrice")} ${t("perYear")}`;

  const maxPrice = billingInterval === "monthly"
    ? `${t("maxMonthlyPrice")} ${t("perMonth")}`
    : `${t("maxYearlyPrice")} ${t("perYear")}`;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <>
      <DialogHeader>
        <div className="flex items-center justify-between">
          <DialogTitle>Account &amp; Billing</DialogTitle>
          <PricingToggle value={billingInterval} onChange={setBillingInterval} />
        </div>
        {isSubscribed && (
          <p className="text-theme-s text-theme-secondary-text mt-1">{t("changeNotice")}</p>
        )}
      </DialogHeader>

      <div className="max-h-[70vh] overflow-y-auto pr-1 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <PlanCard
          name={t("freeName")}
          price={t("freePrice")}
          features={[
            t("freeFeature0"),
            t("freeFeature1"),
            t("freeFeature2"),
            t("freeFeature3"),
          ]}
          highlighted={tier === "free" || isExpired}
        >
          {renderFreeCTA()}
        </PlanCard>

        <PlanCard
          name={t("proName")}
          price={proPrice}
          features={[
            t("proFeature0"),
            t("proFeature1"),
            t("proFeature2"),
            t("proFeature3"),
            t("proFeature4"),
          ]}
          highlighted={tier === "pro" && isSubscribed}
        >
          {renderPaidCTA("pro")}
        </PlanCard>

        <PlanCard
          name={t("maxName")}
          price={maxPrice}
          features={[
            t("maxFeature0"),
            t("maxFeature1"),
            t("maxFeature2"),
            t("maxFeature3"),
            t("maxFeature4"),
          ]}
          highlighted={tier === "max" && isSubscribed}
        >
          {renderPaidCTA("max")}
        </PlanCard>
      </div>

      {actionState.status === "success" && (
        <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/20 px-3 py-2 text-small text-success">
          <CheckCircle className="w-4 h-4 shrink-0" />
          {actionState.message}
        </div>
      )}
      {actionState.status === "error" && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-small text-destructive">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {actionState.message}
        </div>
      )}

      <InstructorAccountSection />

      </div>{/* end scrollable area */}

      <DialogFooter>
        <DialogClose asChild>
          <Button variant="secondary" onClick={onClose}>{t("close")}</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}
