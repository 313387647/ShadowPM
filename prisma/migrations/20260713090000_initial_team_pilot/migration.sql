-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('LEADER', 'MEMBER');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "FlowType" AS ENUM ('ALLOCATE', 'EXPENSE', 'REFUND');

-- CreateEnum
CREATE TYPE "ProjectMemberRole" AS ENUM ('EDITOR', 'VIEWER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "totalBudget" DECIMAL(14,2) NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFocus" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFocus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL DEFAULT 'EDITOR',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Phase" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),

    CONSTRAINT "Phase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "phaseId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "notes" TEXT,
    "assignee" TEXT,
    "department" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'P2',
    "deadline" TIMESTAMP(3),
    "status" "TaskStatus" NOT NULL DEFAULT 'PENDING',
    "aiConfidence" TEXT,
    "sourceRef" TEXT,
    "missingFields" JSONB NOT NULL DEFAULT '[]',
    "conflicts" JSONB NOT NULL DEFAULT '[]',
    "needsConfirmation" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgressLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgressLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT,
    "changeType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "beforeState" JSONB,
    "afterState" JSONB,
    "source" TEXT NOT NULL DEFAULT 'HUMAN',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetFlow" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "counterpartyTaskId" TEXT,
    "groupId" TEXT,
    "flowType" "FlowType" NOT NULL,
    "operation" TEXT NOT NULL DEFAULT 'ALLOCATE',
    "amount" DECIMAL(14,2) NOT NULL,
    "description" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BudgetFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecutionCalendarEntry" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "date" TIMESTAMP(3),
    "startTime" TEXT,
    "endTime" TEXT,
    "channel" TEXT,
    "workstream" TEXT,
    "content" TEXT NOT NULL,
    "owner" TEXT,
    "department" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "notes" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecutionCalendarEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectFeedback" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "testerName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "aiAccuracy" TEXT NOT NULL,
    "uploadOutcome" TEXT NOT NULL,
    "wouldUse" TEXT NOT NULL,
    "budgetIssue" BOOLEAN NOT NULL DEFAULT false,
    "calendarIssue" BOOLEAN NOT NULL DEFAULT false,
    "ownerIssue" BOOLEAN NOT NULL DEFAULT false,
    "missingInfo" BOOLEAN NOT NULL DEFAULT false,
    "friction" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectSource" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "extractedText" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectReport" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "sourceSnapshot" JSONB NOT NULL,
    "generatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectShareLink" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSession_tokenHash_key" ON "AuthSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AuthSession_userId_expiresAt_idx" ON "AuthSession"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");

-- CreateIndex
CREATE INDEX "AuthSession_revokedAt_idx" ON "AuthSession"("revokedAt");

-- CreateIndex
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");

-- CreateIndex
CREATE INDEX "Project_createdAt_idx" ON "Project"("createdAt");

-- CreateIndex
CREATE INDEX "ProjectFocus_userId_createdAt_idx" ON "ProjectFocus"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectFocus_projectId_userId_key" ON "ProjectFocus"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE INDEX "ProjectMember_role_idx" ON "ProjectMember"("role");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "Phase_projectId_idx" ON "Phase"("projectId");

-- CreateIndex
CREATE INDEX "Task_projectId_idx" ON "Task"("projectId");

-- CreateIndex
CREATE INDEX "Task_phaseId_idx" ON "Task"("phaseId");

-- CreateIndex
CREATE INDEX "Task_status_idx" ON "Task"("status");

-- CreateIndex
CREATE INDEX "Task_deadline_idx" ON "Task"("deadline");

-- CreateIndex
CREATE INDEX "Task_assignee_idx" ON "Task"("assignee");

-- CreateIndex
CREATE INDEX "Task_projectId_status_deadline_idx" ON "Task"("projectId", "status", "deadline");

-- CreateIndex
CREATE INDEX "ProgressLog_taskId_idx" ON "ProgressLog"("taskId");

-- CreateIndex
CREATE INDEX "ProgressLog_createdAt_idx" ON "ProgressLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_projectId_idx" ON "ActivityLog"("projectId");

-- CreateIndex
CREATE INDEX "ActivityLog_targetType_idx" ON "ActivityLog"("targetType");

-- CreateIndex
CREATE INDEX "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_projectId_createdAt_idx" ON "ActivityLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "BudgetFlow_taskId_idx" ON "BudgetFlow"("taskId");

-- CreateIndex
CREATE INDEX "BudgetFlow_counterpartyTaskId_idx" ON "BudgetFlow"("counterpartyTaskId");

-- CreateIndex
CREATE INDEX "BudgetFlow_groupId_idx" ON "BudgetFlow"("groupId");

-- CreateIndex
CREATE INDEX "BudgetFlow_operation_idx" ON "BudgetFlow"("operation");

-- CreateIndex
CREATE INDEX "BudgetFlow_createdAt_idx" ON "BudgetFlow"("createdAt");

-- CreateIndex
CREATE INDEX "ExecutionCalendarEntry_projectId_idx" ON "ExecutionCalendarEntry"("projectId");

-- CreateIndex
CREATE INDEX "ExecutionCalendarEntry_taskId_idx" ON "ExecutionCalendarEntry"("taskId");

-- CreateIndex
CREATE INDEX "ExecutionCalendarEntry_date_idx" ON "ExecutionCalendarEntry"("date");

-- CreateIndex
CREATE INDEX "ExecutionCalendarEntry_status_idx" ON "ExecutionCalendarEntry"("status");

-- CreateIndex
CREATE INDEX "ExecutionCalendarEntry_channel_idx" ON "ExecutionCalendarEntry"("channel");

-- CreateIndex
CREATE INDEX "ExecutionCalendarEntry_projectId_date_idx" ON "ExecutionCalendarEntry"("projectId", "date");

-- CreateIndex
CREATE INDEX "ProjectFeedback_projectId_idx" ON "ProjectFeedback"("projectId");

-- CreateIndex
CREATE INDEX "ProjectFeedback_createdById_idx" ON "ProjectFeedback"("createdById");

-- CreateIndex
CREATE INDEX "ProjectFeedback_createdAt_idx" ON "ProjectFeedback"("createdAt");

-- CreateIndex
CREATE INDEX "ProjectFeedback_rating_idx" ON "ProjectFeedback"("rating");

-- CreateIndex
CREATE INDEX "ProjectSource_projectId_idx" ON "ProjectSource"("projectId");

-- CreateIndex
CREATE INDEX "ProjectSource_sourceHash_idx" ON "ProjectSource"("sourceHash");

-- CreateIndex
CREATE INDEX "ProjectSource_createdAt_idx" ON "ProjectSource"("createdAt");

-- CreateIndex
CREATE INDEX "ProjectReport_projectId_idx" ON "ProjectReport"("projectId");

-- CreateIndex
CREATE INDEX "ProjectReport_periodType_idx" ON "ProjectReport"("periodType");

-- CreateIndex
CREATE INDEX "ProjectReport_createdAt_idx" ON "ProjectReport"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectShareLink_tokenHash_key" ON "ProjectShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ProjectShareLink_projectId_idx" ON "ProjectShareLink"("projectId");

-- CreateIndex
CREATE INDEX "ProjectShareLink_expiresAt_idx" ON "ProjectShareLink"("expiresAt");

-- CreateIndex
CREATE INDEX "ProjectShareLink_revokedAt_idx" ON "ProjectShareLink"("revokedAt");

-- AddForeignKey
ALTER TABLE "AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFocus" ADD CONSTRAINT "ProjectFocus_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFocus" ADD CONSTRAINT "ProjectFocus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Phase" ADD CONSTRAINT "Phase_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_phaseId_fkey" FOREIGN KEY ("phaseId") REFERENCES "Phase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgressLog" ADD CONSTRAINT "ProgressLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetFlow" ADD CONSTRAINT "BudgetFlow_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionCalendarEntry" ADD CONSTRAINT "ExecutionCalendarEntry_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecutionCalendarEntry" ADD CONSTRAINT "ExecutionCalendarEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFeedback" ADD CONSTRAINT "ProjectFeedback_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectFeedback" ADD CONSTRAINT "ProjectFeedback_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectSource" ADD CONSTRAINT "ProjectSource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectReport" ADD CONSTRAINT "ProjectReport_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectShareLink" ADD CONSTRAINT "ProjectShareLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
