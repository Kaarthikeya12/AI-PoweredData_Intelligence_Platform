"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Activity, CheckCircle2, CircleDashed, Database, Loader, Plus, XCircle } from "lucide-react";
import { listSessions } from "@/lib/api/client";
import type { SessionRow } from "@/lib/api/types";
import { useApi } from "@/lib/use-api";
import { formatDateTime, formatRelative } from "@/lib/format";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SessionStatusBadge } from "@/components/ui/status-badge";
import PageHeader from "./page-header";
import SessionsTable from "./sessions-table";
import SharedDataNotice from "./shared-data-notice";
import { ActivityChart, StatusBreakdown } from "./charts";

export default function Overview() {
  const { status, data, error, reload } = useApi(listSessions, "sessions");
  const sessions = useMemo(() => data ?? [], [data]);

  const stats = useMemo(() => {
    const by = (s: string) => sessions.filter((x) => x.status === s).length;
    return {
      total: sessions.length,
      completed: by("completed"),
      running: by("executing"),
      failed: by("failed"),
      planned: by("planned"),
    };
  }, [sessions]);

  const loading = status === "loading" && !data;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Workspace"
        title="Overview"
        description="Track your data collection sessions and pick up where you left off."
        actions={
          <Link href="/dashboard/new" className="btn btn-primary">
            <Plus aria-hidden />
            New collection
          </Link>
        }
      />

      {status === "error" && (
        <ErrorState title="Couldn't load sessions" message={error.message} onRetry={reload} />
      )}

      <section className="stat-grid" aria-label="Session statistics">
        <StatTile icon={<Database />} label="Total sessions" value={stats.total} loading={loading} hint={`${stats.planned} awaiting run`} />
        <StatTile icon={<CheckCircle2 />} label="Completed" value={stats.completed} loading={loading} tone="success" />
        <StatTile icon={<Loader />} label="Running" value={stats.running} loading={loading} tone="info" />
        <StatTile icon={<XCircle />} label="Failed" value={stats.failed} loading={loading} tone="danger" />
      </section>

      {!loading && status !== "error" && sessions.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<CircleDashed />}
            title="No collection sessions yet"
            description="Describe the data you need in plain language. DataIntel will propose sources and a schema for you to review before anything is scraped."
            action={
              <Link href="/dashboard/new" className="btn btn-primary">
                <Plus aria-hidden />
                Start your first collection
              </Link>
            }
          />
        </div>
      ) : (
        <>
          <div className="overview-grid">
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Sessions per day</h2>
                  <p>Created in the last 14 days</p>
                </div>
              </div>
              {loading ? <div className="skeleton" style={{ height: 180 }} /> : <ActivityChart sessions={sessions} />}
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Status breakdown</h2>
                  <p>All sessions</p>
                </div>
              </div>
              {loading ? <div className="skeleton" style={{ height: 140 }} /> : <StatusBreakdown sessions={sessions} />}
            </section>
          </div>

          <div className="overview-grid overview-grid-wide">
            <section className="card card-flush">
              <div className="card-head card-head-pad">
                <div>
                  <h2>Recent sessions</h2>
                  <p>Your latest collection requests</p>
                </div>
                <Link href="/dashboard/history" className="btn btn-ghost btn-sm">
                  View all
                </Link>
              </div>
              {loading ? (
                <div className="card-pad">
                  <div className="skeleton" style={{ height: 220 }} />
                </div>
              ) : (
                <SessionsTable sessions={sessions.slice(0, 6)} />
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Latest activity</h2>
                  <p>Session lifecycle events</p>
                </div>
              </div>
              {loading ? <div className="skeleton" style={{ height: 220 }} /> : <ActivityFeed sessions={sessions} />}
            </section>
          </div>

          <SharedDataNotice />
        </>
      )}
    </div>
  );
}

function StatTile({
  icon,
  label,
  value,
  hint,
  tone = "primary",
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
  tone?: "primary" | "success" | "info" | "danger";
  loading: boolean;
}) {
  return (
    <div className="stat-tile">
      <div className={`stat-icon stat-${tone}`} aria-hidden>
        {icon}
      </div>
      <div className="stat-text">
        <span className="stat-label">{label}</span>
        {loading ? <span className="skeleton stat-skeleton" /> : <span className="stat-value">{value}</span>}
        {hint && !loading && <span className="stat-hint">{hint}</span>}
      </div>
    </div>
  );
}

type FeedItem = { key: string; at: string; session: SessionRow; kind: "created" | "finished" };

function ActivityFeed({ sessions }: { sessions: SessionRow[] }) {
  const items: FeedItem[] = [];
  for (const s of sessions) {
    if (s.created_at) items.push({ key: `${s.id}-c`, at: s.created_at, session: s, kind: "created" });
    if (s.completed_at) items.push({ key: `${s.id}-f`, at: s.completed_at, session: s, kind: "finished" });
  }
  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const latest = items.slice(0, 6);

  if (!latest.length) return <p className="muted-text">No activity recorded yet.</p>;

  return (
    <ol className="activity-feed">
      {latest.map((item) => (
        <li key={item.key}>
          <span className={`feed-icon ${item.kind === "finished" ? "feed-done" : ""}`} aria-hidden>
            {item.kind === "finished" ? <CheckCircle2 /> : <Activity />}
          </span>
          <div className="feed-body">
            <Link href={`/dashboard/sessions/${item.session.id}`} className="feed-title">
              {item.kind === "finished" ? "Collection finished" : "Plan created"}
            </Link>
            <p className="feed-prompt">{item.session.user_prompt}</p>
            <div className="feed-meta">
              <time dateTime={item.at} title={formatDateTime(item.at)}>
                {formatRelative(item.at)}
              </time>
              <SessionStatusBadge status={item.session.status} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
