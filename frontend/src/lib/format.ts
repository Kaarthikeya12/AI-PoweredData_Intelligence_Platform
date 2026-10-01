import type { ConsolidatedEntity } from "@/lib/api/types";

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatRelative(value: string | null | undefined, now = Date.now()): string {
  if (!value) return "—";
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return "—";
  const s = Math.round((now - t) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return formatDateTime(value);
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Host plus path, e.g. "supabase.com/docs/billing" — distinguishes URLs on one host. */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/\/+$/, "");
    return u.hostname.replace(/^www\./, "") + path;
  } catch {
    return url;
  }
}

export function humanizeKey(key: string): string {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function cellText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.map(cellText).join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Column order: schema keys first, then any extra keys found in the data. */
export function datasetColumns(rows: ConsolidatedEntity[], schemaKeys: string[] = []): string[] {
  const cols = [...schemaKeys];
  for (const row of rows) {
    for (const key of Object.keys(row.merged_data ?? {})) {
      if (!cols.includes(key)) cols.push(key);
    }
  }
  return cols;
}

function csvEscape(value: string): string {
  // Guard against spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function datasetToCsv(rows: ConsolidatedEntity[], columns: string[]): string {
  const header = ["entity", ...columns, "sources"];
  const lines = [header.map(csvEscape).join(",")];
  for (const row of rows) {
    const values = [
      row.entity_identifier ?? "",
      ...columns.map((c) => {
        const v = row.merged_data?.[c];
        return v === null || v === undefined ? "" : cellText(v);
      }),
      (row.contributing_urls ?? []).join(" "),
    ];
    lines.push(values.map((v) => csvEscape(String(v))).join(","));
  }
  return lines.join("\r\n");
}

export function downloadFile(filename: string, content: string, type: string) {
  // Prepend UTF-8 BOM for CSV files so Excel renders special characters correctly
  const data = type.includes("csv") ? "\uFEFF" + content : content;
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
