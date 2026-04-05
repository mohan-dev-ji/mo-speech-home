import { Navbar } from "@/app/components/marketing/sections/Navbar";
import { Footer } from "@/app/components/marketing/sections/Footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
