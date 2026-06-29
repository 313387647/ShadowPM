# ShadowPM Alpha Review Package

Review date: 2026-06-29

Repository: `git@github.com:313387647/ShadowPM.git`

ShadowPM is an AI Native Project Management Platform for fast internal project control. It is not a generic task manager.

The core user need is: quickly generate, update, and manage multidimensional project control tables for a specific internal team, without adopting a heavy enterprise PM or OA system.

## What Reviewers Should Evaluate

Please evaluate ShadowPM against the product constitution, not against Jira/ClickUp feature checklists.

Primary questions:

1. Can a user turn messy project input into a useful control system quickly?
2. Does AI become part of the core workflow rather than a side widget?
3. Is the project control table becoming the central artifact?
4. Are budget, progress, and execution changes auditable?
5. Is the interaction model lower-friction than manually maintaining Excel?

## Product Constitution

See `PRODUCT_PRINCIPLES.md`.

Non-negotiable direction:

- AI first, not AI as an add-on
- Extreme speed over feature volume
- Low learning cost
- Keyboard first
- Minimum clicks and page switching
- Information density with clarity
- Project control table as the core artifact
- Missing information is allowed and should become editable gaps
- Consistency beats novelty
- Trust is a product feature

## Canonical Project Structure

See `CANONICAL_PROJECT_SCHEMA.md`.

ShadowPM maps messy inputs into:

1. Project Profile
2. Project Control Table
3. Budget Ledger
4. Execution Calendar
5. Progress Change Log
6. Budget Flow Log
7. Risk and Open Issues
8. Assets and References

Important modeling decision:

- Budget does not belong as a loose column inside the project control table.
- Execution calendar should separate date, channel, owner, workstream, content, and status.
- Progress and budget changes need append-only records.

## Current Implemented Scope

### Product And Navigation

- Workspace project list and project creation
- Project detail page
- Dashboard overview
- Role-aware app shell

### Project Surfaces

- Project control table with filters and linkage indicators
- Budget ledger with append-only flow records
- Execution calendar with future/week/month views
- Progress timeline
- Risk register
- Wiki/assets explorer

### AI Workflow

- AI-assisted project import from text/spreadsheet input
- Import preview before creation
- Import draft queue
- AI project summary and structured judgment
- AI suggestions that can become:
  - Control tasks
  - Execution calendar entries
  - Risks
  - Budget flows
- User confirmation for important AI-driven mutations

### Traceability

- Progress changes are logged
- Budget movements are logged
- Import confirmations are logged
- Task-to-calendar and task-to-budget relationships are navigable

## Review Sample

Use this workbook as the messy input reference:

`project-docs/review-assets/one-million-project-control-sample.xlsx`

It is intentionally not treated as a canonical template. It is a useful real-ish sample for testing AI extraction quality.

Known source issues:

- Budget-like information can be mixed into control-table rows
- Calendar cells may mix channel, owner, and content
- Some information is incomplete or structurally ambiguous

Expected ShadowPM behavior:

- Split budget signals into Budget Ledger candidates
- Split calendar fields when possible
- Preserve uncertainty and expose missing fields
- Do not invent critical missing information
- Allow the user to confirm and continue quickly

## How To Run

```bash
npm install
npm test
npm run lint
npm run build
npm run dev
```

Environment variables are local-only and excluded from Git.

## Current Quality Gate

Latest verified gate before GitHub upload:

- `npm test` passed
- `npm run lint` passed
- `npm run build` passed

## Product Gaps For Review

### P0

The latest external review raised two reliability issues that must move ahead of additional product surface work:

- Permission hardening must come first. Current lightweight auth and project-scoped Server Actions need centralized read/write assertions.
- Budget formulas must be unified. `Project.totalBudget` should be treated as planned budget metadata, while `BudgetFlow` should remain the financial source of truth.

Updated P0 order:

1. Reliability hardening
2. Budget ledger truth
3. AI creation without mandatory budget
4. Import draft safety
5. AI import quality V2
6. Control table V2
7. Execution calendar V2
8. Business-rule tests

Key P0 gaps:

- AI import needs field-level confidence, missing-field priority, source references, and conflict review.
- Import draft budget candidates must not default unclear estimates to expense flows.
- Control table needs stronger inline editing and "needs confirmation" workflows.
- Execution calendar needs V2 orchestration around workstream/channel/owner/status.
- Business-rule tests need to cover budget, permissions, logs, import confirmation, and linking.

### P1

- Command Center for keyboard-first natural-language operations.
- Multi-turn AI clarification that asks fewer but better questions.
- Dashboard V2 with stronger AI status judgment.
- Budget module V2 with categories and warnings.
- Team/member model beyond lightweight auth.

## Suggested Review Path

1. Read `PRODUCT_PRINCIPLES.md`.
2. Read `CANONICAL_PROJECT_SCHEMA.md`.
3. Run the app.
4. Import or inspect the sample workbook.
5. Evaluate whether the generated project becomes easier to manage than the original spreadsheet.
6. Review P0 gaps in `project-docs/TASKS.md`.
