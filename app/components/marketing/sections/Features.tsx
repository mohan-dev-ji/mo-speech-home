import { useTranslations } from "next-intl";
import { FeatureCard } from "@/app/components/marketing/ui/FeatureCard";
import { Zap, Shield, BarChart3 } from "lucide-react";

const featureIcons = [Zap, Shield, BarChart3] as const;

export function Features() {
  const t = useTranslations("marketingFeatures");

  // Feature copy lives in translation keys; icons stay in code (visual asset, not translatable).
  const features = [
    { icon: featureIcons[0], title: t("feature1Title"), description: t("feature1Desc") },
    { icon: featureIcons[1], title: t("feature2Title"), description: t("feature2Desc") },
    { icon: featureIcons[2], title: t("feature3Title"), description: t("feature3Desc") },
  ];

  return (
    <section className="py-20 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-heading font-bold mb-4">{t("sectionTitle")}</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            {t("sectionSubtitle")}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {features.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </div>
    </section>
  );
}
