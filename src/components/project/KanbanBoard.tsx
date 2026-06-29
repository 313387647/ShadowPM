"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, GripVertical, Clock, User as UserIcon, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { createTask, updateTaskStatus, updateTask, deleteTask } from "@/actions/task-actions";

type Task = {
  id: string; name: string; description: string | null; notes: string | null;
  assignee: string | null; department: string | null;
  deadline: Date | string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  phaseId: string | null; priority: string;
  _count: { logs: number };
};

type Phase = { id: string; name: string };

interface Props { projectId: string; tasks: Task[]; phases: Phase[] }

const COLUMNS = [
  { key: "PENDING", label: "待启动", color: "bg-muted/50", border: "border-muted-foreground/20" },
  { key: "IN_PROGRESS", label: "进行中", color: "bg-blue-50/30", border: "border-blue-200" },
  { key: "COMPLETED", label: "已完成", color: "bg-emerald-50/30", border: "border-emerald-200" },
] as const;

const PRIORITY_COLORS: Record<string, string> = {
  P0: "bg-red-100 text-red-700", P1: "bg-amber-100 text-amber-700",
  P2: "bg-muted text-muted-foreground", P3: "bg-muted/50 text-muted-foreground/50",
};

export function KanbanBoard({ projectId, tasks, phases }: Props) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [moving, setMoving] = useState<string | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [filterPhase, setFilterPhase] = useState<string | null>(null);

  async function handleCreate(formData: FormData) {
    setCreating(true);
    try {
      formData.set("projectId", projectId);
      if (filterPhase) formData.set("phaseId", filterPhase);
      const r = await createTask(formData);
      if (r.success) { toast.success(r.message!); setShowCreate(false); router.refresh(); }
      else { toast.error(r.message!); }
    } catch { toast.error("创建失败"); }
    finally { setCreating(false); }
  }

  async function handleMove(taskId: string, toStatus: string) {
    setMoving(taskId);
    try {
      const r = await updateTaskStatus(taskId, toStatus);
      if (r.success) { toast.success(r.message!); router.refresh(); }
      else { toast.error(r.message!); }
    } catch { toast.error("操作失败"); }
    finally { setMoving(null); }
  }

  async function handleDelete(taskId: string, taskName: string) {
    if (!confirm(`删除「${taskName}」？`)) return;
    try {
      const r = await deleteTask(taskId);
      if (r.success) { toast.success(r.message!); router.refresh(); }
      else { toast.error(r.message!); }
    } catch { toast.error("删除失败"); }
  }

  async function handleEdit(formData: FormData) {
    setCreating(true);
    try {
      if (editTask) formData.set("taskId", editTask.id);
      const r = await updateTask(formData);
      if (r.success) { toast.success(r.message!); setEditTask(null); router.refresh(); }
      else { toast.error(r.message!); }
    } catch { toast.error("编辑失败"); }
    finally { setCreating(false); }
  }

  const phaseLabel = (pid: string | null) => {
    if (!pid) return null;
    return phases.find((p) => p.id === pid)?.name ?? null;
  };

  const filtered = filterPhase
    ? tasks.filter((t) => t.phaseId === filterPhase)
    : tasks;

  // Group by phase within the filtered set
  const statusGroups: Record<string, Map<string | null, Task[]>> = {
    PENDING: new Map(), IN_PROGRESS: new Map(), COMPLETED: new Map(),
  };
  for (const t of filtered) {
    const m = statusGroups[t.status];
    const key = t.phaseId;
    if (!m.has(key)) m.set(key, []);
    m.get(key)!.push(t);
  }

  return (
    <div className="space-y-4">
      {/* 顶部筛选 + 操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            {filtered.length} 个任务
          </p>
          {phases.length > 0 && (
            <select
              value={filterPhase ?? ""}
              onChange={(e) => setFilterPhase(e.target.value || null)}
              className="rounded-lg border px-2 py-1 text-xs outline-none bg-background"
            >
              <option value="">全部阶段</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="size-3.5" />新增任务
        </Button>
      </div>

      {/* 看板列 */}
      <div className="grid gap-4 lg:grid-cols-3">
        {COLUMNS.map((col) => {
          const groups = statusGroups[col.key];
          const totalInCol = Array.from(groups.values()).reduce((s, g) => s + g.length, 0);
          return (
            <div key={col.key} className={`rounded-xl border ${col.border} ${col.color} p-3 space-y-3 min-h-[200px]`}>
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">{col.label}</h4>
                <Badge variant="outline" className="text-[10px] h-4 px-1.5">{totalInCol}</Badge>
              </div>

              {Array.from(groups.entries()).map(([phaseId, tasksInGroup]) => {
                const phName = phaseLabel(phaseId);
                return (
                  <div key={phaseId ?? "__none"} className="space-y-2">
                    {phName && (
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
                        📁 {phName}
                      </p>
                    )}
                    {tasksInGroup.map((task) => (
                      <div
                        key={task.id}
                        className="group rounded-lg border bg-card p-3 shadow-sm hover:shadow-md transition-all"
                      >
                        {/* 顶行：优先级 + 状态 */}
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {task.priority !== "P2" && (
                            <span className={`text-[9px] rounded px-1 py-0.5 font-bold ${PRIORITY_COLORS[task.priority] ?? ""}`}>
                              {task.priority}
                            </span>
                          )}
                          <p className="text-sm font-medium flex-1">{task.name}</p>
                          {col.key !== "COMPLETED" && col.key !== "PENDING" && (
                            <Button variant="ghost" size="icon" className="size-5 opacity-0 group-hover:opacity-100"
                              onClick={() => handleMove(task.id, "COMPLETED")}
                              title="标记完成" disabled={moving === task.id}>
                              {moving === task.id ? <Loader2 className="size-3 animate-spin" /> : <GripVertical className="size-3" />}
                            </Button>
                          )}
                        </div>

                        {/* 描述 */}
                        {task.description && (
                          <p className="text-[10px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{task.description}</p>
                        )}
                        {/* 进度备注 */}
                        {task.notes && (
                          <p className="text-[10px] text-blue-600 mt-1 bg-blue-50/50 rounded px-1.5 py-0.5">{task.notes}</p>
                        )}
                        {/* 元信息 */}
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5">
                          <span className="flex items-center gap-1">
                            {task.assignee && <><UserIcon className="size-3" />{task.assignee}</>}
                            {task.department && <span className="text-[9px] text-muted-foreground/60">({task.department})</span>}
                          </span>
                          <span className="flex items-center gap-1">
                            {task.deadline && <><Clock className="size-3" />{new Date(task.deadline).toLocaleDateString("zh-CN")}</>}
                          </span>
                        </div>

                        {/* 操作按钮 */}
                        <div className="flex gap-1 mt-2 pt-2 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                          {col.key === "PENDING" && (
                            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1"
                              onClick={() => handleMove(task.id, "IN_PROGRESS")}
                              disabled={moving === task.id}>
                              开始
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-6 px-1.5"
                            onClick={() => setEditTask(task)}>
                            <Pencil className="size-3" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-6 px-1.5 text-destructive"
                            onClick={() => handleDelete(task.id, task.name)}>
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })}

              {totalInCol === 0 && (
                <p className="text-xs text-muted-foreground/40 text-center py-8">暂无</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增任务</DialogTitle></DialogHeader>
          <form action={handleCreate} className="space-y-4">
            <input type="hidden" name="projectId" value={projectId} />
            <div>
              <label className="block text-sm font-medium mb-1.5">任务名称 <span className="text-red-500">*</span></label>
              <input name="name" required placeholder="任务名称" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">负责人</label>
              <input name="assignee" placeholder="负责人姓名" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">截止日期</label>
              <input name="deadline" type="date" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={() => setShowCreate(false)}>取消</Button>
              <Button type="submit" disabled={creating} className="gap-1.5">
                {creating && <Loader2 className="size-3.5 animate-spin" />}创建
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editTask} onOpenChange={() => setEditTask(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>编辑任务</DialogTitle></DialogHeader>
          {editTask && (
            <form action={handleEdit} className="space-y-4">
              <input type="hidden" name="taskId" value={editTask.id} />
              <div>
                <label className="block text-sm font-medium mb-1.5">任务名称</label>
                <input name="name" required defaultValue={editTask.name} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">负责人</label>
                <input name="assignee" defaultValue={editTask.assignee ?? ""} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5">截止日期</label>
                <input name="deadline" type="date" defaultValue={typeof editTask.deadline === "string" ? editTask.deadline.split("T")[0] : editTask.deadline ? new Date(editTask.deadline).toISOString().split("T")[0] : ""} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setEditTask(null)}>取消</Button>
                <Button type="submit" disabled={creating} className="gap-1.5">
                  {creating && <Loader2 className="size-3.5 animate-spin" />}保存
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
