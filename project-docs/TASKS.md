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
- [x] Dashboard overview

### AI-Native Workflow

- [x] AI-assisted project import
- [x] Spreadsheet/text parsing entry
- [x] Import preview before creation
- [x] Direct editable AI import into control table, budget ledger, and execution calendar
- [x] AI project summary and judgment
- [x] AI next actions converted to control tasks
- [x] AI next actions converted to execution calendar entries
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
- [x] P0.1 Reliability hardening
  - [x] Add centralized `src/lib/permissions.ts`
  - [x] Add `requireCurrentUser`, `assertCanReadProject`, and `assertCanWriteProject`
  - [x] Apply project access checks to project-scoped Server Actions
  - [x] Fix Copilot project context so it cannot read unrelated projects
  - [x] Replace forgeable plain session cookie with a signed and server-verifiable session strategy
  - [ ] Add regression tests for cross-project read/write protection
- [x] P0.2 Budget ledger truth
  - [x] Unify budget formulas across Dashboard, Ledger, Copilot, and AI summaries
  - [x] Treat `Project.totalBudget` as planned/approved budget metadata
  - [x] Treat `BudgetFlow` as financial truth
  - [x] Compute dynamic budget from `SUM(ALLOCATE)`
  - [x] Compute consumed budget from `ABS(SUM(EXPENSE)) - SUM(REFUND)`
  - [x] Remove formulas that double-count `Project.totalBudget + initial ALLOCATE`
  - [x] Ensure manual budget entries reject invalid flow types and store `EXPENSE` as negative
  - [ ] Add business tests for budget snapshots
- [x] P0.3 AI creation should not block on missing budget
  - [x] Require project name only
  - [x] Allow unknown or zero total budget when source does not contain a reliable budget pool
  - [x] Show "budget pool needs confirmation" instead of blocking project creation
  - [x] Write identifiable budget rows into the editable ledger
  - [x] Do not create an initial `ALLOCATE` flow when no confirmed budget exists
  - [x] Align manual project creation with the same optional budget rule
- [x] P0.4 Direct editable AI import
  - [x] Remove the separate import draft/review queue from the Alpha core
  - [x] Stop defaulting ambiguous budget signals to `EXPENSE`
  - [x] Write AI-generated budget rows into the official ledger
  - [x] Write AI-generated calendar rows into the official execution calendar
  - [x] Keep blockers/open questions in editable table notes and activity summaries
- [x] P0.5 Product surface pruning
  - [x] Remove independent risk and assets surfaces from the Alpha core
  - [x] Remove AI-to-risk conversion actions
  - [x] Convert Copilot risk-style prompts into control-table attention queries
  - [x] Update current docs to reflect the three core work surfaces
  - [ ] Clean legacy database models with an explicit migration plan
- [ ] P0.6 AI import quality V2
  - Add field-level confidence
  - Separate required gaps from optional gaps
  - Surface conflicts and ambiguous fields before confirmation
  - Add `sourceRef` for control items, budget rows, and calendar entries
  - Add `missingFields` and `conflicts` to the import preview model
  - Group preview rows as "ready to create", "needs confirmation", and "can fill later"
  - Keep low-confidence items editable instead of blocking creation
- [ ] P0.7 Control table V2
  - Introduce a product-language adapter: database may stay `Task`, but UI/actions should expose "Control Item / 管控事项"
  - Replace task-manager wording in core surfaces
  - Improve inline edit coverage
  - Add missing-field and needs-confirmation filters
  - Add low-confidence filters once import confidence is available
  - Expose department, description, owner, deadline, status, latest progress, and blocker editing
  - Show clearer relationship indicators for budget/calendar/log history
- [ ] P0.8 Execution calendar V2
  - Optimize for execution orchestration, not decorative month browsing
  - Add workstream/channel/owner/status grouping
  - Improve overdue and upcoming signal density
  - Keep channel and owner separate
- [ ] P0.9 Business-rule tests
  - Budget balance from flow sum
  - Cross-project read/write protection
  - Status change creates progress log
  - AI import can create a project without confirmed total budget
  - Import confirmation creates expected records
  - Calendar/task and ledger/task linking
  - Import budget candidate cannot cross-link to another project's task

## P1 - Product Differentiation

- [ ] Command Center
  - Keyboard-first command interface
  - Natural language updates
  - Quick create/update/query flows
  - Mutation preview before write operations
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

## External Tester Gate

Goal: let reviewers directly upload the sample spreadsheet and submit product feedback through a shared website.

Minimum gate before sharing a test URL:

- [x] P0.1 permissions are hardened enough for private testing
- [x] P0.2 budget formulas are unified
- [x] P0.3 project creation does not require confirmed budget
- [x] P0.4 AI import writes official editable budget/calendar records
- [x] P0.5 independent risk/assets/import-review surfaces are removed from the Alpha core
- [ ] Shared deployment is configured with `SHADOWPM_SESSION_SECRET`, `DEEPSEEK_API_KEY`, and database access
- [x] Complete reviewer user guide and feedback template are available
- [ ] Test flow is smoke-tested with `project-docs/review-assets/one-million-project-control-sample.xlsx`

Tester flow:

1. Open the test site.
2. Log in as a test user.
3. Upload `project-docs/review-assets/one-million-project-control-sample.xlsx`.
4. Review AI preview.
5. Create the project even if budget is missing.
6. Check project control table, editable budget ledger, editable execution calendar, and project activity records.
7. Submit feedback on wrong extraction, missing fields, confusing labels, and unsafe AI assumptions.
