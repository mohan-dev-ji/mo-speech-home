"use client";

import Link from "next/link";
import { useClerk, useUser } from "@clerk/nextjs";
import { ThemeToggle } from "@/app/components/marketing/ui/ThemeToggle";

export function Navbar() {
  const { signOut } = useClerk();
  const { isSignedIn } = useUser();
  const appHref = isSignedIn ? "/start?pick=true" : "/sign-in";

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-subheading text-foreground">
          YourProduct
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/pricing" className="text-small text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {isSignedIn ? (
            <button
              onClick={() => signOut({ redirectUrl: "/" })}
              className="text-small text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign out
            </button>
          ) : (
            <Link
              href="/sign-in"
              className="text-small text-muted-foreground hover:text-foreground transition-colors"
            >
              Sign in
            </Link>
          )}
          <Link
            href={appHref}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-small font-medium hover:opacity-90 transition-opacity"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  );
}
