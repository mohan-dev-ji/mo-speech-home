import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://yourdomain.com";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/pricing"],
      disallow: ["/start", "/en/", "/hi/", "/admin", "/api/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
