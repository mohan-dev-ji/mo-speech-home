import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* AppStateProvider rewrites this to /<userRecord.locale>/home for returning users;
          new sign-ups go via /start which sets locale before reaching /home. */}
      <SignIn fallbackRedirectUrl="/en/home" />
    </div>
  );
}
