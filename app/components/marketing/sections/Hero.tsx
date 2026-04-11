"use client";

import Link from "next/link";
import { useUser } from "@clerk/nextjs";

export function Hero() {
  const { isSignedIn } = useUser();
  const appHref = isSignedIn ? "/start?pick=true" : "/sign-in";

  return (
    <section className="py-24 md:py-32 px-6 text-center">
      <div className="max-w-3xl mx-auto">
        <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-caption font-medium mb-6">
          Now in beta
        </span>
        <h1 className="text-display font-bold tracking-tight mb-6">
          Mo Speech Home
          <br />
          <span className="text-primary">AAC built for the world</span>
        </h1>
        <p className="text-subheading text-muted-foreground max-w-xl mx-auto mb-10">
          Replace this with your product&apos;s value proposition. One sentence
          that makes your ideal customer say &ldquo;yes, that&apos;s exactly
          what I need.&rdquo;
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href={appHref}
            className="w-full sm:w-auto px-8 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Start for free
          </Link>
          <Link
            href="/pricing"
            className="w-full sm:w-auto px-8 py-3 border border-border rounded-lg font-medium hover:bg-muted transition-colors text-foreground"
          >
            See pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
