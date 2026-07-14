"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertCanWriteProject } from "@/lib/permissions";
import { isBudgetFlowAction, normalizeMoneyInput, type BudgetFlowActionValue } from "@/lib/budget-rules";
import type { ActionResult } from "@/actions/types";

const ITEM_FLOW_ACTIONS = new Set<BudgetFlowActionValue>([
  "APPROVAL_RECORDED",
  "TRANSFER_RECORDED",
  "EXPENSE_RECORDED",
  "REFUND_RECORDED",
  "SETTLED",
  "REVERSED",
]);

function revalidateBudget(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/workspace");
  revalidatePath("/dashboard");
}

/** Records an append-only cash or approval event against one independent item. */
export async function recordBudgetFlow(formData: FormData): Promise<ActionResult<{ budgetFlowId: string }>> {
  const budgetItemId = String(formData.get("budgetItemId") ?? "");
  const requestedAction = String(formData.get("action") ?? "");
  const amount = normalizeMoneyInput(formData.get("amount"));
  const counterparty = String(formData.get("counterparty") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim();

  if (!isBudgetFlowAction(requestedAction) || !ITEM_FLOW_ACTIONS.has(requestedAction)) {
    return { success: false, message: "请选择有效的预算资金动作。" };
  }
  if (!amount || amount.lte(0) || !description) {
    return { success: false, message: "资金动作金额和说明均为必填项。" };
  }
  if (requestedAction === "TRANSFER_RECORDED" && !counterparty) {
    return { success: false, message: "记录划拨时必须填写接收部门或合作方。" };
  }

  const item = await prisma.budgetItem.findUnique({
    where: { id: budgetItemId },
    select: { id: true, title: true, projectId: true, status: true },
  });
  if (!item) return { success: false, message: "预算项不存在。" };
  const user = await assertCanWriteProject(item.projectId);
  if (item.status === "DRAFT" || item.status === "CANCELED") {
    return { success: false, message: "请先确认预算项，已取消预算项不能继续记录资金动作。" };
  }

  const action = requestedAction as BudgetFlowActionValue;
  const flowType = action === "EXPENSE_RECORDED" ? "EXPENSE" : action === "REFUND_RECORDED" ? "REFUND" : "ALLOCATE";
  const operation = action.replace(/_RECORDED$/, "");

  const flow = await prisma.$transaction(async (tx) => {
    const created = await tx.budgetFlow.create({
      data: {
        projectId: item.projectId,
        budgetItemId: item.id,
        flowType,
        operation,
        action,
        amount,
        counterparty,
        description,
        createdBy: user.name,
      },
    });
    const nextItemStatus = action === "SETTLED"
      ? "SETTLED"
      : item.status === "CONFIRMED" && action !== "REVERSED"
        ? "IN_PROGRESS"
        : item.status;
    if (nextItemStatus !== item.status) {
      await tx.budgetItem.update({ where: { id: item.id }, data: { status: nextItemStatus } });
    }
    await tx.activityLog.create({
      data: {
        projectId: item.projectId,
        targetType: "BUDGET_FLOW",
        targetId: created.id,
        changeType: "CREATE",
        summary: `预算动作：${item.title} / ${action} / ¥${amount.toNumber().toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n说明：${description}`,
        afterState: { budgetItemId: item.id, action, amount: amount.toString(), counterparty },
        source: "HUMAN",
        createdBy: user.name,
      },
    });
    return created;
  });

  revalidateBudget(item.projectId);
  return { success: true, message: "资金动作已记录", data: { budgetFlowId: flow.id } };
}
