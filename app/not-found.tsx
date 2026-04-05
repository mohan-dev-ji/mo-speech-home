import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <p className="text-caption text-muted-foreground uppercase tracking-widest mb-2">
          404
        </p>
        <h1 className="text-heading font-bold mb-3">Page not found</h1>
        <p className="text-muted-foreground max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
      </div>
      <Link
        href="/"
        className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-small font-medium hover:opacity-90 transition-opacity"
      >
        Back to home
      </Link>
    </div>
  );
}
