import { FeatureCard } from "@/app/components/marketing/ui/FeatureCard";
import { Zap, Shield, BarChart3 } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Feature one",
    description: "Replace this with your first key benefit. Focus on the outcome, not the feature itself.",
  },
  {
    icon: Shield,
    title: "Feature two",
    description: "What problem does your product solve? Describe it here in one or two sentences.",
  },
  {
    icon: BarChart3,
    title: "Feature three",
    description: "Your third differentiator. What makes you different from the alternatives?",
  },
];

export function Features() {
  return (
    <section className="py-20 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-heading font-bold mb-4">Everything you need</h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Replace this section with your actual feature highlights.
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
