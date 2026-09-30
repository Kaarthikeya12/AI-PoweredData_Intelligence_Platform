import Link from "next/link";
import SiteNav from "@/components/marketing/site-nav";
import BrandMark from "@/components/ui/brand-mark";
import { getCurrentUser } from "@/lib/supabase/server";

const features = [
  {
    number: "01",
    title: "Describe your data",
    text: "Tell the platform what information you need using plain language.",
  },
  {
    number: "02",
    title: "AI builds the workflow",
    text: "The intelligence layer discovers sources and creates the collection process automatically.",
  },
  {
    number: "03",
    title: "Collect & structure",
    text: "Public data is collected, extracted, cleaned and converted into structured records.",
  },
  {
    number: "04",
    title: "Verify everything",
    text: "Every result remains connected to its source so your dataset stays traceable.",
  },
];

const useCases = [
  "Sales leads",
  "Job opportunities",
  "Market research",
  "Sponsor discovery",
  "Competitor intelligence",
  "Public web datasets",
];

export default async function Home() {
  const signedIn = Boolean(await getCurrentUser());

  return (
    <main className="site-shell" id="main">
      <div className="ambient ambient-one" aria-hidden />
      <div className="ambient ambient-two" aria-hidden />

      <SiteNav signedIn={signedIn} />

      {/* HERO */}
      <section className="hero" id="product">
        <div className="hero-grid" aria-hidden />

        <div className="hero-glow" aria-hidden />

        {/* Decorative shapes */}
        <div className="neon-orbit orbit-left" aria-hidden>
          <div className="orbit-ring" />
          <div className="orbit-core" />
        </div>

        <div className="neon-diamond" aria-hidden>
          <div className="diamond-inner" />
        </div>

        <div className="neon-arrow" aria-hidden>
          <span />
          <span />
          <span />
        </div>

        <div className="hero-content">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            AI-POWERED DATA INTELLIGENCE
          </div>

          <h1>
            Turn any data request
            <br />
            into a <span>structured dataset.</span>
          </h1>

          <p className="hero-description">
            Describe the data you need. Our AI discovers sources, collects
            information, extracts structured fields, validates results, and
            delivers verified data you can actually use.
          </p>

          <div className="hero-buttons">
            <Link href="/dashboard/new" className="primary-button">
              Start collecting
              <span aria-hidden>→</span>
            </Link>

            <a href="#workflow" className="secondary-button">
              See how it works
            </a>
          </div>

          <div className="hero-trust">
            <span className="pulse" />
            Public-source intelligence
            <span className="separator">•</span>
            Source-backed results
            <span className="separator">•</span>
            Structured output
          </div>
        </div>

        <div className="scroll-indicator" aria-hidden>
          <span>Scroll to explore</span>
          <i />
        </div>
      </section>

      {/* PROMPT DEMO */}
      <section className="demo-section" id="start">
        <div className="section-label">01 — INTELLIGENT COLLECTION</div>

        <div className="demo-heading">
          <h2>
            Just describe
            <br />
            what you need.
          </h2>

          <p>
            No complicated scraper configuration. Give the platform an
            objective and let the intelligence layer turn it into a data
            collection workflow.
          </p>
        </div>

        <div className="prompt-card">
          <div className="prompt-top">
            <div className="window-dots">
              <span />
              <span />
              <span />
            </div>

            <span className="prompt-status">
              <i />
              AI WORKSPACE
            </span>
          </div>

          <div className="prompt-body">
            <div className="prompt-icon" aria-hidden>✦</div>

            <div className="prompt-text">
              <span className="prompt-label">YOUR REQUEST</span>

              <p>
                Find SaaS companies hiring backend engineers in Europe with
                their company name, website, funding stage and careers URL.
              </p>
            </div>

            <Link href="/dashboard/new" className="run-button">
              Try it yourself
              <span aria-hidden>→</span>
            </Link>
          </div>

          <div className="workflow-line">
            <div>
              <span>01</span>
              Discover sources
            </div>

            <b />

            <div>
              <span>02</span>
              Extract data
            </div>

            <b />

            <div>
              <span>03</span>
              Validate
            </div>

            <b />

            <div>
              <span>04</span>
              Dataset ready
            </div>
          </div>
        </div>
      </section>

      {/* WORKFLOW */}
      <section className="workflow-section" id="workflow">
        <div className="section-label">02 — FROM PROMPT TO DATA</div>

        <div className="workflow-title">
          <h2>
            Intelligence that
            <br />
            <span>does the work.</span>
          </h2>
        </div>

        <div className="workflow-grid">
          {features.map((feature) => (
            <article className="workflow-card" key={feature.number}>
              <div className="card-number">{feature.number}</div>

              <div className="card-line" />

              <h3>{feature.title}</h3>

              <p>{feature.text}</p>

              <div className="card-arrow">↗</div>
            </article>
          ))}
        </div>
      </section>

      {/* DATA PREVIEW */}
      <section className="data-section">
        <div className="section-label">03 — YOUR DATASET</div>

        <div className="data-header">
          <div>
            <h2>
              From messy web data
              <br />
              to <span>usable intelligence.</span>
            </h2>
          </div>

          <p>
            Results are structured, validated and connected to the original
            source so you can inspect exactly where every record came from.
          </p>
        </div>

        <div className="data-window">
          <div className="data-window-top">
            <div className="window-dots">
              <span />
              <span />
              <span />
            </div>

            <div className="dataset-name">
              <span className="blue-dot" />
              Example output — SaaS Companies, Europe
            </div>

            <div className="records">Illustrative example</div>
          </div>

          <div className="table">
            <div className="table-row table-heading">
              <span>COMPANY</span>
              <span>ROLE</span>
              <span>FUNDING</span>
              <span>SOURCE</span>
              <span>STATUS</span>
            </div>

            {[
              ["Linear", "Backend Engineer", "Series B", "linear.app", "Sample"],
              ["Vercel", "Software Engineer", "Series E", "vercel.com", "Sample"],
              ["Loom", "Backend Developer", "Series C", "loom.com", "Sample"],
              ["Stripe", "Platform Engineer", "Private", "stripe.com", "Sample"],
            ].map((row, index) => (
              <div className="table-row" key={index}>
                <span className="company-name">{row[0]}</span>
                <span>{row[1]}</span>
                <span>{row[2]}</span>
                <span className="source">{row[3]}</span>
                <span>
                  <em className="verified">
                    <i />
                    {row[4]}
                  </em>
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="features-section" id="features">
        <div className="section-label">04 — BUILT FOR DATA WORK</div>

        <h2>
          One platform.
          <br />
          <span>Every collection workflow.</span>
        </h2>

        <div className="feature-matrix">
          <div className="feature-large">
            <div className="feature-symbol">✦</div>
            <h3>AI-powered workflows</h3>
            <p>
              Turn natural language objectives into repeatable data collection
              workflows.
            </p>
          </div>

          <div className="feature-box">
            <span>↗</span>
            <h3>Multi-source</h3>
            <p>Collect information across permitted public sources.</p>
          </div>

          <div className="feature-box">
            <span>⌁</span>
            <h3>Validation</h3>
            <p>Clean, validate and deduplicate collected records.</p>
          </div>

          <div className="feature-box">
            <span>◉</span>
            <h3>Evidence</h3>
            <p>Keep source-backed evidence attached to every result.</p>
          </div>

          <div className="feature-box">
            <span>↓</span>
            <h3>Export</h3>
            <p>Turn your final dataset into something your team can use.</p>
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="use-cases" id="use-cases">
        <div className="section-label">05 — USE CASES</div>

        <div className="use-case-layout">
          <h2>
            Ask for data.
            <br />
            <span>Get intelligence.</span>
          </h2>

          <div className="use-case-list">
            {useCases.map((item, index) => (
              <div className="use-case" key={item}>
                <span>0{index + 1}</span>
                <strong>{item}</strong>
                <i>↗</i>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="final-section">
        <div className="final-glow" />

        <div className="final-content">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            DATA INTELLIGENCE, REIMAGINED
          </div>

          <h2>
            Your next dataset
            <br />
            starts with a <span>sentence.</span>
          </h2>

          <p>
            Describe what you need. Let the platform handle the collection.
          </p>

          <Link href="/dashboard/new" className="primary-button final-button">
            Start collecting
            <span aria-hidden>→</span>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <Link href="/" className="brand footer-brand">
          <BrandMark />
          <span>DataIntel</span>
        </Link>

        <span>AI-powered data intelligence platform</span>

        <span>© 2026 DataIntel</span>
      </footer>
    </main>
  );
}