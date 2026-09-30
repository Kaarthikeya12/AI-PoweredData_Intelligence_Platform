"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiError, executeSession } from "@/lib/api/client";
import type { ConsolidatedEntity, ExecuteEvent, ReconciliationNote } from "@/lib/api/types";

export type Phase =
  | "idle"
  | "connecting"
  | "scraping"
  | "reconciling"
  | "formatting"
  | "complete"
  | "error"
  | "interrupted"
  | "cancelled";

export type TaskProgress = {
  index: number;
  url: string;
  status: "success" | "failed";
  entities?: number;
  error?: string;
};

export type LogEntry = { id: number; at: number; tone: "info" | "success" | "error"; text: string };

export type ExecutionResult = {
  consolidated_dataset: ConsolidatedEntity[];
  reconciliation_notes: ReconciliationNote[];
  report: string;
};

export type ExecutionState = {
  phase: Phase;
  total: number;
  completed: number;
  tasks: TaskProgress[];
  log: LogEntry[];
  reconciliation: { entities: number; notes: number } | null;
  result: ExecutionResult | null;
  error: string | null;
};

type Action =
  | { type: "start" }
  | { type: "event"; event: ExecuteEvent }
  | { type: "fail"; message: string; phase: "error" | "interrupted" | "cancelled" };

const initial: ExecutionState = {
  phase: "idle",
  total: 0,
  completed: 0,
  tasks: [],
  log: [],
  reconciliation: null,
  result: null,
  error: null,
};

let logId = 0;
const entry = (tone: LogEntry["tone"], text: string): LogEntry => ({ id: ++logId, at: Date.now(), tone, text });

export function reduceExecution(state: ExecutionState, action: Action): ExecutionState {
  switch (action.type) {
    case "start":
      return { ...initial, phase: "connecting", log: [entry("info", "Connecting to the executor…")] };

    case "fail":
      return { ...state, phase: action.phase, error: action.message, log: [...state.log, entry("error", action.message)] };

    case "event": {
      const e = action.event;
      switch (e.event) {
        case "started":
          return {
            ...state,
            phase: "scraping",
            total: e.total_tasks,
            log: [...state.log, entry("info", `Execution started — ${e.total_tasks} source${e.total_tasks === 1 ? "" : "s"} queued.`)],
          };
        case "task_complete": {
          const task: TaskProgress = {
            index: e.task_index,
            url: e.url,
            status: e.status,
            entities: e.entities_count,
            error: e.error,
          };
          const text =
            e.status === "success"
              ? `Extracted ${e.entities_count ?? 0} record${e.entities_count === 1 ? "" : "s"} from ${e.url}`
              : `Failed ${e.url}${e.error ? ` — ${e.error}` : ""}`;
          return {
            ...state,
            phase: "scraping",
            total: e.total || state.total,
            completed: e.completed,
            tasks: [...state.tasks.filter((t) => t.index !== e.task_index), task],
            log: [...state.log, entry(e.status === "success" ? "success" : "error", text)],
          };
        }
        case "reconciliation_complete":
          return {
            ...state,
            phase: "formatting",
            reconciliation: { entities: e.consolidated_entities, notes: e.conflict_notes },
            log: [
              ...state.log,
              entry("success", `Reconciled into ${e.consolidated_entities} entities with ${e.conflict_notes} note${e.conflict_notes === 1 ? "" : "s"}.`),
            ],
          };
        case "formatting_complete":
          return { ...state, phase: "formatting", log: [...state.log, entry("info", "Final report formatted. Saving results…")] };
        case "complete":
          return {
            ...state,
            phase: "complete",
            result: {
              consolidated_dataset: Array.isArray(e.consolidated_dataset) ? e.consolidated_dataset : [],
              reconciliation_notes: Array.isArray(e.reconciliation_notes) ? e.reconciliation_notes : [],
              report: typeof e.report === "string" ? e.report : "",
            },
            log: [...state.log, entry("success", "Collection complete.")],
          };
        case "error":
          return {
            ...state,
            phase: "error",
            error: e.message || "The executor reported an error.",
            log: [...state.log, entry("error", `Executor error: ${e.message}`)],
          };
      }
      return state;
    }
  }
}

/** When all tasks are scraped the backend reconciles before emitting more events. */
export function displayPhase(state: ExecutionState): Phase {
  if (state.phase === "scraping" && state.total > 0 && state.completed >= state.total) return "reconciling";
  return state.phase;
}

export function progressPercent(state: ExecutionState): number {
  const phase = displayPhase(state);
  if (phase === "complete") return 100;
  if (phase === "formatting") return state.reconciliation ? 95 : 90;
  if (phase === "reconciling") return 85;
  if (state.total > 0) return Math.round((state.completed / state.total) * 80);
  return phase === "connecting" ? 2 : 0;
}

export function useExecution(sessionId: string, onComplete?: () => void) {
  const [state, dispatch] = useReducer(reduceExecution, initial);
  const controllerRef = useRef<AbortController | null>(null);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const running = ["connecting", "scraping", "reconciling", "formatting"].includes(state.phase);

  // Warn before leaving the page mid-run: closing the stream may interrupt the backend job.
  useEffect(() => {
    if (!running) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [running]);

  const start = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    dispatch({ type: "start" });

    let sawComplete = false;
    let sawStarted = false;
    try {
      const { receivedTerminalEvent } = await executeSession(
        sessionId,
        (event) => {
          if (event.event === "started") sawStarted = true;
          if (event.event === "complete") sawComplete = true;
          dispatch({ type: "event", event });
        },
        controller.signal,
      );
      if (!receivedTerminalEvent) {
        dispatch({
          type: "fail",
          phase: "interrupted",
          message: "The progress stream closed before the job reported completion. Check the session page for its final status.",
        });
      }
    } catch (err) {
      const e = err instanceof ApiError ? err : null;
      if (sawComplete) {
        // The final payload already arrived; a late disconnect is harmless.
      } else if (e?.kind === "aborted") {
        dispatch({ type: "fail", phase: "cancelled", message: "Stopped listening for progress." });
      } else {
        dispatch({
          type: "fail",
          phase: e?.kind === "network" && sawStarted ? "interrupted" : "error",
          message: e?.message ?? "Execution failed unexpectedly.",
        });
      }
    }
    if (sawComplete) onCompleteRef.current?.();
  }, [sessionId]);

  const cancel = useCallback(() => controllerRef.current?.abort(), []);

  return { state, start, cancel, running };
}
