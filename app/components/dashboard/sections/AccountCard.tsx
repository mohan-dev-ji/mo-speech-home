import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/app/components/shared/ui/Card";
import { formatDate } from "@/lib/utils";
import type { UserRecord } from "@/types";

export function AccountCard({ user }: { user: UserRecord }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Account</CardTitle>
        <CardDescription>Your account details</CardDescription>
      </CardHeader>
      <CardContent>
        <dl className="space-y-3">
          <div className="flex justify-between text-small">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium">{user.name ?? "—"}</dd>
          </div>
          <div className="flex justify-between text-small">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium">{user.email}</dd>
          </div>
          <div className="flex justify-between text-small">
            <dt className="text-muted-foreground">Member since</dt>
            <dd className="font-medium">{formatDate(user._creationTime)}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
