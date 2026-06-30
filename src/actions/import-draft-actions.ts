"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertCanReadProject, assertCanWriteProject } from "@/lib/permissions";
import type { ActionResult } from "@/actions/types";

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

type BudgetCandidate = {
  title?: string;
  amount?: number | null;
  type?: string | null;
  workstream?: string | null;
  status?: string | null;
  description?: string | null;
  applied?: boolean;
  appliedAt?: string;
  appliedBy?: string;
  appliedFlowId?: string;
};

type RiskCandidate = {
  title?: string;
  description?: string | null;
  type?: string | null;
  level?: string | null;
  status?: string | null;
  owner?: string | null;
  relatedItemName?: string | null;
  applied?: boolean;
  appliedAt?: string;
  appliedBy?: string;
  appliedRiskId?: string;
};

type CalendarCandidate = {
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  channel?: string | null;
  workstream?: string | null;
  content?: string;
  owner?: string | null;
  department?: string | null;
  status?: string | null;
  notes?: string | null;
  applied?: boolean;
  appliedAt?: string;
  appliedBy?: string;
  appliedCalendarEntryId?: string;
};

const FLOW_TYPES = ["ALLOCATE", "EXPENSE", "REFUND"] as const;
const FLOW_TO_OPERATION = {
  ALLOCATE: "ALLOCATE",
  EXPENSE: "EXPENSE",
  REFUND: "REFUND",
} as const;
const BUDGET_TYPES_REQUIRING_MANUAL_FLOW = ["ESTIMATE", "TRANSFER"] as const;
const RISK_TYPES = ["BUDGET", "SCHEDULE", "RESOURCE", "SCOPE", "COMMUNICATION", "OTHER"] as const;
const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const CALENDAR_STATUSES = ["PLANNED", "CONFIRMED", "DONE", "CANCELED"] as const;

function normalizeRiskType(type: string | null | undefined) {
  const normalized = type?.trim().toUpperCase();
  return RISK_TYPES.includes(normalized as (typeof RISK_TYPES)[number])
    ? normalized ?? "OTHER"
    : "OTHER";
}

function normalizeRiskLevel(level: string | null | undefined) {
  const normalized = level?.trim().toUpperCase();
  return RISK_LEVELS.includes(normalized as (typeof RISK_LEVELS)[number])
    ? normalized ?? "MEDIUM"
    : "MEDIUM";
}

function normalizeCalendarStatus(status: string | null | undefined) {
  const normalized = status?.trim().toUpperCase();
  return CALENDAR_STATUSES.includes(normalized as (typeof CALENDAR_STATUSES)[number])
    ? normalized ?? "PLANNED"
    : "PLANNED";
}

function parseDateSafe(dateRaw: string | null | undefined): Date | null {
  if (!dateRaw) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
    ? new Date(`${dateRaw}T00:00:00.000Z`)
    : null;
}

function normalizeBudgetCandidateType(type: string | null | undefined) {
  return type?.trim().toUpperCase() ?? "";
}

export async function getPendingImportDrafts(projectId: string) {
  await assertCanReadProject(projectId);

  const drafts = await prisma.importDraft.findMany({
    where: {
      projectId,
      status: "PENDING",
    },
    orderBy: { createdAt: "desc" },
  });

  return drafts.map((draft) => {
    const budgetItems = asArray(draft.budgetItems);
    const calendarEntries = asArray(draft.calendarEntries);
    const risks = asArray(draft.risks);

    return {
      id: draft.id,
      sourceType: draft.sourceType,
      sourceQuality: draft.sourceQuality,
      confidence: draft.confidence,
      budgetCount: budgetItems.filter((item) => !(item as BudgetCandidate).applied).length,
      calendarCount: calendarEntries.filter((item) => !(item as CalendarCandidate).applied).length,
      riskCount: risks.filter((item) => !(item as RiskCandidate).applied).length,
      budgetPreview: budgetItems
        .map((item, index) => ({ ...(item as BudgetCandidate), candidateIndex: index }))
        .filter((item) => !item.applied),
      calendarPreview: calendarEntries
        .map((item, index) => ({ ...(item as CalendarCandidate), candidateIndex: index }))
        .filter((item) => !item.applied),
      riskPreview: risks
        .map((item, index) => ({ ...(item as RiskCandidate), candidateIndex: index }))
        .filter((item) => !item.applied),
      createdBy: draft.createdBy,
      createdAt: draft.createdAt,
    };
  });
}

export async function applyBudgetImportCandidate(
  formData: FormData
): Promise<ActionResult> {
  const draftId = formData.get("draftId") as string;
  const indexRaw = formData.get("candidateIndex") as string;
  const taskId = formData.get("taskId") as string;
  const flowTypeRaw = formData.get("flowType") as string;

  const candidateIndex = Number(indexRaw);
  const flowType = FLOW_TYPES.includes(flowTypeRaw as (typeof FLOW_TYPES)[number])
    ? (flowTypeRaw as (typeof FLOW_TYPES)[number])
    : null;

  if (!draftId || !Number.isInteger(candidateIndex) || candidateIndex < 0 || !taskId || !flowType) {
    return { success: false, message: "预算候选、管控事项和流水类型为必填项" };
  }

  const draft = await prisma.importDraft.findUnique({
    where: { id: draftId },
  });
  if (!draft || draft.status !== "PENDING") {
    return { success: false, message: "导入候选不存在或已处理" };
  }
  const user = await assertCanWriteProject(draft.projectId);

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, name: true, projectId: true },
  });
  if (!task || task.projectId !== draft.projectId) {
    return { success: false, message: "所选管控事项不属于当前项目" };
  }

  const budgetItems = asArray(draft.budgetItems) as BudgetCandidate[];
  const candidate = budgetItems[candidateIndex];
  if (!candidate) return { success: false, message: "预算候选不存在" };
  if (candidate.applied) return { success: false, message: "预算候选已入账" };
  if (typeof candidate.amount !== "number" || candidate.amount <= 0) {
    return { success: false, message: "预算候选金额无效，暂不能入账" };
  }
  const candidateType = normalizeBudgetCandidateType(candidate.type);
  if (BUDGET_TYPES_REQUIRING_MANUAL_FLOW.includes(candidateType as (typeof BUDGET_TYPES_REQUIRING_MANUAL_FLOW)[number]) && flowTypeRaw === candidateType) {
    return { success: false, message: "预算估算或转移候选必须先选择分配、支出或退款类型" };
  }

  const candidateAmount = candidate.amount;
  let amount = new Prisma.Decimal(candidateAmount.toString());
  if (flowType === "EXPENSE") amount = amount.negated();

  const flow = await prisma.$transaction(async (tx) => {
    const createdFlow = await tx.budgetFlow.create({
      data: {
        taskId,
        flowType,
        operation: FLOW_TO_OPERATION[flowType],
        amount,
        description: `AI 导入预算候选确认：${candidate.title ?? "未命名预算项"}`,
        createdBy: user.name,
      },
    });

    const nextBudgetItems = budgetItems.map((item, index) =>
      index === candidateIndex
        ? {
            ...item,
            applied: true,
            appliedAt: new Date().toISOString(),
            appliedBy: user.name,
            appliedFlowId: createdFlow.id,
          }
        : item
    );

    await tx.importDraft.update({
      where: { id: draftId },
      data: { budgetItems: nextBudgetItems },
    });

    await tx.progressLog.create({
      data: {
        taskId,
        createdBy: user.name,
        content: `💰 AI 导入预算候选已确认入账：${candidate.title ?? "未命名预算项"}（${flowType}，¥${candidateAmount.toLocaleString("zh-CN")}）`,
      },
    });

    await tx.activityLog.create({
      data: {
        projectId: task.projectId,
        targetType: "BUDGET_ITEM",
        targetId: createdFlow.id,
        changeType: "IMPORT",
        source: "IMPORT",
        createdBy: user.name,
        summary: [
          `💰 AI 导入预算候选已确认入账：${candidate.title ?? "未命名预算项"}`,
          `流水：${flowType}｜金额：¥${candidateAmount.toLocaleString("zh-CN")}｜关联事项：${task.name}`,
        ].join("\n"),
        beforeState: candidate as Prisma.InputJsonObject,
        afterState: {
          flowId: createdFlow.id,
          flowType,
          amount: candidateAmount,
          taskId,
          taskName: task.name,
        },
      },
    });

    return createdFlow;
  });

  revalidatePath(`/projects/${task.projectId}`);
  return { success: true, message: `预算候选已入账：${flow.id}` };
}

export async function applyRiskImportCandidate(
  formData: FormData
): Promise<ActionResult> {
  const draftId = formData.get("draftId") as string;
  const indexRaw = formData.get("candidateIndex") as string;
  const candidateIndex = Number(indexRaw);

  if (!draftId || !Number.isInteger(candidateIndex) || candidateIndex < 0) {
    return { success: false, message: "风险候选为必填项" };
  }

  const draft = await prisma.importDraft.findUnique({
    where: { id: draftId },
    select: { id: true, projectId: true, status: true, risks: true },
  });
  if (!draft || draft.status !== "PENDING") {
    return { success: false, message: "导入候选不存在或已处理" };
  }
  const user = await assertCanWriteProject(draft.projectId);

  const risks = asArray(draft.risks) as RiskCandidate[];
  const candidate = risks[candidateIndex];
  if (!candidate) return { success: false, message: "风险候选不存在" };
  if (candidate.applied) return { success: false, message: "风险候选已确认" };

  const title = candidate.title?.trim() || "未命名风险";
  const description = candidate.description?.trim() || title;
  const type = normalizeRiskType(candidate.type);
  const level = normalizeRiskLevel(candidate.level);

  const risk = await prisma.$transaction(async (tx) => {
    const createdRisk = await tx.risk.create({
      data: {
        projectId: draft.projectId,
        title,
        type,
        level,
        description,
        suggestion: candidate.relatedItemName
          ? `建议优先关联并核对「${candidate.relatedItemName}」的责任人、截止日期和预算影响。`
          : "建议确认责任人、影响范围和下一步处理动作。",
        status: "OPEN",
        source: "AI_IMPORT",
      },
    });

    const nextRisks = risks.map((item, index) =>
      index === candidateIndex
        ? {
            ...item,
            applied: true,
            appliedAt: new Date().toISOString(),
            appliedBy: user.name,
            appliedRiskId: createdRisk.id,
          }
        : item
    );

    await tx.importDraft.update({
      where: { id: draftId },
      data: { risks: nextRisks },
    });

    await tx.activityLog.create({
      data: {
        projectId: draft.projectId,
        targetType: "RISK",
        targetId: createdRisk.id,
        changeType: "IMPORT",
        source: "IMPORT",
        createdBy: user.name,
        summary: `⚠️ AI 导入风险候选已确认：${title}`,
        beforeState: candidate as Prisma.InputJsonObject,
        afterState: {
          riskId: createdRisk.id,
          title,
          type,
          level,
          status: "OPEN",
        },
      },
    });

    return createdRisk;
  });

  revalidatePath(`/projects/${draft.projectId}`);
  return { success: true, message: `风险已确认：${risk.id}` };
}

export async function applyCalendarImportCandidate(
  formData: FormData
): Promise<ActionResult> {
  const draftId = formData.get("draftId") as string;
  const indexRaw = formData.get("candidateIndex") as string;
  const candidateIndex = Number(indexRaw);

  if (!draftId || !Number.isInteger(candidateIndex) || candidateIndex < 0) {
    return { success: false, message: "日历候选为必填项" };
  }

  const draft = await prisma.importDraft.findUnique({
    where: { id: draftId },
    select: { id: true, projectId: true, status: true, calendarEntries: true },
  });
  if (!draft || draft.status !== "PENDING") {
    return { success: false, message: "导入候选不存在或已处理" };
  }
  const user = await assertCanWriteProject(draft.projectId);

  const calendarEntries = asArray(draft.calendarEntries) as CalendarCandidate[];
  const candidate = calendarEntries[candidateIndex];
  if (!candidate) return { success: false, message: "日历候选不存在" };
  if (candidate.applied) return { success: false, message: "日历候选已确认" };

  const content = candidate.content?.trim();
  if (!content) return { success: false, message: "日历候选内容为空，暂不能确认" };

  const calendarEntry = await prisma.$transaction(async (tx) => {
    const createdEntry = await tx.executionCalendarEntry.create({
      data: {
        projectId: draft.projectId,
        date: parseDateSafe(candidate.date),
        startTime: candidate.startTime?.trim() || null,
        endTime: candidate.endTime?.trim() || null,
        channel: candidate.channel?.trim() || null,
        workstream: candidate.workstream?.trim() || null,
        content,
        owner: candidate.owner?.trim() || null,
        department: candidate.department?.trim() || null,
        status: normalizeCalendarStatus(candidate.status),
        notes: candidate.notes?.trim() || null,
        source: "AI_IMPORT",
        createdBy: user.name,
      },
    });

    const nextCalendarEntries = calendarEntries.map((item, index) =>
      index === candidateIndex
        ? {
            ...item,
            applied: true,
            appliedAt: new Date().toISOString(),
            appliedBy: user.name,
            appliedCalendarEntryId: createdEntry.id,
          }
        : item
    );

    await tx.importDraft.update({
      where: { id: draftId },
      data: { calendarEntries: nextCalendarEntries },
    });

    await tx.activityLog.create({
      data: {
        projectId: draft.projectId,
        targetType: "CALENDAR_ENTRY",
        targetId: createdEntry.id,
        changeType: "IMPORT",
        source: "IMPORT",
        createdBy: user.name,
        summary: [
          `📆 AI 导入日历候选已确认：${content}`,
          `时间：${candidate.date ?? "日期待确认"}${candidate.startTime ? ` ${candidate.startTime}` : ""}`,
          `渠道：${candidate.channel ?? "待确认"}｜工作流：${candidate.workstream ?? "待确认"}`,
        ].join("\n"),
        beforeState: candidate as Prisma.InputJsonObject,
        afterState: {
          calendarEntryId: createdEntry.id,
          content,
          date: candidate.date ?? null,
          startTime: candidate.startTime ?? null,
          channel: candidate.channel ?? null,
          workstream: candidate.workstream ?? null,
        },
      },
    });

    return createdEntry;
  });

  revalidatePath(`/projects/${draft.projectId}`);
  return { success: true, message: `日历候选已确认：${calendarEntry.id}` };
}
