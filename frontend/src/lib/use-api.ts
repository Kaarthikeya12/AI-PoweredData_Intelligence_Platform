"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError } from "@/lib/api/client";

type State<T> =
  | { status: "loading"; data: T | null; error: null }
  | { status: "success"; data: T; error: null }
  | { status: "error"; data: T | null; error: ApiError };

/**
 * Load data from the backend with cancellation and retry.
 * `loader` must be stable (module-level or memoised) and `key` changes refetch.
 */
export function useApi<T>(loader: (signal: AbortSignal) => Promise<T>, key: string) {
  const [state, setState] = useState<State<T>>({ status: "loading", data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  const [loadedKey, setLoadedKey] = useState(key);

  // Reset to loading when the key changes (render-phase update, no effect cascade).
  if (loadedKey !== key) {
    setLoadedKey(key);
    setState({ status: "loading", data: null, error: null });
  }

  useEffect(() => {
    const controller = new AbortController();
    loader(controller.signal).then(
      (data) => setState({ status: "success", data, error: null }),
      (err) => {
        if (controller.signal.aborted) return;
        const error = err instanceof ApiError ? err : new ApiError(String(err?.message ?? err), null, "invalid_response");
        setState((prev) => ({ status: "error", data: prev.data, error }));
      },
    );
    return () => controller.abort();
  }, [loader, key, attempt]);

  const reload = useCallback(() => {
    setState((prev) => ({ status: "loading", data: prev.data, error: null }));
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
