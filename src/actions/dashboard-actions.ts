"use server";

import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/permissions";
import { getProjectLifecycle } from "@/lib/project-lifecycle";

// ── 全局大盘聚合（全部压力交给 PostgreSQL） ──

export async function getGlobalDashboardStats() {
  const user = await requireCurrentUser();
  if (user.role !== "LEADER") throw new Error("仅 Leader 可访问");

  const now = new Date();

  // ════════════════════════════════════════
  // 全部使用 DB 层面聚合，禁止 findMany 拉到内存
  // ════════════════════════════════════════

  const [
    poolAgg,
    allocationAgg,
    disbursementAgg,
    taskStatusGroups,
    activeProjectResult,
    overdueCount,
    projectCount,
  ] = await Promise.all([
    // Current budget state is held on projects and control items, not by replaying flows.
    prisma.project.aggregate({
      _sum: { totalBudget: true },
      where: { budgetStatus: "CONFIRMED" },
    }),
    prisma.task.aggregate({
      _sum: { budgetAmount: true },
      where: { budgetStatus: { in: ["ALLOCATED", "APPROVED", "DISBURSED", "ACCEPTED"] } },
    }),
    prisma.task.aggregate({
      _sum: { budgetAmount: true },
      where: { budgetStatus: "DISBURSED" },
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

  const totalPool = poolAgg._sum.totalBudget?.toNumber() ?? 0;
  const totalAllocated = allocationAgg._sum.budgetAmount?.toNumber() ?? 0;
  const totalExpense = disbursementAgg._sum.budgetAmount?.toNumber() ?? 0;

  // 从 groupBy 结果中提取各状态计数
  const byStatus = { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0 };
  for (const g of taskStatusGroups) {
    if (g.status in byStatus) {
      byStatus[g.status as keyof typeof byStatus] = g._count.id;
    }
  }

  return {
    totalPool,
    totalAllocated,
    totalExpense,
    totalRefund: 0,
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
      tasks: { select: { id: true, status: true, deadline: true, assignee: true, budgetAmount: true, budgetStatus: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Each project is computed from its current pool and current item budgets.
  return projects.map((p) => {
    const confirmedPool = p.budgetStatus === "CONFIRMED" ? p.totalBudget.toNumber() : 0;
    const allocated = p.tasks
      .filter((task) => ["ALLOCATED", "APPROVED", "DISBURSED", "ACCEPTED"].includes(task.budgetStatus))
      .reduce((sum, task) => sum + task.budgetAmount.toNumber(), 0);
    const disbursed = p.tasks
      .filter((task) => task.budgetStatus === "DISBURSED")
      .reduce((sum, task) => sum + task.budgetAmount.toNumber(), 0);
    const balance = confirmedPool - allocated;
    const usagePercent = confirmedPool > 0 ? Math.round((allocated / confirmedPool) * 100) : 0;

    const completedTasks = p.tasks.filter((t) => t.status === "COMPLETED").length;
    const totalTasks = p._count.tasks;
    const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const hasOverdueTasks = p.tasks.some(
      (t) => t.deadline && new Date(t.deadline) < now && t.status !== "COMPLETED"
    );
    const overdueCount = p.tasks.filter(
      (t) => t.deadline && new Date(t.deadline) < now && t.status !== "COMPLETED"
    ).length;
    const pendingCount = p.tasks.filter((t) => t.status === "PENDING").length;
    const inProgressCount = p.tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const lifecycle = getProjectLifecycle({ startDate: p.startDate, taskStatuses: p.tasks.map((task) => task.status), now });

    const isAtRisk = usagePercent > 90 || hasOverdueTasks;

    return {
      id: p.id,
      name: p.name,
      ownerName: p.owner.name,
      dynamicTotal: confirmedPool,
      plannedBudget: p.totalBudget.toNumber(),
      consumed: disbursed,
      balance,
      budgetUsage: usagePercent,
      totalTasks,
      completedTasks,
      taskProgress,
      hasOverdueTasks,
      overdueCount,
      pendingCount,
      inProgressCount,
      lifecycle,
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
        tasks: { select: { status: true, deadline: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const projectBriefs = projectsWithTasks.map((project) => {
    const total = project.tasks.length;
    const completed = project.tasks.filter((task) => task.status === "COMPLETED").length;
    const overdue = project.tasks.filter((task) => task.deadline && task.deadline < now && task.status !== "COMPLETED").length;
    const active = project.tasks.filter((task) => task.status !== "COMPLETED").length;

    return {
      id: project.id,
      name: project.name,
      ownerName: project.owner.name,
      total,
      active,
      completed,
      overdue,
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
    })),
    projectBriefs,
  };
}

export async function getLeaderDashboardCalendar(monthKey?: string) {
  const user = await requireCurrentUser();
  if (user.role !== "LEADER") throw new Error("仅 Leader 可访问");

  const now = new Date();
  const parsed = monthKey?.match(/^(\d{4})-(\d{2})$/);
  const requestedYear = parsed ? Number(parsed[1]) : now.getFullYear();
  const requestedMonth = parsed ? Number(parsed[2]) - 1 : now.getMonth();
  const safeYear = requestedYear >= 2020 && requestedYear <= 2100 ? requestedYear : now.getFullYear();
  const safeMonth = requestedMonth >= 0 && requestedMonth <= 11 ? requestedMonth : now.getMonth();
  const monthStart = new Date(safeYear, safeMonth, 1);
  const nextMonthStart = new Date(safeYear, safeMonth + 1, 1);

  const entries = await prisma.executionCalendarEntry.findMany({
    where: {
      date: { gte: monthStart, lt: nextMonthStart },
      status: { not: "CANCELED" },
    },
    select: {
      id: true,
      projectId: true,
      taskId: true,
      date: true,
      startTime: true,
      content: true,
      owner: true,
      status: true,
      project: { select: { name: true } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }, { createdAt: "asc" }],
  });

  return {
    month: `${safeYear}-${String(safeMonth + 1).padStart(2, "0")}`,
    entries: entries.map((entry) => ({
      id: entry.id,
      projectId: entry.projectId,
      projectName: entry.project.name,
      taskId: entry.taskId,
      date: entry.date!,
      startTime: entry.startTime,
      content: entry.content,
      owner: entry.owner,
      status: entry.status,
    })),
  };
}
