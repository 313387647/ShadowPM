import { calculateBudgetPlanningSnapshot } from "@/lib/budget-rules";
import { Prisma } from "@/generated/prisma/client";

type DecimalInput = Prisma.Decimal | number | string;
type BudgetItemInput = { plannedAmount: DecimalInput; status: string };
type BudgetFlowInput = { amount: DecimalInput; action?: string | null; flowType?: string | null };

/** Canonical read model shared by project, workspace, dashboard, and exports. */
export function getProjectBudgetSummary(input: {
  budgetMode: string;
  totalBudget: DecimalInput;
  budgetItems: BudgetItemInput[];
  budgetFlows: BudgetFlowInput[];
}) {
  const snapshot = calculateBudgetPlanningSnapshot({
    budgetMode: input.budgetMode,
    totalBudget: input.totalBudget,
    items: input.budgetItems,
    flows: input.budgetFlows,
  });
  const confirmedBudget = input.budgetMode === "CONFIRMED" ? snapshot.totalBudget.toNumber() : 0;
  const actualSpend = snapshot.actualSpend.toNumber();
  return {
    mode: input.budgetMode,
    totalBudget: snapshot.totalBudget.toNumber(),
    confirmedBudget,
    planned: snapshot.planned.toNumber(),
    remainingToAllocate: snapshot.remainingToAllocate.toNumber(),
    expense: snapshot.expense.toNumber(),
    refund: snapshot.refund.toNumber(),
    actualSpend,
    spendRemaining: confirmedBudget - actualSpend,
    usagePercent: confirmedBudget > 0 ? Math.round((actualSpend / confirmedBudget) * 100) : 0,
    overPlanned: snapshot.overPlanned,
  };
}
