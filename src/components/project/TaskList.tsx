"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Circle, Play, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TASK_STATUS_MAP } from "@/lib/constants";
import { createTask, updateTaskStatus, updateTask, deleteTask } from "@/actions/task-actions";

type Task = {
  id: string; name: string; description: string | null; notes: string | null;
  assignee: string | null; department: string | null;
  deadline: Date | string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  _count: { logs: number; budgets: number };
};

const STATUS_DOT: Record<string, React.ReactNode> = {
  PENDING: <Circle className="size-3 text-muted-foreground" />,
  IN_PROGRESS: <Play className="size-3 text-blue-500" fill="currentColor" />,
  COMPLETED: <CheckCircle2 className="size-3 text-emerald-500" fill="currentColor" />,
};

const STATUS_BADGE: Record<string, "secondary" | "default" | "outline"> = {
  PENDING: "secondary",
  IN_PROGRESS: "default",
  COMPLETED: "outline",
};

const NEXT_STATUS: Record<string, string | null> = {
  PENDING: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  COMPLETED: null,
};

interface Props { projectId: string; tasks: Task[] }

export function TaskList({ projectId, tasks }: Props) {
  const router = useRouter();
  const createFormRef = useRef<HTMLFormElement>(null);
  const editFormRef = useRef<HTMLFormElement>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  // Edit state
  const [editTask, setEditTask] = useState<Task | null>(null);

  async function handleCreate(formData: FormData) {
    setCreating(true);
    try {
      formData.set("projectId", projectId);
      const result = await createTask(formData);
      if (result.success) { toast.success(result.message!); createFormRef.current?.reset(); setShowCreate(false); router.refresh(); }
      else { toast.error(result.message!); }
    } catch { toast.error("创建失败"); }
    finally { setCreating(false); }
  }

  async function handleStatusToggle(taskId: string, currentStatus: string) {
    const next = NEXT_STATUS[currentStatus]; if (!next) return;
    setToggling(taskId);
    try {
      const result = await updateTaskStatus(taskId, next);
      if (result.success) { toast.success(result.message!); router.refresh(); }
      else { toast.error(result.message!); }
    } catch { toast.error("状态变更失败"); }
    finally { setToggling(null); }
  }

  async function handleEdit(formData: FormData) {
    setCreating(true);
    try {
      if (editTask) formData.set("taskId", editTask.id);
      const result = await updateTask(formData);
      if (result.success) { toast.success(result.message!); setEditTask(null); router.refresh(); }
      else { toast.error(result.message!); }
    } catch { toast.error("编辑失败"); }
    finally { setCreating(false); }
  }

  async function handleDelete(taskId: string, taskName: string) {
    if (!confirm(`确定删除「${taskName}」吗？关联的日志和流水也会被删除。`)) return;
    try {
      const result = await deleteTask(taskId);
      if (result.success) { toast.success(result.message!); router.refresh(); }
      else { toast.error(result.message!); }
    } catch { toast.error("删除失败"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {tasks.length} 个子任务</p>
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="size-3.5" />新增任务
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">暂无子任务</p>
          <p className="text-xs text-muted-foreground/60 mt-1">点击「新增任务」拆解工作项</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40">
              <button
                onClick={() => handleStatusToggle(task.id, task.status)}
                disabled={toggling === task.id || !NEXT_STATUS[task.status]}
                className="shrink-0"
                title={NEXT_STATUS[task.status] ? `切换为 ${TASK_STATUS_MAP[NEXT_STATUS[task.status]! as keyof typeof TASK_STATUS_MAP] ?? ""}` : "已完成"}
              >
                {toggling === task.id ? <Loader2 className="size-4 animate-spin" /> : STATUS_DOT[task.status] ?? null}
              </button>

              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${task.status === "COMPLETED" ? "text-muted-foreground line-through" : ""}`}>
                  {task.name}
                </p>
                {task.description && (
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                )}
                {task.notes && (
                  <p className="text-[11px] text-blue-600 mt-0.5 bg-blue-50/50 rounded px-1.5 py-0.5 inline-block">{task.notes}</p>
                )}
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  {task.assignee && <span>👤 {task.assignee}</span>}
                  {task.department && <span className="text-muted-foreground/60">🏢 {task.department}</span>}
                  {task.deadline && <span>📅 {new Date(task.deadline).toLocaleDateString("zh-CN")}</span>}
                  <span>{task._count.logs} 条日志</span>
                </div>
              </div>

              <Badge variant={STATUS_BADGE[task.status] ?? "secondary"} className="shrink-0">
                {TASK_STATUS_MAP[task.status as keyof typeof TASK_STATUS_MAP] ?? task.status}
              </Badge>

              {/* Edit + Delete buttons */}
              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-foreground"
                  onClick={() => setEditTask(task)} title="编辑任务">
                  <Pencil className="size-3" />
                </Button>
                <Button variant="ghost" size="icon" className="size-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(task.id, task.name)} title="删除任务">
                  <Trash2 className="size-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>新增子任务</DialogTitle></DialogHeader>
          <form ref={createFormRef} action={handleCreate} className="space-y-4">
            <input type="hidden" name="projectId" value={projectId} />
            <div>
              <label className="block text-sm font-medium mb-1.5">任务名称 <span className="text-red-500">*</span></label>
              <input name="name" required placeholder="例如：公关传播线" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">负责人</label>
              <input name="assignee" placeholder="例如：林小夏" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">截止日期</label>
              <input name="deadline" type="date" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
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
            <form ref={editFormRef} action={handleEdit} className="space-y-4">
              <input type="hidden" name="taskId" value={editTask.id} />
              <div>
                <label className="block text-sm font-medium mb-1.5">任务名称 <span className="text-red-500">*</span></label>
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
              <div className="flex justify-end gap-3 pt-2">
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
