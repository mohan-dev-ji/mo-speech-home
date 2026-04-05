import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-caption text-muted-foreground">
          © {new Date().getFullYear()} YourProduct. All rights reserved.
        </p>
        <nav className="flex items-center gap-6">
          <Link href="/pricing" className="text-caption text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </Link>
          <Link href="/sign-in" className="text-caption text-muted-foreground hover:text-foreground transition-colors">
            Sign in
          </Link>
        </nav>
      </div>
    </footer>
  );
}
