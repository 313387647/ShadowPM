# ShadowPM Database Design

PostgreSQL is the source of truth. Prisma schema: `prisma/schema.prisma`.

## Core Project Records

- `User`: login identity and `LEADER | MEMBER` role.
- `Project`: project profile, owner, planned budget, dates.
- `ProjectMember`: explicit `EDITOR | VIEWER` authorization.
- `Phase`: workstream/grouping for control items.
- `Task`: current implementation name for a project control item.

`Task` stores description, owner, department, deadline, status, priority, latest conclusion, AI confidence, source reference, missing fields, conflicts, and confirmation state. Product UI calls it a control item or 管控事项.

## Trust And History

- `ProgressLog`: append-only per-control-item progress history.
- `ActivityLog`: project-wide audit trail for human, AI, import, and system changes.
- `BudgetFlow`: append-only financial flow linked to a control item.
- `ExecutionCalendarEntry`: formal execution schedule, optionally linked to a control item.

Financial truth:

```text
confirmed budget = SUM(ALLOCATE)
consumed = max(0, ABS(SUM(EXPENSE)) - SUM(REFUND))
available balance = confirmed budget - consumed
```

`Project.totalBudget` is the plan and must not be added to confirmed budget.

## P2 Records

- `ProjectSource`: bounded extracted source text, filename, media type, hash, uploader, timestamp.
- `ProjectReport`: persisted weekly/monthly report plus structured source snapshot.
- `ProjectShareLink`: expiring/revocable read-only capability with token hash only.

These records support AI grounding, reporting, sharing, and calendar subscription without adding a standalone asset center.

## Alpha Support Records

- `ProjectFeedback`: structured reviewer feedback.

## Legacy Hidden Records

- `Risk`
- `AssetFolder`
- `AssetItem`
- `ImportDraft`
- `HealthSnapshot`

They remain for compatibility but are not current product surfaces.

## Index Strategy

Indexes cover project owner/creation, project member roles, control-item project/status/deadline/assignee, activity project/time, budget operation/time, calendar project/date/status/channel, source project/hash, report project/type/time, and share expiry/revocation.

## Deployment

For the current pre-migration-history repository:

```bash
npx prisma generate
npx prisma db push
```

Production hardening after P2 should establish a reviewed migration baseline before multi-tenant rollout. Never use destructive reset commands on shared data.
