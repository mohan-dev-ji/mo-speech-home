"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser, useReverification } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/app/components/shared/ui/Card";
import { Button } from "@/app/components/shared/ui/Button";
import { Input } from "@/app/components/shared/ui/Input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter, DialogClose,
} from "@/app/components/shared/ui/Dialog";
import { ArrowLeft, Camera } from "lucide-react";
import Link from "next/link";

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const deleteMyUser = useMutation(api.users.deleteMyUser);

  const updatePasswordVerified = useReverification(
    async (newPassword: string) => user?.updatePassword({ newPassword })
  );

  const deleteUserVerified = useReverification(
    async () => user?.delete()
  );

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Original values for change detection
  const [origFirst, setOrigFirst] = useState("");
  const [origLast, setOrigLast] = useState("");
  const [origEmail, setOrigEmail] = useState("");

  // UI state
  const [saving, setSaving] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [passwordConfirmOpen, setPasswordConfirmOpen] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    const first = user.firstName ?? "";
    const last = user.lastName ?? "";
    const em = user.primaryEmailAddress?.emailAddress ?? "";
    setFirstName(first); setOrigFirst(first);
    setLastName(last); setOrigLast(last);
    setEmail(em); setOrigEmail(em);
  }, [user]);

  if (!isLoaded) return null;

  const hasChanges =
    firstName !== origFirst ||
    lastName !== origLast ||
    email !== origEmail ||
    newPassword.length > 0;

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    try {
      await user?.setProfileImage({ file });
    } catch {
      setError("Failed to update photo.");
    } finally {
      setPhotoLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    setError("");
    setSuccess("");
    setPasswordError("");

    if (newPassword && newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }

    // Show confirmation modal before touching password
    if (newPassword) {
      setPasswordConfirmOpen(true);
      return;
    }

    await saveChanges();
  };

  const saveChanges = async (includePassword = false) => {
    setSaving(true);
    setError("");
    try {
      // Update name if changed
      if (firstName !== origFirst || lastName !== origLast) {
        await user?.update({ firstName, lastName });
        setOrigFirst(firstName);
        setOrigLast(lastName);
      }

      // Add new email (Clerk will send verification — it becomes primary once verified)
      if (email !== origEmail) {
        await user?.createEmailAddress({ email });
        setSuccess("Verification email sent to your new address. It will become your primary email once confirmed.");
        setOrigEmail(email);
      }

      // Update password if confirmed — useReverification handles Clerk's re-auth modal
      if (includePassword && newPassword) {
        await updatePasswordVerified(newPassword);
        setNewPassword("");
        setConfirmPassword("");
      }

      if (!success) setSuccess("Changes saved.");
    } catch (err: any) {
      setError(err?.errors?.[0]?.message ?? "Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      // 1. Cancel Stripe subscription + delete customer
      const res = await fetch("/api/delete-account", { method: "POST" });
      if (!res.ok) throw new Error("Stripe cleanup failed");

      // 2. Delete Convex record
      await deleteMyUser();

      // 3. Delete Clerk user (must be last — Clerk will prompt reverification if needed)
      await deleteUserVerified();

      // 4. Redirect (signOut handles session cleanup)
      router.push("/");
    } catch (err) {
      console.error(err);
      setError("Failed to delete account. Please try again.");
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("") ||
    user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
    "?";

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-heading font-bold">Manage account</h1>
          <p className="text-muted-foreground mt-0.5">Update your profile and security settings.</p>
        </div>
      </div>

      {/* Photo + Name */}
      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your name and photo.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={photoLoading}
              className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-border hover:ring-primary transition-all group"
              aria-label="Change photo"
            >
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center bg-muted text-subheading font-medium">
                  {initials}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="w-4 h-4 text-white" />
              </span>
            </button>
            <div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={photoLoading}
                className="text-small text-primary hover:underline disabled:opacity-50"
              >
                {photoLoading ? "Uploading…" : "Change photo"}
              </button>
              <p className="text-caption text-muted-foreground mt-0.5">JPG, PNG or GIF. Max 10MB.</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
          </div>

          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
            />
            <Input
              label="Last name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
            />
          </div>
        </CardContent>
      </Card>

      {/* Email */}
      <Card>
        <CardHeader>
          <CardTitle>Email</CardTitle>
          <CardDescription>
            Changing your email will send a verification link to the new address.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>Leave blank to keep your current password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            label="New password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            error={passwordError}
          />
          <Input
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
          />
        </CardContent>
      </Card>

      {/* Save */}
      {(hasChanges || error || success) && (
        <div className="flex items-center gap-4">
          {hasChanges && (
            <Button onClick={handleSave} loading={saving}>
              Save changes
            </Button>
          )}
          {error && <p className="text-small text-destructive">{error}</p>}
          {success && <p className="text-small text-success">{success}</p>}
        </div>
      )}

      {/* Danger zone */}
      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>
            Permanently delete your account, cancel any active subscription, and remove all your data. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete my account
          </Button>
        </CardContent>
      </Card>

      {/* Password change confirmation dialog */}
      <Dialog open={passwordConfirmOpen} onOpenChange={setPasswordConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change your password?</DialogTitle>
            <DialogDescription>
              You are about to set a new password for your account. If you signed in with Google you can still use Google after this — the password is an additional sign-in option.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              loading={saving}
              onClick={async () => {
                setPasswordConfirmOpen(false);
                await saveChanges(true);
              }}
            >
              Yes, change password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete account?</DialogTitle>
            <DialogDescription>
              This will cancel your subscription, delete all your data from our systems, and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button variant="destructive" loading={deleting} onClick={handleDeleteAccount}>
              Yes, delete my account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
