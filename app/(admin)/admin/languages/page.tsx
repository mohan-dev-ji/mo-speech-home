import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import { LanguagesAdminTable } from "@/app/components/admin/sections/LanguagesAdminTable";

/**
 * Phase 8.1 admin Languages page. Lists every language in the bundled
 * registry joined with its `languageLifecycle` row. Clone of the
 * `/admin/library` shape — same server-component preload, same client
 * table subscribing via `useQuery` for live updates.
 *
 * Per the Phase 8 build doc: this page is the surface for the UI strings
 * pipeline, lifecycle edits, and (later) status promotion.
 */
export default async function AdminLanguagesPage() {
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) convex.setAuth(token);

  const languages = await convex.query(
    api.languages.listAllLanguagesForAdmin,
    {}
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading font-bold">Languages</h1>
        <p className="text-muted-foreground mt-1">
          {languages.length} languages in the registry. Add a language, run
          the UI-strings translation pipeline, then promote through{" "}
          <span className="font-medium">machine → beta → stable</span> as
          translations are reviewed.
        </p>
      </div>

      <LanguagesAdminTable initialLanguages={languages} />
    </div>
  );
}
