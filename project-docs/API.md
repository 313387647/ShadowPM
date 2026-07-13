# ShadowPM Server API Map

ShadowPM uses Next.js Server Actions for authenticated application mutations and Route Handlers for downloadable or public protocol endpoints.

## Authentication And Permissions

- `auth-actions.ts`: demo login, signed session cookie, logout.
- `permissions.ts`: current-user validation plus project/task read and write assertions.
- `permission-rules.ts`: pure owner, leader, editor, and viewer rules used by tests.

Every project mutation resolves authorization from project ownership or explicit `ProjectMember` role. A control-item assignee is business ownership, not edit authorization.

## Project Creation And Control

- `project-actions.ts`: manual creation, workspace project list, project detail, project deletion.
- `ai-actions.ts`: document extraction, canonical AI draft validation, transactional project creation, source-evidence retention.
- `task-actions.ts`: control-item read/create/update/delete and traceable changes.
- `timeline-actions.ts`: append-only progress records and project activity reads.
- `member-actions.ts`: owner-managed editor/viewer collaborators.

## Budget And Calendar

- `ledger-actions.ts`: append-only budget flows and project budget snapshots.
- `calendar-actions.ts`: execution-calendar CRUD and control-item linkage.
- `GET /api/projects/[id]/export`: authenticated canonical Excel workbook export.
- `GET /api/share/[token]/calendar.ics`: public, token-protected, read-only ICS feed.

Budget formulas live in `src/lib/budget.ts`; warning semantics live in `src/lib/budget-signals.ts`. `Project.totalBudget` is planned metadata and `BudgetFlow` is financial truth.

## Reports, Sources, And Sharing

- `project-output-actions.ts`: loads project outputs, generates persisted reports, creates expiring share capabilities, and revokes them.
- `project-share.ts`: validates a token and returns a bounded read-only project projection.
- `GET /share/[token]`: public read-only project page.

Reports may call DeepSeek, but fall back to a deterministic summary from official data. Both paths persist the source fact snapshot and project activity record.

## Dashboard And Query

- `dashboard-actions.ts`: global statistics, portfolio project state, attention items, upcoming execution.
- `dashboard-ai.ts`: deterministic weekly health summary from official records.
- `copilot-actions.ts`: query-only project, budget, calendar, and attention lookup.

Command Center does not perform routine table writes. Users edit the project control table, ledger, and execution calendar directly.

## Operational Endpoints

- `GET /api/health`: database connectivity and service health; returns no secrets.

## Action Contract

Mutations return `ActionResult<T>` with `success`, a user-facing `message`, and optional `data`. Multi-record mutations use Prisma transactions when partial writes would be unsafe.
