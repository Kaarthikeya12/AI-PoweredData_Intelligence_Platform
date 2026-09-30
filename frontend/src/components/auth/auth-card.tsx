"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import "./auth.css";

type AuthCardProps = {
  mode: "login" | "signup";
};

export default function AuthCard({ mode }: AuthCardProps) {
  const isLogin = mode === "login";
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);

    setTimeout(() => {
      setLoading(false);
    }, 900);
  }

  return (
    <main className="auth-page">
      <div className="auth-grid" />
      <div className="auth-glow auth-glow-main" />
      <div className="auth-glow auth-glow-left" />
      <div className="auth-glow auth-glow-right" />

      <nav className="auth-navbar">
        <Link href="/" className="auth-brand">
          <span className="auth-brand-mark">Z</span>
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
          {isLogin ? (
            <>
              <span>New here?</span>
              <Link href="/signup" className="auth-nav-button">
                Get started <span>↗</span>
              </Link>
            </>
          ) : (
            <>
              <span>Already have an account?</span>
              <Link href="/login" className="auth-nav-button">
                Sign in <span>↗</span>
              </Link>
            </>
          )}
        </div>
      </nav>

      <section className="auth-content">
        <div className="auth-orbit orbit-one" />
        <div className="auth-orbit orbit-two" />

        <div className="auth-intro">
          <div className="auth-badge">
            <span className="auth-badge-dot" />
            AI-POWERED DATA INTELLIGENCE
          </div>

          <h1>
            {isLogin ? (
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
            )}
          </h1>

          <p>
            {isLogin
              ? "Continue building source-backed datasets from simple natural-language requests."
              : "Describe what you need. DataIntel discovers sources, collects information, and delivers structured datasets."}
          </p>

          <div className="auth-mini-flow">
            <span>Prompt</span>
            <i>→</i>
            <span>Sources</span>
            <i>→</i>
            <span>Dataset</span>
          </div>
        </div>

        <div className="auth-card">
          <div className="auth-card-shine" />

          <div className="auth-card-content">
            <div className="auth-card-header">
              <div className="auth-card-icon">
                {isLogin ? "→" : "+"}
              </div>

              <div>
                <h2>{isLogin ? "Sign in" : "Create account"}</h2>
                <p>
                  {isLogin
                    ? "Access your intelligence workspace."
                    : "Start collecting intelligent data."}
                </p>
              </div>
            </div>

            <button className="google-button" type="button">
              <span className="google-icon">G</span>
              Continue with Google
            </button>

            <div className="auth-divider">
              <span />
              <small>OR</small>
              <span />
            </div>

            <form onSubmit={handleSubmit}>
              {!isLogin && (
                <div className="auth-field">
                  <label>FULL NAME</label>
                  <input
                    type="text"
                    placeholder="Kaarthikeya"
                    required
                  />
                </div>
              )}

              <div className="auth-field">
                <label>EMAIL ADDRESS</label>
                <input
                  type="email"
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div className="auth-field">
                <div className="auth-label-row">
                  <label>PASSWORD</label>

                  {isLogin && (
                    <button type="button" className="forgot-button">
                      Forgot password?
                    </button>
                  )}
                </div>

                <div className="password-wrap">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••••••"
                    minLength={6}
                    required
                  />

                  <button
                    type="button"
                    className="show-button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "HIDE" : "SHOW"}
                  </button>
                </div>
              </div>

              {!isLogin && (
                <label className="terms">
                  <input type="checkbox" required />
                  <span>
                    I agree to the <b>Terms of Service</b> and{" "}
                    <b>Privacy Policy</b>.
                  </span>
                </label>
              )}

              <button
                className="submit-button"
                type="submit"
                disabled={loading}
              >
                <span>
                  {loading
                    ? "Processing..."
                    : isLogin
                      ? "Enter workspace"
                      : "Create my account"}
                </span>

                {!loading && <strong>↗</strong>}
              </button>
            </form>

            <div className="auth-switch">
              {isLogin ? (
                <>
                  Don't have an account?
                  <Link href="/signup">Create one</Link>
                </>
              ) : (
                <>
                  Already have an account?
                  <Link href="/login">Sign in</Link>
                </>
              )}
            </div>

            <div className="auth-security">
              <span>◉</span>
              Secure access
              <i />
              Source-backed intelligence
            </div>
          </div>
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
