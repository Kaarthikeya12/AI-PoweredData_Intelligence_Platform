const DEFAULT_DESTINATION = "/dashboard";

/**
 * Only allow same-origin, path-only redirect targets. Rejects absolute URLs,
 * protocol-relative URLs ("//evil.com"), backslash tricks ("/\evil.com") and
 * anything that would bounce back into the auth pages.
 */
export function safeNextPath(
  value: string | null | undefined,
  fallback: string = DEFAULT_DESTINATION,
): string {
  if (!value || typeof value !== "string") return fallback;
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;

  try {
    const parsed = new URL(value, "http://localhost");
    if (parsed.origin !== "http://localhost") return fallback;
    if (
      parsed.pathname === "/login" ||
      parsed.pathname === "/signup" ||
      parsed.pathname.startsWith("/auth/")
    ) {
      return fallback;
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return fallback;
  }
}
