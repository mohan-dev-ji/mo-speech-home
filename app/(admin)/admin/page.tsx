import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import type { UserRecord } from "@/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/shared/ui/Card";
import { Users, TrendingUp, Star, Building2 } from "lucide-react";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function AdminPage() {
  const users = await convex.query(api.users.listAllUsers, { limit: 500 });

  const stats = {
    total: users.length,
    free: (users as UserRecord[]).filter((u) => u.subscription.tier === "free").length,
    pro: (users as UserRecord[]).filter((u) => u.subscription.tier === "pro").length,
    max: (users as UserRecord[]).filter((u) => u.subscription.tier === "max").length,
  };

  const statCards = [
    { label: "Total users", value: stats.total, icon: Users },
    { label: "Free", value: stats.free, icon: Star },
    { label: "Pro", value: stats.pro, icon: TrendingUp },
    { label: "Max", value: stats.max, icon: Building2 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-heading font-bold">Overview</h1>
        <p className="text-muted-foreground mt-1">Platform metrics at a glance.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="text-center">
            <CardContent>
              <Icon className="w-5 h-5 text-muted-foreground mx-auto mb-2 mt-2" />
              <p className="text-heading font-bold">{value}</p>
              <p className="text-caption text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
