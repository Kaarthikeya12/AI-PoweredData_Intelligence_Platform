import Link from "next/link";
import type { ReactNode } from "react";
import BrandMark from "@/components/ui/brand-mark";
import "./auth.css";

type AuthShellProps = {
  heading: ReactNode;
  description: string;
  navPrompt?: { text: string; href: string; label: string };
  children: ReactNode;
};

export default function AuthShell({ heading, description, navPrompt, children }: AuthShellProps) {
  return (
    <main className="auth-page" id="main">
      <div className="auth-grid" aria-hidden />
      <div className="auth-glow auth-glow-main" aria-hidden />
      <div className="auth-glow auth-glow-left" aria-hidden />
      <div className="auth-glow auth-glow-right" aria-hidden />

      <nav className="auth-navbar" aria-label="Main">
        <Link href="/" className="auth-brand">
          <BrandMark />
          <span>
            Data<span>Intel</span>
          </span>
        </Link>

        <div className="auth-nav-center">
          <Link href="/#workflow">Workflow</Link>
          <Link href="/#features">Features</Link>
          <Link href="/#use-cases">Use cases</Link>
        </div>

        <div className="auth-nav-right">
          {navPrompt && (
            <>
              <span>{navPrompt.text}</span>
              <Link href={navPrompt.href} className="auth-nav-button">
                {navPrompt.label} <span aria-hidden>↗</span>
              </Link>
            </>
          )}
        </div>
      </nav>

      <section className="auth-content">
        <div className="auth-orbit orbit-one" aria-hidden />
        <div className="auth-orbit orbit-two" aria-hidden />

        <div className="auth-intro">
          <div className="auth-badge">
            <span className="auth-badge-dot" />
            AI-POWERED DATA INTELLIGENCE
          </div>

          <h1>{heading}</h1>

          <p>{description}</p>

          <div className="auth-mini-flow" aria-hidden>
            <span>Prompt</span>
            <i>→</i>
            <span>Sources</span>
            <i>→</i>
            <span>Dataset</span>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-shine" aria-hidden />
          <div className="auth-card-content">{children}</div>
        </div>
      </section>

      <footer className="auth-footer">
        <span>DATAINTEL</span>
        <span>© 2026</span>
        <span>AI DATA INTELLIGENCE PLATFORM</span>
      </footer>
    </main>
  );
}

export function AuthCardHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="auth-card-header">
      <div className="auth-card-icon" aria-hidden>
        {icon}
      </div>
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>
    </div>
  );
}
