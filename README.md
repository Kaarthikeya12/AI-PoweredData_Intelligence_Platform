# 🧠 AI-Powered Data Intelligence Platform

An end-to-end AI platform that takes a natural-language research prompt, autonomously discovers relevant web sources, scrapes structured data from them, reconciles conflicts across sources, and delivers a consolidated dataset with a polished markdown report — all streamed in real-time to a modern Next.js dashboard.

---

## 📋 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites](#prerequisites)
- [Setup Guide](#setup-guide)
  - [1. Clone the Repository](#1-clone-the-repository)
  - [2. Backend Setup (FastAPI)](#2-backend-setup-fastapi)
  - [3. Frontend Setup (Next.js)](#3-frontend-setup-nextjs)
  - [4. Supabase Database Setup](#4-supabase-database-setup)
- [Running the Application](#running-the-application)
- [API Endpoints](#api-endpoints)
- [How It Works](#how-it-works)
- [Environment Variables Reference](#environment-variables-reference)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Architecture Overview

```
User Prompt
    │
    ▼
┌──────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js)                    │
│  Landing Page → Auth → Dashboard (Plan → Execute → View)│
└────────────────────────┬─────────────────────────────────┘
                         │ HTTP / SSE
                         ▼
┌──────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI)                      │
│                                                          │
│  ┌─────────────────┐    ┌──────────────────────────────┐ │
│  │  Workflow 1:     │    │  Workflow 2:                 │ │
│  │  PLANNER         │    │  EXECUTOR                   │ │
│  │  (LangGraph)     │    │  (LangGraph)                │ │
│  │                  │    │                              │ │
│  │  • Parse prompt  │    │  • Scrape each URL           │ │
│  │  • Web search    │    │  • Extract structured data   │ │
│  │  • Build schema  │    │  • Reconcile conflicts       │ │
│  │  • Rank sources  │    │  • Generate markdown report  │ │
│  └─────────────────┘    └──────────────────────────────┘ │
│                                                          │
│  ┌─────────────────┐    ┌──────────────────────────────┐ │
│  │  Model Hub       │    │  Scraper Module              │ │
│  │  (Groq + OR)     │    │  (Crawl4AI + Playwright)     │ │
│  └─────────────────┘    └──────────────────────────────┘ │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│                  SUPABASE (PostgreSQL)                   │
│  sessions │ planned_tasks │ session_results │ auth       │
└──────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer       | Technology                                                                 |
| ----------- | -------------------------------------------------------------------------- |
| **Frontend**| Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Motion       |
| **Backend** | Python, FastAPI, Uvicorn, LangChain, LangGraph                            |
| **AI / LLM**| Groq (multi-key rotation), OpenRouter (fallback), Google Gemini (optional) |
| **Scraping**| Crawl4AI, Playwright, BeautifulSoup4                                      |
| **Database**| Supabase (PostgreSQL + Auth + Realtime)                                   |
| **Auth**    | Supabase Auth (email/password, password reset)                            |

---

## Project Structure

```
AI-PoweredData_Intelligence_Platform/
├── frontend/                    # Next.js 16 application
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx             # Landing page
│   │   │   ├── layout.tsx           # Root layout
│   │   │   ├── globals.css          # Global styles
│   │   │   ├── auth/                # Auth callback handler
│   │   │   ├── login/               # Login page
│   │   │   ├── signup/              # Signup page
│   │   │   ├── forgot-password/     # Forgot password page
│   │   │   ├── reset-password/      # Reset password page
│   │   │   └── dashboard/           # Main dashboard (protected)
│   │   ├── components/
│   │   │   ├── ui/                  # shadcn/ui components
│   │   │   ├── auth/                # Auth-related components
│   │   │   ├── dashboard/           # Dashboard components
│   │   │   └── marketing/           # Landing page components
│   │   ├── lib/                     # Utility functions
│   │   └── proxy.ts                 # API proxy configuration
│   ├── .env.example                 # Environment template
│   ├── package.json
│   └── tsconfig.json
│
├── server/                      # FastAPI backend
│   ├── main.py                      # FastAPI app & API endpoints
│   ├── database.py                  # Supabase database layer
│   ├── model_hub.py                 # LLM provider hub (Groq/OpenRouter)
│   ├── requirements.txt             # Python dependencies
│   ├── supabase_migration.sql       # Database schema SQL
│   ├── orchestrator/
│   │   ├── planner/                 # Workflow 1: Research planning
│   │   │   ├── graph.py                 # LangGraph planner graph
│   │   │   ├── nodes.py                 # Planner node functions
│   │   │   └── state.py                 # Planner state definition
│   │   └── executor/                # Workflow 2: Scraping & analysis
│   │       ├── graph.py                 # LangGraph executor graph
│   │       ├── nodes.py                 # Executor node functions
│   │       └── state.py                 # Executor state definition
│   └── scraper/                     # Web scraping module
│       ├── scraper.py                   # Core scraping logic
│       ├── extractor.py                 # Data extraction engine
│       ├── utils.py                     # Scraper utilities
│       ├── errors.py                    # Custom error types
│       ├── requirements.txt             # Scraper-specific deps
│       └── run_test.py                  # Scraper test runner
│
├── requirements.txt             # Root-level Python requirements
├── package-lock.json
└── README.md                    # This file
```

---

## Prerequisites

Before getting started, make sure you have the following installed:

- **Python 3.11+** — [Download](https://www.python.org/downloads/)
- **Node.js 18+** — [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Git** — [Download](https://git-scm.com/)
- A **Supabase** account (free tier works) — [supabase.com](https://supabase.com)
- At least one LLM API key:
  - **Groq** API key(s) — [console.groq.com](https://console.groq.com) *(recommended, free tier available)*
  - **OpenRouter** API key — [openrouter.ai](https://openrouter.ai) *(fallback)*

---

## Setup Guide

### 1. Clone the Repository

```bash
git clone https://github.com/Kaarthikeya12/AI-PoweredData_Intelligence_Platform.git
cd AI-PoweredData_Intelligence_Platform
```

### 2. Backend Setup (FastAPI)

```bash
# Navigate to the server directory
cd server

# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# Windows (CMD):
.\venv\Scripts\activate.bat
# macOS / Linux:
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt

# Install Playwright browsers (required by Crawl4AI for scraping)
playwright install
```

#### Configure Backend Environment Variables

Create a `.env` file inside the `server/` directory:

```bash
# server/.env

# ============================================================
# LLM API KEYS
# ============================================================

# GROQ API KEYS (Primary) — comma-separated for automatic rate-limit rotation
GROQ_API_KEYS=your_groq_api_key_1,your_groq_api_key_2

# OPENROUTER API KEY (Secondary Fallback)
OPENROUTER_API_KEY=your_openrouter_api_key

# GEMINI API KEY (Optional)
GEMINI_API_KEY=your_gemini_api_key

# ============================================================
# SUPABASE CONFIGURATION
# ============================================================

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

> **Note:** You need at least one of `GROQ_API_KEYS` or `OPENROUTER_API_KEY` for the LLM to work. Multiple Groq keys can be passed comma-separated for automatic rotation when rate limits are hit.

### 3. Frontend Setup (Next.js)

```bash
# From the project root, navigate to frontend
cd frontend

# Install Node.js dependencies
npm install
```

#### Configure Frontend Environment Variables

Copy the example env file and fill in your values:

```bash
cp .env.example .env.local
```

Edit `frontend/.env.local`:

```bash
# Supabase project URL
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co

# Supabase public/anon key (NOT the service role key)
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend API URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

> **Important:** Never put the Supabase service role key in the frontend. Only the public anon key should be used here.

### 4. Supabase Database Setup

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (or create a new one)
3. Navigate to **SQL Editor**
4. Copy the contents of [`server/supabase_migration.sql`](server/supabase_migration.sql) and run it

This creates three tables:

| Table              | Purpose                                            |
| ------------------ | -------------------------------------------------- |
| `sessions`         | Tracks each research session (prompt, status, schema) |
| `planned_tasks`    | Stores each URL target discovered by the planner   |
| `session_results`  | Stores the final consolidated dataset and report   |

#### Enable Supabase Auth

1. In Supabase Dashboard → **Authentication** → **Settings**
2. Enable **Email** provider
3. Configure redirect URLs for password reset:
   - `http://localhost:3000/auth/callback`
   - `http://localhost:3000/reset-password`

---

## Running the Application

You need **two terminals** — one for the backend and one for the frontend.

### Terminal 1: Start the Backend

```bash
cd server

# Activate virtual environment
# Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# macOS / Linux:
source venv/bin/activate

# Run the FastAPI server
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`.

### Terminal 2: Start the Frontend

```bash
cd frontend

npm run dev
```

The frontend will be available at `http://localhost:3000`.

### Quick Verification

1. Open `http://localhost:3000` in your browser
2. Sign up for a new account
3. Navigate to the Dashboard
4. Enter a research prompt (e.g., *"Find the top 10 AI startups in healthcare with their funding and founding year"*)
5. Click **Plan** to generate research tasks
6. Click **Execute** to run the scraping pipeline and watch real-time progress via SSE

---

## API Endpoints

| Method | Endpoint                    | Description                                      |
| ------ | --------------------------- | ------------------------------------------------ |
| `POST` | `/api/plan`                 | Accepts a user prompt, runs the Planner workflow, returns task cards, and saves the session to Supabase |
| `POST` | `/api/execute/{session_id}` | Executes the scraping pipeline with **Server-Sent Events (SSE)** streaming for real-time progress |
| `GET`  | `/api/session/{session_id}` | Retrieves the full session: metadata, planned tasks (with scrape results), and final consolidated output |
| `GET`  | `/api/sessions`             | Lists all sessions, most recent first            |

### Example: Plan a Research Task

```bash
curl -X POST http://localhost:8000/api/plan \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Find the top 5 electric vehicle companies and their market cap"}'
```

---

## How It Works

### Workflow 1 — Planner (LangGraph)

1. **Prompt Parsing** — The LLM analyzes the user's natural-language research query
2. **Schema Generation** — Automatically builds a structured extraction schema (fields, types)
3. **Web Search** — Uses DuckDuckGo (`ddgs`) to discover relevant URLs
4. **Source Ranking** — Ranks and selects the most promising sources
5. **Task Cards** — Generates UI-friendly task cards with URL, title, and reason for selection

### Workflow 2 — Executor (LangGraph)

1. **Scraping** — Each URL is scraped using Crawl4AI with Playwright (handles JS-rendered pages)
2. **Extraction** — Structured entities are extracted from the page content using the LLM
3. **Reconciliation** — Conflicts across multiple sources are detected and resolved
4. **Report Generation** — A final markdown report is generated with the consolidated dataset

### Model Hub

The Model Hub provides seamless LLM access with built-in resilience:
- **Multi-key Groq rotation** — Automatically cycles through multiple Groq API keys when rate limits hit
- **OpenRouter fallback** — Falls back to OpenRouter if all Groq keys are exhausted
- Supports both standard chat and structured (Pydantic) output modes

---

## Environment Variables Reference

### Backend (`server/.env`)

| Variable                    | Required | Description                                          |
| --------------------------- | -------- | ---------------------------------------------------- |
| `GROQ_API_KEYS`             | Yes*     | Comma-separated Groq API keys for multi-key rotation |
| `OPENROUTER_API_KEY`        | Yes*     | OpenRouter API key (fallback provider)               |
| `GEMINI_API_KEY`            | No       | Google Gemini API key (optional)                     |
| `SUPABASE_URL`              | Yes      | Your Supabase project URL                            |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes      | Supabase service role key (server-side only)         |

> \* At least one of `GROQ_API_KEYS` or `OPENROUTER_API_KEY` must be set.

### Frontend (`frontend/.env.local`)

| Variable                           | Required | Description                           |
| ---------------------------------- | -------- | ------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`         | Yes      | Your Supabase project URL             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Yes      | Supabase public anon key              |
| `NEXT_PUBLIC_API_BASE_URL`         | Yes      | Backend URL (default: `http://localhost:8000`) |

---

## Troubleshooting

### Common Issues

| Issue | Solution |
| ----- | -------- |
| `Missing Supabase credentials` error on server start | Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set in `server/.env` |
| `No valid API keys found` error | Set at least one of `GROQ_API_KEYS` or `OPENROUTER_API_KEY` in `server/.env` |
| Playwright browser not found | Run `playwright install` inside the activated virtual environment |
| `WinError 87` on Windows | The server already handles this — make sure you're using Python 3.11+ |
| Frontend can't reach backend | Check that `NEXT_PUBLIC_API_BASE_URL` is set to `http://localhost:8000` in `frontend/.env.local` |
| CORS errors in browser console | The backend allows all origins by default; ensure the backend is running |
| Unicode/encoding errors on Windows | The server auto-sets `PYTHONUTF8=1`; ensure you're using Python 3.11+ |
| Scraper timeouts | Some sites block automated access; the system gracefully handles failures and continues with other sources |

### Windows-Specific Notes

- Use **PowerShell** or **CMD** (not Git Bash) for activating the virtual environment
- The backend automatically configures `WindowsSelectorEventLoopPolicy` to avoid IOCP issues
- Encoding is auto-configured to UTF-8 for Windows compatibility

---

## License

This project is open-source. Feel free to use, modify, and distribute.