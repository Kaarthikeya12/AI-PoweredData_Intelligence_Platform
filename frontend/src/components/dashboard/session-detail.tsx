"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { ArrowLeft, Check, Copy, ExternalLink, Play, RotateCcw } from "lucide-react";
import { getSessionDetail } from "@/lib/api/client";
import type { PlannedTaskRow, SessionDetail as Detail } from "@/lib/api/types";
import { useApi } from "@/lib/use-api";
import { formatDateTime, hostname } from "@/lib/format";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { SessionStatusBadge, TaskStatusBadge } from "@/components/ui/status-badge";
import PageHeader from "./page-header";
import { SchemaTable, SourceCards } from "./plan-review";
import ExecutionPanel from "./execution-panel";
import ResultsView from "./results-view";
import { useExecution } from "./use-execution";

type Tab = "results" | "sources" | "schema";

export default function SessionDetail({ sessionId }: { sessionId: string }) {
  const loader = useCallback((signal: AbortSignal) => getSessionDetail(sessionId, signal), [sessionId]);
  const { status, data, error, reload } = useApi(loader, sessionId);

  if (status === "loading" && !data) return <LoadingState label="Loading session…" />;

  if (status === "error" && !data) {
    const notFound = error.status === 404;
    return (
      <div className="page">
        <BackLink />
        <ErrorState
          title={notFound ? "Session not found" : "Couldn't load this session"}
          message={notFound ? "This session doesn't exist or was deleted." : error.message}
          onRetry={notFound ? undefined : reload}
        />
      </div>
    );
  }

  return data ? <Loaded detail={data} reload={reload} refreshing={status === "loading"} /> : null;
}

function BackLink() {
  return (
    <Link href="/dashboard/history" className="back-link">
      <ArrowLeft aria-hidden />
      All sessions
    </Link>
  );
}

function Loaded({ detail, reload, refreshing }: { detail: Detail; reload: () => void; refreshing: boolean }) {
  const { session, planned_tasks: tasks, results } = detail;
  const execution = useExecution(session.id, reload);
  const [tab, setTab] = useState<Tab>(results ? "results" : "sources");
  const [copied, setCopied] = useState(false);

  const started = execution.state.phase !== "idle";
  const canRun = session.status === "planned" || session.status === "failed";
  const schemaKeys = Object.keys(session.extraction_schema ?? {});

  const liveResult = execution.state.result;
  const dataset = results?.consolidated_dataset ?? liveResult?.consolidated_dataset ?? null;
  const notes = results?.reconciliation_notes ?? liveResult?.reconciliation_notes ?? [];
  const report = results?.markdown_report ?? liveResult?.report ?? null;

  async function copyId() {
    try {
      await navigator.clipboard.writeText(session.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className="page">
      <BackLink />

      <PageHeader
        eyebrow="Session"
        title={<span className="session-title">{session.user_prompt || "Untitled request"}</span>}
        description={
          <span className="session-meta">
            <SessionStatusBadge status={session.status} />
            <span>Created {formatDateTime(session.created_at)}</span>
            {session.completed_at && <span>Completed {formatDateTime(session.completed_at)}</span>}
            <button type="button" className="id-copy" onClick={copyId} aria-label="Copy session ID">
              <code>{session.id.slice(0, 8)}</code>
              {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
            </button>
          </span>
        }
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={reload} disabled={refreshing || execution.running}>
              {refreshing ? <span className="spinner" aria-hidden /> : <RotateCcw aria-hidden />}
              Refresh
            </button>
            {canRun && !started && (
              <button type="button" className="btn btn-primary" onClick={execution.start} disabled={!tasks.length}>
                <Play aria-hidden />
                {session.status === "failed" ? "Retry scraping" : "Start scraping"}
              </button>
            )}
          </>
        }
      />

      {session.status === "executing" && !started && (
        <div className="alert alert-info" role="status">
          <span className="spinner" aria-hidden />
          <div className="alert-body">
            <strong>This session is running</strong>
            <p>
              Execution was started elsewhere, so live progress isn&apos;t available on this page. Refresh to check for
              results.
            </p>
          </div>
        </div>
      )}

      {session.status === "failed" && !started && (
        <ErrorState
          title="This session failed"
          message="The executor reported an error. Check the sources tab for per-URL errors, then retry."
        />
      )}

      {session.status === "planned" && !started && (
        <div className="alert alert-info">
          <Play aria-hidden />
          <div className="alert-body">
            <strong>Ready to run</strong>
            <p>Review the proposed sources and schema below, then start scraping.</p>
          </div>
        </div>
      )}

      {started && <ExecutionPanel state={execution.state} onCancel={execution.cancel} onRetry={execution.start} />}

      <div className="tabs" role="tablist" aria-label="Session sections">
        {(
          [
            ["results", "Results"],
            ["sources", `Sources (${tasks.length})`],
            ["schema", `Schema (${schemaKeys.length})`],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "results" &&
          (dataset ? (
            <ResultsView
              dataset={dataset}
              notes={notes}
              report={report}
              schemaKeys={schemaKeys}
              fileBase={`dataintel-${session.id.slice(0, 8)}`}
            />
          ) : (
            <div className="card">
              <EmptyState
                title="No results yet"
                description={
                  session.status === "planned"
                    ? "Start scraping to collect and consolidate data from the planned sources."
                    : "Results will appear here once execution completes."
                }
              />
            </div>
          ))}

        {tab === "sources" && (
          <section className="card card-flush">
            {session.status === "planned" && !started ? (
              <div className="card-pad">
                <SourceCards
                  cards={tasks.map((t) => ({ title: t.title ?? "", url: t.url, reason: t.reason ?? "" }))}
                />
              </div>
            ) : (
              <TasksTable tasks={tasks} />
            )}
          </section>
        )}

        {tab === "schema" && (
          <section className="card">
            <SchemaTable schema={session.extraction_schema} />
          </section>
        )}
      </div>
    </div>
  );
}

function TasksTable({ tasks }: { tasks: PlannedTaskRow[] }) {
  if (!tasks.length) return <EmptyState title="No sources" description="The planner stored no tasks for this session." />;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Source</th>
            <th scope="col">Status</th>
            <th scope="col">Records</th>
            <th scope="col">Details</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => {
            const entities = Array.isArray(t.scrape_result?.entities) ? t.scrape_result.entities.length : null;
            const err = typeof t.error_details?.message === "string" ? t.error_details.message : null;
            return (
              <tr key={t.id ?? t.task_index}>
                <td className="cell-muted">{t.task_index + 1}</td>
                <td>
                  <span className="cell-strong">{t.title || hostname(t.url)}</span>
                  <a href={t.url} target="_blank" rel="noopener noreferrer" className="cell-link">
                    {hostname(t.url)}
                    <ExternalLink aria-hidden />
                  </a>
                </td>
                <td>
                  <TaskStatusBadge status={t.scrape_status} />
                </td>
                <td className="cell-muted">{entities ?? "—"}</td>
                <td className="cell-wrap cell-muted">{err ?? t.reason ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
