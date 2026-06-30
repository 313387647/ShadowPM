"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, MessageSquarePlus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TASK_STATUS_MAP } from "@/lib/constants";
import { createTask, updateTask } from "@/actions/task-actions";
import { addProgressLog } from "@/actions/timeline-actions";
import { cn } from "@/lib/utils";

type Task = {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  notes: string | null;
  assignee: string | null;
  department: string | null;
  deadline: Date | string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  priority: string;
  logs: { id: string; content: string; createdBy: string; createdAt: Date | string }[];
  _count: { logs: number; budgets: number; calendarEntries: number };
};

type ControlFilter = "ALL" | "MISSING" | "OVERDUE" | "WITH_BUDGET" | "WITH_LOGS" | "WITH_CALENDAR";

const CONTROL_FILTERS: { value: ControlFilter; label: string }[] = [
  { value: "ALL", label: "全部" },
  { value: "MISSING", label: "待补" },
  { value: "OVERDUE", label: "逾期" },
  { value: "WITH_BUDGET", label: "有预算" },
  { value: "WITH_LOGS", label: "有日志" },
  { value: "WITH_CALENDAR", label: "有日历" },
];

function getMissingFields(task: Task) {
  const missing: string[] = [];
  if (!task.assignee?.trim()) missing.push("负责人");
  if (!task.department?.trim()) missing.push("部门");
  if (!task.deadline) missing.push("截止");
  return missing;
}

function missingFieldToInput(field: string) {
  const map: Record<string, string> = {
    负责人: "assignee",
    部门: "department",
    截止: "deadline",
  };

  return map[field] ?? "assignee";
}

function isOverdue(task: Task) {
  if (!task.deadline || task.status === "COMPLETED") return false;
  const deadline = new Date(task.deadline);
  deadline.setHours(23, 59, 59, 999);
  return deadline < new Date();
}

function toDateInputValue(value: Task["deadline"]) {
  if (!value) return "";
  if (typeof value === "string") return value.split("T")[0] ?? "";
  return value.toISOString().split("T")[0] ?? "";
}

function formatLogDate(value: Date | string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function matchesControlFilter(task: Task, filter: ControlFilter) {
  if (filter === "ALL") return true;
  if (filter === "MISSING") return getMissingFields(task).length > 0;
  if (filter === "OVERDUE") return isOverdue(task);
  if (filter === "WITH_BUDGET") return task._count.budgets > 0;
  if (filter === "WITH_LOGS") return task._count.logs > 0;
  if (filter === "WITH_CALENDAR") return task._count.calendarEntries > 0;
  return true;
}

function matchesSearch(task: Task, query: string) {
  if (!query.trim()) return true;
  const normalizedQuery = query.trim().toLowerCase();
  return [
    task.name,
    task.description,
    task.notes,
    task.assignee,
    task.department,
    task.priority,
    TASK_STATUS_MAP[task.status],
  ].some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function isEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function ControlTableRow({
  task,
  focused,
}: {
  task: Task;
  focused: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(task.name);
  const [description, setDescription] = useState(task.description ?? "");
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const [department, setDepartment] = useState(task.department ?? "");
  const [deadline, setDeadline] = useState(toDateInputValue(task.deadline));
  const [notes, setNotes] = useState(task.notes ?? "");
  const [priority, setPriority] = useState(task.priority);
  const [status, setStatus] = useState<Task["status"]>(task.status);
  const [saving, setSaving] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [logContent, setLogContent] = useState("");
  const [syncLogToNotes, setSyncLogToNotes] = useState(true);
  const [logging, setLogging] = useState(false);

  const missing = getMissingFields({
    ...task,
    assignee,
    department,
    deadline: deadline || null,
  });
  const overdue = isOverdue({ ...task, deadline: deadline || null });
  const dirty =
    name !== task.name ||
    description !== (task.description ?? "") ||
    assignee !== (task.assignee ?? "") ||
    department !== (task.department ?? "") ||
    deadline !== toDateInputValue(task.deadline) ||
    notes !== (task.notes ?? "") ||
    priority !== task.priority ||
    status !== task.status;

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("taskId", task.id);
      formData.set("name", name);
      formData.set("assignee", assignee);
      formData.set("department", department);
      formData.set("deadline", deadline);
      formData.set("description", description);
      formData.set("notes", notes);
      formData.set("priority", priority);
      formData.set("status", status);

      const result = await updateTask(formData);
      if (result.success) {
        toast.success("管控表已更新");
        router.refresh();
      } else {
        toast.error(result.message ?? "保存失败");
      }
    } catch {
      toast.error("保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function submitProgressLog() {
    if (!logContent.trim() || logging) return;
    setLogging(true);
    try {
      const formData = new FormData();
      formData.set("taskId", task.id);
      formData.set("content", logContent);
      if (syncLogToNotes) formData.set("syncTaskNotes", "on");

      const result = await addProgressLog(formData);
      if (result.success) {
        toast.success(syncLogToNotes ? "进度更新已记录，当前结论已同步" : "进度更新已记录");
        if (syncLogToNotes) setNotes(logContent.trim());
        setLogContent("");
        router.refresh();
      } else {
        toast.error(result.message ?? "记录失败");
      }
    } catch {
      toast.error("记录失败");
    } finally {
      setLogging(false);
    }
  }

  function saveOnEnter(event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    }
  }

  return (
    <Fragment>
      <tr
        id={`control-task-${task.id}`}
        className={cn(
          "bg-card transition-colors hover:bg-muted/30",
          focused && "bg-primary/5 ring-1 ring-inset ring-primary/30",
          historyOpen && "bg-primary/5"
        )}
      >
      <td className="px-3 py-2">
        <div className="space-y-1">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={saveOnEnter}
            placeholder="管控事项"
            className="w-full rounded border border-transparent bg-transparent px-1 py-1 font-medium leading-5 outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background"
          />
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            onKeyDown={saveOnEnter}
            placeholder="详细描述"
            rows={2}
            className="w-full resize-none rounded border border-transparent bg-transparent px-1 py-1 text-[11px] leading-5 text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background"
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <input
          data-task-field={`${task.id}:assignee`}
          value={assignee}
          onChange={(event) => setAssignee(event.target.value)}
          onKeyDown={saveOnEnter}
          placeholder="待补"
          className="w-full rounded border border-transparent bg-transparent px-1 py-1 outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background"
        />
      </td>
      <td className="px-3 py-2">
        <input
          data-task-field={`${task.id}:department`}
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
          onKeyDown={saveOnEnter}
          placeholder="待补"
          className="w-full rounded border border-transparent bg-transparent px-1 py-1 outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          {overdue && <AlertTriangle className="size-3 text-destructive" />}
          <input
            data-task-field={`${task.id}:deadline`}
            type="date"
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
            onKeyDown={saveOnEnter}
            className={`w-full rounded border border-transparent bg-transparent px-1 py-1 outline-none transition-colors focus:border-primary focus:bg-background ${
              overdue ? "font-medium text-destructive" : ""
            }`}
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <Select
          value={status}
          onChange={(event) => setStatus(event.target.value as Task["status"])}
          className="h-8 text-xs"
        >
          <option value="PENDING">待启动</option>
          <option value="IN_PROGRESS">进行中</option>
          <option value="COMPLETED">已完成</option>
        </Select>
      </td>
      <td className="px-3 py-2">
        <Select
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          className="h-8 text-xs font-semibold"
        >
          <option value="P0">P0</option>
          <option value="P1">P1</option>
          <option value="P2">P2</option>
          <option value="P3">P3</option>
        </Select>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
        <Button
          type="button"
          size="sm"
          variant={historyOpen ? "secondary" : "ghost"}
          className="h-6 gap-1 px-2 text-[11px]"
          onClick={() => setHistoryOpen((value) => !value)}
        >
          <MessageSquarePlus className="size-3" />
          {task._count.logs}
        </Button>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
        {task._count.budgets > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => router.push(`/projects/${task.projectId}?tab=ledger&ledgerTask=${task.id}`)}
          >
            {task._count.budgets}
          </Button>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {task._count.calendarEntries > 0 ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-[11px]"
            onClick={() => router.push(`/projects/${task.projectId}?tab=calendar&calendarTask=${task.id}`)}
          >
            {task._count.calendarEntries}
          </Button>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>
      <td className="px-3 py-2">
        <input
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          onKeyDown={saveOnEnter}
          placeholder="暂无"
          className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-blue-600 outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background"
        />
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          {missing.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {missing.map((field) => (
                <span
                  key={field}
                  className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700"
                >
                  {field}
                </span>
              ))}
            </div>
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <CheckCircle2 className="size-3" />
              完整
            </span>
          )}
          {dirty && (
            <Button
              size="sm"
              variant="outline"
              className="h-6 shrink-0 px-2 text-[10px]"
              onClick={save}
              disabled={saving}
            >
              {saving ? "保存中" : "保存"}
            </Button>
          )}
        </div>
      </td>
      </tr>
      {historyOpen && (
        <tr className="border-t bg-primary/[0.03]">
          <td colSpan={11} className="px-3 py-3">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium">追加管控进展</p>
                  <span className="text-[11px] text-muted-foreground">直接沉淀到该事项历史，不改变其他字段</span>
                </div>
                <textarea
                  value={logContent}
                  onChange={(event) => setLogContent(event.target.value)}
                  placeholder="例如：供应商已反馈报价，待明天 12:00 前确认最终版本。"
                  rows={3}
                  className="w-full resize-none rounded-md border bg-background px-3 py-2 text-xs leading-5 outline-none placeholder:text-muted-foreground/50 focus:border-primary"
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={syncLogToNotes}
                      onChange={(event) => setSyncLogToNotes(event.target.checked)}
                      className="size-3.5 rounded border"
                    />
                    同时更新进度/结论
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={submitProgressLog}
                    disabled={logging || !logContent.trim()}
                  >
                    {logging ? "记录中" : "记录更新"}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium">最近更新</p>
                {task.logs.length === 0 ? (
                  <div className="rounded-md border border-dashed bg-background/60 px-3 py-4 text-xs text-muted-foreground">
                    暂无更新记录。第一条进展会从这里开始。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {task.logs.map((log) => (
                      <div key={log.id} className="rounded-md border bg-background px-3 py-2">
                        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                          <span>{log.createdBy}</span>
                          <span>{formatLogDate(log.createdAt)}</span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap text-xs leading-5">{log.content}</p>
                      </div>
                    ))}
                    {task._count.logs > task.logs.length && (
                      <p className="text-[11px] text-muted-foreground">
                        还有 {task._count.logs - task.logs.length} 条更早记录，可在项目活动中查看。
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export function ProjectControlTable({
  projectId,
  tasks,
}: {
  projectId: string;
  tasks: Task[];
}) {
  const router = useRouter();
  const createFormRef = useRef<HTMLFormElement>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ControlFilter>("ALL");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(tasks.length === 0);
  const [creating, setCreating] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();

  const overdueCount = tasks.filter(isOverdue).length;
  const filterCounts = CONTROL_FILTERS.reduce<Record<ControlFilter, number>>((counts, item) => {
    counts[item.value] = tasks.filter((task) => matchesControlFilter(task, item.value)).length;
    return counts;
  }, {
    ALL: 0,
    MISSING: 0,
    OVERDUE: 0,
    WITH_BUDGET: 0,
    WITH_LOGS: 0,
    WITH_CALENDAR: 0,
  });
  const visibleTasks = tasks.filter((task) => {
    return matchesControlFilter(task, filter) && matchesSearch(task, query);
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;

      if (event.key === "/" && !isEditingTarget(event.target)) {
        event.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }

      if (event.key === "Escape" && document.activeElement === searchRef.current && query) {
        event.preventDefault();
        setQuery("");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [query]);

  function jumpToTask(taskId: string, firstMissingField?: string) {
    setFocusedTaskId(taskId);
    document.getElementById(`control-task-${taskId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    window.setTimeout(() => {
      const field = firstMissingField ? missingFieldToInput(firstMissingField) : "assignee";
      const input = document.querySelector<HTMLInputElement>(
        `[data-task-field="${taskId}:${field}"]`
      );
      input?.focus();
      input?.select?.();
    }, 350);
    window.setTimeout(() => setFocusedTaskId(null), 1800);
  }

  useEffect(() => {
    const taskId = searchParams.get("focusTask");
    if (!taskId || !tasks.some((task) => task.id === taskId)) return;

    setFilter("ALL");
    setQuery("");
    window.setTimeout(() => jumpToTask(taskId), 250);
  }, [searchParams, tasks]);

  async function handleCreate(formData: FormData) {
    if (creating) return;
    setCreating(true);
    try {
      formData.set("projectId", projectId);
      const result = await createTask(formData);
      if (result.success) {
        toast.success("管控事项已添加");
        createFormRef.current?.reset();
        setShowCreate(false);
        setFilter("ALL");
        setQuery("");
        router.refresh();
      } else {
        toast.error(result.message ?? "添加失败");
      }
    } catch {
      toast.error("添加失败");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">项目管控表</p>
          <p className="text-xs text-muted-foreground">
            直接编辑事项、负责人、部门、截止、状态、优先级和进度结论
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => setShowCreate((value) => !value)}
          >
            <Plus className="size-3.5" />
            新增管控事项
          </Button>
          <Badge variant={overdueCount > 0 ? "destructive" : "outline"}>
            {overdueCount} 个逾期事项
          </Badge>
        </div>
      </div>

      {showCreate && (
        <form
          ref={createFormRef}
          action={handleCreate}
          className="rounded-lg border bg-card p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">新增管控事项</p>
              <p className="mt-1 text-xs text-muted-foreground">
                手动项目可以从这里直接补充管控表，不需要切换视图。
              </p>
            </div>
            <Button type="submit" size="sm" className="h-8 gap-1.5" disabled={creating}>
              {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              添加
            </Button>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-[1.4fr_1fr_1fr_150px]">
            <input
              name="name"
              required
              placeholder="管控事项，例如：发布会场地确认"
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            />
            <input
              name="assignee"
              placeholder="负责人"
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            />
            <input
              name="department"
              placeholder="部门"
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            />
            <input
              name="deadline"
              type="date"
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            <Select name="status" defaultValue="PENDING" className="h-9 text-sm">
              <option value="PENDING">待启动</option>
              <option value="IN_PROGRESS">进行中</option>
              <option value="COMPLETED">已完成</option>
            </Select>
            <Select name="priority" defaultValue="P2" className="h-9 text-sm">
              <option value="P0">P0 - 必须马上处理</option>
              <option value="P1">P1 - 关键事项</option>
              <option value="P2">P2 - 常规事项</option>
              <option value="P3">P3 - 低优先级</option>
            </Select>
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            <input
              name="description"
              placeholder="详细描述，例如：确认场地档期、面积、搭建限制和报价"
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            />
            <input
              name="notes"
              placeholder="进度/结论，例如：待供应商周五前反馈"
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            />
          </div>
        </form>
      )}

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">暂无管控事项</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            使用上方「新增管控事项」添加第一条，或用 AI 生成项目
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background p-2">
            <div className="flex flex-wrap gap-1.5">
              {CONTROL_FILTERS.map((item) => (
                <button
                  key={item.value}
                  data-control-filter={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors",
                    filter === item.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground"
                  )}
                >
                  {item.label}
                  <span className={cn(
                    "rounded-full px-1.5 text-[10px]",
                    filter === item.value ? "bg-primary-foreground/20" : "bg-muted"
                  )}>
                    {filterCounts[item.value]}
                  </span>
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-72">
              <input
                ref={searchRef}
                data-control-search="true"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索事项 / 负责人 / 部门"
                className="h-8 w-full rounded-md border bg-background px-2 pr-14 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-primary"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                /
              </span>
            </div>
          </div>
          <div className="border-b bg-muted/20 px-3 py-1.5 text-xs text-muted-foreground">
            当前显示 {visibleTasks.length} / {tasks.length} 条管控事项
          </div>
          <div className="overflow-x-auto">
            {visibleTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <p className="text-sm text-muted-foreground">当前筛选下暂无管控事项</p>
                <p className="mt-1 text-xs text-muted-foreground/60">
                  清空搜索或切回「全部」查看完整表格
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[1040px] text-left text-xs">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="min-w-56 px-3 py-2 font-medium">管控事项</th>
                    <th className="w-24 px-3 py-2 font-medium">负责人</th>
                    <th className="w-28 px-3 py-2 font-medium">部门</th>
                    <th className="w-24 px-3 py-2 font-medium">截止</th>
                    <th className="w-24 px-3 py-2 font-medium">状态</th>
                    <th className="w-20 px-3 py-2 font-medium">优先级</th>
                    <th className="w-20 px-3 py-2 text-right font-medium">日志</th>
                    <th className="w-20 px-3 py-2 text-right font-medium">预算</th>
                    <th className="w-20 px-3 py-2 text-right font-medium">日历</th>
                    <th className="min-w-48 px-3 py-2 font-medium">进度/结论</th>
                    <th className="w-36 px-3 py-2 font-medium">待补</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleTasks.map((task) => {
                    return (
                      <ControlTableRow
                        key={task.id}
                        task={task}
                        focused={focusedTaskId === task.id}
                      />
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
