const SESSION_STATUS: Record<string, { label: string; tone: string }> = {
  planned: { label: "Planned", tone: "" },
  executing: { label: "Running", tone: "badge-info badge-running" },
  completed: { label: "Completed", tone: "badge-success" },
  failed: { label: "Failed", tone: "badge-danger" },
};

const TASK_STATUS: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "" },
  scraping: { label: "Scraping", tone: "badge-info badge-running" },
  success: { label: "Success", tone: "badge-success" },
  failed: { label: "Failed", tone: "badge-danger" },
};

function Badge({ label, tone }: { label: string; tone: string }) {
  return (
    <span className={`badge ${tone}`}>
      <span className="badge-dot" aria-hidden />
      {label}
    </span>
  );
}

export function SessionStatusBadge({ status }: { status: string }) {
  const s = SESSION_STATUS[status] ?? { label: status || "Unknown", tone: "" };
  return <Badge {...s} />;
}

export function TaskStatusBadge({ status }: { status: string }) {
  const s = TASK_STATUS[status] ?? { label: status || "Unknown", tone: "" };
  return <Badge {...s} />;
}

export function sessionStatusLabel(status: string): string {
  return SESSION_STATUS[status]?.label ?? status;
}
