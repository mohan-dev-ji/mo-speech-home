/**
 * Clerk JWT auth config for Convex.
 *
 * Setup:
 * 1. Clerk Dashboard → JWT Templates → New → Convex preset
 * 2. Copy the Issuer URL
 * 3. Add to .env.local: CLERK_JWT_ISSUER_DOMAIN=https://xxxx.clerk.accounts.dev
 * 4. Add same value to Convex Dashboard → Settings → Environment Variables
 * 5. Run: npx convex dev
 *
 * ⚠️  Create the JWT template in EACH Clerk environment separately
 *     (Development and Production use different issuer URLs).
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN,
      applicationID: "convex",
    },
  ],
};
