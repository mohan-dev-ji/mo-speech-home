import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Tell tailwind-merge that our custom text-* tokens are font-size classes,
// not color classes — prevents them conflicting with text-white, text-primary etc.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        "text-display",
        "text-heading",
        "text-subheading",
        "text-body",
        "text-small",
        "text-caption",
        // AAC theme type scale — these are font-sizes, NOT colours. Without
        // registering them, tailwind-merge treats e.g. `text-theme-s` as a
        // text-colour and drops it when a colour like `text-theme-alt-text`
        // is also present (e.g. Button size + variant), silently breaking sizes.
        "text-theme-xs",
        "text-theme-s",
        "text-theme-p",
        "text-theme-large",
        "text-theme-h1",
        "text-theme-h2",
        "text-theme-h3",
        "text-theme-h4",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatCurrency(amount: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}
