# ShadowPM Roadmap

This roadmap is organized around product readiness, not feature volume.

ShadowPM is not trying to become another task manager. Every item below must improve AI-native project control: faster creation, clearer review, easier updates, stronger traceability, or lower cognitive load.

## Current Completed Scope

### Foundation

- [x] Next.js 14 App Router application
- [x] Tailwind CSS and local Shadcn-style UI primitives
- [x] Prisma schema and seed data
- [x] Lightweight auth shell with role-aware navigation
- [x] Workspace page for project creation and project list

### Core Project Surfaces

- [x] Project detail page
- [x] Project control table
- [x] Budget ledger
- [x] Execution calendar
- [x] Progress timeline
- [x] Risk view
- [x] Wiki/assets explorer
- [x] Dashboard overview

### AI-Native Workflow

- [x] AI-assisted project import
- [x] Spreadsheet/text parsing entry
- [x] Import preview before creation
- [x] Import draft queue
- [x] AI project summary and judgment
- [x] AI next actions converted to control tasks
- [x] AI next actions converted to execution calendar entries
- [x] AI risks converted to formal risks
- [x] AI budget signals converted to budget flows
- [x] User confirmation before important AI mutations

### Traceability

- [x] Progress change records
- [x] Budget flow records
- [x] Import confirmation activity records
- [x] Calendar to task linkage
- [x] Control table to calendar linkage
- [x] Control table to budget linkage

## P0 - Alpha Review And Core Reliability

These items are required before ShadowPM should be considered ready for broader internal testing.

- [x] Update product documentation to match the current AI-native platform direction
- [x] Move review sample assets into `project-docs/review-assets/`
- [x] Publish latest Alpha review build to GitHub
- [ ] AI import quality V2
  - Add field-level confidence
  - Separate required gaps from optional gaps
  - Surface conflicts and ambiguous fields before confirmation
  - Keep low-confidence items editable instead of blocking creation
- [ ] Control table V2
  - Improve inline edit coverage
  - Add missing-field and needs-confirmation filters
  - Show clearer relationship indicators for budget/calendar/risk/assets
- [ ] Execution calendar V2
  - Optimize for execution orchestration, not decorative month browsing
  - Add workstream/channel/owner/status grouping
  - Improve overdue and upcoming signal density
  - Keep channel and owner separate
- [ ] Permission hardening
  - Add centralized project access helpers
  - Enforce owner/member access at Server Action boundaries
  - Audit AI mutation permission checks
- [ ] Business-rule tests
  - Budget balance from flow sum
  - Status change creates progress log
  - Import confirmation creates expected records
  - Calendar/task and ledger/task linking

## P1 - Product Differentiation

- [ ] Command Center
  - Keyboard-first command interface
  - Natural language updates
  - Quick create/update/query flows
- [ ] Multi-turn AI confirmation
  - AI asks only high-value clarification questions
  - User can choose "create now, fill gaps later"
  - AI explains what it will mutate before applying low-confidence changes
- [ ] Dashboard V2
  - AI-generated weekly project health summary
  - Cross-project risk and budget signals
  - Leader view that answers status questions without page drilling
- [ ] Budget module V2
  - Budget categories
  - Budget warnings
  - Draft vs confirmed financial signals
  - Better task/workstream association
- [ ] Team model
  - Project members
  - Workload view
  - Role-aware mutation boundaries

## P2 - Scale And Ecosystem

- [ ] Export canonical project control workbook
- [ ] AI-generated weekly/monthly reports
- [ ] External collaborator share links
- [ ] Calendar sync
- [ ] Asset intelligence and AI grounding over project documents
- [ ] Portfolio cockpit for many active projects
- [ ] Enterprise deployment hardening

## Development Protocol

Each module should be developed iteratively:

1. Modify only the scoped module.
2. Run:

```bash
npm test
npm run lint
npm run build
```

3. Fix all errors.
4. Explain changed files, reason, risk, and impact.
5. Push to GitHub only after the module is stable.
