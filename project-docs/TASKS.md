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

- [x] P0 code scope completed and verified locally
- [x] Update product documentation to match the current AI-native platform direction
- [x] Move review sample assets into `project-docs/review-assets/`
- [x] Publish latest Alpha review build to GitHub
- [x] P0.1 Reliability hardening
  - [x] Add centralized `src/lib/permissions.ts`
  - [x] Add `requireCurrentUser`, `assertCanReadProject`, and `assertCanWriteProject`
  - [x] Apply project access checks to project-scoped Server Actions
  - [x] Fix Copilot project context so it cannot read unrelated projects
  - [x] Replace forgeable plain session cookie with a signed and server-verifiable session strategy
  - [x] Add regression tests for cross-project read/write protection
- [x] P0.2 Budget ledger truth
  - [x] Unify budget formulas across Dashboard, Ledger, Copilot, and AI summaries
  - [x] Treat `Project.totalBudget` as planned/approved budget metadata
  - [x] Treat `BudgetFlow` as financial truth
  - [x] Compute dynamic budget from `SUM(ALLOCATE)`
  - [x] Compute consumed budget from `ABS(SUM(EXPENSE)) - SUM(REFUND)`
  - [x] Remove formulas that double-count `Project.totalBudget + initial ALLOCATE`
  - [x] Ensure manual budget entries reject invalid flow types and store `EXPENSE` as negative
  - [x] Add business tests for budget snapshots
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
  - [x] Write only high-confidence confirmed AI budget rows into the official ledger
  - [x] Keep estimate/draft/low-confidence budget signals in import diagnostics instead of confirmed ledger flows
  - [x] Write AI-generated calendar rows into the official execution calendar
  - [x] Keep blockers/open questions in editable table notes and activity summaries
- [x] P0.5 Product surface pruning
  - [x] Remove independent risk and assets surfaces from the Alpha core
  - [x] Remove AI-to-risk conversion actions
  - [x] Convert Copilot risk-style prompts into control-table attention queries
  - [x] Update current docs to reflect the three core work surfaces
  - [x] Clean legacy database models with an explicit migration plan
- [x] P0.6 AI import quality V2
  - [x] Add field-level confidence
  - [x] Separate required gaps from optional gaps
  - [x] Surface conflicts and ambiguous fields before confirmation
  - [x] Add `sourceRef` for control items, budget rows, and calendar entries
  - [x] Add `missingFields` and `conflicts` to the import preview model
  - [x] Group preview rows with visible diagnostics instead of blocking creation
  - [x] Keep low-confidence items editable instead of blocking creation
  - [x] Persist control-item AI diagnostics on `Task`
  - [x] Surface AI confidence/source/missing/conflict signals in the control table
- [x] P0.7 Control table V2
  - [x] Introduce a product-language adapter: database may stay `Task`, but UI/actions expose "Control Item / 管控事项"
  - [x] Replace task-manager wording in core surfaces
  - [x] Remove redundant list/kanban views from the Alpha core
  - [x] Improve inline edit coverage
  - [x] Add missing-field and needs-confirmation filters
  - [x] Expose department, description, owner, deadline, status, latest progress, and blocker editing
  - [x] Show clearer relationship indicators for budget/calendar/log history
- [x] P0.8 Execution calendar V2
  - [x] Optimize for execution orchestration, not decorative month browsing
  - [x] Add workstream/channel/owner/status grouping
  - [x] Improve overdue and upcoming signal density
  - [x] Keep channel and owner separate
  - [x] Add control-table-to-calendar creation flow
  - [x] Add calendar deletion for mistaken schedules while preserving activity logs
- [x] P0.9 Business-rule tests
  - [x] Upgrade `npm test` to run typecheck plus business tests
  - [x] Cover budget balance from flow sum
  - [x] Cover planned budget not being double-counted as available budget
  - [x] Cover refund impact on consumed budget
  - [x] Cover AI low-confidence and estimate budgets not becoming confirmed allocations
  - [x] Cover leader read-only and owner-only write permission rules

- [x] P0.10 Alpha external testing polish
  - [x] Update demo entry for direct upload-and-feedback testing
  - [x] Add external tester quickstart
  - [x] Hide advanced budget operations from Alpha UI
  - [x] Mark Risk/Asset/ImportDraft schema models as legacy hidden from Alpha core
  - [x] Prevent hard delete for control items with logs, budget flows, or calendar entries

## P1 - Product Differentiation (Completed)

- [x] Command Center
  - [x] Keyboard-first global entry with `Cmd/Ctrl + K`
  - [x] Natural language queries over official project, budget, and calendar data
  - [x] Keep progress/status edits in the project control table instead of AI chat
  - [x] Remove routine data mutation from the Command Center scope
  - [x] Improve query accuracy and answer formatting only
- [x] Multi-turn AI confirmation
  - [x] AI asks only high-value clarification questions
  - [x] User can choose "create now, fill gaps later"
  - [x] AI explains what it will mutate before applying low-confidence changes
  - [x] AI import and bulk-generation flows show clear previews before writes
- [x] Dashboard V2
  - [x] Leader cockpit first screen with attention items and upcoming execution calendar
  - [x] Cross-project watch signals without page drilling
  - [x] Project brief cards with progress, overdue, and missing-owner signals
  - [x] Budget anomaly ranking and ledger drill-down
  - [x] Explainable weekly project health summary from official data
- [x] Budget module V2
  - [x] Budget categories
  - [x] Budget warnings
  - [x] Draft/planned vs confirmed financial signals
  - [x] Better task/workstream association
  - Reintroduce advanced split/merge/transfer UI only after Alpha users understand the basic ledger
- [x] Team model
  - [x] Project members
  - [x] Workload view
  - [x] Role-aware mutation boundaries
  - [x] Leader read-only vs owner-editable permission explanation
  - [x] Explicit collaborator authorization beyond project owner

## P2 - Scale And Ecosystem

- [x] Export canonical project control workbook
  - Includes project profile, control table, progress changes, budget flows, execution calendar, activity, and source evidence
- [x] AI-generated weekly/monthly reports
  - Grounded in official project data and retained import evidence
  - Falls back to a deterministic report when the model is unavailable
  - Persists report content and source snapshot for auditability
- [x] External collaborator share links
  - Revocable, expiring, read-only project view
  - Stores only the share-token hash
- [x] Calendar sync
  - Standards-based read-only ICS subscription from the same revocable share capability
  - Two-way Google/Microsoft OAuth sync is intentionally outside this release
- [x] Asset intelligence and AI grounding over project documents
  - Import sources are retained as bounded text evidence with filename and hash
  - No standalone asset center was restored
- [x] Portfolio cockpit for many active projects
  - Searchable, filterable portfolio table with progress, responsibility, schedule, and budget signals
  - Removed duplicate decorative charts and risk panels
- [x] Enterprise deployment hardening baseline
  - Health endpoint, security headers, signed sessions, standalone build, Docker image, environment template, and no-index policy
  - SSO, tenant isolation, object storage, queue workers, and provider-specific OAuth remain post-P2 enterprise work

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
