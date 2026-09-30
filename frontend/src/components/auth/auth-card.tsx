"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/env";
import { safeNextPath } from "@/lib/redirect";
import AuthShell, { AuthCardHeader } from "./auth-shell";
import PasswordInput from "./password-input";
import { NOT_CONFIGURED_MESSAGE, authErrorMessage, queryErrorMessage } from "./auth-messages";

type AuthCardProps = {
  mode: "login" | "signup";
  next?: string;
  errorCode?: string;
};

type Status =
  | { kind: "idle" }
  | { kind: "error"; message: string }
  | { kind: "success"; message: string };

const MIN_PASSWORD = 8;

export default function AuthCard({ mode, next, errorCode }: AuthCardProps) {
  const isLogin = mode === "login";
  const router = useRouter();
  const destination = safeNextPath(next);
  const configured = isSupabaseConfigured();

  const [loading, setLoading] = useState<"form" | "google" | null>(null);
  const [status, setStatus] = useState<Status>(() => {
    const message = queryErrorMessage(errorCode);
    if (message) return { kind: "error", message };
    if (!configured) return { kind: "error", message: NOT_CONFIGURED_MESSAGE };
    return { kind: "idle" };
  });

  function callbackUrl(target: string) {
    const url = new URL("/auth/callback", window.location.origin);
    url.searchParams.set("next", target);
    return url.toString();
  }

  async function handleGoogle() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setStatus({ kind: "error", message: NOT_CONFIGURED_MESSAGE });
    setLoading("google");
    setStatus({ kind: "idle" });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl(destination) },
    });
    // On success the browser navigates away to Google.
    if (error) {
      setStatus({ kind: "error", message: authErrorMessage(error) });
      setLoading(null);
    }
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return setStatus({ kind: "error", message: NOT_CONFIGURED_MESSAGE });

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    if (!isLogin) {
      const confirm = String(form.get("confirmPassword") ?? "");
      if (password.length < MIN_PASSWORD) {
        return setStatus({ kind: "error", message: `Password must be at least ${MIN_PASSWORD} characters.` });
      }
      if (password !== confirm) {
        return setStatus({ kind: "error", message: "Passwords do not match." });
      }
    }

    setLoading("form");
    setStatus({ kind: "idle" });

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(destination);
        router.refresh();
        return;
      }

      const fullName = String(form.get("fullName") ?? "").trim();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: fullName ? { full_name: fullName } : undefined,
          emailRedirectTo: callbackUrl(destination),
        },
      });
      if (error) throw error;

      // Supabase returns a user with no identities when the email is already registered.
      if (data.user && data.user.identities?.length === 0) {
        setStatus({ kind: "error", message: "An account with this email already exists. Try signing in instead." });
      } else if (data.session) {
        router.replace(destination);
        router.refresh();
        return;
      } else {
        setStatus({
          kind: "success",
          message: `We sent a confirmation link to ${email}. Open it to activate your account.`,
        });
      }
    } catch (err) {
      setStatus({ kind: "error", message: authErrorMessage(err as Error) });
    }
    setLoading(null);
  }

  const busy = loading !== null;

  return (
    <AuthShell
      heading={
        isLogin ? (
          <>
            Welcome
            <br />
            <em>back.</em>
          </>
        ) : (
          <>
            Turn data
            <br />
            into <em>intelligence.</em>
          </>
        )
      }
      description={
        isLogin
          ? "Continue building source-backed datasets from simple natural-language requests."
          : "Describe what you need. DataIntel discovers sources, collects information, and delivers structured datasets."
      }
      navPrompt={
        isLogin
          ? { text: "New here?", href: "/signup", label: "Get started" }
          : { text: "Already have an account?", href: "/login", label: "Sign in" }
      }
    >
      <AuthCardHeader
        icon={isLogin ? "→" : "+"}
        title={isLogin ? "Sign in" : "Create account"}
        subtitle={isLogin ? "Access your intelligence workspace." : "Start collecting intelligent data."}
      />

      {status.kind !== "idle" && (
        <div
          className={`alert ${status.kind === "error" ? "alert-error" : "alert-success"} auth-alert`}
          role={status.kind === "error" ? "alert" : "status"}
        >
          {status.kind === "error" ? <AlertCircle aria-hidden /> : <CheckCircle2 aria-hidden />}
          <div className="alert-body">{status.message}</div>
        </div>
      )}

      <button className="google-button" type="button" onClick={handleGoogle} disabled={busy || !configured}>
        {loading === "google" ? <span className="spinner" aria-hidden /> : <GoogleIcon />}
        {loading === "google" ? "Redirecting to Google…" : "Continue with Google"}
      </button>

      <div className="auth-divider">
        <span />
        <small>OR</small>
        <span />
      </div>

      <form onSubmit={handleSubmit} noValidate={false}>
        {!isLogin && (
          <div className="auth-field">
            <label htmlFor="fullName">FULL NAME</label>
            <input id="fullName" name="fullName" type="text" placeholder="Your name" autoComplete="name" disabled={busy} />
          </div>
        )}

        <div className="auth-field">
          <label htmlFor="email">EMAIL ADDRESS</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            disabled={busy}
            required
          />
        </div>

        <div className="auth-field">
          <div className="auth-label-row">
            <label htmlFor="password">PASSWORD</label>
            {isLogin && (
              <Link href="/forgot-password" className="forgot-button">
                Forgot password?
              </Link>
            )}
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={isLogin ? undefined : MIN_PASSWORD}
            describedBy={isLogin ? undefined : "password-hint"}
            disabled={busy}
          />
          {!isLogin && (
            <p className="auth-hint" id="password-hint">
              At least {MIN_PASSWORD} characters.
            </p>
          )}
        </div>

        {!isLogin && (
          <div className="auth-field">
            <label htmlFor="confirmPassword">CONFIRM PASSWORD</label>
            <PasswordInput
              id="confirmPassword"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              disabled={busy}
            />
          </div>
        )}

        <button className="submit-button" type="submit" disabled={busy || !configured}>
          {loading === "form" && <span className="spinner" aria-hidden />}
          <span>
            {loading === "form"
              ? isLogin
                ? "Signing in…"
                : "Creating account…"
              : isLogin
                ? "Enter workspace"
                : "Create my account"}
          </span>
          {loading !== "form" && <strong aria-hidden>↗</strong>}
        </button>
      </form>

      <div className="auth-switch">
        {isLogin ? (
          <>
            Don&apos;t have an account?
            <Link href={next ? `/signup?next=${encodeURIComponent(destination)}` : "/signup"}>Create one</Link>
          </>
        ) : (
          <>
            Already have an account?
            <Link href={next ? `/login?next=${encodeURIComponent(destination)}` : "/login"}>Sign in</Link>
          </>
        )}
      </div>

      <div className="auth-security">
        <span aria-hidden>◉</span>
        Secured by Supabase Auth
        <i aria-hidden />
        Source-backed intelligence
      </div>
    </AuthShell>
  );
}

function GoogleIcon() {
  return (
    <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  );
}
