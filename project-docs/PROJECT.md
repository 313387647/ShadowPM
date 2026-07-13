# ShadowPM Project Context

## Product Positioning

ShadowPM is an AI Native Project Management Platform for fast internal project control.

It serves lightweight team operations outside heavy enterprise systems. The target user is not trying to run a generic task board; they need to create, update, and manage multidimensional project control tables with as little manual work as possible.

The product must optimize for:

- AI-first creation and updates
- Extremely low learning cost
- High information density
- Keyboard-first operation
- Minimum clicks and page switching
- Auditable project, budget, and progress history
- Modern SaaS quality comparable to Linear, Cursor, Raycast, Vercel, GitHub, and Stripe Dashboard

## Core Product Model

ShadowPM projects are organized around three primary work surfaces:

1. Project Control Table
   The main operating artifact. It tracks workstreams, control items, owners, departments, deadlines, status, progress conclusions, watch items, and links to budget/calendar records.

2. Budget Ledger
   Budget must not be hidden inside the control table. It is an append-only ledger with allocation, expense, refund, and adjustment flows.

3. Execution Calendar
   Execution and communication plans should be structured as dates, channels, workstreams, owners, content, status, and related control items.

The trust layers are:

- Progress Change Log
- Budget Flow Log
- AI import/action traceability
- Retained import-source evidence
- Persisted report source snapshots
- Revocable external share capabilities

The canonical model is maintained in `CANONICAL_PROJECT_SCHEMA.md`.

## Current Product State

The product currently supports:

- Workspace project creation
- AI project import from pasted text or uploaded spreadsheet
- Import preview and confirmation
- Project control table
- Budget ledger
- Execution calendar
- Progress timeline
- Query-only Command Center
- Portfolio dashboard
- Canonical workbook export
- Weekly/monthly grounded reports
- Expiring read-only project sharing
- ICS execution-calendar subscription

The current Alpha is suitable for review and internal testing with the sample spreadsheet in `project-docs/review-assets/`.

## Technical Stack

- Framework: Next.js 14 App Router
- Backend: Next.js Server Actions
- Frontend: React 18
- Styling: Tailwind CSS
- UI: Shadcn-style local primitives + Lucide icons
- ORM: Prisma
- Database: PostgreSQL
- Workbook export: SheetJS
- File parsing: spreadsheet parser in `src/lib/xlsx-parser.js`

## Engineering Rules

- Prefer React Server Components and Server Actions.
- Avoid unnecessary client-side global state.
- Keep mutations typed, permission-aware, and auditable.
- Budget and progress changes should be append-only by default.
- AI output should become structured data, not chat-only text.
- Every substantial module must pass `npm test`, `npm run lint`, and `npm run build`.
- Do not preserve broken flows just for compatibility.
