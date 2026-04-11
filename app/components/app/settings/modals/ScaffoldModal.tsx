"use client";

import { DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/app/components/shared/ui/Dialog";
import { Button } from "@/app/components/shared/ui/Button";

export function ScaffoldModal({ title, onClose }: { title: string; onClose: () => void }) {
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
