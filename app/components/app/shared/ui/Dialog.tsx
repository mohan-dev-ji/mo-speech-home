"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;

export function DialogContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  // z-index 300 puts modals above every other layered surface in the app:
  //   page chrome             (TopBar z-70, Sidebar)
  //   modelling backdrop      (z-80)
  //   highlighted target      (z-90)
  //   modelling annotation    (z-95)
  //   fullscreen play modals  (z-200, PlayModalBackdrop)
  //   modals / onboarding     (z-300+)  ← here
  // A dialog can be opened from WITHIN a play modal (e.g. the tone-chip
  // UpgradeNudge), so it must clear the z-200 play backdrop — at z-100 it hid
  // behind it. (Before z-100, both sat at z-50 and the TopBar's z-70 chrome
  // leaked through on top of the modal.)
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 bg-black/50 z-[300] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
      <RadixDialog.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-[300] -translate-x-1/2 -translate-y-1/2",
          "w-full max-w-md bg-theme-alt-card text-theme-text border border-theme-line rounded-theme p-6 shadow-lg",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          className
        )}
      >
        {children}
        <RadixDialog.Close className="absolute right-4 top-4 text-theme-secondary-text hover:text-theme-text transition-colors">
          <X className="w-4 h-4" />
        </RadixDialog.Close>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function DialogHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4">{children}</div>;
}

export function DialogTitle({ children }: { children: React.ReactNode }) {
  return (
    <RadixDialog.Title className="font-semibold text-theme-h4 text-theme-text">
      {children}
    </RadixDialog.Title>
  );
}

export function DialogDescription({ children }: { children: React.ReactNode }) {
  return (
    <RadixDialog.Description className="text-theme-s text-theme-secondary-text mt-1">
      {children}
    </RadixDialog.Description>
  );
}

export function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex justify-end gap-3 mt-6">{children}</div>;
}

export const DialogClose = RadixDialog.Close;
