"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser, useReverification } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useProfile } from "@/app/contexts/ProfileContext";
import {
  DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/app/components/shared/ui/Dialog";
import { Dialog, DialogContent } from "@/app/components/shared/ui/Dialog";
import { Button } from "@/app/components/shared/ui/Button";
import { Input } from "@/app/components/shared/ui/Input";
import { Camera } from "lucide-react";

// ─── Student profile section ──────────────────────────────────────────────────

function StudentProfileSection() {
  const { studentProfile } = useProfile();
  const updateStudentProfile = useMutation(api.studentProfiles.updateStudentProfile);

  const [name,     setName]     = useState("");
  const [dob,      setDob]      = useState("");
  const [language, setLanguage] = useState<"eng" | "hin">("eng");
  const [origName, setOrigName] = useState("");
  const [origDob,  setOrigDob]  = useState("");
  const [origLang, setOrigLang] = useState<"eng" | "hin">("eng");
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState("");
  const [success,  setSuccess]  = useState("");

  useEffect(() => {
    if (!studentProfile) return;
    const n = studentProfile.name;
    const d = studentProfile.dateOfBirth
      ? new Date(studentProfile.dateOfBirth).toISOString().split("T")[0]
      : "";
    const l = (studentProfile.language as "eng" | "hin") ?? "eng";
    setName(n); setOrigName(n);
    setDob(d);  setOrigDob(d);
    setLanguage(l); setOrigLang(l);
  }, [studentProfile]);

  if (!studentProfile) return null;

  const hasChanges = name !== origName || dob !== origDob || language !== origLang;

  const handleSave = async () => {
    setSaving(true); setError(""); setSuccess("");
    try {
      const dateOfBirth = dob ? new Date(dob).getTime() : undefined;
      await updateStudentProfile({
        profileId: studentProfile._id,
        name: name.trim() || undefined,
        dateOfBirth,
        language,
      });
      setOrigName(name); setOrigDob(dob); setOrigLang(language);
      setSuccess("Student profile saved.");
    } catch {
      setError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-4 border-t border-border space-y-3">
      <p className="text-small font-semibold text-foreground">Student profile</p>

      <Input
        label="Student's name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Student's name"
      />

      {/* Language */}
      <div className="space-y-1.5">
        <span className="text-small font-medium text-foreground">Language</span>
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
              {lang === "eng" ? "English" : "हिंदी"}
            </button>
          ))}
        </div>
      </div>

      {/* Date of birth */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="text-small font-medium text-foreground">Date of birth</span>
          <span className="text-xs text-muted-foreground">(optional)</span>
        </div>
        <input
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          max={new Date().toISOString().split("T")[0]}
          className="w-full px-3 py-2 text-body bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary text-foreground"
        />
      </div>

      {(error || success) && (
        <p className={`text-small ${error ? "text-destructive" : "text-success"}`}>{error || success}</p>
      )}

      <Button size="sm" onClick={handleSave} loading={saving} disabled={!hasChanges || !name.trim()}>
        Save student profile
      </Button>
    </div>
  );
}

// ─── ProfileModal ─────────────────────────────────────────────────────────────

export function ProfileModal({ onClose }: { onClose: () => void }) {
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

      <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
        {/* ── Instructor account ─────────────────────────── */}
        <p className="text-small font-semibold text-foreground">Your account</p>

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

        {/* ── Student profile ────────────────────────────── */}
        <StudentProfileSection />

        {/* ── Danger zone ───────────────────────────────── */}
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
