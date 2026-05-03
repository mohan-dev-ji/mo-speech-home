import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/pricing",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/stripe/webhook",
  "/api/health",
  "/(en|hi)/library(.*)",
  // /api/assets is exposed at the middleware level; the route handler enforces
  // its own allowlist (PUBLIC_KEY_PATTERN in app/api/assets/route.ts) and
  // requires Clerk auth for any key outside it.
  "/api/assets",
]);

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

export default clerkMiddleware(async (auth, request) => {
  // Admin routes — need role verification (defence in depth with layout redirect)
  if (isAdminRoute(request)) {
    const { userId, sessionClaims } = await auth();
    const role = (sessionClaims?.metadata as Record<string, string> | undefined)
      ?.role;
    if (!userId || role !== "admin") {
      return NextResponse.redirect(new URL("/en/home", request.url));
    }
    return;
  }

  // Public routes — skip auth() entirely (no Clerk network round-trip)
  if (isPublicRoute(request)) return;

  // Protected routes — must be authenticated
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
