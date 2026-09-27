-- =============================================================================
-- AI Data Intelligence Platform — Supabase Schema Migration
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard → SQL Editor)
-- =============================================================================

-- 1. Core session tracking
CREATE TABLE IF NOT EXISTS sessions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_prompt       TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'planned',
    extraction_schema JSONB,
    created_at        TIMESTAMPTZ DEFAULT now(),
    completed_at      TIMESTAMPTZ
);

-- Add check constraint for valid status values
ALTER TABLE sessions
    DROP CONSTRAINT IF EXISTS sessions_status_check;
ALTER TABLE sessions
    ADD CONSTRAINT sessions_status_check
    CHECK (status IN ('planned', 'executing', 'completed', 'failed'));


-- 2. Each URL target discovered by Workflow 1
CREATE TABLE IF NOT EXISTS planned_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id      UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    task_index      INT NOT NULL,
    url             TEXT NOT NULL,
    title           TEXT,
    reason          TEXT,
    scraper_config  JSONB,
    scrape_status   TEXT NOT NULL DEFAULT 'pending',
    scrape_result   JSONB,
    error_details   JSONB,
    scraped_at      TIMESTAMPTZ
);

ALTER TABLE planned_tasks
    DROP CONSTRAINT IF EXISTS planned_tasks_scrape_status_check;
ALTER TABLE planned_tasks
    ADD CONSTRAINT planned_tasks_scrape_status_check
    CHECK (scrape_status IN ('pending', 'scraping', 'success', 'failed'));


-- 3. Final consolidated output from Workflow 2
CREATE TABLE IF NOT EXISTS session_results (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id             UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    consolidated_dataset   JSONB,
    reconciliation_notes   JSONB,
    markdown_report        TEXT,
    raw_extractions        JSONB,
    created_at             TIMESTAMPTZ DEFAULT now()
);


-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_planned_tasks_session_id
    ON planned_tasks(session_id);

CREATE INDEX IF NOT EXISTS idx_session_results_session_id
    ON session_results(session_id);

CREATE INDEX IF NOT EXISTS idx_sessions_created_at
    ON sessions(created_at DESC);
