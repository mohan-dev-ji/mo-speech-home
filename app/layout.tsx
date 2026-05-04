import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ClerkProvider } from "@clerk/nextjs";
import ConvexClientProvider from "@/app/contexts/ConvexClientProvider";
import "./globals.css";

// Anti-flash dark-mode bootstrapping. Lives in <head> as a plain inline
// <script> so it executes once during initial document load and isn't part of
// React's body render tree (which would otherwise emit a "Scripts inside React
// components are never executed when rendering on the client" warning every
// time a client-side navigation re-traverses the body).
const themeInitScript = `(function(){var t=localStorage.getItem('theme')||'light';document.documentElement.classList.toggle('dark',t==='dark');})();`;

export const metadata: Metadata = {
  title: {
    default: "Your Product Name",
    template: "%s | Your Product Name",
  },
  description: "Your product description.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      // AppStateProvider rewrites /en/home to /<userRecord.locale>/home for returning
      // users. New sign-ups go via /post-signup which reads library:resume from
      // localStorage (queued by LoadPackButton) and dispatches to /<locale>/categories
      // or /<locale>/home.
      signInFallbackRedirectUrl="/en/home"
      signUpFallbackRedirectUrl="/post-signup"
    >
      <html
        lang="en"
        className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <head>
          <script
            id="theme-init"
            dangerouslySetInnerHTML={{ __html: themeInitScript }}
          />
        </head>
        <body className="min-h-full flex flex-col bg-background text-foreground">
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
