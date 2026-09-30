"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { History as HistoryIcon, Plus, RotateCcw, Search } from "lucide-react";
import { listSessions } from "@/lib/api/client";
import { useApi } from "@/lib/use-api";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import PageHeader from "./page-header";
import SessionsTable from "./sessions-table";
import SharedDataNotice from "./shared-data-notice";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "executing", label: "Running" },
  { value: "planned", label: "Planned" },
  { value: "failed", label: "Failed" },
];

export default function History() {
  const { status, data, error, reload } = useApi(listSessions, "sessions");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const sessions = useMemo(() => data ?? [], [data]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sessions.filter(
      (s) =>
        (filter === "all" || s.status === filter) &&
        (!q || s.user_prompt?.toLowerCase().includes(q) || s.id.toLowerCase().includes(q)),
    );
  }, [sessions, query, filter]);

  return (
    <div className="page">
      <PageHeader
        eyebrow="Workspace"
        title="Session history"
        description="Every collection session stored by the backend, newest first."
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={reload} disabled={status === "loading"}>
              <RotateCcw aria-hidden />
              Refresh
            </button>
            <Link href="/dashboard/new" className="btn btn-primary">
              <Plus aria-hidden />
              New collection
            </Link>
          </>
        }
      />

      {status === "error" && <ErrorState title="Couldn't load sessions" message={error.message} onRetry={reload} />}

      <section className="card card-flush">
        <div className="toolbar">
          <label className="search-field">
            <Search aria-hidden />
            <span className="sr-only">Search sessions</span>
            <input
              type="search"
              placeholder="Search by request or session ID…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="segmented" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                className={filter === f.value ? "active" : ""}
                aria-pressed={filter === f.value}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
                {data && (
                  <span className="segmented-count">
                    {f.value === "all" ? sessions.length : sessions.filter((s) => s.status === f.value).length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {status === "loading" && !data ? (
          <LoadingState label="Loading sessions…" />
        ) : sessions.length === 0 && status !== "error" ? (
          <EmptyState
            icon={<HistoryIcon />}
            title="No sessions yet"
            description="Sessions appear here as soon as a plan is generated."
            action={
              <Link href="/dashboard/new" className="btn btn-primary">
                <Plus aria-hidden />
                New collection
              </Link>
            }
          />
        ) : filtered.length === 0 && data ? (
          <EmptyState icon={<Search />} title="No matching sessions" description="Try a different search or status filter." />
        ) : (
          filtered.length > 0 && <SessionsTable sessions={filtered} />
        )}
      </section>

      <SharedDataNotice />
    </div>
  );
}
