import { z } from "zod";

/**
 * Environment variable validation.
 * Throws at startup if required variables are missing.
 * Import `env` instead of `process.env` throughout the codebase.
 */
const envSchema = z.object({
  // Convex
  NEXT_PUBLIC_CONVEX_URL: z.url("NEXT_PUBLIC_CONVEX_URL must be a valid URL"),
  CONVEX_DEPLOY_KEY: z.string().min(1, "CONVEX_DEPLOY_KEY is required"),
  CONVEX_SERVER_SECRET: z
    .string()
    .min(32, "CONVEX_SERVER_SECRET is required (openssl rand -hex 32)"),

  // Clerk
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z
    .string()
    .min(1, "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required"),
  CLERK_SECRET_KEY: z.string().min(1, "CLERK_SECRET_KEY is required"),
  CLERK_JWT_ISSUER_DOMAIN: z
    .string()
    .min(1, "CLERK_JWT_ISSUER_DOMAIN is required"),

  // Stripe
  STRIPE_SECRET_KEY: z.string().min(1, "STRIPE_SECRET_KEY is required"),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .min(1, "STRIPE_WEBHOOK_SECRET is required"),
  STRIPE_PRO_MONTHLY_PRICE_ID: z
    .string()
    .min(1, "STRIPE_PRO_MONTHLY_PRICE_ID is required"),
  STRIPE_PRO_YEARLY_PRICE_ID: z
    .string()
    .min(1, "STRIPE_PRO_YEARLY_PRICE_ID is required"),
  STRIPE_MAX_MONTHLY_PRICE_ID: z
    .string()
    .min(1, "STRIPE_MAX_MONTHLY_PRICE_ID is required"),
  STRIPE_MAX_YEARLY_PRICE_ID: z
    .string()
    .min(1, "STRIPE_MAX_YEARLY_PRICE_ID is required"),
  // Stripe Managed Payments (merchant of record) — off by default until the
  // live account is on the owner's Ltd. See ADR-025.
  STRIPE_MANAGED_PAYMENTS: z.enum(["true", "false"]).optional(),

  // R2 — optional, app functions without storage
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),

  // PostHog product analytics — optional. Absent = no-op (dev / CI / preview
  // without an analytics project). See plan §2.
  NEXT_PUBLIC_POSTHOG_KEY: z.string().optional(),
  NEXT_PUBLIC_POSTHOG_HOST: z.string().optional(),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
