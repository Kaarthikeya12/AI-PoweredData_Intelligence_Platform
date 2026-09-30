import { API_BASE_URL } from "@/lib/env";
import { SseParser } from "@/lib/sse";
import type {
  ExecuteEvent,
  PlanResponse,
  SessionDetail,
  SessionRow,
} from "./types";

// NOTE: The backend does not validate any user token, so no Authorization
// header is sent. See README "Known limitations".

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number | null,
    public readonly kind: "network" | "timeout" | "http" | "invalid_response" | "aborted",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const PLAN_TIMEOUT_MS = 5 * 60_000; // Planner runs search + LLM calls.
const READ_TIMEOUT_MS = 30_000;

function detailMessage(body: unknown, status: number): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    // FastAPI validation errors: [{ loc, msg, type }]
    if (Array.isArray(detail)) {
      return detail
        .map((d) => (d && typeof d === "object" && "msg" in d ? String(d.msg) : String(d)))
        .join("; ");
    }
  }
  return `Request failed with status ${status}`;
}

/** Combine a caller signal with a timeout. */
function withTimeout(signal: AbortSignal | undefined, timeoutMs: number | null) {
  const controller = new AbortController();
  let timedOut = false;
  const timer =
    timeoutMs === null
      ? null
      : setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    // Only the timer is cleared: the caller's abort must keep forwarding so a
    // streaming body can still be cancelled after headers arrive.
    cleanup: () => {
      if (timer) clearTimeout(timer);
    },
  };
}

async function send(
  path: string,
  init: RequestInit & { timeoutMs?: number | null } = {},
): Promise<Response> {
  const { timeoutMs = READ_TIMEOUT_MS, signal, ...rest } = init;
  const t = withTimeout(signal ?? undefined, timeoutMs);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { ...rest, signal: t.signal });
    if (!res.ok) {
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(detailMessage(body, res.status), res.status, "http");
    }
    return res;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (t.timedOut()) {
      throw new ApiError("The request timed out. The backend may be busy or unreachable.", null, "timeout");
    }
    if (signal?.aborted) throw new ApiError("Request cancelled.", null, "aborted");
    throw new ApiError(
      `Could not reach the backend at ${API_BASE_URL}. Make sure the FastAPI server is running.`,
      null,
      "network",
    );
  } finally {
    // For streaming responses the caller still reads the body; the timeout
    // only covers connection + headers.
    t.cleanup();
  }
}

async function json<T>(res: Response, check: (v: unknown) => boolean): Promise<T> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError("The backend returned a response that is not valid JSON.", res.status, "invalid_response");
  }
  if (!check(body)) {
    throw new ApiError("The backend returned an unexpected response shape.", res.status, "invalid_response");
  }
  return body as T;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

// ---------------------------------------------------------------------------

export async function planJob(userPrompt: string, signal?: AbortSignal): Promise<PlanResponse> {
  const res = await send("/api/plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_prompt: userPrompt }),
    signal,
    timeoutMs: PLAN_TIMEOUT_MS,
  });
  return json<PlanResponse>(
    res,
    (b) => isObj(b) && typeof b.session_id === "string" && Array.isArray(b.ui_cards) && isObj(b.extraction_schema),
  );
}

export async function listSessions(signal?: AbortSignal): Promise<SessionRow[]> {
  const res = await send("/api/sessions", { signal });
  const body = await json<{ sessions: SessionRow[] }>(res, (b) => isObj(b) && Array.isArray(b.sessions));
  return body.sessions;
}

export async function getSessionDetail(sessionId: string, signal?: AbortSignal): Promise<SessionDetail> {
  const res = await send(`/api/session/${encodeURIComponent(sessionId)}`, { signal });
  return json<SessionDetail>(res, (b) => isObj(b) && isObj(b.session) && Array.isArray(b.planned_tasks));
}

const KNOWN_EVENTS = new Set([
  "started",
  "task_complete",
  "reconciliation_complete",
  "formatting_complete",
  "complete",
  "error",
]);

/** Parse one SSE `data` payload into a typed event, or null if unrecognised. */
export function parseExecuteEvent(data: string): ExecuteEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isObj(value) || typeof value.event !== "string" || !KNOWN_EVENTS.has(value.event)) return null;
  return value as ExecuteEvent;
}

/**
 * Start execution and stream progress events. POST + streaming body, so this
 * uses fetch + a manual SSE parser rather than EventSource (GET-only).
 * Resolves when the stream ends; rejects on network/HTTP errors.
 */
export async function executeSession(
  sessionId: string,
  onEvent: (event: ExecuteEvent) => void,
  signal?: AbortSignal,
): Promise<{ receivedTerminalEvent: boolean }> {
  const res = await send(`/api/execute/${encodeURIComponent(sessionId)}`, {
    method: "POST",
    headers: { Accept: "text/event-stream" },
    signal,
    timeoutMs: 60_000,
  });

  if (!res.body) {
    throw new ApiError("The browser did not expose a readable stream for this response.", res.status, "invalid_response");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const parser = new SseParser();
  let terminal = false;

  const dispatch = (frames: string[]) => {
    for (const frame of frames) {
      const event = parseExecuteEvent(frame);
      if (!event) continue;
      if (event.event === "complete" || event.event === "error") terminal = true;
      onEvent(event);
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      dispatch(parser.push(decoder.decode(value, { stream: true })));
    }
    dispatch(parser.push(decoder.decode()));
    dispatch(parser.flush());
  } catch {
    if (signal?.aborted) throw new ApiError("Execution stream cancelled.", null, "aborted");
    throw new ApiError("The connection to the backend was interrupted during execution.", null, "network");
  } finally {
    reader.releaseLock();
  }

  return { receivedTerminalEvent: terminal };
}
