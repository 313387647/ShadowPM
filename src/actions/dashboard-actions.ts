"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/permissions";
import { calculateBudgetSnapshot } from "@/lib/budget";

// ── 全局大盘聚合（全部压力交给 PostgreSQL） ──

export async function getGlobalDashboardStats() {
  const user = await requireCurrentUser();
  if (user.role !== "LEADER") throw new Error("仅 Leader 可访问");

  const now = new Date();

  // ════════════════════════════════════════
  // 全部使用 DB 层面聚合，禁止 findMany 拉到内存
  // ════════════════════════════════════════

  const [
    allocAgg,
    expenseAgg,
    refundAgg,
    taskStatusGroups,
    activeProjectResult,
    overdueCount,
    projectCount,
  ] = await Promise.all([
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
    totalPool: totalAllocated.toNumber(),
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
      tasks: { select: { id: true, status: true, deadline: true, assignee: true } },
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

    const budget = calculateBudgetSnapshot({
      plannedBudget: p.totalBudget,
      allocated: fin.alloc,
      expense: fin.expense,
      refund: fin.refund,
    });

    const completedTasks = p.tasks.filter((t) => t.status === "COMPLETED").length;
    const totalTasks = p._count.tasks;
    const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const hasOverdueTasks = p.tasks.some(
      (t) => t.deadline && new Date(t.deadline) < now && t.status !== "COMPLETED"
    );
    const overdueCount = p.tasks.filter(
      (t) => t.deadline && new Date(t.deadline) < now && t.status !== "COMPLETED"
    ).length;
    const missingOwnerCount = p.tasks.filter((t) => !t.assignee?.trim()).length;
    const pendingCount = p.tasks.filter((t) => t.status === "PENDING").length;
    const inProgressCount = p.tasks.filter((t) => t.status === "IN_PROGRESS").length;

    const isAtRisk = budget.usagePercent > 90 || hasOverdueTasks;

    return {
      id: p.id,
      name: p.name,
      ownerName: p.owner.name,
      dynamicTotal: budget.allocated.toNumber(),
      plannedBudget: budget.plannedBudget.toNumber(),
      consumed: budget.consumed.toNumber(),
      balance: budget.balance.toNumber(),
      budgetUsage: budget.usagePercent,
      totalTasks,
      completedTasks,
      taskProgress,
      hasOverdueTasks,
      overdueCount,
      missingOwnerCount,
      pendingCount,
      inProgressCount,
      isAtRisk,
    };
  });
}

export async function getLeaderDashboardAttention() {
  const user = await requireCurrentUser();
  if (user.role !== "LEADER") throw new Error("仅 Leader 可访问");

  const now = new Date();
  const nextSevenDays = new Date(now.getTime() + 7 * 86400000);

  const [attentionTasks, upcomingCalendarEntries, projectCount, projectsWithTasks] = await Promise.all([
    prisma.task.findMany({
      where: {
        status: { not: "COMPLETED" },
        OR: [
          { assignee: null },
          { assignee: "" },
          { deadline: null },
          { deadline: { lt: now } },
          { deadline: { lte: nextSevenDays }, status: "PENDING" },
        ],
      },
      select: {
        id: true,
        projectId: true,
        name: true,
        status: true,
        priority: true,
        assignee: true,
        department: true,
        deadline: true,
      },
      orderBy: [{ deadline: "asc" }, { priority: "asc" }],
      take: 12,
    }),
    prisma.executionCalendarEntry.findMany({
      where: {
        status: { notIn: ["DONE", "CANCELED"] },
        OR: [
          { date: null },
          { date: { gte: now, lte: nextSevenDays } },
        ],
      },
      select: {
        id: true,
        projectId: true,
        taskId: true,
        date: true,
        startTime: true,
        channel: true,
        workstream: true,
        content: true,
        owner: true,
        status: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "desc" }],
      take: 10,
    }),
    prisma.project.count(),
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        owner: { select: { name: true } },
        tasks: { select: { status: true, deadline: true, assignee: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const projectBriefs = projectsWithTasks.map((project) => {
    const total = project.tasks.length;
    const completed = project.tasks.filter((task) => task.status === "COMPLETED").length;
    const overdue = project.tasks.filter((task) => task.deadline && task.deadline < now && task.status !== "COMPLETED").length;
    const missingOwner = project.tasks.filter((task) => !task.assignee?.trim()).length;
    const active = project.tasks.filter((task) => task.status !== "COMPLETED").length;

    return {
      id: project.id,
      name: project.name,
      ownerName: project.owner.name,
      total,
      active,
      completed,
      overdue,
      missingOwner,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });
  const attentionProjectIds = Array.from(new Set(attentionTasks.map((task) => task.projectId)));
  const attentionProjects = attentionProjectIds.length > 0
    ? await prisma.project.findMany({
        where: { id: { in: attentionProjectIds } },
        select: { id: true, name: true, owner: { select: { name: true } } },
      })
    : [];
  const attentionProjectById = new Map(attentionProjects.map((project) => [project.id, project]));

  return {
    projectCount,
    attentionTasks: attentionTasks.map((task) => ({
      id: task.id,
      name: task.name,
      status: task.status,
      priority: task.priority,
      assignee: task.assignee,
      department: task.department,
      deadline: task.deadline,
      projectId: task.projectId,
      projectName: attentionProjectById.get(task.projectId)?.name ?? "未知项目",
      ownerName: attentionProjectById.get(task.projectId)?.owner.name ?? "未知负责人",
      signals: [
        !task.assignee?.trim() ? "缺负责人" : null,
        !task.deadline ? "缺截止日期" : null,
        task.deadline && task.deadline < now ? "已逾期" : null,
        task.deadline && task.deadline <= nextSevenDays && task.status === "PENDING" ? "临近未启动" : null,
      ].filter((item): item is string => Boolean(item)),
    })),
    upcomingCalendarEntries: upcomingCalendarEntries.map((entry) => ({
      id: entry.id,
      projectId: entry.projectId,
      projectName: entry.project.name,
      taskId: entry.taskId,
      date: entry.date,
      startTime: entry.startTime,
      channel: entry.channel,
      workstream: entry.workstream,
      content: entry.content,
      owner: entry.owner,
      status: entry.status,
      isUnscheduled: !entry.date,
    })),
    projectBriefs,
  };
}
