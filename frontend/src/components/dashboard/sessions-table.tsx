import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { SessionRow } from "@/lib/api/types";
import { SessionStatusBadge } from "@/components/ui/status-badge";
import { formatDateTime, formatRelative } from "@/lib/format";

export default function SessionsTable({ sessions }: { sessions: SessionRow[] }) {
  return (
    <div className="table-scroll">
      <table className="data-table sessions-table">
        <thead>
          <tr>
            <th scope="col">Request</th>
            <th scope="col">Status</th>
            <th scope="col">Fields</th>
            <th scope="col">Created</th>
            <th scope="col">
              <span className="sr-only">Open</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => {
            const fields = s.extraction_schema ? Object.keys(s.extraction_schema).length : 0;
            return (
              <tr key={s.id} className="row-link">
                <td className="cell-prompt">
                  <Link href={`/dashboard/sessions/${s.id}`} className="row-anchor">
                    {s.user_prompt || "Untitled request"}
                  </Link>
                  <span className="cell-sub mono">{s.id.slice(0, 8)}</span>
                </td>
                <td>
                  <SessionStatusBadge status={s.status} />
                </td>
                <td className="cell-muted">{fields || "—"}</td>
                <td className="cell-muted" title={formatDateTime(s.created_at)}>
                  {formatRelative(s.created_at)}
                </td>
                <td className="cell-chevron" aria-hidden>
                  <ChevronRight />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
