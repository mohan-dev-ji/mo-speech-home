"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { useClerk, useUser } from "@clerk/nextjs";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const { user } = useUser();
  const { signOut } = useClerk();

  const initials =
    [user?.firstName?.[0], user?.lastName?.[0]].filter(Boolean).join("") ||
    user?.primaryEmailAddress?.emailAddress?.[0]?.toUpperCase() ||
    "?";

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="w-8 h-8 rounded-full overflow-hidden ring-2 ring-border hover:ring-primary transition-all focus:outline-none"
          aria-label="Account menu"
        >
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt={user.fullName ?? "Avatar"}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="w-full h-full flex items-center justify-center bg-muted text-small font-medium">
              {initials}
            </span>
          )}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className={cn(
            "z-50 min-w-[160px] bg-card border border-border rounded-md shadow-lg py-1",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          )}
        >
          {user && (
            <div className="px-3 py-2 border-b border-border mb-1">
              <p className="text-small font-medium truncate">{user.fullName ?? "Account"}</p>
              <p className="text-caption text-muted-foreground truncate">
                {user.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          )}
          <DropdownMenu.Item
            onSelect={() => signOut({ redirectUrl: "/" })}
            className="flex items-center gap-2 px-3 py-2 text-small text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer outline-none transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
