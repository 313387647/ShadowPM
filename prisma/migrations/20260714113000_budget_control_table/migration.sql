-- Budget is now modeled as current state plus an append-only audit trail.
-- A project pool no longer needs a fake "project coordination" control item.
CREATE TYPE "ProjectBudgetStatus" AS ENUM ('UNCONFIRMED', 'CONFIRMED', 'CANCELED');
CREATE TYPE "TaskBudgetStatus" AS ENUM ('UNALLOCATED', 'ALLOCATED', 'APPROVED', 'DISBURSED', 'ACCEPTED', 'CANCELED');

ALTER TABLE "Project"
  ADD COLUMN "budgetStatus" "ProjectBudgetStatus" NOT NULL DEFAULT 'UNCONFIRMED',
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Project"
SET "budgetStatus" = CASE
  WHEN "totalBudget" > 0 THEN 'CONFIRMED'::"ProjectBudgetStatus"
  ELSE 'UNCONFIRMED'::"ProjectBudgetStatus"
END;

ALTER TABLE "Task"
  ADD COLUMN "budgetAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN "budgetStatus" "TaskBudgetStatus" NOT NULL DEFAULT 'UNALLOCATED',
  ADD COLUMN "budgetRecipient" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "BudgetFlow"
  ADD COLUMN "projectId" TEXT,
  ADD COLUMN "counterparty" TEXT;

UPDATE "BudgetFlow" AS flow
SET "projectId" = task."projectId"
FROM "Task" AS task
WHERE flow."taskId" = task."id";

ALTER TABLE "BudgetFlow"
  ALTER COLUMN "projectId" SET NOT NULL,
  ALTER COLUMN "taskId" DROP NOT NULL;

ALTER TABLE "BudgetFlow" DROP CONSTRAINT "BudgetFlow_taskId_fkey";
ALTER TABLE "BudgetFlow"
  ADD CONSTRAINT "BudgetFlow_taskId_fkey"
  FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BudgetFlow"
  ADD CONSTRAINT "BudgetFlow_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "BudgetFlow_projectId_createdAt_idx" ON "BudgetFlow"("projectId", "createdAt");

-- Preserve only unambiguous legacy item allocations as current item state.
-- Legacy CONFIRM rows represented a project pool and deliberately remain audit-only.
WITH task_allocations AS (
  SELECT task."projectId", flow."taskId", SUM(flow.amount) AS amount
  FROM "BudgetFlow" AS flow
  JOIN "Task" AS task ON task."id" = flow."taskId"
  WHERE flow.operation = 'ALLOCATE' AND flow.amount > 0
  GROUP BY task."projectId", flow."taskId"
), project_allocations AS (
  SELECT "projectId", SUM(amount) AS amount
  FROM task_allocations
  GROUP BY "projectId"
)
UPDATE "Task" AS task
SET "budgetAmount" = allocation.amount,
    "budgetStatus" = 'ALLOCATED'::"TaskBudgetStatus"
FROM task_allocations AS allocation
JOIN project_allocations AS project_total ON project_total."projectId" = allocation."projectId"
JOIN "Project" AS project ON project."id" = allocation."projectId"
WHERE task."id" = allocation."taskId"
  AND project_total.amount <= project."totalBudget";
