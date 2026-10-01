"use client";

import { useEffect, useRef } from "react";
import { AlertTriangle, CheckCircle2, Circle, CircleX, Info, Loader2, RotateCcw, Square } from "lucide-react";
import { hostname } from "@/lib/format";
import type { ExecutionState, Phase } from "./use-execution";
import { displayPhase, progressPercent } from "./use-execution";

const STAGES: { key: string; label: string; phases: Phase[] }[] = [
  { key: "scrape", label: "Scraping sources", phases: ["connecting", "scraping"] },
  { key: "reconcile", label: "Reconciling data", phases: ["reconciling"] },
  { key: "format", label: "Formatting report", phases: ["formatting"] },
  { key: "done", label: "Complete", phases: ["complete"] },
];

function stageIndex(phase: Phase) {
  const i = STAGES.findIndex((s) => s.phases.includes(phase));
  return i === -1 ? 0 : i;
}

export default function ExecutionPanel({
  state,
  onCancel,
  onRetry,
}: {
  state: ExecutionState;
  onCancel: () => void;
  onRetry?: () => void;
}) {
  const phase = displayPhase(state);
  const pct = progressPercent(state);
  const running = ["connecting", "scraping", "reconciling", "formatting"].includes(phase);
  const ended = ["error", "interrupted", "cancelled"].includes(phase);
  const current = stageIndex(phase);
  const logRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.log.length]);

  const succeeded = state.tasks.filter((t) => t.status === "success").length;
  const failed = state.tasks.filter((t) => t.status === "failed").length;
  const scraping = state.tasks.filter((t) => t.status === "scraping").length;

  return (
    <section className="card execution" aria-label="Execution progress">
      <div className="card-head">
        <div>
          <h2>{phase === "complete" ? "Collection complete" : running ? "Collecting data…" : "Execution stopped"}</h2>
          <p>
            {state.total > 0
              ? `${state.completed} of ${state.total} sources processed · ${succeeded} succeeded · ${failed} failed${scraping > 0 ? ` · ${scraping} in progress` : ""}`
              : "Waiting for the executor to start…"}
          </p>
        </div>
        {running && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
            <Square aria-hidden />
            Stop listening
          </button>
        )}
      </div>

      <div
        className="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Collection progress"
      >
        <div className={`progress-fill ${running ? "is-active" : ""} ${ended ? "is-stopped" : ""}`} style={{ width: `${pct}%` }} />
      </div>

      <ol className="stages">
        {STAGES.map((s, i) => {
          const done = phase === "complete" || i < current;
          const active = running && i === current;
          return (
            <li key={s.key} className={`stage ${done ? "done" : ""} ${active ? "active" : ""}`}>
              {done ? <CheckCircle2 aria-hidden /> : active ? <span className="spinner" aria-hidden /> : <Circle aria-hidden />}
              {s.label}
            </li>
          );
        })}
      </ol>

      {ended && state.error && (
        <div className={`alert ${phase === "cancelled" ? "alert-warning" : "alert-error"}`} role="alert">
          <AlertTriangle aria-hidden />
          <div className="alert-body">
            <strong>
              {phase === "cancelled" ? "Stopped" : phase === "interrupted" ? "Connection interrupted" : "Execution failed"}
            </strong>
            <p>{state.error}</p>
            {phase === "cancelled" && (
              <p>The backend may still be processing this session. Check the session page for its status.</p>
            )}
            {onRetry && phase === "error" && (
              <div className="alert-actions">
                <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
                  <RotateCcw aria-hidden />
                  Try again
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="execution-grid">
        <div>
          <h3 className="subhead">Sources</h3>
          {state.tasks.length === 0 ? (
            <p className="muted-text">No sources processed yet.</p>
          ) : (
            <ul className="task-list">
              {[...state.tasks]
                .sort((a, b) => a.index - b.index)
                .map((t) => (
                  <li key={t.index} className={`task-item task-${t.status}`}>
                    {t.status === "success" ? (
                      <CheckCircle2 aria-hidden />
                    ) : t.status === "scraping" ? (
                      <Loader2 className="spin" aria-hidden />
                    ) : (
                      <CircleX aria-hidden />
                    )}
                    <div>
                      <a href={t.url} target="_blank" rel="noopener noreferrer">
                        {hostname(t.url)}
                      </a>
                      <span>
                        {t.status === "success"
                          ? `${t.entities ?? 0} record${t.entities === 1 ? "" : "s"} extracted`
                          : t.status === "scraping"
                          ? "Scanning page…"
                          : t.error || "Could not extract data"}
                      </span>
                    </div>
                  </li>
                ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="subhead">Activity log</h3>
          <ol className="log" ref={logRef} aria-live="polite">
            {state.log.map((l) => (
              <li key={l.id} className={`log-${l.tone}`}>
                <time>{new Date(l.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                {l.tone === "success" ? <CheckCircle2 aria-hidden /> : l.tone === "error" ? <CircleX aria-hidden /> : <Info aria-hidden />}
                <span>{l.text}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
