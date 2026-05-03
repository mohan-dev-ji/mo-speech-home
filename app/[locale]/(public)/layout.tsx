import { Navbar } from '@/app/components/marketing/sections/Navbar';
import { Footer } from '@/app/components/marketing/sections/Footer';
import { ToastProvider } from '@/app/components/app/shared/ui/Toast';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  // ToastProvider is included so action surfaces (LoadPackButton) can show
  // success/error toasts without depending on the AAC shell's AppProviders.
  return (
    <ToastProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </ToastProvider>
  );
}
