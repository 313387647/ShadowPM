# Server Actions API

ShadowPM uses Next.js Server Actions instead of traditional API routes.

All backend mutations and reads live in `src/actions/` and should remain typed, permission-aware, and aligned with `PRODUCT_PRINCIPLES.md`.

## AI Import And Copilot

### `src/actions/ai-actions.ts`

- Parses pasted briefs and uploaded spreadsheet content into structured project drafts.
- Creates the project profile, editable control table, direct budget ledger flows, and execution calendar entries.
- Should continue moving toward confidence scoring, conflict detection, and missing-field classification without reintroducing a second import review queue.

### `src/actions/copilot-actions.ts`

- Handles natural-language project queries and AI action suggestions.
- Converts AI suggestions into controlled mutations only after user confirmation.
- Supports task, calendar, budget, and project-control attention queries.

## Project And Workspace

### `src/actions/project-actions.ts`

- Creates projects.
- Fetches workspace project lists.
- Fetches full project detail for project pages.
- Should remain the owner of project-level permission checks.

### `src/actions/dashboard-actions.ts`

- Fetches dashboard aggregates for project count, budget status, and project overview.

### `src/actions/dashboard-ai.ts`

- Produces AI-oriented dashboard summaries and project judgment signals.

## Control Table And Tasks

### `src/actions/task-actions.ts`

- Fetches project control tasks.
- Creates control tasks.
- Updates task status.
- Batch-fills missing task fields.
- Maintains related progress/activity records for important changes.

Rules:

- Status changes must create traceable progress records.
- Missing optional fields should be visible and fixable, not blockers.
- Budget and calendar links should remain navigable from the control table.

## Progress Timeline

### `src/actions/timeline-actions.ts`

- Reads project progress timeline.
- Appends progress logs.

Rules:

- Timeline records are append-only.
- Important AI or human changes should be explainable from the timeline/activity trail.

## Budget Ledger

### `src/actions/ledger-actions.ts`

- Reads project budget flows and task-linked budget flows.
- Calculates budget balance from append-only flow records.
- Records allocation, expense, and refund flows.

Rules:

- Do not store mutable remaining budget as the source of truth.
- Expense amounts are negative.
- Allocation and refund amounts are positive.
- High-impact AI budget mutations require user confirmation.

## Execution Calendar

### `src/actions/calendar-actions.ts`

- Reads project execution calendar entries.
- Creates and updates calendar entries.
- Links calendar entries to control tasks when possible.

Rules:

- Channel, owner, workstream, and content must remain separate fields.
- Calendar import should not copy messy spreadsheet matrices as-is.
- Calendar changes should be traceable when they affect execution accountability.

## Auth And Health

### `src/actions/auth-actions.ts`

- Handles local role-based login/logout.
- Current auth is lightweight and suitable for Alpha testing only.

### `src/actions/health-actions.ts`

- Provides health/status checks used during development.

## API Design Gaps

P0/P1 gaps to address:

- Centralized permission helpers for project reads and writes
- Business-rule tests for budget balance, status logs, import confirmation, and calendar linkage
- More explicit result types for AI confidence, missing fields, and conflicts
- Stronger transaction boundaries around multi-record AI confirmations
