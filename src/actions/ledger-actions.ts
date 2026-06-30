"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertCanReadProject, assertCanWriteTask } from "@/lib/permissions";
import { calculateBudgetSnapshot } from "@/lib/budget";
import type { $Enums } from "@/generated/prisma/client";
import type { ActionResult } from "@/actions/types";

const BUDGET_OPERATIONS = [
  "CONFIRM",
  "SUPPLEMENT",
  "REDUCE",
  "ALLOCATE",
  "RETURN",
  "TRANSFER",
  "SPLIT",
  "MERGE",
  "EXPENSE",
  "REFUND",
] as const;
const MOVEMENT_OPERATIONS = ["TRANSFER", "SPLIT", "MERGE"] as const;

// ── 读取项目维度流水 ──

export async function getProjectLedger(projectId: string) {
  await assertCanReadProject(projectId);

  const flows = await prisma.budgetFlow.findMany({
    where: { task: { projectId } },
    include: {
      task: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const counterpartyTaskIds = Array.from(new Set(
    flows
      .map((flow) => flow.counterpartyTaskId)
      .filter((id): id is string => Boolean(id))
  ));
  const counterparties = counterpartyTaskIds.length > 0
    ? await prisma.task.findMany({
        where: { id: { in: counterpartyTaskIds }, projectId },
        select: { id: true, name: true },
      })
    : [];
  const counterpartyById = new Map(counterparties.map((task) => [task.id, task]));

  // 将 Decimal amount 转为 number 以便前端渲染
  return flows.map((f) => ({
    ...f,
    amount: f.amount.toNumber(),
    counterpartyTask: f.counterpartyTaskId ? counterpartyById.get(f.counterpartyTaskId) ?? null : null,
  }));
}

// ── Event-Sourcing 动态结余 ──
// 结余 = 项目总预算 + SUM(BudgetFlow.amount)
// 使用 Prisma.Decimal 完成所有运算，前端收到纯 number

export async function getProjectBudgetBalance(projectId: string) {
  await assertCanReadProject(projectId);

  const [project, allocAgg, expenseAgg, refundAgg] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { totalBudget: true },
    }),
    prisma.budgetFlow.aggregate({
      _sum: { amount: true },
      where: { task: { projectId }, flowType: "ALLOCATE" },
    }),
    prisma.budgetFlow.aggregate({
      _sum: { amount: true },
      where: { task: { projectId }, flowType: "EXPENSE" },
    }),
    prisma.budgetFlow.aggregate({
      _sum: { amount: true },
      where: { task: { projectId }, flowType: "REFUND" },
    }),
  ]);

  const snapshot = calculateBudgetSnapshot({
    plannedBudget: project?.totalBudget,
    allocated: allocAgg._sum.amount,
    expense: expenseAgg._sum.amount,
    refund: refundAgg._sum.amount,
  });

  return {
    plannedBudget: snapshot.plannedBudget.toNumber(),
    allocatedBudget: snapshot.allocated.toNumber(),
    balance: snapshot.balance.toNumber(),
    used: snapshot.consumed.toNumber(),
    expense: snapshot.expense.toNumber(),
    refund: snapshot.refund.toNumber(),
    usagePercent: snapshot.usagePercent,
  };
}

// ── 获取项目下的任务列表（供下拉选择） ──

export async function getProjectTasksForSelect(projectId: string) {
  await assertCanReadProject(projectId);

  return prisma.task.findMany({
    where: { projectId },
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });
}

// ── 记账操作（纯 Append，绝不修改任何余额字段） ──

export async function recordBudget(formData: FormData): Promise<ActionResult> {
  const taskId = formData.get("taskId") as string;
  const { user } = await assertCanWriteTask(taskId);
  const operationRaw = formData.get("operation") as string;
  const counterpartyTaskId = (formData.get("counterpartyTaskId") as string) || null;
  const amountRaw = formData.get("amount") as string;
  const description = formData.get("description") as string;

  if (!taskId || !operationRaw || !amountRaw || !description?.trim()) {
    return { success: false, message: "所有字段为必填项" };
  }
  const operation = BUDGET_OPERATIONS.includes(operationRaw as (typeof BUDGET_OPERATIONS)[number])
    ? operationRaw as (typeof BUDGET_OPERATIONS)[number]
    : null;
  if (!operation) {
    return { success: false, message: "预算动作无效" };
  }

  // 使用 Prisma.Decimal 包装器，杜绝原生 parseFloat
  const amount = new Prisma.Decimal(amountRaw);
  if (amount.isNaN() || amount.lte(0)) {
    return { success: false, message: "金额必须为正数" };
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, name: true },
  });
  if (!task) return { success: false, message: "任务不存在" };

  if (MOVEMENT_OPERATIONS.includes(operation as (typeof MOVEMENT_OPERATIONS)[number])) {
    if (!counterpartyTaskId) return { success: false, message: "划拨、拆分或合并必须选择目标事项" };
    if (counterpartyTaskId === taskId) return { success: false, message: "来源事项和目标事项不能相同" };

    const counterpartyTask = await prisma.task.findFirst({
      where: { id: counterpartyTaskId, projectId: task.projectId },
      select: { id: true, name: true },
    });
    if (!counterpartyTask) return { success: false, message: "目标事项不存在或不属于当前项目" };

    const groupId = randomUUID();
    await prisma.budgetFlow.createMany({
      data: [
        {
          taskId,
          counterpartyTaskId,
          groupId,
          flowType: "ALLOCATE",
          operation,
          amount: amount.negated(),
          description: description.trim(),
          createdBy: user.name,
        },
        {
          taskId: counterpartyTaskId,
          counterpartyTaskId: taskId,
          groupId,
          flowType: "ALLOCATE",
          operation,
          amount,
          description: description.trim(),
          createdBy: user.name,
        },
      ],
    });
  } else {
    const flowType = operation === "EXPENSE"
      ? "EXPENSE"
      : operation === "REFUND"
        ? "REFUND"
        : "ALLOCATE";
    const signedAmount = ["EXPENSE", "REDUCE", "RETURN"].includes(operation)
      ? amount.negated()
      : amount;

    await prisma.budgetFlow.create({
      data: {
        taskId,
        counterpartyTaskId: null,
        flowType: flowType as $Enums.FlowType,
        operation,
        amount: signedAmount,
        description: description.trim(),
        createdBy: user.name,
      },
    });
  }

  revalidatePath(`/projects/${task.projectId}`);
  return { success: true, message: "预算流转已记录" };
}
