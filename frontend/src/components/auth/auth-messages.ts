import type { AuthError } from "@supabase/supabase-js";

export const NOT_CONFIGURED_MESSAGE =
  "Authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in frontend/.env.local, then restart the dev server.";

/** Messages for ?error= codes set by the proxy and /auth/callback. */
export function queryErrorMessage(code: string | undefined): string | null {
  switch (code) {
    case undefined:
    case "":
      return null;
    case "auth_not_configured":
      return NOT_CONFIGURED_MESSAGE;
    case "oauth_failed":
      return "Google sign-in was cancelled or could not be completed. Please try again.";
    case "missing_code":
    case "exchange_failed":
      return "This sign-in link is invalid or has expired. Please try again.";
    default:
      return "Something went wrong while signing you in. Please try again.";
  }
}

export function authErrorMessage(error: AuthError | Error | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  const code = "code" in error ? (error.code as string | undefined) : undefined;
  switch (code) {
    case "invalid_credentials":
      return "Incorrect email or password.";
    case "email_not_confirmed":
      return "Please confirm your email address first — check your inbox for the confirmation link.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Try signing in instead.";
    case "weak_password":
      return "That password is too weak. Use at least 8 characters with a mix of letters and numbers.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a minute and try again.";
    case "provider_disabled":
    case "validation_failed":
      return error.message || "This sign-in method is not enabled for this project.";
    case "same_password":
      return "Your new password must be different from the old one.";
  }
  if (/fetch|network/i.test(error.message)) {
    return "Could not reach the authentication server. Check your connection and Supabase URL.";
  }
  return error.message || "Something went wrong. Please try again.";
}
