import type { SessionRow } from "@/lib/api/types";
import { sessionStatusLabel } from "@/components/ui/status-badge";

const DAYS = 14;

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Single-series bar chart: sessions created per day over the last 14 days. */
export function ActivityChart({ sessions }: { sessions: SessionRow[] }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = Array.from({ length: DAYS }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (DAYS - 1 - i));
    return { date: d, key: dayKey(d), count: 0 };
  });
  const index = new Map(days.map((d, i) => [d.key, i]));
  for (const s of sessions) {
    if (!s.created_at) continue;
    const t = new Date(s.created_at);
    if (Number.isNaN(t.getTime())) continue;
    const i = index.get(dayKey(t));
    if (i !== undefined) days[i].count += 1;
  }

  const total = days.reduce((n, d) => n + d.count, 0);
  const max = Math.max(1, ...days.map((d) => d.count));
  const niceMax = max <= 4 ? max : Math.ceil(max / 2) * 2;
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

  return (
    <figure className="chart" aria-label={`Sessions created per day, last ${DAYS} days. ${total} total.`}>
      <div className="chart-plot">
        <div className="chart-grid" aria-hidden>
          <span data-value={niceMax} />
          <span data-value={Math.round(niceMax / 2)} />
          <span data-value={0} />
        </div>
        <div className="chart-bars">
          {days.map((d) => {
            const label = `${fmt(d.date)}: ${d.count} session${d.count === 1 ? "" : "s"}`;
            return (
              <div key={d.key} className="chart-col" tabIndex={0} aria-label={label}>
                <div
                  className={`chart-bar ${d.count === 0 ? "is-zero" : ""}`}
                  style={{ height: `${(d.count / niceMax) * 100}%` }}
                />
                <span className="chart-tip" role="tooltip">
                  <b>{d.count}</b> {fmt(d.date)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="chart-x" aria-hidden>
        <span>{fmt(days[0].date)}</span>
        <span>{fmt(days[Math.floor(DAYS / 2)].date)}</span>
        <span>Today</span>
      </div>
    </figure>
  );
}

const STATUS_ORDER = ["completed", "executing", "planned", "failed"] as const;

/** Part-to-whole bar of session statuses, with a labelled legend. */
export function StatusBreakdown({ sessions }: { sessions: SessionRow[] }) {
  const counts = STATUS_ORDER.map((status) => ({
    status,
    count: sessions.filter((s) => s.status === status).length,
  }));
  const total = counts.reduce((n, c) => n + c.count, 0);

  return (
    <div className="status-breakdown">
      <div className="status-bar" role="img" aria-label={counts.map((c) => `${sessionStatusLabel(c.status)} ${c.count}`).join(", ")}>
        {total === 0 ? (
          <span className="status-seg status-empty" style={{ flexGrow: 1 }} />
        ) : (
          counts
            .filter((c) => c.count > 0)
            .map((c) => (
              <span
                key={c.status}
                className={`status-seg status-${c.status}`}
                style={{ flexGrow: c.count }}
                title={`${sessionStatusLabel(c.status)}: ${c.count}`}
              />
            ))
        )}
      </div>
      <ul className="status-legend">
        {counts.map((c) => (
          <li key={c.status}>
            <span className={`legend-swatch status-${c.status}`} aria-hidden />
            <span className="legend-label">{sessionStatusLabel(c.status)}</span>
            <span className="legend-value">{c.count}</span>
            <span className="legend-pct">{total ? Math.round((c.count / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
