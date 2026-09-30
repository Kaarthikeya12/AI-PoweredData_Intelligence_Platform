"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { AuthCardHeader } from "./auth-shell";
import PasswordInput from "./password-input";
import { NOT_CONFIGURED_MESSAGE, authErrorMessage } from "./auth-messages";

const MIN_PASSWORD = 8;

/** Rendered only when the recovery link produced a valid session (checked server-side). */
export default function ResetPasswordForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setError(NOT_CONFIGURED_MESSAGE);

    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");
    if (password.length < MIN_PASSWORD) return setError(`Password must be at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError("Passwords do not match.");

    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return setError(authErrorMessage(error));
    setDone(true);
    setTimeout(() => {
      router.replace("/dashboard");
      router.refresh();
    }, 1200);
  }

  return (
    <>
      <AuthCardHeader icon="✦" title="Choose a new password" subtitle="Use something you haven't used before." />

      {error && (
        <div className="alert alert-error auth-alert" role="alert">
          <AlertCircle aria-hidden />
          <div className="alert-body">{error}</div>
        </div>
      )}

      {done ? (
        <div className="alert alert-success auth-alert" role="status">
          <CheckCircle2 aria-hidden />
          <div className="alert-body">Password updated. Taking you to your dashboard…</div>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="password">NEW PASSWORD</label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              describedBy="password-hint"
              disabled={loading}
            />
            <p className="auth-hint" id="password-hint">
              At least {MIN_PASSWORD} characters.
            </p>
          </div>
          <div className="auth-field">
            <label htmlFor="confirmPassword">CONFIRM NEW PASSWORD</label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              disabled={loading}
            />
          </div>
          <button className="submit-button" type="submit" disabled={loading}>
            {loading && <span className="spinner" aria-hidden />}
            <span>{loading ? "Updating…" : "Update password"}</span>
          </button>
        </form>
      )}

      <div className="auth-switch">
        <Link href="/dashboard">Skip for now</Link>
      </div>
    </>
  );
}
