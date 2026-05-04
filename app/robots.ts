import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

const APP_PATHS = [
  "home",
  "categories",
  "lists",
  "sentences",
  "search",
  "settings",
];

const PUBLIC_PATHS = ["", "pricing", "library"];

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://yourdomain.com";

  // Allow root + all (locale, public-path) combinations.
  const allow: string[] = ["/"];
  for (const locale of routing.locales) {
    for (const path of PUBLIC_PATHS) {
      allow.push(path ? `/${locale}/${path}` : `/${locale}`);
    }
  }

  // Disallow the AAC app shell under each locale, plus auth/admin/api surfaces.
  const disallow: string[] = ["/sign-in", "/sign-up", "/start", "/admin", "/api/"];
  for (const locale of routing.locales) {
    for (const path of APP_PATHS) {
      disallow.push(`/${locale}/${path}`);
    }
  }

  return {
    rules: {
      userAgent: "*",
      allow,
      disallow,
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
