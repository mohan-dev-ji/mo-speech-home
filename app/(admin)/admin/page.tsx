import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";
import { api } from "@/convex/_generated/api";
import { Card, CardContent } from "@/app/components/app/shared/ui/Card";
import {
  Users,
  TrendingUp,
  Star,
  Building2,
  Activity,
  UserPlus,
} from "lucide-react";

/**
 * Phase 7 admin Overview. Returns a single Convex query result (per plan
 * §4) and renders seven stat cards. No "Active Trials" card — this build
 * has no free trial; see the No-Trial callout in the plan Context.
 *
 * Deferred KPIs (MRR breakdown, scheduled/expiring soon, translation gaps,
 * custom-access activity) are TODO once their data layers exist.
 */
export default async function AdminPage() {
  const { getToken } = await auth();
  const token = await getToken({ template: "convex" });
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  if (token) convex.setAuth(token);

  const stats = await convex.query(api.admin.overviewStats.getOverviewStats, {});

  const userCards = [
    { label: "Total users", value: stats.totalUsers, icon: Users },
    { label: "Free", value: stats.free, icon: Star },
    { label: "Pro", value: stats.pro, icon: TrendingUp },
    { label: "Max", value: stats.max, icon: Building2 },
  ];

  const activityCards = [
    { label: "Active (7d)", value: stats.active7d, icon: Activity },
    { label: "New signups (7d)", value: stats.new7d, icon: UserPlus },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-heading font-bold">Overview</h1>
        <p className="text-muted-foreground mt-1">Platform metrics at a glance.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {userCards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="text-center">
            <CardContent>
              <Icon className="w-5 h-5 text-muted-foreground mx-auto mb-2 mt-2" />
              <p className="text-heading font-bold">{value}</p>
              <p className="text-caption text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {activityCards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="text-center">
            <CardContent>
              <Icon className="w-5 h-5 text-muted-foreground mx-auto mb-2 mt-2" />
              <p className="text-heading font-bold">{value}</p>
              <p className="text-caption text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/*
        TODO (Phase 7 follow-up plans):
          - MRR breakdown (needs Stripe Price ID → amount mapping)
          - Scheduled / Expiring soon pack counts
          - Translation gaps widget (deferred per plan scope decision)
          - Custom-access activity (grants in last 7 days)
        See ~/.claude/plans/i-just-completed-this-ancient-floyd.md §4.
      */}
    </div>
  );
}
