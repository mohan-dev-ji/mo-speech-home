import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { ThemeToggle } from "@/app/components/admin/ui/ThemeToggle";
import { LayoutDashboard, Users, Library, Languages, Palette } from "lucide-react";

// Admin UI is English only (per docs/1-inbox/ideas/17-admin-dashboard.md §
// "Language Handling"). This is the one place in the app where the
// `useTranslations` rule is deliberately bypassed — all strings below are
// plain literals. Remaining sections (Affiliates, Core Vocab, Starter Pack)
// ship in later phases and will be added to `adminNav` then.
const adminNav = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/library", label: "Library", icon: Library },
  { href: "/admin/themes", label: "Themes", icon: Palette },
  { href: "/admin/languages", label: "Languages", icon: Languages },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId, sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as Record<string, string> | undefined)?.role;

  // Defence in depth — middleware also checks this
  if (!userId || role !== "admin") {
    redirect("/en/home");
  }

  return (
    <div className="min-h-screen flex bg-background">
      <aside className="w-56 border-r border-border flex flex-col py-6 px-3 hidden md:flex">
        <div className="px-3 mb-2">
          <span className="text-caption text-muted-foreground uppercase tracking-widest font-medium">
            Admin
          </span>
        </div>
        <Link href="/" className="px-3 mb-8 font-bold text-subheading">
          Mo Speech
        </Link>
        <nav className="flex-1 space-y-1">
          {adminNav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 px-3 py-2 rounded-md text-small text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="px-3 pt-4 border-t border-border">
          <Link href="/en/home" className="text-caption text-muted-foreground hover:text-foreground transition-colors">
            ← Back to app
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-border flex items-center justify-between px-6">
          <span className="text-small font-medium text-muted-foreground">Admin</span>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <UserButton />
          </div>
        </header>
        <main className="flex-1 p-6 md:p-8 max-w-5xl w-full">{children}</main>
      </div>
    </div>
  );
}
