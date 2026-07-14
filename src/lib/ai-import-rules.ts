export type AIBudgetSignal = {
  amount: number | null;
  type?: string | null;
  status?: string | null;
  confidence?: "high" | "medium" | "low" | null;
  conflicts?: string[] | null;
};

/**
 * AI extraction is source evidence, never a financial confirmation. Kept as a
 * compatibility export while callers migrate to the explicit draft-selection
 * rule below.
 */
export function shouldCreateConfirmedBudgetFlow(item: AIBudgetSignal) {
  void item;
  return false;
}

/** High-confidence, conflict-free rows can be selected for draft creation. */
export function shouldDefaultSelectAIBudgetItem(item: AIBudgetSignal) {
  return (
    typeof item.amount === "number" &&
    item.amount > 0 &&
    item.confidence === "high" &&
    (item.conflicts?.length ?? 0) === 0
  );
}

/** The user must choose a candidate before AI text becomes a confirmed pool. */
export function requiresTotalBudgetConfirmation(candidates: Array<number | null | undefined>, selectedAmount: number | null | undefined) {
  const distinctCandidates = Array.from(new Set(candidates.filter((amount): amount is number => typeof amount === "number" && amount > 0)));
  if (distinctCandidates.length === 0) return false;
  if (selectedAmount === null || selectedAmount === undefined || selectedAmount <= 0) return true;
  return distinctCandidates.length > 1 || !distinctCandidates.includes(selectedAmount);
}

export function resolveAIBudgetTaskId(params: {
  title?: string | null;
  relatedItemName?: string | null;
  workstream?: string | null;
  tasks: Array<{ id: string; name: string; workstream?: string | null }>;
}) {
  const tokens = [params.relatedItemName, params.title, params.workstream]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  for (const token of tokens) {
    const exact = params.tasks.find((task) => task.name === token || task.workstream === token);
    if (exact) return exact.id;
  }
  for (const token of tokens) {
    const fuzzy = params.tasks.find((task) => task.name.includes(token) || token.includes(task.name));
    if (fuzzy) return fuzzy.id;
  }
  return null;
}
