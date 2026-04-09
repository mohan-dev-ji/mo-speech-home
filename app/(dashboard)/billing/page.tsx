"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppState } from "@/app/components/AppStateProvider";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/shared/ui/Card";
import { Button } from "@/app/components/shared/ui/Button";

function BillingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { subscription } = useAppState();

  const success = searchParams.get("success") === "true";
  const cancelled = searchParams.get("cancelled") === "true";

  // Clear query params after showing the message
  useEffect(() => {
    if (success || cancelled) {
      const timer = setTimeout(() => {
        router.replace("/billing");
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [success, cancelled, router]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-heading font-bold">Billing</h1>
        <p className="text-muted-foreground mt-1">Manage your subscription.</p>
      </div>

      {success && (
        <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 px-4 py-3 text-small text-green-800 dark:text-green-200">
          Subscription activated. Welcome aboard!
        </div>
      )}

      {cancelled && (
        <div className="rounded-md bg-muted border border-border px-4 py-3 text-small text-muted-foreground">
          Checkout cancelled — no charge was made.
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Current plan</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="space-y-3">
            <div className="flex justify-between text-small">
              <dt className="text-muted-foreground">Tier</dt>
              <dd className="font-medium capitalize">{subscription.tier}</dd>
            </div>
            <div className="flex justify-between text-small">
              <dt className="text-muted-foreground">Status</dt>
              <dd className="font-medium capitalize">{subscription.status}</dd>
            </div>
            {subscription.plan && (
              <div className="flex justify-between text-small">
                <dt className="text-muted-foreground">Billing</dt>
                <dd className="font-medium capitalize">{subscription.plan}</dd>
              </div>
            )}
          </dl>

          {(subscription.status === "active" || subscription.status === "cancelled") && (
            <div className="mt-6 flex justify-end">
              <ManageBillingButton />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingContent />
    </Suspense>
  );
}

function ManageBillingButton() {
  const handlePortal = async () => {
    const res = await fetch("/api/stripe/portal", { method: "POST" });
    const data = await res.json();
    if (data.url) window.location.href = data.url;
  };

  return (
    <Button variant="secondary" size="sm" onClick={handlePortal}>
      Manage billing
    </Button>
  );
}
