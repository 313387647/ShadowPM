import { ProjectControlTable } from "@/components/project/ProjectControlTable";

export function TaskViewToggle({
  projectId, tasks, phases, canEdit,
}: {
  projectId: string;
  tasks: { id: string; projectId: string; name: string; description: string | null; notes: string | null; assignee: string | null; department: string | null; deadline: Date | string | null; status: "PENDING" | "IN_PROGRESS" | "COMPLETED"; phaseId: string | null; priority: string; budgetAmount: { toNumber?: () => number } | number; budgetStatus: string; logs: { id: string; content: string; createdBy: string; createdAt: Date | string }[]; _count: { logs: number; budgets: number; calendarEntries: number } }[];
  phases: { id: string; name: string }[];
  canEdit: boolean;
}) {
  return <ProjectControlTable projectId={projectId} tasks={tasks} phases={phases} canEdit={canEdit} />;
}
