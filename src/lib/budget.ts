import { Prisma } from "@/generated/prisma/client";

type BudgetInput = {
  plannedBudget?: Prisma.Decimal | number | string | null;
  allocated?: Prisma.Decimal | number | string | null;
  expense?: Prisma.Decimal | number | string | null;
  refund?: Prisma.Decimal | number | string | null;
};

function decimal(value: BudgetInput[keyof BudgetInput]) {
  if (value instanceof Prisma.Decimal) return value;
  if (value === null || value === undefined || value === "") return new Prisma.Decimal(0);
  return new Prisma.Decimal(value);
}

export function calculateBudgetSnapshot(input: BudgetInput) {
  const plannedBudget = decimal(input.plannedBudget);
  const allocated = decimal(input.allocated);
  const expense = decimal(input.expense).abs();
  const refund = decimal(input.refund);
  const consumed = expense.sub(refund);
  const balance = allocated.sub(consumed);
  const usagePercent = allocated.gt(0)
    ? Math.round(consumed.div(allocated).times(100).toNumber())
    : 0;

  return {
    plannedBudget,
    allocated,
    expense,
    refund,
    consumed,
    balance,
    usagePercent,
    plannedVariance: allocated.sub(plannedBudget),
  };
}
