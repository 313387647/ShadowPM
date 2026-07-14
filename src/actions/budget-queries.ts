"use server";

import { prisma } from "@/lib/prisma";
import { assertCanReadProject } from "@/lib/permissions";
import { calculateBudgetPlanningSnapshot, getBudgetItemRemaining } from "@/lib/budget-rules";

/** Read model for the future budget-planning and transaction views. */
export async function getProjectBudgetPlanning(projectId: string) {
  await assertCanReadProject(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      totalBudget: true,
      budgetMode: true,
      budgetConfirmedAt: true,
      budgetItems: {
        include: {
          taskRelations: { include: { task: { select: { id: true, name: true } } } },
          flows: { orderBy: { createdAt: "desc" } },
        },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      },
      budgetFlows: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!project) return null;

  const snapshot = calculateBudgetPlanningSnapshot({
    budgetMode: project.budgetMode,
    totalBudget: project.totalBudget,
    items: project.budgetItems,
    flows: project.budgetFlows,
  });

  return {
    projectId: project.id,
    pool: {
      mode: project.budgetMode,
      totalBudget: snapshot.totalBudget.toNumber(),
      confirmedAt: project.budgetConfirmedAt?.toISOString() ?? null,
      planned: snapshot.planned.toNumber(),
      remainingToAllocate: snapshot.remainingToAllocate.toNumber(),
      actualSpend: snapshot.actualSpend.toNumber(),
      overPlanned: snapshot.overPlanned,
    },
    items: project.budgetItems.map((item) => {
      const actualSpend = calculateBudgetPlanningSnapshot({
        budgetMode: "CONFIRMED",
        totalBudget: item.plannedAmount,
        items: [{ plannedAmount: item.plannedAmount, status: item.status }],
        flows: item.flows,
      }).actualSpend;
      return {
        id: item.id,
        title: item.title,
        category: item.category,
        plannedAmount: item.plannedAmount.toNumber(),
        actualSpend: actualSpend.toNumber(),
        remaining: getBudgetItemRemaining(item.plannedAmount, item.flows).toNumber(),
        status: item.status,
        description: item.description,
        source: item.source,
        aiConfidence: item.aiConfidence,
        sourceRef: item.sourceRef,
        createdBy: item.createdBy,
        updatedAt: item.updatedAt.toISOString(),
        taskIds: item.taskRelations.map((relation) => relation.task.id),
        taskNames: item.taskRelations.map((relation) => relation.task.name),
      };
    }),
    flows: project.budgetFlows.map((flow) => ({
      id: flow.id,
      budgetItemId: flow.budgetItemId,
      taskId: flow.taskId,
      action: flow.action,
      legacyOperation: flow.operation,
      flowType: flow.flowType,
      amount: flow.amount.toNumber(),
      counterparty: flow.counterparty,
      description: flow.description,
      createdBy: flow.createdBy,
      createdAt: flow.createdAt.toISOString(),
    })),
  };
}

/** A narrow task read model for optional budget-item relations. */
export async function getProjectBudgetTaskOptions(projectId: string) {
  await assertCanReadProject(projectId);
  return prisma.task.findMany({
    where: { projectId },
    select: { id: true, name: true, status: true },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}
