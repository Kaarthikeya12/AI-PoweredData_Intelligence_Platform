"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, History, LayoutDashboard, LogOut, Menu, Plus, Server, X } from "lucide-react";
import BrandMark from "@/components/ui/brand-mark";
import { API_BASE_URL } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export type ShellUser = {
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
};

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/new", label: "New collection", icon: Plus, exact: true },
  { href: "/dashboard/history", label: "History", icon: History, exact: false },
];

function isActive(pathname: string, href: string, exact: boolean) {
  if (href === "/dashboard/history") {
    return pathname.startsWith("/dashboard/history") || pathname.startsWith("/dashboard/sessions");
  }
  return exact ? pathname === href : pathname.startsWith(href);
}

function initials(user: ShellUser) {
  const source = user.name || user.email || "?";
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function DashboardShell({ user, children }: { user: ShellUser; children: ReactNode }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Close the mobile drawer on navigation.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setNavOpen(false);
  }

  return (
    <div className={`dash ${navOpen ? "dash-nav-open" : ""}`}>
      <aside className="dash-sidebar" aria-label="Dashboard">
        <div className="dash-sidebar-top">
          <Link href="/" className="brand">
            <BrandMark />
            <span>DataIntel</span>
          </Link>
          <button
            type="button"
            className="icon-btn dash-close"
            aria-label="Close navigation"
            onClick={() => setNavOpen(false)}
          >
            <X aria-hidden />
          </button>
        </div>

        <nav className="dash-nav">
          <span className="dash-nav-label">Workspace</span>
          {NAV.map(({ href, label, icon: Icon, exact }) => {
            const active = isActive(pathname, href, exact);
            return (
              <Link
                key={href}
                href={href}
                className={`dash-nav-link ${active ? "active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon aria-hidden />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="dash-sidebar-foot">
          <div className="dash-api">
            <Server aria-hidden />
            <div>
              <span>Backend API</span>
              <code title={API_BASE_URL}>{API_BASE_URL.replace(/^https?:\/\//, "")}</code>
            </div>
          </div>
        </div>
      </aside>

      <button
        type="button"
        className="dash-scrim"
        aria-label="Close navigation"
        tabIndex={navOpen ? 0 : -1}
        onClick={() => setNavOpen(false)}
      />

      <div className="dash-main">
        <header className="dash-topbar">
          <button
            type="button"
            className="icon-btn dash-menu"
            aria-label="Open navigation"
            aria-expanded={navOpen}
            onClick={() => setNavOpen(true)}
          >
            <Menu aria-hidden />
          </button>
          <Link href="/dashboard" className="brand dash-topbar-brand">
            <BrandMark />
            <span>DataIntel</span>
          </Link>

          <div className="dash-topbar-actions">
            {/* Overview, History and New collection render their own primary action. */}
            {!["/dashboard", "/dashboard/new", "/dashboard/history"].includes(pathname) && (
              <Link href="/dashboard/new" className="btn btn-primary btn-sm dash-topbar-new">
                <Plus aria-hidden />
                New collection
              </Link>
            )}
            <UserMenu user={user} />
          </div>
        </header>

        <main className="dash-content" id="main">
          {children}
        </main>
      </div>
    </div>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setSigningOut(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error } = supabase ? await supabase.auth.signOut() : { error: null };
    if (error) {
      setError("Sign out failed. Please try again.");
      setSigningOut(false);
      return;
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {user.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatarUrl} alt="" className="avatar" referrerPolicy="no-referrer" />
        ) : (
          <span className="avatar" aria-hidden>
            {initials(user)}
          </span>
        )}
        <span className="user-trigger-name">{user.name ?? user.email ?? "Account"}</span>
        <ChevronDown aria-hidden />
      </button>

      {open && (
        <div className="user-dropdown" role="menu">
          <div className="user-dropdown-head">
            <strong>{user.name ?? "Signed in"}</strong>
            {user.email && <span>{user.email}</span>}
          </div>
          {error && <p className="user-dropdown-error">{error}</p>}
          <button type="button" role="menuitem" className="user-dropdown-item" onClick={signOut} disabled={signingOut}>
            {signingOut ? <span className="spinner" aria-hidden /> : <LogOut aria-hidden />}
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
