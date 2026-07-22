"use server";

import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/permissions";
import { getProjectLifecycle } from "@/lib/project-lifecycle";
import { getProjectBudgetSummary } from "@/lib/budget-summary";

// ── 全局大盘聚合（全部压力交给 PostgreSQL） ──

export async function getGlobalDashboardStats() {
  const user = await requireCurrentUser();
  if (user.role !== "LEADER") throw new Error("仅 Leader 可访问");

  const now = new Date();

  const [
    budgetProjects,
    taskStatusGroups,
    activeProjectResult,
    overdueCount,
    projectCount,
  ] = await Promise.all([
    prisma.project.findMany({ where: { isExternalProject: false }, select: { budgetMode: true, totalBudget: true, budgetItems: { select: { plannedAmount: true, status: true } }, budgetFlows: { select: { amount: true, action: true, flowType: true } } } }),

    // 任务按状态 groupBy —— PostgreSQL 层面完成聚合
    prisma.task.groupBy({
      by: ["status"],
      where: { project: { isExternalProject: false } },
      _count: { id: true },
    }),

    // 活跃项目：有未完成任务的项目去重计数
    prisma.task.groupBy({
      by: ["projectId"],
      where: { status: { not: "COMPLETED" }, project: { isExternalProject: false } },
      _count: { id: true },
    }),

    // 逾期任务：deadline < now 且未完成 —— DB 层面 count
    prisma.task.count({
      where: {
        deadline: { lt: now },
        status: { not: "COMPLETED" },
        project: { isExternalProject: false },
      },
    }),

    // 项目总数
    prisma.project.count({ where: { isExternalProject: false } }),
  ]);

  const summaries = budgetProjects.map(getProjectBudgetSummary);
  const totalPool = summaries.reduce((sum, item) => sum + item.confirmedBudget, 0);
  const totalAllocated = summaries.reduce((sum, item) => sum + item.planned, 0);
  const totalExpense = summaries.reduce((sum, item) => sum + item.actualSpend, 0);
  const totalRefund = summaries.reduce((sum, item) => sum + item.refund, 0);

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
    totalRefund,
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
    where: { isExternalProject: false },
    include: {
      owner: { select: { name: true } },
      tasks: { select: { id: true, status: true, deadline: true, assignee: true } },
      calendarEntries: {
        where: { status: { notIn: ["DONE", "CANCELED"] }, date: { gte: now } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 1,
        select: { date: true, content: true },
      },
      budgetItems: { select: { plannedAmount: true, status: true } },
      budgetFlows: { select: { amount: true, action: true, flowType: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Each project is computed from its current pool and current item budgets.
  return projects.map((p) => {
    const budget = getProjectBudgetSummary(p);
    const balance = budget.spendRemaining;
    const usagePercent = budget.usagePercent;

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
      dynamicTotal: budget.confirmedBudget,
      plannedBudget: budget.planned,
      consumed: budget.actualSpend,
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
      nextNode: p.calendarEntries[0]?.date ? { date: p.calendarEntries[0].date as Date, content: p.calendarEntries[0].content } : null,
      updatedAt: p.updatedAt,
    };
  });
}

export async function getLeaderDashboardAttention() {
  const user = await requireCurrentUser();
  if (user.role !== "LEADER") throw new Error("仅 Leader 可访问");

  const now = new Date();
  const nextSevenDays = new Date(now.getTime() + 7 * 86400000);

  const attentionWhere = {
    status: { not: "COMPLETED" as const },
    project: { isExternalProject: false },
    OR: [
      { deadline: { lt: now } },
      { deadline: { lte: nextSevenDays }, status: "PENDING" as const },
    ],
  };
  const upcomingCalendarWhere = {
    status: { notIn: ["DONE", "CANCELED"] },
    project: { isExternalProject: false },
    date: { gte: now, lte: nextSevenDays },
  };

  const [attentionTasks, upcomingCalendarEntries, attentionTaskCount, upcomingCalendarCount, projectCount, projectsWithTasks] = await Promise.all([
    prisma.task.findMany({
      where: attentionWhere,
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
      take: 50,
    }),
    prisma.executionCalendarEntry.findMany({
      where: upcomingCalendarWhere,
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
      take: 50,
    }),
    prisma.task.count({ where: attentionWhere }),
    prisma.executionCalendarEntry.count({ where: upcomingCalendarWhere }),
    prisma.project.count({ where: { isExternalProject: false } }),
    prisma.project.findMany({
      where: { isExternalProject: false },
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
        where: { id: { in: attentionProjectIds }, isExternalProject: false },
        select: { id: true, name: true, owner: { select: { name: true } } },
      })
    : [];
  const attentionProjectById = new Map(attentionProjects.map((project) => [project.id, project]));

  return {
    projectCount,
    attentionTaskCount,
    upcomingCalendarCount,
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
      project: { isExternalProject: false },
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
