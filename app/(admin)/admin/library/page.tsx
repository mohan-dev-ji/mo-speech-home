import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { auth } from "@clerk/nextjs/server";
import { LibraryAdminTable } from "@/app/components/admin/sections/LibraryAdminTable";

/**
 * Phase 7 admin Library page. Lists every pack in the JSON catalogue
 * joined with its packLifecycle row. The dashboard handles metadata and
 * lifecycle only — content authoring lives in the main app under
 * `viewMode === 'admin'` per ADR-008 and ADR-010.
 *
 * Server component preloads the catalogue then hands it to the client
 * LibraryAdminTable, which subscribes via `useQuery` so all mutations
 * reflect live.
 */
export default async function AdminLibraryPage() {
  // `listAllPacksForAdmin` is gated by `requireCallerIsAdmin`, so we forward
  // the caller's Clerk JWT to the ConvexHttpClient. Build a per-request
  // client to avoid leaking auth across concurrent requests on a shared
  // module-level singleton.
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) convex.setAuth(token);

  const packs = await convex.query(api.resourcePacks.listAllPacksForAdmin, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading font-bold">Library</h1>
        <p className="text-muted-foreground mt-1">
          {packs.length} packs in catalogue. Edit lifecycle metadata only — content
          authoring happens in the main app.
        </p>
      </div>

      <LibraryAdminTable initialPacks={packs} />
    </div>
  );
}
