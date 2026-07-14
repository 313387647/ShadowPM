import { Prisma } from "@/generated/prisma/client";

export const BUDGET_ITEM_STATUSES = ["DRAFT", "CONFIRMED", "IN_PROGRESS", "SETTLED", "CANCELED"] as const;
export const PROJECT_BUDGET_MODES = ["PENDING", "CONFIRMED", "NOT_MANAGED"] as const;
export const BUDGET_FLOW_ACTIONS = [
  "POOL_CONFIRMED",
  "POOL_ADJUSTED",
  "ITEM_CONFIRMED",
  "ITEM_ADJUSTED",
  "APPROVAL_RECORDED",
  "TRANSFER_RECORDED",
  "EXPENSE_RECORDED",
  "REFUND_RECORDED",
  "SETTLED",
  "CANCELED",
  "REVERSED",
  "LEGACY_IMPORTED",
] as const;

export type BudgetItemStatusValue = (typeof BUDGET_ITEM_STATUSES)[number];
export type ProjectBudgetModeValue = (typeof PROJECT_BUDGET_MODES)[number];
export type BudgetFlowActionValue = (typeof BUDGET_FLOW_ACTIONS)[number];

type DecimalInput = Prisma.Decimal | number | string | null | undefined;

export type BudgetItemAmount = {
  plannedAmount: DecimalInput;
  status: BudgetItemStatusValue | string;
};

export type BudgetFlowAmount = {
  amount: DecimalInput;
  action?: BudgetFlowActionValue | string | null;
  flowType?: "ALLOCATE" | "EXPENSE" | "REFUND" | string | null;
};

function decimal(value: DecimalInput) {
  if (value instanceof Prisma.Decimal) return value;
  if (value === null || value === undefined || value === "") return new Prisma.Decimal(0);
  return new Prisma.Decimal(value);
}

export function isBudgetItemStatus(value: string): value is BudgetItemStatusValue {
  return BUDGET_ITEM_STATUSES.includes(value as BudgetItemStatusValue);
}

export function isProjectBudgetMode(value: string): value is ProjectBudgetModeValue {
  return PROJECT_BUDGET_MODES.includes(value as ProjectBudgetModeValue);
}

export function isBudgetFlowAction(value: string): value is BudgetFlowActionValue {
  return BUDGET_FLOW_ACTIONS.includes(value as BudgetFlowActionValue);
}

export function isBudgetItemActive(status: string) {
  return status !== "CANCELED";
}

export function isBudgetItemConfirmed(status: string) {
  return ["CONFIRMED", "IN_PROGRESS", "SETTLED"].includes(status);
}

/**
 * Planning and cash movement are deliberately separate: remainingToAllocate
 * answers "how much pool remains for new plans", while actualSpend answers
 * "how much cash is currently consumed".
 */
export function calculateBudgetPlanningSnapshot(input: {
  budgetMode: ProjectBudgetModeValue | string;
  totalBudget: DecimalInput;
  items: BudgetItemAmount[];
  flows: BudgetFlowAmount[];
}) {
  const totalBudget = decimal(input.totalBudget);
  const hasConfirmedPool = input.budgetMode === "CONFIRMED";
  const planned = input.items.reduce(
    (sum, item) => isBudgetItemActive(item.status) ? sum.add(decimal(item.plannedAmount)) : sum,
    new Prisma.Decimal(0)
  );
  const confirmedPlanned = input.items.reduce(
    (sum, item) => isBudgetItemConfirmed(item.status) ? sum.add(decimal(item.plannedAmount)) : sum,
    new Prisma.Decimal(0)
  );

  const expense = input.flows.reduce((sum, flow) => {
    const isExpense = flow.action === "EXPENSE_RECORDED" || (!flow.action && flow.flowType === "EXPENSE");
    return isExpense ? sum.add(decimal(flow.amount).abs()) : sum;
  }, new Prisma.Decimal(0));
  const refund = input.flows.reduce((sum, flow) => {
    const isRefund = flow.action === "REFUND_RECORDED" || (!flow.action && flow.flowType === "REFUND");
    return isRefund ? sum.add(decimal(flow.amount).abs()) : sum;
  }, new Prisma.Decimal(0));
  const actualSpend = Prisma.Decimal.max(expense.sub(refund), new Prisma.Decimal(0));
  const remainingToAllocate = hasConfirmedPool ? totalBudget.sub(planned) : new Prisma.Decimal(0);

  return {
    totalBudget,
    planned,
    confirmedPlanned,
    remainingToAllocate,
    expense,
    refund,
    actualSpend,
    overPlanned: hasConfirmedPool && planned.gt(totalBudget),
  };
}

export function getBudgetItemRemaining(plannedAmount: DecimalInput, flows: BudgetFlowAmount[]) {
  const snapshot = calculateBudgetPlanningSnapshot({
    budgetMode: "CONFIRMED",
    totalBudget: plannedAmount,
    items: [{ plannedAmount, status: "CONFIRMED" }],
    flows,
  });
  // A negative value is meaningful: it exposes an item-level overspend instead
  // of masking it as a harmless zero balance.
  return snapshot.totalBudget.sub(snapshot.actualSpend);
}

export function canConfirmBudgetItem(params: {
  budgetMode: ProjectBudgetModeValue | string;
  proposedPlannedAmount: DecimalInput;
  otherActivePlannedAmount: DecimalInput;
  totalBudget: DecimalInput;
}) {
  if (params.budgetMode !== "CONFIRMED") {
    return { allowed: false, message: "请先确认项目总预算，再确认预算项。" };
  }

  const proposed = decimal(params.proposedPlannedAmount);
  const total = decimal(params.totalBudget);
  const nextPlanned = decimal(params.otherActivePlannedAmount).add(proposed);
  if (proposed.lte(0)) return { allowed: false, message: "已确认预算项必须大于 0。" };
  if (nextPlanned.gt(total)) {
    return {
      allowed: false,
      message: `预算项合计超出项目总预算 ${nextPlanned.sub(total).toFixed(2)}。`,
    };
  }

  return { allowed: true as const, message: null, nextPlanned };
}

export function requiresBudgetChangeReason(params: {
  previousStatus: string;
  nextStatus: string;
  amountChanged: boolean;
  isProjectPool?: boolean;
  poolWasConfirmed?: boolean;
}) {
  if (params.isProjectPool) {
    return Boolean(params.poolWasConfirmed && (params.amountChanged || params.nextStatus !== "CONFIRMED"));
  }
  if (params.previousStatus === "DRAFT") return false;
  return params.amountChanged || params.nextStatus === "CANCELED" || params.previousStatus === "SETTLED";
}

export function normalizeMoneyInput(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value.replace(/,/g, "").trim() : "";
  const amount = new Prisma.Decimal(raw || "NaN");
  return amount.isNaN() || amount.lt(0) ? null : amount;
}

/** Empty task links are valid: a budget plan can precede its control items. */
export function normalizeBudgetItemTaskIds(taskIds: string[] | null | undefined) {
  return Array.from(new Set((taskIds ?? []).map((taskId) => taskId.trim()).filter(Boolean)));
}

export function mapLegacyTaskBudgetStatus(status: string): BudgetItemStatusValue {
  if (status === "ALLOCATED") return "CONFIRMED";
  if (status === "APPROVED" || status === "DISBURSED") return "IN_PROGRESS";
  if (status === "ACCEPTED") return "SETTLED";
  if (status === "CANCELED") return "CANCELED";
  return "DRAFT";
}

/** A task deletion only removes the optional relation, never the budget item. */
export function getTaskDeletionBudgetEffect() {
  return { deleteBudgetItem: false, deleteTaskRelation: true };
}
