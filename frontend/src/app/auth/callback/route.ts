import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/redirect";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Handles the PKCE redirect for Google OAuth, email confirmation and
 * password recovery: exchanges ?code= for a session cookie, then redirects
 * to a validated same-origin path.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));

  const fail = (reason: string) => {
    const url = new URL("/login", origin);
    url.searchParams.set("error", reason);
    return NextResponse.redirect(url);
  };

  // Provider-side errors (e.g. the user cancelled the Google consent screen).
  const providerError = searchParams.get("error_description") ?? searchParams.get("error");
  if (providerError) return fail("oauth_failed");

  const code = searchParams.get("code");
  if (!code) return fail("missing_code");

  const supabase = await getSupabaseServerClient();
  if (!supabase) return fail("auth_not_configured");

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail("exchange_failed");

  return NextResponse.redirect(new URL(next, origin));
}
