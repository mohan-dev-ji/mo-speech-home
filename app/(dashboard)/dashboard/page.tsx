"use client";

import { useUser } from "@clerk/nextjs";
import { useAppState } from "@/app/components/AppStateProvider";
import { AccountCard } from "@/app/components/dashboard/sections/AccountCard";
import { SubscriptionCard } from "@/app/components/dashboard/sections/SubscriptionCard";
import { DashboardSkeleton } from "@/app/components/shared/ui/Skeleton";

export default function DashboardPage() {
  const { user } = useUser();
  const { userRecord, subscription, isLoading } = useAppState();

  if (isLoading) return <DashboardSkeleton />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-heading font-bold">
          Hello, {user?.firstName ?? "there"} 👋
        </h1>
        <p className="text-muted-foreground mt-1">
          Welcome to your dashboard.
        </p>
      </div>

      {userRecord && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <AccountCard user={userRecord} />
          <SubscriptionCard subscription={subscription} />
        </div>
      )}

      {/* ─── Replace below with your app's content ─────────────── */}
      <div className="border border-dashed border-border rounded-lg p-10 text-center">
        <p className="text-muted-foreground text-small">
          Your app content goes here.
          <br />
          Replace this section with your actual dashboard features.
        </p>
      </div>
    </div>
  );
}
