-- Control-item order is intentional and independent from status, priority, or
-- module. Existing projects keep their former module/priority/name order once.
ALTER TABLE "Task" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

WITH ranked_tasks AS (
  SELECT
    task."id",
    ROW_NUMBER() OVER (
      PARTITION BY task."projectId"
      ORDER BY phase."sortOrder" ASC NULLS LAST, task."priority" ASC, task."name" ASC, task."id" ASC
    ) - 1 AS "sortOrder"
  FROM "Task" task
  LEFT JOIN "Phase" phase ON phase."id" = task."phaseId"
)
UPDATE "Task" task
SET "sortOrder" = ranked_tasks."sortOrder"
FROM ranked_tasks
WHERE task."id" = ranked_tasks."id";

CREATE INDEX "Task_projectId_sortOrder_idx" ON "Task"("projectId", "sortOrder");
