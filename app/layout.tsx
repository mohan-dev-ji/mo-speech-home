import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { ClerkProvider } from "@clerk/nextjs";
import Script from "next/script";
import ConvexClientProvider from "@/app/components/ConvexClientProvider";
import "./globals.css";

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
      signInFallbackRedirectUrl="/start"
      signUpFallbackRedirectUrl="/start"
    >
      <html
        lang="en"
        className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <head />
        <body className="min-h-full flex flex-col bg-background text-foreground">
          <ConvexClientProvider>{children}</ConvexClientProvider>
          {/* Anti-flash: apply saved theme before first paint */}
          <Script
            id="theme-init"
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(){var t=localStorage.getItem('theme')||'light';document.documentElement.classList.toggle('dark',t==='dark');})();`,
            }}
          />
        </body>
      </html>
    </ClerkProvider>
  );
}
