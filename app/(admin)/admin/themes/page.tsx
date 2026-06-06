import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import { ThemesAdminTable } from "@/app/components/admin/sections/ThemesAdminTable";

/**
 * Phase 9 admin Themes page (ADR-011 §2). Lists every theme in the JSON
 * catalogue (`convex/data/themes/*.json`) joined with its `themeLifecycle`
 * row. The dashboard handles lifecycle only — publish window, tier, featured,
 * scheduling. Theme token *values* are JSON, changed by code deploy (ADR-011
 * §2.0); there is no in-app token editor in this build.
 *
 * Server component preloads the catalogue then hands it to the client
 * ThemesAdminTable, which subscribes via `useQuery` so mutations reflect live.
 */
export default async function AdminThemesPage() {
  // `listAllThemesForAdmin` is gated by `requireCallerIsAdmin`; forward the
  // caller's Clerk JWT on a per-request client to avoid cross-request leakage.
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) convex.setAuth(token);

  const themes = await convex.query(api.themes.listAllThemesForAdmin, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading font-bold">Themes</h1>
        <p className="text-muted-foreground mt-1">
          {themes.length} themes in catalogue. Edit lifecycle only — token values
          (colours) live in <code className="font-mono">convex/data/themes/*.json</code>{" "}
          and change by code deploy.
        </p>
      </div>

      <ThemesAdminTable initialThemes={themes} />
    </div>
  );
}
