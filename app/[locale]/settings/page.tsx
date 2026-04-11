import { Suspense } from "react";
import { BillingBanner }   from "@/app/components/app/settings/sections/BillingBanner";
import { SettingsContent } from "@/app/components/app/settings/sections/SettingsContent";

export default function SettingsPage() {
  return (
    <Suspense>
      <BillingBanner />
      <SettingsContent />
    </Suspense>
  );
}
