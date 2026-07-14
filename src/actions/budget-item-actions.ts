"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertCanManageProject, assertCanWriteProject } from "@/lib/permissions";
import {
  canConfirmBudgetItem,
  isBudgetItemStatus,
  normalizeBudgetItemTaskIds,
  normalizeMoneyInput,
  requiresBudgetChangeReason,
  type BudgetItemStatusValue,
} from "@/lib/budget-rules";
import type { ActionResult } from "@/actions/types";

type BudgetItemInput = {
  projectId: string;
  title: string;
  plannedAmount: number | string;
  category?: string | null;
  description?: string | null;
  taskIds?: string[];
  status?: BudgetItemStatusValue;
  source?: "MANUAL" | "AI_IMPORT" | "MIGRATED";
  aiConfidence?: string | null;
  sourceRef?: string | null;
};

export type BudgetItemBatchInput = {
  projectId: string;
  items: Array<{
    title: string;
    plannedAmount: number | string;
    category?: string | null;
    description?: string | null;
    taskIds?: string[];
    source?: "MANUAL" | "AI_IMPORT" | "MIGRATED";
    aiConfidence?: string | null;
    sourceRef?: string | null;
  }>;
};

function revalidateBudget(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/workspace");
  revalidatePath("/dashboard");
}

function formatMoney(amount: { toNumber: () => number }) {
  return `¥${amount.toNumber().toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function validateTaskIds(projectId: string, taskIds: string[]) {
  const uniqueTaskIds = normalizeBudgetItemTaskIds(taskIds);
  if (uniqueTaskIds.length === 0) return uniqueTaskIds;
  const count = await prisma.task.count({ where: { projectId, id: { in: uniqueTaskIds } } });
  if (count !== uniqueTaskIds.length) throw new Error("关联事项必须属于当前项目。");
  return uniqueTaskIds;
}

/** Creates a draft by default. A budget item may have no related control item. */
export async function createBudgetItem(input: BudgetItemInput): Promise<ActionResult<{ budgetItemId: string }>> {
  const user = await assertCanWriteProject(input.projectId);
  const title = input.title.trim();
  const plannedAmount = normalizeMoneyInput(String(input.plannedAmount));
  const requestedStatus = input.status ?? "DRAFT";

  if (!title) return { success: false, message: "预算项名称不能为空。" };
  if (!plannedAmount || plannedAmount.lte(0)) return { success: false, message: "预算项计划金额必须大于 0。" };
  if (!isBudgetItemStatus(requestedStatus)) return { success: false, message: "预算项状态无效。" };

  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: { ownerId: true, totalBudget: true, budgetMode: true, budgetItems: { select: { plannedAmount: true, status: true } } },
  });
  if (!project) return { success: false, message: "项目不存在。" };
  const taskIds = await validateTaskIds(input.projectId, input.taskIds ?? []);

  if (requestedStatus !== "DRAFT") {
    if (requestedStatus !== "CONFIRMED") {
      return { success: false, message: "新建预算项只能保存为草稿或由项目主负责人确认。" };
    }
    if (project.ownerId !== user.id) return { success: false, message: "只有项目主负责人可以确认预算项。" };
    const decision = canConfirmBudgetItem({
      budgetMode: project.budgetMode,
      proposedPlannedAmount: plannedAmount,
      otherActivePlannedAmount: project.budgetItems
        .filter((item) => item.status !== "CANCELED")
        .reduce((sum, item) => sum.add(item.plannedAmount), plannedAmount.minus(plannedAmount)),
      totalBudget: project.totalBudget,
    });
    if (!decision.allowed) return { success: false, message: decision.message };
  } else if (project.budgetMode === "CONFIRMED") {
    const alreadyPlanned = project.budgetItems
      .filter((item) => item.status !== "CANCELED")
      .reduce((sum, item) => sum.add(item.plannedAmount), plannedAmount.minus(plannedAmount));
    if (alreadyPlanned.add(plannedAmount).gt(project.totalBudget)) {
      return { success: false, message: `预算项合计不能超过项目总预算 ${formatMoney(project.totalBudget)}。` };
    }
  }

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.budgetItem.create({
      data: {
        projectId: input.projectId,
        title,
        plannedAmount,
        category: input.category?.trim() || null,
        description: input.description?.trim() || null,
        status: requestedStatus,
        source: input.source ?? "MANUAL",
        aiConfidence: input.aiConfidence ?? null,
        sourceRef: input.sourceRef ?? null,
        createdBy: user.name,
        taskRelations: taskIds.length ? { create: taskIds.map((taskId) => ({ taskId })) } : undefined,
      },
    });
    await tx.activityLog.create({
      data: {
        projectId: input.projectId,
        targetType: "BUDGET_ITEM",
        targetId: created.id,
        changeType: "CREATE",
        summary: `新增${requestedStatus === "DRAFT" ? "草稿" : "已确认"}预算项：${title} ${formatMoney(plannedAmount)}`,
        afterState: { plannedAmount: plannedAmount.toString(), status: requestedStatus, taskIds },
        source: input.source === "AI_IMPORT" ? "AI" : "HUMAN",
        createdBy: user.name,
      },
    });
    return created;
  });

  revalidateBudget(input.projectId);
  return { success: true, message: "预算项已保存", data: { budgetItemId: item.id } };
}

/**
 * Persists a reviewed paste, spreadsheet, or AI import in one transaction.
 * New rows deliberately remain drafts: importing data must not be confused
 * with a financial confirmation.
 */
export async function createBudgetItems(input: BudgetItemBatchInput): Promise<ActionResult<{ count: number }>> {
  const user = await assertCanWriteProject(input.projectId);
  if (!Array.isArray(input.items) || input.items.length === 0) {
    return { success: false, message: "请至少提供一条预算项。" };
  }
  if (input.items.length > 100) {
    return { success: false, message: "一次最多导入 100 条预算项。" };
  }

  let normalized: Array<Omit<BudgetItemBatchInput["items"][number], "title" | "plannedAmount" | "taskIds"> & { title: string; plannedAmount: NonNullable<ReturnType<typeof normalizeMoneyInput>>; taskIds: string[] }>;

  try {
    normalized = input.items.map((item) => {
      const title = item.title.trim();
      const plannedAmount = normalizeMoneyInput(String(item.plannedAmount));
      if (!title || !plannedAmount || plannedAmount.lte(0)) {
        throw new Error("每条预算项都需要名称和大于 0 的计划金额。");
      }
      return {
        ...item,
        title,
        plannedAmount,
        taskIds: normalizeBudgetItemTaskIds(item.taskIds),
      };
    });
    await prisma.$transaction(async (tx) => {
      const project = await tx.project.findUnique({
        where: { id: input.projectId },
        select: {
          totalBudget: true,
          budgetMode: true,
          budgetItems: { select: { plannedAmount: true, status: true } },
        },
      });
      if (!project) throw new Error("项目不存在。");
      if (project.budgetMode === "NOT_MANAGED") {
        throw new Error("当前项目未启用预算管理，请先确认项目总预算。");
      }

      const taskIds = normalizeBudgetItemTaskIds(normalized.flatMap((item) => item.taskIds));
      if (taskIds.length > 0) {
        const taskCount = await tx.task.count({ where: { projectId: input.projectId, id: { in: taskIds } } });
        if (taskCount !== taskIds.length) throw new Error("关联事项必须属于当前项目。");
      }

      const incomingTotal = normalized.reduce((sum, item) => sum.add(item.plannedAmount), normalized[0].plannedAmount.minus(normalized[0].plannedAmount));
      const existingTotal = project.budgetItems
        .filter((item) => item.status !== "CANCELED")
        .reduce((sum, item) => sum.add(item.plannedAmount), incomingTotal.minus(incomingTotal));
      if (project.budgetMode === "CONFIRMED" && existingTotal.add(incomingTotal).gt(project.totalBudget)) {
        throw new Error(`预算项合计不能超过项目总预算 ${formatMoney(project.totalBudget)}。`);
      }

      const created = await Promise.all(normalized.map((item) => tx.budgetItem.create({
        data: {
          projectId: input.projectId,
          title: item.title,
          plannedAmount: item.plannedAmount,
          category: item.category?.trim() || null,
          description: item.description?.trim() || null,
          status: "DRAFT",
          source: item.source ?? "MANUAL",
          aiConfidence: item.aiConfidence ?? null,
          sourceRef: item.sourceRef ?? null,
          createdBy: user.name,
          taskRelations: item.taskIds.length ? { create: item.taskIds.map((taskId) => ({ taskId })) } : undefined,
        },
      })));

      await tx.activityLog.create({
        data: {
          projectId: input.projectId,
          targetType: "BUDGET_ITEM",
          changeType: "CREATE",
          summary: `批量新增预算草稿：${created.length} 条，共 ${formatMoney(incomingTotal)}`,
          afterState: { budgetItemIds: created.map((item) => item.id), total: incomingTotal.toString() },
          source: normalized.some((item) => item.source === "AI_IMPORT") ? "AI" : "HUMAN",
          createdBy: user.name,
        },
      });
    });
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : "批量新增预算项失败。" };
  }

  revalidateBudget(input.projectId);
  return { success: true, message: `已新增 ${normalized.length} 条预算草稿`, data: { count: normalized.length } };
}

export async function updateBudgetItem(formData: FormData): Promise<ActionResult> {
  const budgetItemId = String(formData.get("budgetItemId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const plannedAmount = normalizeMoneyInput(formData.get("plannedAmount"));
  const category = String(formData.get("category") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const requestedStatus = String(formData.get("status") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const taskIds = formData.getAll("taskIds").map(String);

  if (!title || !plannedAmount || plannedAmount.lte(0) || !isBudgetItemStatus(requestedStatus)) {
    return { success: false, message: "请填写预算项名称、有效金额和状态。" };
  }
  const item = await prisma.budgetItem.findUnique({
    where: { id: budgetItemId },
    include: { project: { select: { id: true, ownerId: true, totalBudget: true, budgetMode: true, budgetItems: { select: { id: true, plannedAmount: true, status: true } } } }, taskRelations: true },
  });
  if (!item) return { success: false, message: "预算项不存在。" };
  const user = await assertCanWriteProject(item.projectId);
  const nextStatus = requestedStatus as BudgetItemStatusValue;
  const amountChanged = !item.plannedAmount.eq(plannedAmount);

  if (requiresBudgetChangeReason({ previousStatus: item.status, nextStatus, amountChanged }) && !reason) {
    return { success: false, message: "修改已确认或已结算预算项时必须说明原因。" };
  }
  if ((nextStatus === "CONFIRMED" || nextStatus === "CANCELED") && item.project.ownerId !== user.id) {
    return { success: false, message: "只有项目主负责人可以确认或取消预算项。" };
  }
  if (item.status === "DRAFT" && !["DRAFT", "CONFIRMED"].includes(nextStatus)) {
    return { success: false, message: "草稿预算项只能保存为草稿或由项目主负责人确认。" };
  }
  if (item.status !== "DRAFT" && nextStatus !== item.status && nextStatus !== "CANCELED") {
    return { success: false, message: "执行中和已结算状态应由预算资金动作推进，不能直接修改。" };
  }
  const uniqueTaskIds = await validateTaskIds(item.projectId, taskIds);
  const otherPlanned = item.project.budgetItems
    .filter((candidate) => candidate.id !== item.id && candidate.status !== "CANCELED")
    .reduce((sum, candidate) => sum.add(candidate.plannedAmount), plannedAmount.minus(plannedAmount));
  if (item.project.budgetMode === "CONFIRMED" && nextStatus !== "CANCELED" && otherPlanned.add(plannedAmount).gt(item.project.totalBudget)) {
    return { success: false, message: `预算项合计不能超过项目总预算 ${formatMoney(item.project.totalBudget)}。` };
  }
  if (nextStatus === "CONFIRMED") {
    const decision = canConfirmBudgetItem({
      budgetMode: item.project.budgetMode,
      proposedPlannedAmount: plannedAmount,
      otherActivePlannedAmount: otherPlanned,
      totalBudget: item.project.totalBudget,
    });
    if (!decision.allowed) return { success: false, message: decision.message };
  }

  await prisma.$transaction(async (tx) => {
    const updated = await tx.budgetItem.update({
      where: { id: item.id },
      data: {
        title,
        plannedAmount,
        category,
        description,
        status: nextStatus,
        taskRelations: {
          deleteMany: {},
          create: uniqueTaskIds.map((taskId) => ({ taskId })),
        },
      },
    });
    const shouldWriteFlow = item.status !== nextStatus || amountChanged;
    const flow = shouldWriteFlow
      ? await tx.budgetFlow.create({
          data: {
            projectId: item.projectId,
            budgetItemId: item.id,
            flowType: "ALLOCATE",
            operation: nextStatus === "CONFIRMED" && item.status === "DRAFT" ? "CONFIRM_ITEM" : "ADJUST_ITEM",
            action: nextStatus === "CONFIRMED" && item.status === "DRAFT" ? "ITEM_CONFIRMED" : nextStatus === "CANCELED" ? "CANCELED" : "ITEM_ADJUSTED",
            amount: plannedAmount,
            description: reason || "更新预算项草稿",
            createdBy: user.name,
          },
        })
      : null;
    await tx.activityLog.create({
      data: {
        projectId: item.projectId,
        targetType: "BUDGET_ITEM",
        targetId: item.id,
        changeType: "UPDATE",
        summary: `${item.title} 已更新${reason ? `\n原因：${reason}` : ""}`,
        beforeState: { title: item.title, plannedAmount: item.plannedAmount.toString(), status: item.status, taskIds: item.taskRelations.map((relation) => relation.taskId) },
        afterState: { title: updated.title, plannedAmount: updated.plannedAmount.toString(), status: updated.status, taskIds: uniqueTaskIds, budgetFlowId: flow?.id ?? null },
        source: "HUMAN",
        createdBy: user.name,
      },
    });
  });

  revalidateBudget(item.projectId);
  return { success: true, message: "预算项已更新" };
}

/** Drafts may be removed for speed; confirmed items must be cancelled instead. */
export async function deleteDraftBudgetItem(budgetItemId: string): Promise<ActionResult> {
  const item = await prisma.budgetItem.findUnique({ where: { id: budgetItemId }, select: { id: true, projectId: true, title: true, status: true } });
  if (!item) return { success: false, message: "预算项不存在。" };
  const user = await assertCanWriteProject(item.projectId);
  if (item.status !== "DRAFT") return { success: false, message: "已确认预算项不能直接删除，请执行取消操作并说明原因。" };

  await prisma.$transaction([
    prisma.activityLog.create({
      data: {
        projectId: item.projectId,
        targetType: "BUDGET_ITEM",
        targetId: item.id,
        changeType: "DELETE",
        summary: `删除草稿预算项：${item.title}`,
        source: "HUMAN",
        createdBy: user.name,
      },
    }),
    prisma.budgetItem.delete({ where: { id: item.id } }),
  ]);
  revalidateBudget(item.projectId);
  return { success: true, message: "草稿预算项已删除" };
}

export async function assertProjectBudgetOwner(projectId: string) {
  return assertCanManageProject(projectId);
}
