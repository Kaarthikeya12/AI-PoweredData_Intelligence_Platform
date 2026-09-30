"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import BrandMark from "@/components/ui/brand-mark";

const links = [
  { href: "#product", label: "Product" },
  { href: "#workflow", label: "Workflow" },
  { href: "#features", label: "Features" },
  { href: "#use-cases", label: "Use cases" },
];

export default function SiteNav({ signedIn }: { signedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <header className="navbar-wrap">
      <nav className="navbar" aria-label="Main">
        <Link href="/" className="brand">
          <BrandMark />
          <span>DataIntel</span>
        </Link>

        <div className="nav-links">
          {links.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>

        <div className="nav-actions">
          {signedIn ? (
            <Link href="/dashboard" className="nav-cta">
              Open dashboard
              <span aria-hidden>↗</span>
            </Link>
          ) : (
            <>
              <Link href="/login" className="sign-in">
                Sign in
              </Link>
              <Link href="/signup" className="nav-cta">
                Get started
                <span aria-hidden>↗</span>
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="icon-btn nav-menu-button"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X aria-hidden /> : <Menu aria-hidden />}
        </button>

        <div id="mobile-menu" className="mobile-menu" hidden={!open}>
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={close}>
              {l.label}
            </a>
          ))}
          {signedIn ? (
            <Link href="/dashboard" className="nav-cta" onClick={close}>
              Open dashboard
            </Link>
          ) : (
            <>
              <Link href="/login" onClick={close}>
                Sign in
              </Link>
              <Link href="/signup" className="nav-cta" onClick={close}>
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
