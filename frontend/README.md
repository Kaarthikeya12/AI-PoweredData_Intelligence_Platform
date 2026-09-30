# DataIntel — Frontend

Next.js 16 (App Router, TypeScript) frontend for the AI-Powered Data Intelligence Platform.
It authenticates users with **Supabase Auth** and drives the existing **FastAPI backend** (`../server`) to plan
and execute data collection jobs.

## Quick start

```bash
cd frontend
cp .env.example .env.local   # then fill in real values (see below)
npm install
npm run dev                  # http://localhost:3000
```

Run the backend separately (from `../server`) so it listens on `http://localhost:8000`.

| Command         | What it does                   |
| --------------- | ------------------------------ |
| `npm run dev`   | Development server             |
| `npm run build` | Production build + type check  |
| `npm run start` | Serve the production build     |
| `npm run lint`  | ESLint                         |

## Environment variables (`frontend/.env.local`)

| Variable                                | Required | Description                                                                 |
| --------------------------------------- | -------- | --------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`              | yes      | Supabase project URL, e.g. `https://abcd1234.supabase.co`                   |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`         | yes\*    | Supabase **anon** (public) key                                              |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`  | yes\*    | Alternative to the anon key for projects using `sb_publishable_…` keys      |
| `NEXT_PUBLIC_API_BASE_URL`              | no       | FastAPI base URL. Defaults to `http://localhost:8000`                       |

\* Provide one of the two public keys. **Never** put the `service_role` / `sb_secret_…` key in the frontend —
every `NEXT_PUBLIC_*` value is shipped to the browser. `NEXT_PUBLIC_*` values are inlined at build time, so
restart `npm run dev` (or rebuild) after changing them.

If the Supabase variables are missing, the auth pages show a "not configured" message and `/dashboard` redirects
to `/login`.

## Supabase Auth setup

1. Open (or create) your project at <https://supabase.com/dashboard>.
2. **Project Settings → API** (or **Data API / API Keys**): copy the Project URL and the anon/publishable key into
   `frontend/.env.local`.
3. **Authentication → Sign In / Providers → Email**: make sure Email is enabled. If "Confirm email" is on, new users
   must click the emailed link before they can sign in (the app tells them so).
4. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` for local development (your production URL in production).
   - **Redirect URLs**: add
     - `http://localhost:3000/auth/callback`
     - `https://YOUR-PRODUCTION-DOMAIN/auth/callback`

   The callback handles Google OAuth, email confirmation and password-reset links.
5. Restart the frontend dev server.

## Google OAuth setup

1. In **Google Cloud Console → APIs & Services → Credentials**, create an **OAuth client ID** of type
   *Web application* (configure the OAuth consent screen first if prompted).
2. Under **Authorized redirect URIs**, add Supabase's callback (not the app's):
   `https://<your-project-ref>.supabase.co/auth/v1/callback`
   (Supabase shows this exact URL on the Google provider page.)
3. Optionally add `http://localhost:3000` and your production domain under **Authorized JavaScript origins**.
4. In Supabase, **Authentication → Sign In / Providers → Google**: enable it and paste the Google **Client ID** and
   **Client Secret**. Save.
5. Make sure the app callback URLs from step 4 of the Supabase setup are in the **Redirect URLs** allowlist.
6. Restart the frontend and use **Continue with Google** on `/login` or `/signup`.

Google sign-in will not work until these values are configured and tested against your project.

## How it fits together

```
src/
  proxy.ts                       Session refresh + route protection (Next 16 "proxy", formerly middleware)
  app/
    page.tsx                     Marketing homepage
    login/, signup/              Email/password + Google sign-in
    forgot-password/             Sends a Supabase reset email
    reset-password/              Sets a new password (requires the session from the reset link)
    auth/callback/route.ts       PKCE code exchange for OAuth / email links, validated `next` redirect
    dashboard/                   Protected app (layout re-checks the user server-side)
      page.tsx                   Overview: stats, charts, recent sessions, activity
      new/                       Prompt → Generate plan → review → Start scraping → live progress → results
      history/                   All sessions with search + status filter
      sessions/[id]/             Session detail: results, sources, schema; run planned sessions
  lib/
    env.ts                       Public configuration
    supabase/client.ts|server.ts Browser / server Supabase clients (@supabase/ssr)
    api/client.ts                Typed FastAPI client (timeouts, error mapping, SSE execution stream)
    sse.ts                       Server-Sent Events frame parser for fetch() streams
```

### Backend endpoints used (unchanged)

| Endpoint                          | Used for                                                                 |
| --------------------------------- | ------------------------------------------------------------------------ |
| `POST /api/plan`                  | Generate a plan: `{ user_prompt }` → `{ session_id, ui_cards, extraction_schema }` |
| `POST /api/execute/{session_id}`  | Start execution; response is an SSE stream of `data: {json}` frames      |
| `GET  /api/sessions`              | Session history and dashboard statistics                                 |
| `GET  /api/session/{session_id}`  | Session detail: session, planned tasks, results                          |

The execute endpoint is a **POST**, so the browser's `EventSource` (GET-only) can't be used. The client reads
`fetch()`'s response body and parses frames with `SseParser`. Handled events: `started`, `task_complete`,
`reconciliation_complete`, `formatting_complete`, `complete`, and the backend's undocumented `error` event.

## Known limitations (backend-side, not changed)

- **The backend does not authenticate API requests.** Supabase Auth protects the *frontend* routes only. The FastAPI
  endpoints accept requests from anyone who can reach them, and the frontend does not send a user token because the
  backend would ignore it.
- **No per-user data isolation.** The `sessions` table has no owner/user column and `GET /api/sessions` returns every
  session. The dashboard shows all sessions stored by the backend and says so in the UI. Real isolation needs backend
  changes (a `user_id` column, token verification in FastAPI, filtering and/or RLS).
- **CORS** is `allow_origins=["*"]` on the backend, which works for local development. Restrict it in production.
- **Cancelling** only stops the browser from waiting. A cancelled plan request may still create a session, and a
  stopped execution stream may leave the session in `executing`, because the backend has no cancel endpoint.
- If execution was started in another tab, the session page can't re-attach to live progress (there is no GET
  progress endpoint). Use **Refresh** to check the status.
