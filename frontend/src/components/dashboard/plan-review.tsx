import { ExternalLink, FileSearch, ListTree } from "lucide-react";
import type { ExtractionSchema, UiCard } from "@/lib/api/types";
import { hostname, humanizeKey } from "@/lib/format";

export function SourceCards({ cards }: { cards: UiCard[] }) {
  if (!cards.length) {
    return <p className="muted-text">The planner did not return any sources.</p>;
  }
  return (
    <ol className="source-list">
      {cards.map((card, i) => (
        <li key={`${card.url}-${i}`} className="source-card">
          <span className="source-index" aria-hidden>
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="source-body">
            <h3>{card.title || hostname(card.url)}</h3>
            <a href={card.url} target="_blank" rel="noopener noreferrer" className="source-url">
              {hostname(card.url)}
              <ExternalLink aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            {card.reason && <p>{card.reason}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function SchemaTable({ schema }: { schema: ExtractionSchema | null | undefined }) {
  const entries = Object.entries(schema ?? {});
  if (!entries.length) {
    return <p className="muted-text">No extraction schema was defined.</p>;
  }
  return (
    <div className="table-scroll">
      <table className="data-table schema-table">
        <thead>
          <tr>
            <th scope="col">Field</th>
            <th scope="col">Description</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([key, description]) => (
            <tr key={key}>
              <td>
                <span className="field-name">{humanizeKey(key)}</span>
                <code className="field-key">{key}</code>
              </td>
              <td className="cell-wrap">{typeof description === "string" ? description : JSON.stringify(description)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function PlanReview({ cards, schema }: { cards: UiCard[]; schema: ExtractionSchema | null }) {
  return (
    <div className="plan-grid">
      <section className="card">
        <div className="card-head">
          <div>
            <h2>
              <FileSearch aria-hidden className="card-head-icon" />
              Proposed sources
            </h2>
            <p>
              {cards.length} URL{cards.length === 1 ? "" : "s"} selected by the planner
            </p>
          </div>
        </div>
        <SourceCards cards={cards} />
      </section>

      <section className="card">
        <div className="card-head">
          <div>
            <h2>
              <ListTree aria-hidden className="card-head-icon" />
              Extraction schema
            </h2>
            <p>Fields that will be extracted from each source</p>
          </div>
        </div>
        <SchemaTable schema={schema} />
      </section>
    </div>
  );
}
