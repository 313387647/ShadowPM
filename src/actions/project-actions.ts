"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateBudgetSnapshot } from "@/lib/budget";
import { assertCanReadProject, assertCanWriteProject, requireCurrentUser } from "@/lib/permissions";
import { canWriteProject } from "@/lib/permission-rules";
import type { ActionResult } from "@/actions/types";

/** 安全解析 HTML date input（"YYYY-MM-DD"），强制 UTC 午夜，杜绝时区偏移 */
function parseDateSafe(dateRaw: string | null): Date | null {
  if (!dateRaw) return null;
  return new Date(dateRaw + "T00:00:00.000Z");
}

export async function createProject(formData: FormData): Promise<ActionResult<{ projectId: string }>> {
  const user = await requireCurrentUser();

  const name = formData.get("name") as string;
  const budgetRaw = formData.get("totalBudget") as string;

  if (!name?.trim()) {
    return { success: false, message: "项目名称为必填项" };
  }

  const totalBudget = budgetRaw
    ? new Prisma.Decimal(budgetRaw)
    : new Prisma.Decimal(0);
  if (totalBudget.isNaN() || totalBudget.lt(0)) {
    return { success: false, message: "预算不能为负数" };
  }

  const project = await prisma.project.create({
    data: {
      name,
      totalBudget,
      ownerId: user.id,
      startDate: parseDateSafe(formData.get("startDate") as string),
      endDate: parseDateSafe(formData.get("endDate") as string),
    },
  });

  // 自动创建占位任务；有确认预算时才创建初始 ALLOCATE 流水
  const placeholderTask = await prisma.task.create({
    data: {
      projectId: project.id,
      name: "项目统筹",
      assignee: user.name,
      status: "IN_PROGRESS",
    },
  });
  if (totalBudget.gt(0)) {
    await prisma.budgetFlow.create({
      data: {
        taskId: placeholderTask.id,
        flowType: "ALLOCATE",
        operation: "CONFIRM",
        amount: totalBudget,
        description: `「${name}」项目预算确定`,
        createdBy: user.name,
      },
    });
  }

  revalidatePath("/workspace");
  return { success: true, message: `项目「${name}」创建成功`, data: { projectId: project.id } };
}

export async function getUserProjects() {
  const user = await requireCurrentUser();

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id, role: "EDITOR" } } },
      ],
    },
    include: {
      _count: { select: { tasks: true } },
      tasks: {
        select: {
          budgets: {
            select: {
              flowType: true,
              amount: true,
            },
          },
        },
      },
      activityLogs: {
        where: { changeType: "IMPORT" },
        select: { afterState: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 将 Decimal 转为 number 以便序列化
  return projects.map((p) => ({
    ...p,
    tasks: undefined,
    activityLogs: undefined,
    totalBudget: p.totalBudget.toNumber(),
    confirmedBudget: calculateProjectConfirmedBudget(p).toNumber(),
    pendingBudgetSignal: extractPendingBudgetSignal(p.activityLogs.map((log) => log.afterState)),
  }));
}

function calculateProjectConfirmedBudget(project: {
  totalBudget: Prisma.Decimal;
  tasks: { budgets: { flowType: string; amount: Prisma.Decimal }[] }[];
}) {
  const flows = project.tasks.flatMap((task) => task.budgets);
  const allocated = flows
    .filter((flow) => flow.flowType === "ALLOCATE")
    .reduce((sum, flow) => sum.add(flow.amount), new Prisma.Decimal(0));
  const expense = flows
    .filter((flow) => flow.flowType === "EXPENSE")
    .reduce((sum, flow) => sum.add(flow.amount), new Prisma.Decimal(0));
  const refund = flows
    .filter((flow) => flow.flowType === "REFUND")
    .reduce((sum, flow) => sum.add(flow.amount), new Prisma.Decimal(0));

  return calculateBudgetSnapshot({
    plannedBudget: project.totalBudget,
    allocated,
    expense,
    refund,
  }).allocated;
}

function extractPendingBudgetSignal(states: unknown[]) {
  let total = 0;
  let count = 0;

  for (const state of states) {
    if (!state || typeof state !== "object") continue;
    const diagnostics = "importDiagnostics" in state
      ? (state as { importDiagnostics?: unknown }).importDiagnostics
      : null;
    if (!diagnostics || typeof diagnostics !== "object") continue;
    const items = "lowConfidenceBudgetItems" in diagnostics
      ? (diagnostics as { lowConfidenceBudgetItems?: unknown }).lowConfidenceBudgetItems
      : null;
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const amount = "amount" in item ? (item as { amount?: unknown }).amount : null;
      if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
        total += amount;
        count += 1;
      }
    }
  }

  return { total, count };
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  await assertCanWriteProject(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  if (!project) return { success: false, message: "项目不存在" };

  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/workspace");
  return { success: true, message: `项目「${project.name}」已删除` };
}

export async function getProjectDetail(projectId: string) {
  const user = await assertCanReadProject(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, name: true, role: true } },
      members: { where: { userId: user.id }, select: { role: true }, take: 1 },
      _count: { select: { tasks: true } },
    },
  });

  if (!project) return null;

  // 将 Decimal 转为 number 以便序列化
  return {
    ...project,
    members: undefined,
    totalBudget: project.totalBudget.toNumber(),
    canEdit: canWriteProject({
      userId: user.id,
      role: user.role,
      ownerId: project.ownerId,
      memberRole: project.members[0]?.role ?? null,
    }),
  };
}
