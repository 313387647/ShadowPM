import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isValidShareToken } from "@/lib/p2-rules";

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
          budgetStatus: true,
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
              budgetAmount: true,
              budgetStatus: true,
              budgetRecipient: true,
              phase: { select: { name: true } },
            },
            orderBy: [{ status: "asc" }, { deadline: "asc" }],
          },
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

  const confirmed = link.project.budgetStatus === "CONFIRMED" ? link.project.totalBudget.toNumber() : 0;
  const allocated = link.project.tasks
    .filter((task) => ["ALLOCATED", "APPROVED", "DISBURSED", "ACCEPTED"].includes(task.budgetStatus))
    .reduce((sum, task) => sum + task.budgetAmount.toNumber(), 0);
  const disbursed = link.project.tasks
    .filter((task) => task.budgetStatus === "DISBURSED")
    .reduce((sum, task) => sum + task.budgetAmount.toNumber(), 0);

  return {
    expiresAt: link.expiresAt,
    project: {
      ...link.project,
      totalBudget: link.project.totalBudget.toNumber(),
      tasks: link.project.tasks.map((task) => ({
        ...task,
        budgetAmount: task.budgetAmount.toNumber(),
      })),
    },
    budget: {
      planned: link.project.totalBudget.toNumber(),
      confirmed,
      allocated,
      consumed: disbursed,
      balance: confirmed - allocated,
      usagePercent: confirmed > 0 ? Math.round((allocated / confirmed) * 100) : 0,
    },
  };
}
