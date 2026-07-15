"use server";

import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/permissions";
import { getWorkspaceHealth, type WorkspaceHealthLevel } from "@/lib/workspace-health";
import { getProjectLifecycle } from "@/lib/project-lifecycle";
import { Prisma } from "@/generated/prisma/client";
import { getProjectBudgetSummary } from "@/lib/budget-summary";

const DAY = 24 * 60 * 60 * 1000;

export type WorkspaceCockpitData = {
  metrics: {
    myOpenTasks: number;
    overdueTasks: number;
    upcomingCalendar: number;
  };
  myTasks: Array<{
    id: string;
    projectId: string;
    projectName: string;
    name: string;
    priority: string;
    status: string;
    deadline: Date | null;
    isOverdue: boolean;
  }>;
  myProjects: Array<{
    id: string;
    name: string;
    lifecycle: "UPCOMING" | "ACTIVE" | "COMPLETED";
    health: WorkspaceHealthLevel;
    needsMyAttention: number;
    nextNode: { date: Date; content: string } | null;
    budgetSignal: string;
    budgetTone: "default" | "warning" | "danger";
    updatedAt: Date;
    archivedAt: Date | null;
  }>;
  upcomingCalendar: Array<{
    id: string;
    projectId: string;
    projectName: string;
    date: Date;
    startTime: string | null;
    content: string;
    channel: string | null;
    owner: string | null;
  }>;
};

export async function getWorkspaceCockpit(): Promise<WorkspaceCockpitData> {
  const user = await requireCurrentUser();
  const now = new Date();
  const nextSevenDays = new Date(now.getTime() + 7 * DAY);
  // 工作台永远是个人视角；跨项目全局判断只由管理总览承担。
  const scope: Prisma.ProjectWhereInput = {
    OR: [
      { ownerId: user.id },
      { members: { some: { userId: user.id } } },
    ],
  };

  const projects = await prisma.project.findMany({
    where: scope,
    select: {
      id: true,
      name: true,
      totalBudget: true,
      budgetMode: true,
      startDate: true,
      archivedAt: true,
      updatedAt: true,
      tasks: {
        select: {
          id: true,
          name: true,
          assignee: true,
          status: true,
          priority: true,
          deadline: true,
          needsConfirmation: true,
        },
      },
      budgetItems: { select: { plannedAmount: true, status: true } },
      budgetFlows: { select: { amount: true, action: true, flowType: true } },
      calendarEntries: {
        where: { status: { notIn: ["DONE", "CANCELED"] }, date: { gte: now, lte: nextSevenDays } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        select: { id: true, date: true, startTime: true, content: true, channel: true, owner: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const allMyTasks: WorkspaceCockpitData["myTasks"] = [];
  const upcomingCalendar: WorkspaceCockpitData["upcomingCalendar"] = [];
  const myProjects: WorkspaceCockpitData["myProjects"] = [];

  for (const project of projects) {
    const lifecycle = getProjectLifecycle({
      startDate: project.startDate,
      taskStatuses: project.tasks.map((task) => task.status),
      now,
    });
    const overdueCount = project.tasks.filter((task) => task.status !== "COMPLETED" && task.deadline && task.deadline < now).length;
    const missingInfoCount = project.tasks.filter((task) => task.needsConfirmation || !task.assignee?.trim() || !task.deadline).length;
    const budget = getProjectBudgetSummary(project);
    const balance = budget.spendRemaining;
    const budgetUsage = budget.usagePercent;
    const level = getWorkspaceHealth({
      overdueCount,
      missingInfoCount,
      budgetUsage,
      budgetBalance: balance,
      hasUnconfirmedSpend: false,
    });

    const myOpenTaskCount = project.tasks.filter((task) => task.assignee === user.name && task.status !== "COMPLETED").length;
    const nextNode = project.calendarEntries[0];
    const budgetSignal = getBudgetSignal(project.budgetMode, budget);
    myProjects.push({
      id: project.id,
      name: project.name,
      lifecycle,
      health: level,
      needsMyAttention: myOpenTaskCount,
      nextNode: nextNode?.date ? { date: nextNode.date, content: nextNode.content } : null,
      budgetSignal: budgetSignal.label,
      budgetTone: budgetSignal.tone,
      updatedAt: project.updatedAt,
      archivedAt: project.archivedAt,
    });

    for (const task of project.tasks) {
      if (task.assignee === user.name && task.status !== "COMPLETED") {
        allMyTasks.push({
          id: task.id,
          projectId: project.id,
          projectName: project.name,
          name: task.name,
          priority: task.priority,
          status: task.status,
          deadline: task.deadline,
          isOverdue: Boolean(task.deadline && task.deadline < now),
        });
      }
    }

    for (const entry of project.calendarEntries) {
      if (!entry.date) continue;
      upcomingCalendar.push({ ...entry, date: entry.date, projectId: project.id, projectName: project.name });
    }

  }

  const priorityScore: Record<string, number> = { P0: 0, P1: 1, P2: 2, P3: 3 };
  allMyTasks.sort((a, b) => Number(b.isOverdue) - Number(a.isOverdue) || (a.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER) || (priorityScore[a.priority] ?? 9) - (priorityScore[b.priority] ?? 9));
  upcomingCalendar.sort((a, b) => a.date.getTime() - b.date.getTime() || (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"));

  return {
    metrics: {
      myOpenTasks: allMyTasks.length,
      overdueTasks: allMyTasks.filter((task) => task.isOverdue).length,
      upcomingCalendar: upcomingCalendar.length,
    },
    myTasks: allMyTasks.slice(0, 6),
    myProjects: myProjects.sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime()),
    upcomingCalendar: upcomingCalendar.slice(0, 6),
  };
}

function getBudgetSignal(mode: string, budget: ReturnType<typeof getProjectBudgetSummary>) {
  if (mode === "NOT_MANAGED") return { label: "未启用预算", tone: "default" as const };
  if (mode !== "CONFIRMED") return { label: "预算待确认", tone: "warning" as const };
  if (budget.spendRemaining < 0) return { label: "预算超支", tone: "danger" as const };
  if (budget.usagePercent >= 90) return { label: `已用 ${budget.usagePercent}%`, tone: "warning" as const };
  return { label: `剩余 ${formatMoney(budget.spendRemaining)}`, tone: "default" as const };
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 0 }).format(value);
}
