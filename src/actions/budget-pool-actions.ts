"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertCanManageProject } from "@/lib/permissions";
import {
  calculateBudgetPlanningSnapshot,
  isProjectBudgetMode,
  normalizeMoneyInput,
  requiresBudgetChangeReason,
  type ProjectBudgetModeValue,
} from "@/lib/budget-rules";
import type { ActionResult } from "@/actions/types";

function revalidateBudget(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/workspace");
  revalidatePath("/dashboard");
}

function formatMoney(amount: { toNumber: () => number }) {
  return `¥${amount.toNumber().toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Establishes, changes, or disables the project-level budget scope. This is
 * owner-only because it changes the ceiling for every budget item.
 */
export async function setProjectBudgetPool(formData: FormData): Promise<ActionResult> {
  const projectId = String(formData.get("projectId") ?? "");
  const requestedMode = String(formData.get("budgetMode") ?? "");
  const requestedAmount = normalizeMoneyInput(formData.get("totalBudget"));
  const reason = String(formData.get("reason") ?? "").trim();
  const user = await assertCanManageProject(projectId);

  if (!isProjectBudgetMode(requestedMode)) {
    return { success: false, message: "请选择明确预算、预算待确认或不管理预算。" };
  }
  if (requestedMode === "CONFIRMED" && (!requestedAmount || requestedAmount.lte(0))) {
    return { success: false, message: "确认项目总预算时，金额必须大于 0。" };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      totalBudget: true,
      budgetMode: true,
      budgetItems: { select: { plannedAmount: true, status: true } },
    },
  });
  if (!project) return { success: false, message: "项目不存在。" };

  const nextMode = requestedMode as ProjectBudgetModeValue;
  // Pending and unmanaged projects intentionally carry no synthetic 0-yuan budget.
  const amount = nextMode === "CONFIRMED" ? requestedAmount! : normalizeMoneyInput("0")!;
  const poolWasConfirmed = project.budgetMode === "CONFIRMED";
  const amountChanged = !project.totalBudget.eq(amount);
  if (requiresBudgetChangeReason({
    previousStatus: project.budgetMode,
    nextStatus: nextMode,
    amountChanged,
    isProjectPool: true,
    poolWasConfirmed,
  }) && !reason) {
    return { success: false, message: "修改已确认项目总预算时必须说明原因。" };
  }

  const nextSnapshot = calculateBudgetPlanningSnapshot({
    budgetMode: nextMode,
    totalBudget: amount,
    items: project.budgetItems,
    flows: [],
  });
  if (nextMode === "CONFIRMED" && nextSnapshot.overPlanned) {
    return {
      success: false,
      message: `项目总预算不能低于已编排预算 ${formatMoney(nextSnapshot.planned)}。请先调整或取消预算项。`,
    };
  }
  if (nextMode === "NOT_MANAGED" && nextSnapshot.planned.gt(0)) {
    return { success: false, message: "已有预算项，不能直接关闭预算管理。请先取消或删除预算项。" };
  }

  const shouldWriteFlow = nextMode === "CONFIRMED" && (project.budgetMode !== "CONFIRMED" || amountChanged);
  const action = project.budgetMode === "CONFIRMED" ? "POOL_ADJUSTED" : "POOL_CONFIRMED";
  const summary = nextMode === "NOT_MANAGED"
    ? "项目已标记为不管理预算"
    : nextMode === "PENDING"
      ? "项目预算改为待确认"
      : project.budgetMode === "CONFIRMED"
        ? `项目总预算调整：${formatMoney(project.totalBudget)} → ${formatMoney(amount)}`
        : `项目总预算已确认：${formatMoney(amount)}`;

  await prisma.$transaction(async (tx) => {
    const flow = shouldWriteFlow
      ? await tx.budgetFlow.create({
          data: {
            projectId,
            flowType: "ALLOCATE",
            operation: action === "POOL_CONFIRMED" ? "CONFIRM_POOL" : "ADJUST_POOL",
            action,
            amount,
            description: reason || (action === "POOL_CONFIRMED" ? "确认项目总预算" : "调整项目总预算"),
            createdBy: user.name,
          },
        })
      : null;

    await tx.project.update({
      where: { id: projectId },
      data: {
        totalBudget: amount,
        budgetMode: nextMode,
        budgetConfirmedAt: nextMode === "CONFIRMED" ? project.budgetMode === "CONFIRMED" ? undefined : new Date() : null,
        // Compatibility only. New budget code reads budgetMode.
        budgetStatus: nextMode === "CONFIRMED" ? "CONFIRMED" : "UNCONFIRMED",
      },
    });
    await tx.activityLog.create({
      data: {
        projectId,
        targetType: "BUDGET_POOL",
        targetId: flow?.id,
        changeType: project.budgetMode === nextMode ? "UPDATE" : "STATUS_CHANGE",
        summary: reason ? `${summary}\n原因：${reason}` : summary,
        beforeState: { amount: project.totalBudget.toString(), mode: project.budgetMode },
        afterState: { amount: amount.toString(), mode: nextMode, budgetFlowId: flow?.id ?? null },
        source: "HUMAN",
        createdBy: user.name,
      },
    });
  });

  revalidateBudget(projectId);
  return { success: true, message: summary };
}
