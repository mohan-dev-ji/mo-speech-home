# Changelog

## v1.0.0 — 2026-04-03

Initial release.

**Included:**
- Next.js 16 + TypeScript + Tailwind CSS 4 (design tokens, light/dark mode, fluid typography)
- Clerk v7 auth — sign-in, sign-up, protected routes, admin role via publicMetadata
- Convex real-time database — users table, subscription tracking, JWT-authenticated queries
- Stripe — checkout (monthly/yearly), customer portal, idempotent webhook handler
- Cloudflare R2 — private asset delivery via authenticated 302 redirect (optional)
- Admin dashboard — user stats, user table, user detail with manual access override
- Marketing pages — landing page and 3-tier pricing with comparison table
- Dashboard shell — account, billing, settings pages
- Docs context notebook — 5-section structure for AI-assisted development
- Environment variable validation via Zod at startup
- `GET-STARTED.md` with 10-step setup guide including Clerk JWT template gotcha
