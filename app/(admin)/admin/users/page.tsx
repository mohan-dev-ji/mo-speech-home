import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { UsersAdminTable } from "@/app/components/admin/sections/UsersAdminTable";

/**
 * Phase 7 admin Users list. Pulls users with derived `profileCount` via
 * the admin-gated `usersWithProfileCount` query so each row shows the
 * number of student profiles on that account. Per plan §3.5–§3.6.
 *
 * Client-side filtering, search, and pagination live in UsersAdminTable.
 */
export default async function AdminUsersPage() {
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) convex.setAuth(token);

  const users = await convex.query(api.users.usersWithProfileCount, { limit: 200 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-heading font-bold">Users</h1>
        <p className="text-muted-foreground mt-1">{users.length} total users</p>
      </div>

      <UsersAdminTable users={users} />
    </div>
  );
}
