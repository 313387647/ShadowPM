export type AIBudgetSignal = {
  amount: number | null;
  type?: string | null;
  status?: string | null;
  confidence?: "high" | "medium" | "low" | null;
};

export function shouldCreateConfirmedBudgetFlow(item: AIBudgetSignal) {
  if (typeof item.amount !== "number" || item.amount <= 0) return false;
  const type = item.type?.trim().toUpperCase();
  const status = item.status?.trim().toUpperCase();
  const unsafeStatus = status === "DRAFT" || status === "PENDING_APPROVAL" || status === "PAUSED" || status === "CANCELLED";
  const unsafeType = type === "ESTIMATE" || type === "EXPENSE" || type === "REFUND" || type === "TRANSFER";

  return (
    item.confidence !== "low" &&
    !unsafeStatus &&
    !unsafeType &&
    (type === "ALLOCATE" || status === "APPROVED")
  );
}
