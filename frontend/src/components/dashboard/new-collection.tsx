"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { ArrowRight, Play, RotateCcw, Sparkles, X } from "lucide-react";
import { ApiError, planJob } from "@/lib/api/client";
import type { PlanResponse } from "@/lib/api/types";
import { ErrorState } from "@/components/ui/states";
import PageHeader from "./page-header";
import PlanReview from "./plan-review";
import ExecutionPanel from "./execution-panel";
import ResultsView from "./results-view";
import { useExecution } from "./use-execution";

const EXAMPLES = [
  "Find database pricing for Supabase and Neon",
  "Compare the free tiers of Vercel, Netlify and Cloudflare Pages",
  "List the pricing plans of Linear and Jira with seat limits",
];

const MAX_PROMPT = 2000;

type Step = "prompt" | "planning" | "review";

export default function NewCollection() {
  const [prompt, setPrompt] = useState("");
  const [step, setStep] = useState<Step>("prompt");
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  useEffect(() => {
    if (step !== "planning") return;
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(id);
  }, [step]);

  async function generatePlan(e?: FormEvent) {
    e?.preventDefault();
    const text = prompt.trim();
    if (!text) return setError("Describe the data you want to collect.");

    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setElapsed(0);
    setStep("planning");
    try {
      const result = await planJob(text, controller.signal);
      setPlan(result);
      setStep("review");
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      if (apiErr?.kind === "aborted") {
        setStep("prompt");
        return;
      }
      setError(apiErr?.message ?? "Planning failed unexpectedly.");
      setStep("prompt");
    }
  }

  function cancelPlanning() {
    controllerRef.current?.abort();
  }

  function startOver() {
    setPlan(null);
    setError(null);
    setStep("prompt");
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="New collection"
        title="What data do you need?"
        description="Describe it in plain language. You'll review the proposed sources and fields before anything is scraped."
      />

      <Stepper step={plan ? "review" : step} />

      {!plan && (
        <form className="card prompt-form" onSubmit={generatePlan}>
          <label htmlFor="prompt" className="field-label">
            Your request
          </label>
          <textarea
            id="prompt"
            className="textarea"
            rows={5}
            maxLength={MAX_PROMPT}
            placeholder="e.g. Find database pricing for Supabase and Neon, including storage limits and compute costs"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) generatePlan();
            }}
            disabled={step === "planning"}
            aria-describedby="prompt-help"
          />
          <div className="prompt-meta" id="prompt-help">
            <span>Be specific about the entities and fields you want. Ctrl/⌘ + Enter to submit.</span>
            <span>
              {prompt.length}/{MAX_PROMPT}
            </span>
          </div>

          {step !== "planning" && (
            <div className="examples">
              <span>Try:</span>
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" className="chip chip-button" onClick={() => setPrompt(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          )}

          {error && <ErrorState title="Couldn't generate a plan" message={error} />}

          <div className="form-actions">
            {step === "planning" ? (
              <>
                <div className="planning-status" role="status" aria-live="polite">
                  <span className="spinner" aria-hidden />
                  Discovering sources and designing a schema… {elapsed}s
                </div>
                <button type="button" className="btn btn-secondary" onClick={cancelPlanning}>
                  <X aria-hidden />
                  Cancel
                </button>
              </>
            ) : (
              <button type="submit" className="btn btn-primary btn-lg" disabled={!prompt.trim()}>
                <Sparkles aria-hidden />
                Generate plan
              </button>
            )}
          </div>
        </form>
      )}

      {plan && <PlannedSession plan={plan} prompt={prompt.trim()} onStartOver={startOver} />}
    </div>
  );
}

function PlannedSession({ plan, prompt, onStartOver }: { plan: PlanResponse; prompt: string; onStartOver: () => void }) {
  const { state, start, cancel, running } = useExecution(plan.session_id);
  const started = state.phase !== "idle";

  return (
    <>
      <section className="card plan-summary">
        <div>
          <span className="field-label">Request</span>
          <p className="plan-prompt">{prompt}</p>
          <span className="cell-sub mono">Session {plan.session_id}</span>
        </div>
        {!started && (
          <div className="plan-actions">
            <button type="button" className="btn btn-secondary" onClick={onStartOver}>
              <RotateCcw aria-hidden />
              Start over
            </button>
            <button type="button" className="btn btn-primary btn-lg" onClick={start} disabled={!plan.ui_cards.length}>
              <Play aria-hidden />
              Start scraping
            </button>
          </div>
        )}
        {started && !running && (
          <div className="plan-actions">
            <Link href={`/dashboard/sessions/${plan.session_id}`} className="btn btn-secondary">
              View session
              <ArrowRight aria-hidden />
            </Link>
            <button type="button" className="btn btn-primary" onClick={onStartOver}>
              New collection
            </button>
          </div>
        )}
      </section>

      {started && <ExecutionPanel state={state} onCancel={cancel} onRetry={start} />}

      {state.result && (
        <ResultsView
          dataset={state.result.consolidated_dataset}
          notes={state.result.reconciliation_notes}
          report={state.result.report}
          schemaKeys={Object.keys(plan.extraction_schema)}
          fileBase={`dataintel-${plan.session_id.slice(0, 8)}`}
        />
      )}

      {!started && <PlanReview cards={plan.ui_cards} schema={plan.extraction_schema} />}
    </>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps = [
    { key: "prompt", label: "Describe" },
    { key: "planning", label: "Plan" },
    { key: "review", label: "Review & run" },
  ];
  const current = steps.findIndex((s) => s.key === step);
  return (
    <ol className="stepper" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s.key} className={i < current ? "done" : i === current ? "active" : ""} aria-current={i === current ? "step" : undefined}>
          <span className="stepper-num">{i + 1}</span>
          {s.label}
        </li>
      ))}
    </ol>
  );
}
