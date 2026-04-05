import Link from "next/link";

export function CTABanner() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-2xl mx-auto text-center">
        <h2 className="text-heading font-bold mb-4">
          Ready to get started?
        </h2>
        <p className="text-muted-foreground mb-8">
          Join thousands of teams already using YourProduct.
          Free to start, no credit card required.
        </p>
        <Link
          href="/sign-up"
          className="inline-block px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
        >
          Start for free
        </Link>
      </div>
    </section>
  );
}
