-- External tester data stays in the shared database but never participates in
-- the internal portfolio, team, or leader dashboard scope.
ALTER TABLE "User" ADD COLUMN "isExternalTester" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Project" ADD COLUMN "isExternalProject" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Project_isExternalProject_idx" ON "Project"("isExternalProject");
