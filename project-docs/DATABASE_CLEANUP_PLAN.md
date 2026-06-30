# ShadowPM Legacy Database Cleanup Plan

ShadowPM Alpha has removed the independent import review queue, risk register, and wiki/assets surfaces from the active product core.

The Prisma schema still contains legacy models so existing local/test data is not destroyed without an explicit migration window.

## Legacy Models To Remove

- `ImportDraft`
- `Risk`
- `AssetFolder`
- `AssetItem`
- `AssetType`
- `Project.importDrafts`
- `Project.risks`
- `Project.folders`

## Why They Are Legacy

- Import review queue was replaced by direct editable AI import into the project control table, budget ledger, and execution calendar.
- Risks and open questions now belong in control-item notes, progress logs, AI summaries, or missing-field diagnostics.
- Wiki/assets are not part of the current Alpha core and should not distract reviewers from the three primary work surfaces.

## Safe Migration Sequence

1. Confirm deployed/test environments no longer call:
   - `src/actions/import-draft-actions.ts`
   - `src/actions/risk-actions.ts`
   - `src/actions/wiki-actions.ts`
   - `ImportDraftPanel`
   - `RiskView`
   - `WikiExplorer`
2. Export or snapshot the database before migration.
3. Add a Prisma migration that drops legacy relations and tables.
4. Run `npx prisma generate`.
5. Run:

```bash
npm test
npm run lint
npm run build
```

6. Smoke-test:
   - AI import creates a project
   - Project control table opens
   - Budget ledger opens
   - Execution calendar opens
   - Project activity opens

## Acceptance Criteria

- No source file imports removed legacy actions/components.
- No seed data creates legacy records.
- Existing Alpha core still passes the quality gate.
- Reviewer documentation only references the three core work surfaces.

