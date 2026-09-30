import type { Metadata } from "next";
import AuthShell from "@/components/auth/auth-shell";
import ForgotPasswordForm from "@/components/auth/forgot-password-form";

export const metadata: Metadata = { title: "Reset password — DataIntel" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      heading={
        <>
          Locked
          <br />
          <em>out?</em>
        </>
      }
      description="Enter the email you signed up with and we'll send you a link to set a new password."
      navPrompt={{ text: "New here?", href: "/signup", label: "Get started" }}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
