export type ProjectLifecycle = "UPCOMING" | "ACTIVE" | "COMPLETED";

export function getProjectLifecycle(input: {
  startDate: Date | null;
  taskStatuses: string[];
  now?: Date;
}): ProjectLifecycle {
  const now = input.now ?? new Date();
  const hasTasks = input.taskStatuses.length > 0;
  const allCompleted = hasTasks && input.taskStatuses.every((status) => status === "COMPLETED");
  if (allCompleted) return "COMPLETED";

  const hasStartedWork = input.taskStatuses.some((status) => status === "IN_PROGRESS" || status === "COMPLETED");
  if (!hasStartedWork && input.startDate && input.startDate > now) return "UPCOMING";

  return "ACTIVE";
}

export const PROJECT_LIFECYCLE_LABEL: Record<ProjectLifecycle, string> = {
  UPCOMING: "待启动",
  ACTIVE: "进行中",
  COMPLETED: "已完成",
};
