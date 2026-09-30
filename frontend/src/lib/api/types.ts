// Types mirror the existing FastAPI backend (server/main.py, server/database.py).

export type SessionStatus = "planned" | "executing" | "completed" | "failed";
export type TaskStatus = "pending" | "scraping" | "success" | "failed";

/** Field name → description, as produced by the planner. */
export type ExtractionSchema = Record<string, string>;

export type UiCard = {
  title: string;
  url: string;
  reason: string;
};

export type PlanResponse = {
  session_id: string;
  ui_cards: UiCard[];
  extraction_schema: ExtractionSchema;
};

export type SessionRow = {
  id: string;
  user_prompt: string;
  status: SessionStatus | string;
  extraction_schema: ExtractionSchema | null;
  created_at: string | null;
  completed_at: string | null;
};

export type PlannedTaskRow = {
  id: string;
  session_id: string;
  task_index: number;
  url: string;
  title: string | null;
  reason: string | null;
  scrape_status: TaskStatus | string;
  scrape_result: { entities?: unknown[]; evidence?: unknown } | null;
  error_details: { message?: string; [key: string]: unknown } | null;
  scraped_at: string | null;
};

export type ConsolidatedEntity = {
  entity_identifier: string;
  merged_data: Record<string, unknown>;
  contributing_urls: string[];
};

export type ReconciliationNote = {
  entity_name: string;
  field_name: string;
  resolution_reason: string;
};

export type SessionResultsRow = {
  id: string;
  session_id: string;
  consolidated_dataset: ConsolidatedEntity[] | null;
  reconciliation_notes: ReconciliationNote[] | null;
  markdown_report: string | null;
  raw_extractions: unknown[] | null;
  created_at: string | null;
};

export type SessionDetail = {
  session: SessionRow;
  planned_tasks: PlannedTaskRow[];
  results: SessionResultsRow | null;
};

// ---- Execution stream events (POST /api/execute/{id}) ----

export type StartedEvent = { event: "started"; session_id: string; total_tasks: number };

export type TaskCompleteEvent = {
  event: "task_complete";
  task_index: number;
  url: string;
  status: "success" | "failed";
  entities_count?: number;
  error?: string;
  completed: number;
  total: number;
};

export type ReconciliationCompleteEvent = {
  event: "reconciliation_complete";
  consolidated_entities: number;
  conflict_notes: number;
};

export type FormattingCompleteEvent = { event: "formatting_complete" };

export type CompleteEvent = {
  event: "complete";
  session_id: string;
  consolidated_dataset: ConsolidatedEntity[];
  reconciliation_notes: ReconciliationNote[];
  report: string;
};

/** Emitted by the backend when the executor raises. Not in the handoff guide. */
export type StreamErrorEvent = { event: "error"; message: string };

export type ExecuteEvent =
  | StartedEvent
  | TaskCompleteEvent
  | ReconciliationCompleteEvent
  | FormattingCompleteEvent
  | CompleteEvent
  | StreamErrorEvent;
