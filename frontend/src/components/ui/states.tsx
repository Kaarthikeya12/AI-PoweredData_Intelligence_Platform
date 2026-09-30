import type { ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <span className="spinner spinner-lg" aria-hidden />
      <p>{label}</p>
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  children,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="alert alert-error" role="alert">
      <AlertTriangle aria-hidden />
      <div className="alert-body">
        <strong>{title}</strong>
        <p>{message}</p>
        {(onRetry || children) && (
          <div className="alert-actions">
            {onRetry && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
                <RotateCcw aria-hidden />
                Retry
              </button>
            )}
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon && (
        <div className="empty-icon" aria-hidden>
          {icon}
        </div>
      )}
      <h3>{title}</h3>
      <p>{description}</p>
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
