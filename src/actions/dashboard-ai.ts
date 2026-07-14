"use server";

import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/permissions";
import { buildWeeklyHealthSummary } from "@/lib/weekly-health-summary";

export async function generateDashboardSummary(): Promise<string | null> {
  const user = await requireCurrentUser();
  if (user.role !== "LEADER") return null;

  const now = new Date();

  const [projects, taskAgg, overdueCount, missingOwnerCount, calendarEntries] = await Promise.all([
      prisma.project.findMany({
        select: {
          id: true, name: true, totalBudget: true, budgetStatus: true,
          _count: { select: { tasks: true } },
          tasks: { select: { status: true, deadline: true, assignee: true, budgetAmount: true, budgetStatus: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.task.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.task.count({
        where: { deadline: { lt: now }, status: { not: "COMPLETED" } },
      }),
      prisma.task.count({
        where: { status: { not: "COMPLETED" }, OR: [{ assignee: null }, { assignee: "" }] },
      }),
      prisma.executionCalendarEntry.findMany({
        select: { projectId: true, date: true, status: true },
        where: { status: { notIn: ["DONE", "CANCELED"] } },
      }),
    ]);

  if (projects.length === 0) return buildWeeklyHealthSummary({
    projectCount: 0, pending: 0, inProgress: 0, completed: 0, overdueCount: 0,
    missingOwnerCount: 0, plannedBudget: 0, allocatedBudget: 0, consumedBudget: 0, projects: [],
  });

  const plannedBudget = projects.reduce((sum, project) => sum + project.totalBudget.toNumber(), 0);
  const totalAllocated = projects.reduce((sum, project) => sum + (project.budgetStatus === "CONFIRMED" ? project.totalBudget.toNumber() : 0), 0);
  const consumed = projects.reduce((sum, project) => sum + project.tasks
    .filter((task) => task.budgetStatus === "DISBURSED")
    .reduce((taskSum, task) => taskSum + task.budgetAmount.toNumber(), 0), 0);

  const pending = taskAgg.find((g) => g.status === "PENDING")?._count.id ?? 0;
  const inProgress = taskAgg.find((g) => g.status === "IN_PROGRESS")?._count.id ?? 0;
  const completed = taskAgg.find((g) => g.status === "COMPLETED")?._count.id ?? 0;
  const calendarByProject = new Map<string, { upcoming: number; unscheduled: number }>();
  for (const entry of calendarEntries) {
    const current = calendarByProject.get(entry.projectId) ?? { upcoming: 0, unscheduled: 0 };
    if (!entry.date) current.unscheduled += 1;
    calendarByProject.set(entry.projectId, current);
  }

  return buildWeeklyHealthSummary({
    projectCount: projects.length,
    pending,
    inProgress,
    completed,
    overdueCount,
    missingOwnerCount,
    plannedBudget,
    allocatedBudget: totalAllocated,
    consumedBudget: consumed,
    projects: projects.map((project) => {
      const completedTasks = project.tasks.filter((task) => task.status === "COMPLETED").length;
      const overdueTasks = project.tasks.filter((task) => task.deadline && task.deadline < now && task.status !== "COMPLETED").length;
      const missingOwnerTasks = project.tasks.filter((task) => task.status !== "COMPLETED" && !task.assignee?.trim()).length;
      const calendar = calendarByProject.get(project.id) ?? { upcoming: 0, unscheduled: 0 };
      return {
        name: project.name,
        totalTasks: project._count.tasks,
        completedTasks,
        overdueTasks,
        missingOwnerTasks,
        upcomingCalendarEntries: calendar.upcoming,
        unscheduledCalendarEntries: calendar.unscheduled,
      };
    }),
  });
}
