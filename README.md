# ShadowPM

ShadowPM is an AI Native Project Management Platform for lightweight internal project control.

It is not a task manager, kanban board, or Jira clone. ShadowPM is built for teams that already have messy project information in spreadsheets, briefs, notes, calendars, and chat records, but need a faster way to turn that information into a clear project control workspace.

The core product promise:

> Upload or enter project information, then get an editable project control table, budget ledger, execution calendar, and change history in one place.

## What ShadowPM Solves

Many internal projects are not managed inside a formal enterprise PM system. They often live across:

- Excel project control tables
- Budget sheets
- Communication calendars
- Meeting notes
- Chat updates
- Manually maintained progress records

The result is usually high friction:

- Budget is mixed into project control rows.
- Calendar entries mix owner, channel, and content.
- Missing fields are hidden instead of being easy to complete.
- Progress and budget changes are hard to trace.
- Managers can see problems too late.
- Team members spend time cleaning tables instead of moving the project forward.

ShadowPM turns that mess into a structured, auditable workspace.

## Product Structure

ShadowPM currently has four official project surfaces:

- **Project Control Table**: the source of truth for control items, owners, departments, deadlines, status, descriptions, and progress conclusions.
- **Budget Ledger**: append-only budget flow records for budget confirmation, allocation, spending, refund, correction, and movement.
- **Execution Calendar**: formal execution and communication schedule, separated from the control table.
- **Project Activity**: traceable records for progress changes, AI imports, budget updates, calendar changes, and collaboration changes.

Supporting surfaces:

- **AI Workspace**: create projects manually or through AI import.
- **Command Center**: keyboard-first query surface for finding project, budget, calendar, and attention signals.
- **Leader Dashboard**: cross-project cockpit for attention items, upcoming execution, project briefs, and budget watch.
- **Team Permissions**: view ownership, collaborator authorization, workload, and read/write boundaries.

## Current Development Stage

ShadowPM is in Alpha.

Completed:

- P0 reliability and product-surface pruning
- AI spreadsheet/text import
- Direct editable AI import into official project tables
- Project control table V2
- Execution calendar V2
- Budget ledger truth and warnings
- Progress and budget traceability
- Leader read-only vs owner-edit permission boundary
- Explicit project collaborator authorization
- Query-only Command Center
- Dashboard V2 cockpit slice
- External tester feedback panel

P1 completed:

- Command Center deterministic query routing and source-table guidance
- Explainable weekly health summary generated from official data
- Budget-to-workstream association in the ledger
- Explicit project collaborator authorization and leader cockpit

P2 completed scope:

- Responsive UI shell and denser leader portfolio cockpit
- Canonical project-control workbook export
- Source-grounded weekly and monthly reports
- Expiring, revocable, read-only external project sharing
- Read-only ICS execution-calendar subscription
- Retained import evidence for AI grounding without a standalone asset center
- Production health check, security headers, standalone output, and Docker baseline

Post-P2 enterprise work is intentionally separate: SSO, tenant isolation, managed object storage, background queues, provider-specific two-way calendar OAuth, observability, and backup automation.

See [project-docs/TASKS.md](./project-docs/TASKS.md) for the live roadmap.

## What To Test Now

The current Alpha test should answer five questions:

1. Can a non-technical user upload a messy project workbook and successfully create a useful project workspace?
2. Does AI correctly separate project control table, budget ledger, and execution calendar?
3. Are missing or uncertain fields easy to find and complete in the official tables?
4. Do progress changes, budget changes, and calendar changes feel traceable?
5. Are permission boundaries understandable: owner can edit, explicit collaborators can edit, managers can inspect but not automatically edit?

## Reviewer Entry Points

- [External tester quickstart](./project-docs/EXTERNAL_TESTER_QUICKSTART.md)
- [Beginner tutorial](./project-docs/BEGINNER_TUTORIAL.md)
- [Current roadmap](./project-docs/TASKS.md)
- [Product principles](./PRODUCT_PRINCIPLES.md)
- [Canonical project schema](./CANONICAL_PROJECT_SCHEMA.md)
- [Review sample workbook](./project-docs/review-assets/one-million-project-control-sample.xlsx)

## Local Development

```bash
npm install
npx prisma dev
npx prisma db push
npx prisma db seed
npm test
npm run lint
npm run build
npm run dev
```

Required environment variables:

- `DATABASE_URL`
- `DEEPSEEK_API_KEY`
- `SHADOWPM_SESSION_SECRET` for shared or production deployment
- `NEXT_PUBLIC_APP_URL` for generated share and calendar-subscription URLs

Quality gate for every substantial module:

```bash
npm test
npm run lint
npm run build
```

Do not treat a successful build as proof that the product works. AI import, spreadsheet parsing, budget flows, calendar linkage, permissions, and feedback collection must be tested through the actual browser flow.
