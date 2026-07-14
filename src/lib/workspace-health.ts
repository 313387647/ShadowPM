export type WorkspaceHealthLevel = "HEALTHY" | "WATCH" | "RISK";

export function getWorkspaceHealth(input: {
  overdueCount: number;
  missingInfoCount: number;
  budgetUsage: number;
  budgetBalance: number;
  hasUnconfirmedSpend: boolean;
}): WorkspaceHealthLevel {
  if (input.budgetBalance < 0 || input.hasUnconfirmedSpend || input.overdueCount > 0) return "RISK";
  if (input.missingInfoCount > 0 || input.budgetUsage >= 90) return "WATCH";
  return "HEALTHY";
}

export const WORKSPACE_HEALTH_LABEL: Record<WorkspaceHealthLevel, string> = {
  HEALTHY: "健康",
  WATCH: "预警",
  RISK: "风险",
};
