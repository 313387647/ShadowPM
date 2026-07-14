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
    activeProjects: number;
    upcomingProjects: number;
    completedProjects: number;
    myOpenTasks: number;
    overdueTasks: number;
    confirmedBalance: number;
    periodExpense: number;
  };
  health: Record<WorkspaceHealthLevel, number>;
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
  activities: Array<{
    id: string;
    projectId: string;
    projectName: string;
    summary: string;
    source: string;
    createdAt: Date;
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
  const scope: Prisma.ProjectWhereInput = user.role === "LEADER"
    ? {}
    : {
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
        select: { id: true, date: true, startTime: true, content: true, channel: true, owner: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const projectIds = projects.map((project) => project.id);
  const [activities] = projectIds.length > 0
    ? await Promise.all([
        prisma.activityLog.findMany({
          where: { projectId: { in: projectIds } },
          select: { id: true, projectId: true, summary: true, source: true, createdAt: true, project: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
      ])
    : [[]];

  const health: Record<WorkspaceHealthLevel, number> = { HEALTHY: 0, WATCH: 0, RISK: 0 };
  const allMyTasks: WorkspaceCockpitData["myTasks"] = [];
  const upcomingCalendar: WorkspaceCockpitData["upcomingCalendar"] = [];
  let activeProjects = 0;
  let upcomingProjects = 0;
  let completedProjects = 0;
  let confirmedBalance = 0;
  let periodExpense = 0;

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

    health[level] += 1;
    if (lifecycle === "ACTIVE") activeProjects += 1;
    if (lifecycle === "UPCOMING") upcomingProjects += 1;
    if (lifecycle === "COMPLETED") completedProjects += 1;
    confirmedBalance += balance;
    periodExpense += budget.actualSpend;

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
      activeProjects,
      upcomingProjects,
      completedProjects,
      myOpenTasks: allMyTasks.length,
      overdueTasks: allMyTasks.filter((task) => task.isOverdue).length,
      confirmedBalance,
      periodExpense,
    },
    health,
    myTasks: allMyTasks.slice(0, 6),
    activities: activities.map((activity) => ({ ...activity, projectName: activity.project.name })),
    upcomingCalendar: upcomingCalendar.slice(0, 6),
  };
}
