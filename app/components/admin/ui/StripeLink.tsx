import { ExternalLink } from "lucide-react";

export function StripeLink({ customerId }: { customerId: string }) {
  return (
    <a
      href={`https://dashboard.stripe.com/customers/${customerId}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-caption text-primary hover:opacity-80 transition-opacity font-mono"
    >
      {customerId.slice(0, 18)}…
      <ExternalLink className="w-3 h-3" />
    </a>
  );
}
