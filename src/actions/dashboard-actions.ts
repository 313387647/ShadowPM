"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/permissions";

// ── 全局大盘聚合（全部压力交给 PostgreSQL） ──

export async function getGlobalDashboardStats() {
  const user = await requireCurrentUser();
  if (user.role !== "LEADER") throw new Error("仅 Leader 可访问");

  const now = new Date();

  // ════════════════════════════════════════
  // 全部使用 DB 层面聚合，禁止 findMany 拉到内存
  // ════════════════════════════════════════

  const [
    budgetTotal,
    allocAgg,
    expenseAgg,
    refundAgg,
    taskStatusGroups,
    activeProjectResult,
    overdueCount,
    projectCount,
  ] = await Promise.all([
    // 总预算池：所有项目 totalBudget 求和
    prisma.project.aggregate({ _sum: { totalBudget: true } }),

    // ALLOCATE 总和
    prisma.budgetFlow.aggregate({
      _sum: { amount: true },
      where: { flowType: "ALLOCATE" },
    }),
    // EXPENSE 总和
    prisma.budgetFlow.aggregate({
      _sum: { amount: true },
      where: { flowType: "EXPENSE" },
    }),
    // REFUND 总和
    prisma.budgetFlow.aggregate({
      _sum: { amount: true },
      where: { flowType: "REFUND" },
    }),

    // 任务按状态 groupBy —— PostgreSQL 层面完成聚合
    prisma.task.groupBy({
      by: ["status"],
      _count: { id: true },
    }),

    // 活跃项目：有未完成任务的项目去重计数
    prisma.task.groupBy({
      by: ["projectId"],
      where: { status: { not: "COMPLETED" } },
      _count: { id: true },
    }),

    // 逾期任务：deadline < now 且未完成 —— DB 层面 count
    prisma.task.count({
      where: {
        deadline: { lt: now },
        status: { not: "COMPLETED" },
      },
    }),

    // 项目总数
    prisma.project.count(),
  ]);

  const totalPool: Prisma.Decimal =
    budgetTotal._sum.totalBudget ?? new Prisma.Decimal(0);
  const totalAllocated: Prisma.Decimal =
    allocAgg._sum.amount ?? new Prisma.Decimal(0);
  const totalExpense: Prisma.Decimal =
    (expenseAgg._sum.amount ?? new Prisma.Decimal(0)).abs();
  const totalRefund: Prisma.Decimal =
    refundAgg._sum.amount ?? new Prisma.Decimal(0);

  // 从 groupBy 结果中提取各状态计数
  const byStatus = { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0 };
  for (const g of taskStatusGroups) {
    if (g.status in byStatus) {
      byStatus[g.status as keyof typeof byStatus] = g._count.id;
    }
  }

  return {
    totalPool: totalPool.toNumber(),
    totalAllocated: totalAllocated.toNumber(),
    totalExpense: totalExpense.toNumber(),
    totalRefund: totalRefund.toNumber(),
    projectCount,
    activeProjectCount: activeProjectResult.length || projectCount,
    overdueTaskCount: overdueCount,
    taskByStatus: byStatus,
  };
}

// ── 项目健康度（严格按财务铁律：DB 聚合 + 精确公式） ──

export async function getProjectsHealth() {
  const user = await requireCurrentUser();
  if (user.role !== "LEADER") throw new Error("仅 Leader 可访问");

  const now = new Date();

  // 1. 项目列表（含 owner + 任务基础信息）
  const projects = await prisma.project.findMany({
    include: {
      owner: { select: { name: true } },
      tasks: { select: { id: true, status: true, deadline: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // 2. 流水按 (taskId, flowType) groupBy —— 绝对不用 findMany 拉全表
  const flowGroups = await prisma.budgetFlow.groupBy({
    by: ["taskId", "flowType"],
    _sum: { amount: true },
  });

  // 3. taskId → projectId 映射（仅 ID，O(任务数)，不 OOM）
  const taskIdToProjectId = new Map<string, string>();
  for (const p of projects) {
    for (const t of p.tasks) {
      taskIdToProjectId.set(t.id, p.id);
    }
  }

  // 4. 按 projectId + flowType 聚合（仅 12 条 groupBy 行，非全量流水行）
  const projectFinance = new Map<
    string,
    { alloc: Prisma.Decimal; expense: Prisma.Decimal; refund: Prisma.Decimal }
  >();
  for (const g of flowGroups) {
    const pid = taskIdToProjectId.get(g.taskId);
    if (!pid) continue;
    const entry = projectFinance.get(pid) ?? {
      alloc: new Prisma.Decimal(0),
      expense: new Prisma.Decimal(0),
      refund: new Prisma.Decimal(0),
    };
    const amount: Prisma.Decimal = g._sum.amount ?? new Prisma.Decimal(0);
    if (g.flowType === "ALLOCATE") entry.alloc = entry.alloc.add(amount);
    else if (g.flowType === "EXPENSE") entry.expense = entry.expense.add(amount);
    else if (g.flowType === "REFUND") entry.refund = entry.refund.add(amount);
    projectFinance.set(pid, entry);
  }

  // 5. 套用财务铁律公式
  return projects.map((p) => {
    const fin = projectFinance.get(p.id) ?? {
      alloc: new Prisma.Decimal(0),
      expense: new Prisma.Decimal(0),
      refund: new Prisma.Decimal(0),
    };

    // ── 财务铁律（与详情页完全一致） ──
    // 动态总预算 = 初始预算 + 追加分配
    const dynamicTotal = p.totalBudget.add(fin.alloc);
    // 已耗金额 = |支出| - 退款
    const consumed = fin.expense.abs().sub(fin.refund);
    // 消耗比例
    const budgetUsage = dynamicTotal.gt(0)
      ? Math.round(consumed.div(dynamicTotal).times(100).toNumber())
      : 0;

    const completedTasks = p.tasks.filter((t) => t.status === "COMPLETED").length;
    const totalTasks = p._count.tasks;
    const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const hasOverdueTasks = p.tasks.some(
      (t) => t.deadline && new Date(t.deadline) < now && t.status !== "COMPLETED"
    );

    const isAtRisk = budgetUsage > 90 || hasOverdueTasks;

    return {
      id: p.id,
      name: p.name,
      ownerName: p.owner.name,
      dynamicTotal: dynamicTotal.toNumber(),
      consumed: consumed.toNumber(),
      budgetUsage,
      totalTasks,
      completedTasks,
      taskProgress,
      hasOverdueTasks,
      isAtRisk,
    };
  });
}
