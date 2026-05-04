import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function Footer() {
  const t = useTranslations("marketingFooter");
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background mt-auto">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <p className="text-caption text-muted-foreground">
          {t("copyright", { year })}
        </p>
        <nav className="flex items-center gap-6">
          <Link href="/pricing" className="text-caption text-muted-foreground hover:text-foreground transition-colors">
            {t("pricing")}
          </Link>
          <Link href="/sign-in" className="text-caption text-muted-foreground hover:text-foreground transition-colors">
            {t("signIn")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
