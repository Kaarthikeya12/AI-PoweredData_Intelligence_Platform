"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Download, FileJson, FileText, GitMerge, Search, Table2 } from "lucide-react";
import type { ConsolidatedEntity, ReconciliationNote } from "@/lib/api/types";
import { cellText, datasetColumns, datasetToCsv, downloadFile, humanizeKey, shortUrl } from "@/lib/format";
import { EmptyState } from "@/components/ui/states";
import Markdown from "./markdown";

type ResultsViewProps = {
  dataset: ConsolidatedEntity[];
  notes: ReconciliationNote[];
  report: string | null;
  schemaKeys: string[];
  fileBase: string;
};

export default function ResultsView({ dataset, notes, report, schemaKeys, fileBase }: ResultsViewProps) {
  const [query, setQuery] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const columns = useMemo(() => datasetColumns(dataset, schemaKeys), [dataset, schemaKeys]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return dataset;
    return dataset.filter((row) => {
      const haystack = [
        row.entity_identifier,
        ...columns.map((c) => cellText(row.merged_data?.[c])),
        ...(row.contributing_urls ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [dataset, columns, query]);

  const exportJson = () =>
    downloadFile(`${fileBase}.json`, JSON.stringify(dataset, null, 2), "application/json");
  const exportCsv = () => downloadFile(`${fileBase}.csv`, datasetToCsv(dataset, columns), "text/csv;charset=utf-8");

  // Hide the backend's placeholder note when nothing was scraped.
  const realNotes = notes.filter((n) => !(n.entity_name === "N/A" && n.field_name === "N/A"));

  return (
    <div className="results">
      <section className="card card-flush">
        <div className="card-head card-head-pad results-head">
          <div>
            <h2>
              <Table2 aria-hidden className="card-head-icon" />
              Consolidated dataset
            </h2>
            <p>
              {dataset.length} entit{dataset.length === 1 ? "y" : "ies"} · {columns.length} field{columns.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="results-tools">
            <label className="search-field">
              <Search aria-hidden />
              <span className="sr-only">Search dataset</span>
              <input
                type="search"
                placeholder="Search records…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={!dataset.length}
              />
            </label>
            <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={!dataset.length}>
              <Download aria-hidden />
              CSV
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={exportJson} disabled={!dataset.length}>
              <FileJson aria-hidden />
              JSON
            </button>
          </div>
        </div>

        {dataset.length === 0 ? (
          <EmptyState
            icon={<Table2 />}
            title="No records extracted"
            description="The executor finished but no entities could be consolidated. Check the sources tab for scrape errors, or try a more specific request."
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Search />} title="No matching records" description={`Nothing matches “${query}”.`} />
        ) : (
          <div className="table-scroll dataset-scroll" tabIndex={0} aria-label="Dataset table">
            <table className="data-table dataset-table">
              <thead>
                <tr>
                  <th scope="col" className="sticky-col">
                    Entity
                  </th>
                  {columns.map((c) => (
                    <th scope="col" key={c}>
                      {humanizeKey(c)}
                    </th>
                  ))}
                  <th scope="col">Sources</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr key={`${row.entity_identifier}-${i}`}>
                    <th scope="row" className="sticky-col">
                      {row.entity_identifier || "—"}
                    </th>
                    {columns.map((c) => (
                      <td key={c} className="cell-wrap">
                        {cellText(row.merged_data?.[c])}
                      </td>
                    ))}
                    <td>
                      <div className="source-chips">
                        {(row.contributing_urls ?? []).map((u) => (
                          <a key={u} href={u} target="_blank" rel="noopener noreferrer" className="chip" title={u}>
                            {shortUrl(u)}
                          </a>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>
              <GitMerge aria-hidden className="card-head-icon" />
              Reconciliation notes
            </h2>
            <p>How conflicting values across sources were resolved</p>
          </div>
        </div>
        {realNotes.length === 0 ? (
          <p className="muted-text">No conflicting values were detected across the sources.</p>
        ) : (
          <ul className="notes-list">
            {realNotes.map((n, i) => (
              <li key={i}>
                <div className="note-head">
                  <strong>{n.entity_name}</strong>
                  <code>{n.field_name}</code>
                </div>
                <p>{n.resolution_reason}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {report && (
        <section className="card">
          <button
            type="button"
            className="card-head collapse-toggle"
            aria-expanded={reportOpen}
            onClick={() => setReportOpen((v) => !v)}
          >
            <div>
              <h2>
                <FileText aria-hidden className="card-head-icon" />
                Final report
              </h2>
              <p>Markdown summary generated by the backend</p>
            </div>
            <ChevronDown aria-hidden className={`collapse-icon ${reportOpen ? "open" : ""}`} />
          </button>
          {reportOpen && (
            <>
              <Markdown source={report} />
              <div className="report-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => downloadFile(`${fileBase}-report.md`, report, "text/markdown;charset=utf-8")}
                >
                  <Download aria-hidden />
                  Download .md
                </button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
