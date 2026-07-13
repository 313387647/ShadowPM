import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { calculateBudgetSnapshot } from "@/lib/budget";
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
              budgets: {
                select: {
                  id: true,
                  flowType: true,
                  operation: true,
                  amount: true,
                  description: true,
                  createdAt: true,
                },
                orderBy: { createdAt: "desc" },
              },
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

  const flows = link.project.tasks.flatMap((task) => task.budgets);
  const budget = calculateBudgetSnapshot({
    plannedBudget: link.project.totalBudget,
    allocated: flows.filter((flow) => flow.flowType === "ALLOCATE").reduce((sum, flow) => sum + flow.amount.toNumber(), 0),
    expense: flows.filter((flow) => flow.flowType === "EXPENSE").reduce((sum, flow) => sum + flow.amount.toNumber(), 0),
    refund: flows.filter((flow) => flow.flowType === "REFUND").reduce((sum, flow) => sum + flow.amount.toNumber(), 0),
  });

  return {
    expiresAt: link.expiresAt,
    project: {
      ...link.project,
      totalBudget: link.project.totalBudget.toNumber(),
      tasks: link.project.tasks.map((task) => ({
        ...task,
        budgets: task.budgets.map((flow) => ({ ...flow, amount: flow.amount.toNumber() })),
      })),
    },
    budget: {
      planned: budget.plannedBudget.toNumber(),
      confirmed: budget.allocated.toNumber(),
      consumed: budget.consumed.toNumber(),
      balance: budget.balance.toNumber(),
      usagePercent: budget.usagePercent,
    },
  };
}
