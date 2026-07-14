-- Budget rearchitecture: budget planning is project-first, not task-first.
-- Legacy task fields remain in place for a release so historical integrations
-- and audit views can be validated before their later removal.

CREATE TYPE "ProjectBudgetMode" AS ENUM ('PENDING', 'CONFIRMED', 'NOT_MANAGED');
CREATE TYPE "BudgetItemStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'SETTLED', 'CANCELED');
CREATE TYPE "BudgetItemSource" AS ENUM ('MANUAL', 'AI_IMPORT', 'MIGRATED');
CREATE TYPE "BudgetFlowAction" AS ENUM (
  'POOL_CONFIRMED', 'POOL_ADJUSTED', 'ITEM_CONFIRMED', 'ITEM_ADJUSTED',
  'APPROVAL_RECORDED', 'TRANSFER_RECORDED', 'EXPENSE_RECORDED',
  'REFUND_RECORDED', 'SETTLED', 'CANCELED', 'REVERSED', 'LEGACY_IMPORTED'
);
CREATE TYPE "BudgetMigrationIssueType" AS ENUM (
  'OVER_POOL_LEGACY_ITEMS', 'UNMAPPED_LEGACY_FLOW', 'LEGACY_POOL_STATUS_AMBIGUOUS'
);

ALTER TABLE "Project"
  ADD COLUMN "budgetMode" "ProjectBudgetMode" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "budgetConfirmedAt" TIMESTAMP(3);

-- Preserve the historical interpretation where it is unambiguous. A former
-- CANCELED pool is deliberately not reclassified as "not managed".
UPDATE "Project"
SET "budgetMode" = CASE
  WHEN "budgetStatus" = 'CONFIRMED' AND "totalBudget" > 0 THEN 'CONFIRMED'::"ProjectBudgetMode"
  ELSE 'PENDING'::"ProjectBudgetMode"
END,
"budgetConfirmedAt" = CASE
  WHEN "budgetStatus" = 'CONFIRMED' AND "totalBudget" > 0 THEN "updatedAt"
  ELSE NULL
END;

CREATE TABLE "BudgetItem" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" TEXT,
  "plannedAmount" DECIMAL(14,2) NOT NULL,
  "status" "BudgetItemStatus" NOT NULL DEFAULT 'DRAFT',
  "description" TEXT,
  "source" "BudgetItemSource" NOT NULL DEFAULT 'MANUAL',
  "aiConfidence" TEXT,
  "sourceRef" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BudgetItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BudgetItemTaskRelation" (
  "budgetItemId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BudgetItemTaskRelation_pkey" PRIMARY KEY ("budgetItemId", "taskId")
);

CREATE TABLE "BudgetMigrationIssue" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "flowId" TEXT,
  "taskId" TEXT,
  "type" "BudgetMigrationIssueType" NOT NULL,
  "details" JSONB NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BudgetMigrationIssue_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "BudgetFlow"
  ADD COLUMN "budgetItemId" TEXT,
  ADD COLUMN "action" "BudgetFlowAction";

-- Every historical task budget or task-level flow becomes an independent item.
-- The deterministic identifier lets flows and relations map without guessing.
INSERT INTO "BudgetItem" (
  "id", "projectId", "title", "plannedAmount", "status", "source", "createdBy", "createdAt", "updatedAt"
)
SELECT
  'legacy-budget-item-' || task."id",
  task."projectId",
  task."name",
  task."budgetAmount",
  CASE task."budgetStatus"
    WHEN 'ALLOCATED' THEN 'CONFIRMED'::"BudgetItemStatus"
    WHEN 'APPROVED' THEN 'IN_PROGRESS'::"BudgetItemStatus"
    WHEN 'DISBURSED' THEN 'IN_PROGRESS'::"BudgetItemStatus"
    WHEN 'ACCEPTED' THEN 'SETTLED'::"BudgetItemStatus"
    WHEN 'CANCELED' THEN 'CANCELED'::"BudgetItemStatus"
    ELSE 'DRAFT'::"BudgetItemStatus"
  END,
  'MIGRATED'::"BudgetItemSource",
  '系统迁移',
  task."updatedAt",
  task."updatedAt"
FROM "Task" task
WHERE task."budgetAmount" <> 0
   OR task."budgetStatus" <> 'UNALLOCATED'::"TaskBudgetStatus"
   OR EXISTS (SELECT 1 FROM "BudgetFlow" flow WHERE flow."taskId" = task."id");

INSERT INTO "BudgetItemTaskRelation" ("budgetItemId", "taskId")
SELECT 'legacy-budget-item-' || task."id", task."id"
FROM "Task" task
WHERE EXISTS (
  SELECT 1 FROM "BudgetItem" item WHERE item."id" = 'legacy-budget-item-' || task."id"
);

-- Preserve every task-level flow by linking it to the migrated item. Project
-- pool flows intentionally retain a null item relationship.
UPDATE "BudgetFlow" flow
SET "budgetItemId" = 'legacy-budget-item-' || flow."taskId",
    "action" = 'LEGACY_IMPORTED'::"BudgetFlowAction"
WHERE flow."taskId" IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM "BudgetItem" item
    WHERE item."id" = 'legacy-budget-item-' || flow."taskId"
  );

UPDATE "BudgetFlow"
SET "action" = 'LEGACY_IMPORTED'::"BudgetFlowAction"
WHERE "action" IS NULL;

-- Do not silently force over-budget legacy data to fit the pool. It is safe to
-- read, but is surfaced as a migration issue before any new confirmation.
INSERT INTO "BudgetMigrationIssue" ("id", "projectId", "type", "details")
SELECT
  'budget-migration-over-pool-' || project."id",
  project."id",
  'OVER_POOL_LEGACY_ITEMS'::"BudgetMigrationIssueType",
  jsonb_build_object(
    'totalBudget', project."totalBudget",
    'confirmedItems', SUM(item."plannedAmount"),
    'message', '历史事项预算合计高于项目预算池；未自动调减。'
  )
FROM "Project" project
JOIN "BudgetItem" item ON item."projectId" = project."id"
WHERE project."budgetMode" = 'CONFIRMED'::"ProjectBudgetMode"
  AND item."status" IN ('CONFIRMED', 'IN_PROGRESS', 'SETTLED')
GROUP BY project."id", project."totalBudget"
HAVING SUM(item."plannedAmount") > project."totalBudget";

-- A stale foreign-key-free data import can leave a taskId with no task. Keep
-- the flow untouched and make the exception auditable instead of guessing.
INSERT INTO "BudgetMigrationIssue" ("id", "projectId", "flowId", "taskId", "type", "details")
SELECT
  'budget-migration-unmapped-flow-' || flow."id",
  flow."projectId",
  flow."id",
  flow."taskId",
  'UNMAPPED_LEGACY_FLOW'::"BudgetMigrationIssueType",
  jsonb_build_object('operation', flow."operation", 'amount', flow."amount")
FROM "BudgetFlow" flow
WHERE flow."taskId" IS NOT NULL
  AND flow."budgetItemId" IS NULL;

INSERT INTO "ActivityLog" (
  "id", "projectId", "targetType", "changeType", "summary", "source", "createdBy"
)
SELECT
  'budget-migration-' || project."id",
  project."id",
  'BUDGET_MIGRATION',
  'IMPORT',
  '预算数据已迁移至独立预算项；原管控事项预算字段保留为兼容数据。',
  'SYSTEM',
  '系统迁移'
FROM "Project" project
WHERE EXISTS (SELECT 1 FROM "BudgetItem" item WHERE item."projectId" = project."id");

ALTER TABLE "BudgetItem"
  ADD CONSTRAINT "BudgetItem_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BudgetItemTaskRelation"
  ADD CONSTRAINT "BudgetItemTaskRelation_budgetItemId_fkey"
  FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "BudgetItemTaskRelation_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BudgetMigrationIssue"
  ADD CONSTRAINT "BudgetMigrationIssue_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BudgetFlow"
  ADD CONSTRAINT "BudgetFlow_budgetItemId_fkey"
  FOREIGN KEY ("budgetItemId") REFERENCES "BudgetItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Project_budgetMode_idx" ON "Project"("budgetMode");
CREATE INDEX "BudgetItem_projectId_status_idx" ON "BudgetItem"("projectId", "status");
CREATE INDEX "BudgetItem_projectId_updatedAt_idx" ON "BudgetItem"("projectId", "updatedAt");
CREATE INDEX "BudgetItem_source_idx" ON "BudgetItem"("source");
CREATE INDEX "BudgetItemTaskRelation_taskId_idx" ON "BudgetItemTaskRelation"("taskId");
CREATE INDEX "BudgetFlow_budgetItemId_createdAt_idx" ON "BudgetFlow"("budgetItemId", "createdAt");
CREATE INDEX "BudgetFlow_action_idx" ON "BudgetFlow"("action");
CREATE INDEX "BudgetMigrationIssue_projectId_resolvedAt_idx" ON "BudgetMigrationIssue"("projectId", "resolvedAt");
CREATE INDEX "BudgetMigrationIssue_flowId_idx" ON "BudgetMigrationIssue"("flowId");
CREATE INDEX "BudgetMigrationIssue_taskId_idx" ON "BudgetMigrationIssue"("taskId");
