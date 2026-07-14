import { ProjectControlTable } from "@/components/project/ProjectControlTable";

export function TaskViewToggle({
  projectId, tasks, phases, canEdit, viewerName,
}: {
  projectId: string;
  tasks: { id: string; projectId: string; name: string; description: string | null; notes: string | null; assignee: string | null; department: string | null; deadline: Date | string | null; status: "PENDING" | "IN_PROGRESS" | "COMPLETED"; phaseId: string | null; priority: string; aiConfidence?: string | null; sourceRef?: string | null; needsConfirmation?: boolean; logs: { id: string; content: string; createdBy: string; createdAt: Date | string }[]; _count: { logs: number; calendarEntries: number } }[];
  phases: { id: string; name: string }[];
  canEdit: boolean;
  viewerName: string;
}) {
  return <ProjectControlTable projectId={projectId} tasks={tasks} phases={phases} canEdit={canEdit} viewerName={viewerName} />;
}
