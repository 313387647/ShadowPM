# ShadowPM Architecture

## Runtime Shape

- Next.js 14 App Router
- React Server Components for reads and page composition
- Client Components only for interactive tables, dialogs, filters, and command UI
- Server Actions for authenticated mutations
- Route Handlers for Excel, ICS, public share, and health endpoints
- Prisma 7 plus PostgreSQL driver adapter
- DeepSeek through the OpenAI-compatible client for import and grounded reports

## Product Flow

```text
Upload or paste source
  -> parse document
  -> AI canonical draft
  -> preview essential writes
  -> transactional project creation
  -> control table + budget ledger + execution calendar
  -> progress/activity traceability
  -> export, report, read-only share, ICS projection
```

## Directory Map

```text
src/
  actions/                 authenticated application reads and mutations
  app/
    (auth)/login/          demo identity selection
    (main)/workspace/      personal control cockpit
    (main)/dashboard/      leader portfolio cockpit
    (main)/projects/[id]/  project control workspace
    api/projects/...       authenticated workbook export
    api/share/...          token-protected calendar feed
    api/health/            operational health
    share/[token]/         public read-only project view
  components/
    copilot/               query-only Command Center
    dashboard/             portfolio and attention components
    layout/                responsive application shell
    project/               control table, ledger, calendar, history, outputs
    ui/                    local UI primitives
  lib/                     budget, permission, AI import, sharing, ICS rules
prisma/
  schema.prisma
  seed.ts
project-docs/              canonical product and engineering memory
```

## Data Boundaries

- `Task` is the low-level control-item record; task-manager UI language is prohibited in core surfaces.
- `BudgetFlow` is append-only financial truth.
- `ExecutionCalendarEntry` is the only formal calendar source.
- `ProgressLog` and `ActivityLog` preserve history.
- `ProjectSource` is bounded AI grounding evidence, not a file repository.
- `ProjectShareLink` grants read-only projection only and stores no raw token.

## Deployment Shape

Next.js builds standalone output. The repository includes a multi-stage Docker image, security headers, signed cookies, environment template, and `/api/health`. Full enterprise deployment still requires SSO, tenant isolation, managed storage, job queues, observability, backups, and a formal migration baseline.
