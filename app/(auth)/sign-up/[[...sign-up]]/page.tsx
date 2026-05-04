import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* /post-signup reads library:resume from localStorage and dispatches to
          /<locale>/categories (loaded) or /<locale>/home (no resume). */}
      <SignUp fallbackRedirectUrl="/post-signup" />
    </div>
  );
}
