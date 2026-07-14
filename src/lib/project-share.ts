import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isValidShareToken } from "@/lib/p2-rules";
import { getProjectBudgetSummary } from "@/lib/budget-summary";

export async function getSharedProject(token: string) {
  if (!isValidShareToken(token)) return null;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const now = new Date();
  const link = await prisma.projectShareLink.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    select: {
      expiresAt: true,
      project: {
        select: {
          id: true,
          name: true,
          totalBudget: true,
          budgetMode: true,
          startDate: true,
          endDate: true,
          owner: { select: { name: true } },
          tasks: {
            select: {
              id: true,
              name: true,
              description: true,
              notes: true,
              assignee: true,
              department: true,
              deadline: true,
              status: true,
              priority: true,
              phase: { select: { name: true } },
            },
            orderBy: [{ status: "asc" }, { deadline: "asc" }],
          },
          budgetItems: { select: { id: true, title: true, category: true, plannedAmount: true, status: true, taskRelations: { select: { task: { select: { name: true } } } } }, orderBy: { updatedAt: "desc" } },
          budgetFlows: { select: { amount: true, action: true, flowType: true } },
          calendarEntries: {
            select: {
              id: true,
              date: true,
              startTime: true,
              endTime: true,
              channel: true,
              workstream: true,
              content: true,
              owner: true,
              department: true,
              status: true,
              notes: true,
            },
            orderBy: [{ date: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });
  if (!link) return null;

  const summary = getProjectBudgetSummary(link.project);

  return {
    expiresAt: link.expiresAt,
    project: {
      ...link.project,
      totalBudget: link.project.totalBudget.toNumber(),
      budgetFlows: undefined,
      budgetItems: link.project.budgetItems.map((item) => ({ ...item, plannedAmount: item.plannedAmount.toNumber(), taskNames: item.taskRelations.map((relation) => relation.task.name) })),
    },
    budget: {
      planned: summary.planned,
      confirmed: summary.confirmedBudget,
      allocated: summary.planned,
      consumed: summary.actualSpend,
      balance: summary.spendRemaining,
      usagePercent: summary.usagePercent,
    },
  };
}
