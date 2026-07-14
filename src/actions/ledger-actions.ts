"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertCanReadProject, assertCanWriteProject, assertCanWriteTask } from "@/lib/permissions";
import type { ActionResult } from "@/actions/types";

const ACTIVE_TASK_BUDGET_STATUSES = ["ALLOCATED", "APPROVED", "DISBURSED", "ACCEPTED"] as const;
const TASK_BUDGET_STATUSES = ["UNALLOCATED", "ALLOCATED", "APPROVED", "DISBURSED", "ACCEPTED", "CANCELED"] as const;
const PROJECT_BUDGET_STATUSES = ["UNCONFIRMED", "CONFIRMED", "CANCELED"] as const;

function parseMoney(value: FormDataEntryValue | null) {
  const amount = new Prisma.Decimal(typeof value === "string" ? value : "");
  return amount.isNaN() || amount.lt(0) ? null : amount;
}

function isActiveBudgetStatus(status: string) {
  return ACTIVE_TASK_BUDGET_STATUSES.includes(status as (typeof ACTIVE_TASK_BUDGET_STATUSES)[number]);
}

function formatMoney(value: Prisma.Decimal) {
  return `¥${value.toNumber().toLocaleString("zh-CN")}`;
}

function revalidateBudget(projectId: string) {
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/workspace");
  revalidatePath("/dashboard");
}

/** The read model for the concise budget-control table. */
export async function getProjectBudgetControl(projectId: string) {
  await assertCanReadProject(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      totalBudget: true,
      budgetStatus: true,
      tasks: {
        select: {
          id: true,
          name: true,
          status: true,
          budgetAmount: true,
          budgetStatus: true,
          budgetRecipient: true,
          updatedAt: true,
          phase: { select: { name: true } },
        },
        orderBy: [{ status: "asc" }, { name: "asc" }],
      },
    },
  });
  if (!project) return null;

  const confirmedPool = project.budgetStatus === "CONFIRMED" ? project.totalBudget : new Prisma.Decimal(0);
  const allocated = project.tasks.reduce(
    (sum, task) => isActiveBudgetStatus(task.budgetStatus) ? sum.add(task.budgetAmount) : sum,
    new Prisma.Decimal(0)
  );
  const disbursed = project.tasks.reduce(
    (sum, task) => task.budgetStatus === "DISBURSED" ? sum.add(task.budgetAmount) : sum,
    new Prisma.Decimal(0)
  );

  return {
    projectId: project.id,
    pool: {
      amount: project.totalBudget.toNumber(),
      confirmedAmount: confirmedPool.toNumber(),
      status: project.budgetStatus,
    },
    allocated: allocated.toNumber(),
    remaining: confirmedPool.sub(allocated).toNumber(),
    disbursed: disbursed.toNumber(),
    tasks: project.tasks.map((task) => ({
      id: task.id,
      name: task.name,
      projectStatus: task.status,
      workstream: task.phase?.name ?? null,
      budgetAmount: task.budgetAmount.toNumber(),
      budgetStatus: task.budgetStatus,
      budgetRecipient: task.budgetRecipient,
      updatedAt: task.updatedAt.toISOString(),
    })),
  };
}

/** Small selector read model shared by timeline and calendar forms. */
export async function getProjectTasksForSelect(projectId: string) {
  await assertCanReadProject(projectId);
  const tasks = await prisma.task.findMany({
    where: { projectId },
    select: { id: true, name: true, status: true, phase: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
  return tasks.map((task) => ({
    id: task.id,
    name: task.name,
    status: task.status,
    workstream: task.phase?.name ?? null,
  }));
}

/** Confirm, adjust, or cancel a project budget pool. A reason is always required. */
export async function updateProjectBudgetPool(formData: FormData): Promise<ActionResult> {
  const projectId = String(formData.get("projectId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const nextStatus = String(formData.get("budgetStatus") ?? "") as "UNCONFIRMED" | "CONFIRMED" | "CANCELED";
  const amount = parseMoney(formData.get("amount"));
  const user = await assertCanWriteProject(projectId);

  if (!projectId || !reason || !PROJECT_BUDGET_STATUSES.includes(nextStatus)) {
    return { success: false, message: "预算池状态、金额和调整原因均为必填项" };
  }
  if (!amount) return { success: false, message: "预算金额不能为负数" };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      totalBudget: true,
      budgetStatus: true,
      tasks: { select: { budgetAmount: true, budgetStatus: true } },
    },
  });
  if (!project) return { success: false, message: "项目不存在" };

  const allocated = project.tasks.reduce(
    (sum, task) => isActiveBudgetStatus(task.budgetStatus) ? sum.add(task.budgetAmount) : sum,
    new Prisma.Decimal(0)
  );
  if (nextStatus === "CONFIRMED" && amount.lt(allocated)) {
    return { success: false, message: `预算池不能低于已分配的 ${formatMoney(allocated)}；请先调减、拆分或取消事项预算。` };
  }
  if (nextStatus === "CANCELED" && allocated.gt(0)) {
    return { success: false, message: "仍有事项预算未收回。请先将事项预算调为未分配或已取消，再取消项目预算池。" };
  }
  if (nextStatus === "CANCELED" && amount.gt(0)) {
    return { success: false, message: "取消预算池时金额必须为 0。" };
  }

  const operation = nextStatus === "CANCELED"
    ? "CANCEL_POOL"
    : project.budgetStatus === "UNCONFIRMED" && nextStatus === "CONFIRMED"
      ? "CONFIRM_POOL"
      : "ADJUST_POOL";

  await prisma.$transaction(async (tx) => {
    const flow = await tx.budgetFlow.create({
      data: {
        projectId,
        flowType: "ALLOCATE",
        operation,
        amount,
        description: reason,
        createdBy: user.name,
      },
    });
    await tx.project.update({
      where: { id: projectId },
      data: { totalBudget: amount, budgetStatus: nextStatus },
    });
    await tx.activityLog.create({
      data: {
        projectId,
        targetType: "BUDGET_POOL",
        targetId: flow.id,
        changeType: "UPDATE",
        source: "HUMAN",
        createdBy: user.name,
        summary: `预算池${operation === "CONFIRM_POOL" ? "已确认" : operation === "CANCEL_POOL" ? "已取消" : "已调整"}：${formatMoney(project.totalBudget)} → ${formatMoney(amount)}\n原因：${reason}`,
        beforeState: { amount: project.totalBudget.toString(), budgetStatus: project.budgetStatus },
        afterState: { amount: amount.toString(), budgetStatus: nextStatus, budgetFlowId: flow.id },
      },
    });
  });

  revalidateBudget(projectId);
  return { success: true, message: nextStatus === "CONFIRMED" ? "项目预算池已确认" : nextStatus === "CANCELED" ? "项目预算池已取消" : "项目预算池已调整" };
}

/** Set the current amount and execution state of one control item. */
export async function updateTaskBudget(formData: FormData): Promise<ActionResult> {
  const taskId = String(formData.get("taskId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const requestedStatus = String(formData.get("budgetStatus") ?? "") as "UNALLOCATED" | "ALLOCATED" | "APPROVED" | "DISBURSED" | "ACCEPTED" | "CANCELED";
  const amount = parseMoney(formData.get("amount"));
  const recipient = String(formData.get("budgetRecipient") ?? "").trim() || null;
  const { user } = await assertCanWriteTask(taskId);

  if (!reason || !TASK_BUDGET_STATUSES.includes(requestedStatus) || !amount) {
    return { success: false, message: "预算金额、预算状态和调整原因均为必填项" };
  }
  const nextAmount = ["UNALLOCATED", "CANCELED"].includes(requestedStatus) ? new Prisma.Decimal(0) : amount;
  if (isActiveBudgetStatus(requestedStatus) && nextAmount.lte(0)) {
    return { success: false, message: "已分配、已报批、已划拨或已验收的事项必须保留大于 0 的预算。" };
  }
  if (requestedStatus === "DISBURSED" && !recipient) {
    return { success: false, message: "划拨到第三方时必须填写收款部门或合作方。" };
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      projectId: true,
      name: true,
      budgetAmount: true,
      budgetStatus: true,
      budgetRecipient: true,
      project: { select: { totalBudget: true, budgetStatus: true, tasks: { select: { id: true, budgetAmount: true, budgetStatus: true } } } },
    },
  });
  if (!task) return { success: false, message: "管控事项不存在" };
  if (task.project.budgetStatus !== "CONFIRMED") {
    return { success: false, message: "请先确认项目预算池，再为具体事项分配预算。" };
  }

  const otherAllocated = task.project.tasks.reduce(
    (sum, item) => item.id !== task.id && isActiveBudgetStatus(item.budgetStatus) ? sum.add(item.budgetAmount) : sum,
    new Prisma.Decimal(0)
  );
  if (otherAllocated.add(isActiveBudgetStatus(requestedStatus) ? nextAmount : 0).gt(task.project.totalBudget)) {
    return { success: false, message: `事项预算合计不能超过项目预算池 ${formatMoney(task.project.totalBudget)}。` };
  }

  const operation = requestedStatus === "CANCELED"
    ? "CANCEL"
    : requestedStatus === "UNALLOCATED"
      ? "RETURN"
      : requestedStatus === "APPROVED"
        ? "APPROVE"
        : requestedStatus === "DISBURSED"
          ? "DISBURSE"
          : requestedStatus === "ACCEPTED"
            ? "ACCEPT"
            : task.budgetAmount.eq(0) ? "ALLOCATE" : "ADJUST";
  const flowType = requestedStatus === "DISBURSED" ? "EXPENSE" : requestedStatus === "CANCELED" || requestedStatus === "UNALLOCATED" ? "REFUND" : "ALLOCATE";
  const nextRecipient = requestedStatus === "DISBURSED"
    ? recipient
    : ["UNALLOCATED", "CANCELED"].includes(requestedStatus)
      ? null
      : task.budgetRecipient;

  await prisma.$transaction(async (tx) => {
    const flow = await tx.budgetFlow.create({
      data: {
        projectId: task.projectId,
        taskId,
        flowType,
        operation,
        amount: nextAmount,
        counterparty: requestedStatus === "DISBURSED" ? recipient : null,
        description: reason,
        createdBy: user.name,
      },
    });
    await tx.task.update({
      where: { id: taskId },
      data: {
        budgetAmount: nextAmount,
        budgetStatus: requestedStatus,
        budgetRecipient: nextRecipient,
      },
    });
    await tx.activityLog.create({
      data: {
        projectId: task.projectId,
        targetType: "BUDGET_ITEM",
        targetId: taskId,
        changeType: "UPDATE",
        source: "HUMAN",
        createdBy: user.name,
        summary: `事项预算更新：${task.name}\n${formatMoney(task.budgetAmount)} / ${task.budgetStatus} → ${formatMoney(nextAmount)} / ${requestedStatus}${nextRecipient ? ` / 划拨至 ${nextRecipient}` : ""}\n原因：${reason}`,
        beforeState: { amount: task.budgetAmount.toString(), status: task.budgetStatus, recipient: task.budgetRecipient },
        afterState: { amount: nextAmount.toString(), status: requestedStatus, recipient: nextRecipient, budgetFlowId: flow.id },
      },
    });
  });

  revalidateBudget(task.projectId);
  return { success: true, message: "事项预算已更新，并写入项目活动" };
}

/** Move part of one item budget to another item without changing the project pool. */
export async function splitTaskBudget(formData: FormData): Promise<ActionResult> {
  const sourceTaskId = String(formData.get("sourceTaskId") ?? "");
  const targetTaskId = String(formData.get("targetTaskId") ?? "");
  const amount = parseMoney(formData.get("amount"));
  const reason = String(formData.get("reason") ?? "").trim();
  const { user } = await assertCanWriteTask(sourceTaskId);

  if (!targetTaskId || targetTaskId === sourceTaskId || !amount || amount.lte(0) || !reason) {
    return { success: false, message: "来源事项、目标事项、拆分金额和拆分原因均为必填项。" };
  }

  const [source, target] = await Promise.all([
    prisma.task.findUnique({ where: { id: sourceTaskId }, select: { id: true, projectId: true, name: true, budgetAmount: true, budgetStatus: true } }),
    prisma.task.findUnique({ where: { id: targetTaskId }, select: { id: true, projectId: true, name: true, budgetAmount: true, budgetStatus: true } }),
  ]);
  if (!source || !target || source.projectId !== target.projectId) return { success: false, message: "目标事项不存在或不属于当前项目。" };
  if (!isActiveBudgetStatus(source.budgetStatus) || source.budgetAmount.lt(amount)) {
    return { success: false, message: "来源事项没有足够的可拆分预算。" };
  }

  const nextSourceAmount = source.budgetAmount.sub(amount);
  const nextTargetAmount = target.budgetAmount.add(amount);
  const groupId = randomUUID();

  await prisma.$transaction(async (tx) => {
    const flows = await tx.budgetFlow.createMany({
      data: [
        { projectId: source.projectId, taskId: source.id, counterpartyTaskId: target.id, groupId, flowType: "ALLOCATE", operation: "SPLIT_OUT", amount, description: reason, createdBy: user.name },
        { projectId: source.projectId, taskId: target.id, counterpartyTaskId: source.id, groupId, flowType: "ALLOCATE", operation: "SPLIT_IN", amount, description: reason, createdBy: user.name },
      ],
    });
    await tx.task.update({
      where: { id: source.id },
      data: { budgetAmount: nextSourceAmount, budgetStatus: nextSourceAmount.eq(0) ? "UNALLOCATED" : source.budgetStatus, budgetRecipient: null },
    });
    await tx.task.update({
      where: { id: target.id },
      data: { budgetAmount: nextTargetAmount, budgetStatus: isActiveBudgetStatus(target.budgetStatus) ? target.budgetStatus : "ALLOCATED", budgetRecipient: null },
    });
    await tx.activityLog.create({
      data: {
        projectId: source.projectId,
        targetType: "BUDGET_ITEM",
        targetId: groupId,
        changeType: "UPDATE",
        source: "HUMAN",
        createdBy: user.name,
        summary: `事项预算拆分：${source.name} → ${target.name} ${formatMoney(amount)}\n原因：${reason}`,
        beforeState: { source: { taskId: source.id, amount: source.budgetAmount.toString() }, target: { taskId: target.id, amount: target.budgetAmount.toString() } },
        afterState: { source: { amount: nextSourceAmount.toString() }, target: { amount: nextTargetAmount.toString() }, budgetFlowCount: flows.count },
      },
    });
  });

  revalidateBudget(source.projectId);
  return { success: true, message: "预算已拆分，两个事项与项目活动已同步更新" };
}
