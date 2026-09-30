"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthCardHeader } from "./auth-shell";
import { NOT_CONFIGURED_MESSAGE, authErrorMessage } from "./auth-messages";

export default function ForgotPasswordForm() {
  const configured = isSupabaseConfigured();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(configured ? null : NOT_CONFIGURED_MESSAGE);
  const [sentTo, setSentTo] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError(NOT_CONFIGURED_MESSAGE);

    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    setLoading(true);
    setError(null);

    const redirectTo = new URL("/auth/callback", window.location.origin);
    redirectTo.searchParams.set("next", "/reset-password");

    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: redirectTo.toString() });
    setLoading(false);
    if (error) return setError(authErrorMessage(error));
    setSentTo(email);
  }

  return (
    <>
      <AuthCardHeader icon="?" title="Reset password" subtitle="We'll email you a secure reset link." />

      {error && (
        <div className="alert alert-error auth-alert" role="alert">
          <AlertCircle aria-hidden />
          <div className="alert-body">{error}</div>
        </div>
      )}

      {sentTo ? (
        <div className="alert alert-success auth-alert" role="status">
          <CheckCircle2 aria-hidden />
          <div className="alert-body">
            If an account exists for <b>{sentTo}</b>, a password reset link is on its way. The link opens a page where
            you can choose a new password.
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="email">EMAIL ADDRESS</label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              autoComplete="email"
              disabled={loading}
              required
            />
          </div>

          <button className="submit-button" type="submit" disabled={loading || !configured}>
            {loading && <span className="spinner" aria-hidden />}
            <span>{loading ? "Sending link…" : "Send reset link"}</span>
          </button>
        </form>
      )}

      <div className="auth-switch">
        Remembered it?
        <Link href="/login">Back to sign in</Link>
      </div>
    </>
  );
}
