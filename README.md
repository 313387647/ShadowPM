# ShadowPM

ShadowPM is an AI Native Project Management Platform for lightweight internal project control.

It is not a task manager. Its core job is to turn messy project inputs such as spreadsheets, briefs, notes, and chat updates into a structured, auditable project control system:

- Project control table
- Budget ledger
- Execution calendar
- Progress change log
- Risk and issue register
- Project assets and references

The product direction is defined in [PRODUCT_PRINCIPLES.md](./PRODUCT_PRINCIPLES.md). The canonical data contract is defined in [CANONICAL_PROJECT_SCHEMA.md](./CANONICAL_PROJECT_SCHEMA.md).

## Current Status

This repository is currently an Alpha review build.

Implemented:

- AI-assisted project import from text and spreadsheet input
- AI import preview and confirmation flow
- Project workspace and project detail views
- Project control table with filters, missing-field completion, and linked navigation
- Budget ledger with append-only flow records
- Execution calendar with week/month/future views and task linkage
- Progress timeline with append-only change records
- Risk view and AI-to-risk conversion
- AI copilot actions for task, calendar, risk, and budget suggestions
- Dashboard with project and budget overview
- Auth shell with role-aware navigation

Known gaps:

- AI import needs stronger confidence, conflict, and missing-field review UX
- Execution calendar needs a true execution orchestration V2
- Permissions are still lightweight and not enterprise-grade
- Test coverage is mostly typecheck/lint/build level; business-rule tests need expansion
- Product documentation is being kept in `project-docs/` and should stay in sync with development

## Review Entry Points

- [Review Package](./project-docs/REVIEW_PACKAGE.md)
- [Current Roadmap](./project-docs/TASKS.md)
- [Architecture](./project-docs/ARCHITECTURE.md)
- [Database](./project-docs/DATABASE.md)
- [Server Actions API](./project-docs/API.md)
- [Review sample spreadsheet](./project-docs/review-assets/one-million-project-control-sample.xlsx)

## Local Setup

```bash
npm install
npm test
npm run lint
npm run build
npm run dev
```

The app uses Next.js App Router, Server Actions, Prisma, PostgreSQL, Tailwind CSS, and Shadcn-style UI primitives.

Required local environment variables are intentionally excluded from Git. See `.env` locally for development secrets.

## Quality Gate

Every substantial module must pass:

```bash
npm test
npm run lint
npm run build
```

Do not treat a successful build as proof of product quality. Spreadsheet ingestion, AI parsing, budget flows, and calendar linkage should also be tested with real project data.
