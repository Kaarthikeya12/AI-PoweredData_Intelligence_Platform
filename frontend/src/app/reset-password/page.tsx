import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import AuthShell, { AuthCardHeader } from "@/components/auth/auth-shell";
import ResetPasswordForm from "@/components/auth/reset-password-form";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a new password — DataIntel" };

export default async function ResetPasswordPage() {
  const user = await getCurrentUser();

  return (
    <AuthShell
      heading={
        <>
          Almost
          <br />
          <em>there.</em>
        </>
      }
      description="Set a new password for your DataIntel account."
    >
      {user ? (
        <ResetPasswordForm />
      ) : (
        <>
          <AuthCardHeader icon="!" title="Link expired" subtitle="This reset link is no longer valid." />
          <div className="alert alert-error auth-alert" role="alert">
            <AlertCircle aria-hidden />
            <div className="alert-body">
              Password reset links can only be used once and expire after a short time. Request a new one to continue.
            </div>
          </div>
          <Link href="/forgot-password" className="submit-button">
            <span>Request a new link</span>
          </Link>
        </>
      )}
    </AuthShell>
  );
}
