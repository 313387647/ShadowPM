# ShadowPM P2 Release Review

## Product Outcome

P2 makes a ShadowPM project portable, reportable, shareable, calendar-compatible, source-grounded, and manageable at portfolio scale without turning the product into a generic task suite.

## Completed Capabilities

1. Canonical Excel export with project, control, progress, budget, calendar, activity, and source sheets.
2. Persisted weekly/monthly reports grounded in official data and retained source excerpts.
3. Expiring, revocable, read-only project share links with hashed tokens.
4. Read-only ICS subscription backed by the official execution calendar.
5. Project source evidence retained during AI import using bounded text plus source hash.
6. Searchable and filterable leader portfolio cockpit.
7. Responsive navigation, mobile dialogs, denser workspace and project surfaces.
8. Health endpoint, security headers, no-index policy, standalone build, and Docker baseline.

## Intentional Boundaries

- No standalone asset center.
- No AI chat mutations for routine project edits.
- No automatic calendar event for every active control item.
- No two-way Google or Microsoft calendar OAuth.
- No guest comments or external edit permissions.
- No claim of enterprise readiness without SSO, tenant isolation, managed storage, queues, observability, and backup automation.

## Acceptance Flow

Before running the acceptance flow against an existing local database:

```bash
npx prisma generate
npx prisma db push
```

1. AI import a real workbook and confirm a `ProjectSource` record is retained.
2. Edit a control item and confirm its activity/progress record.
3. Export the canonical workbook and inspect all sheets.
4. Generate weekly and monthly reports and verify project activity records.
5. Create a read-only link and open it in a logged-out browser.
6. Subscribe to or inspect the ICS feed.
7. Revoke the link and confirm both external endpoints stop working.
8. Use the leader portfolio filters with at least 20 projects.
9. Verify mobile navigation and horizontal table access.
10. Verify `/api/health` after deployment.

## Current Verification State

- Code quality gate: passed (`npm test`, `npm run lint`, `npm run build`).
- Business rules: 22 tests across budget, AI import, permissions, health summary, Command Center, sharing, and ICS.
- Prisma schema validation: passed.
- Local database synchronization: passed with `npx prisma db push`.
- Browser acceptance: manually completed by the product owner on 2026-07-13 for steps 1 through 9.
- Health acceptance: manually completed on 2026-07-13. `/api/health` returned `status: ok`, `service: shadowpm`, `database: connected`, and `latencyMs: 13`.
