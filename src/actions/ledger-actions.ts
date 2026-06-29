"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertCanReadProject, assertCanWriteTask } from "@/lib/permissions";
import type { $Enums } from "@/generated/prisma/client";
import type { ActionResult } from "@/actions/types";

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

  // 将 Decimal amount 转为 number 以便前端渲染
  return flows.map((f) => ({
    ...f,
    amount: f.amount.toNumber(),
  }));
}

// ── Event-Sourcing 动态结余 ──
// 结余 = 项目总预算 + SUM(BudgetFlow.amount)
// 使用 Prisma.Decimal 完成所有运算，前端收到纯 number

export async function getProjectBudgetBalance(projectId: string) {
  await assertCanReadProject(projectId);

  const [project, result] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { totalBudget: true },
    }),
    prisma.budgetFlow.aggregate({
      _sum: { amount: true },
      where: { task: { projectId } },
    }),
  ]);

  // Prisma.Decimal 精确运算 —— 杜绝浮点数精度丢失
  // 关键：flowSum 已包含初始 ALLOCATE（即预算本身），结余 = Σ 所有流水
  const totalBudget: Prisma.Decimal = project?.totalBudget ?? new Prisma.Decimal(0);
  const flowSum: Prisma.Decimal = result._sum.amount ?? new Prisma.Decimal(0);

  // 结余 = 流水总和（ALLOCATE - EXPENSE + REFUND）
  const balance = flowSum;
  // 已使用 = 项目总预算 - 当前结余
  const used = totalBudget.sub(balance);

  return {
    balance: balance.toNumber(),
    used: used.toNumber(),
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
  const flowType = formData.get("flowType") as string;
  const amountRaw = formData.get("amount") as string;
  const description = formData.get("description") as string;

  if (!taskId || !flowType || !amountRaw || !description?.trim()) {
    return { success: false, message: "所有字段为必填项" };
  }

  // 使用 Prisma.Decimal 包装器，杜绝原生 parseFloat
  let amount = new Prisma.Decimal(amountRaw);
  if (amount.isNaN() || amount.lte(0)) {
    return { success: false, message: "金额必须为正数" };
  }

  // 按 Event-Sourcing 规则：EXPENSE 存储为负数，ALLOCATE/REFUND 为正数
  if (flowType === "EXPENSE") {
    amount = amount.negated();
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) return { success: false, message: "任务不存在" };

  await prisma.budgetFlow.create({
    data: {
      taskId,
      flowType: flowType as $Enums.FlowType,
      amount,
      description: description.trim(),
      createdBy: user.name,
    },
  });

  revalidatePath(`/projects/${task.projectId}`);
  return { success: true, message: "记账成功" };
}
