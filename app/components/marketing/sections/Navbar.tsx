"use client";

import { useTranslations } from "next-intl";
import { useClerk, useUser } from "@clerk/nextjs";
import { Link } from "@/i18n/navigation";
import { ThemeToggle } from "@/app/components/marketing/ui/ThemeToggle";
import { LocaleSwitcher } from "@/app/components/marketing/ui/LocaleSwitcher";

export function Navbar() {
  const t = useTranslations("marketingNav");
  const { signOut } = useClerk();
  const { isSignedIn } = useUser();
  const appHref = isSignedIn ? "/start?pick=true" : "/sign-in";

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold text-subheading text-foreground">
          {t("brand")}
        </Link>

        <nav className="hidden md:flex items-center gap-6">
          <Link href="/library" className="text-small text-muted-foreground hover:text-foreground transition-colors">
            {t("library")}
          </Link>
          <Link href="/pricing" className="text-small text-muted-foreground hover:text-foreground transition-colors">
            {t("pricing")}
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <LocaleSwitcher />
          <ThemeToggle />
          {isSignedIn ? (
            <button
              onClick={() => signOut({ redirectUrl: "/" })}
              className="text-small text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("signOut")}
            </button>
          ) : (
            <Link
              href="/sign-in"
              className="text-small text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("signIn")}
            </Link>
          )}
          <Link
            href={appHref}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-small font-medium hover:opacity-90 transition-opacity"
          >
            {t("getStarted")}
          </Link>
        </div>
      </div>
    </header>
  );
}
