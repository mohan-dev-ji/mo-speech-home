import Link from "next/link";
import { AppStateProvider } from "@/app/components/AppStateProvider";
import { ThemeToggle } from "@/app/components/shared/ui/ThemeToggle";
import { UserMenu } from "@/app/components/dashboard/ui/UserMenu";
import { LayoutDashboard, Settings } from "lucide-react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppStateProvider>
      <div className="min-h-screen flex bg-background">
        {/* Sidebar */}
        <aside className="w-56 border-r border-border flex flex-col py-6 px-3 hidden md:flex">
          <Link href="/" className="px-3 mb-8 font-bold text-subheading">
            YourProduct
          </Link>
          <nav className="flex-1 space-y-1">
            {navLinks.map(({ href, label, icon: Icon }) => (
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
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Topbar */}
          <header className="h-14 border-b border-border flex items-center justify-between px-6">
            <Link href="/" className="md:hidden font-bold">YourProduct</Link>
            <div className="flex-1" />
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <UserMenu />
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-6 md:p-8 max-w-4xl w-full">
            {children}
          </main>
        </div>
      </div>
    </AppStateProvider>
  );
}
