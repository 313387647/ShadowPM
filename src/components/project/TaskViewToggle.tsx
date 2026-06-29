"use client";

import { useState } from "react";
import { List, LayoutGrid, Table2 } from "lucide-react";
import { TaskList } from "@/components/project/TaskList";
import { KanbanBoard } from "@/components/project/KanbanBoard";
import { ProjectControlTable } from "@/components/project/ProjectControlTable";

type View = "control" | "list" | "kanban";

export function TaskViewToggle({
  projectId, tasks, phases,
}: {
  projectId: string;
  tasks: { id: string; projectId: string; name: string; description: string | null; notes: string | null; assignee: string | null; department: string | null; deadline: Date | string | null; status: "PENDING" | "IN_PROGRESS" | "COMPLETED"; phaseId: string | null; priority: string; logs: { id: string; content: string; createdBy: string; createdAt: Date | string }[]; _count: { logs: number; budgets: number; calendarEntries: number } }[];
  phases: { id: string; name: string }[];
}) {
  const [view, setView] = useState<View>("control");

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end gap-1">
        <button
          onClick={() => setView("control")}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
            view === "control" ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Table2 className="size-3" /> 管控表
        </button>
        <button
          onClick={() => setView("list")}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
            view === "list" ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <List className="size-3" /> 列表
        </button>
        <button
          onClick={() => setView("kanban")}
          className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs transition-colors ${
            view === "kanban" ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <LayoutGrid className="size-3" /> 看板
        </button>
      </div>

      {view === "control" ? (
        <ProjectControlTable projectId={projectId} tasks={tasks} phases={phases} />
      ) : view === "list" ? (
        <TaskList projectId={projectId} tasks={tasks} />
      ) : (
        <KanbanBoard projectId={projectId} tasks={tasks} phases={phases} />
      )}
    </div>
  );
}
