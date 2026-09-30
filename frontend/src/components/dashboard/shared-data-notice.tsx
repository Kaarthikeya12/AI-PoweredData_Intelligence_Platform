import { Info } from "lucide-react";

/**
 * The backend's /api/sessions returns every session in the database and the
 * schema has no owner column, so history is not scoped to the signed-in user.
 */
export default function SharedDataNotice() {
  return (
    <div className="alert alert-info notice-compact">
      <Info aria-hidden />
      <div className="alert-body">
        <strong>Shared workspace</strong>
        <p>
          The backend does not associate sessions with user accounts yet, so this history shows every session stored
          by the backend — not only yours.
        </p>
      </div>
    </div>
  );
}
