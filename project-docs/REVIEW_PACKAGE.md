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

- AI import needs field-level confidence, missing-field priority, and conflict review.
- Control table needs stronger inline editing and "needs confirmation" workflows.
- Execution calendar needs V2 orchestration around workstream/channel/owner/status.
- Server Action permissions need hardening.
- Business-rule tests need to cover budget, logs, import confirmation, and linking.

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
