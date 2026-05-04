import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { WelcomeSplash } from "@/app/components/marketing/sections/WelcomeSplash";

/**
 * Root dispatcher.
 *
 * Three states, decided server-side before any client paint:
 * 1. Signed-in → straight to /<locale>/home (AppStateProvider fixes locale
 *    if users.locale differs from URL — existing behaviour).
 * 2. Anonymous + NEXT_LOCALE cookie set → redirect to /<locale> (Hero landing).
 * 3. Anonymous + no cookie → render WelcomeSplash (first-time visitor).
 *
 * Bare `/` is intentionally not handled by next-intl middleware (see proxy.ts).
 * That gives this page full ownership of the splash-vs-redirect decision and
 * avoids next-intl's Accept-Language auto-redirect, which would skip the splash.
 */
export default async function RootPage() {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const { userId } = await auth();

  if (userId) {
    redirect(cookieLocale === "hi" ? "/hi/home" : "/en/home");
  }

  if (cookieLocale === "en" || cookieLocale === "hi") {
    redirect(`/${cookieLocale}`);
  }

  return <WelcomeSplash />;
}
