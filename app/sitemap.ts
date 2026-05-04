import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";

// Public, indexable routes. Each emits one entry per locale + a hreflang
// alternates block so search engines pick the right language for the user.
const PUBLIC_PATHS: ReadonlyArray<{ path: string; priority: number }> = [
  { path: "", priority: 1 },
  { path: "pricing", priority: 0.8 },
  { path: "library", priority: 0.8 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://yourdomain.com";
  const lastModified = new Date();

  return PUBLIC_PATHS.flatMap(({ path, priority }) => {
    const languages: Record<string, string> = {};
    for (const locale of routing.locales) {
      languages[locale] = path ? `${base}/${locale}/${path}` : `${base}/${locale}`;
    }
    return routing.locales.map((locale) => ({
      url: languages[locale],
      lastModified,
      changeFrequency: "monthly" as const,
      priority,
      alternates: { languages },
    }));
  });
}
