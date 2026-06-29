"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CheckCircle2, Circle, History, Play, Target } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TASK_STATUS_MAP } from "@/lib/constants";
import { fillMissingTaskFields, updateTask } from "@/actions/task-actions";
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
  phaseId: string | null;
  priority: string;
  _count: { logs: number; budgets: number; calendarEntries: number };
};

type Phase = { id: string; name: string };
type ControlFilter = "ALL" | "MISSING" | "OVERDUE" | "WITH_BUDGET" | "WITH_LOGS" | "WITH_CALENDAR";

const CONTROL_FILTERS: { value: ControlFilter; label: string }[] = [
  { value: "ALL", label: "全部" },
  { value: "MISSING", label: "待补" },
  { value: "OVERDUE", label: "逾期" },
  { value: "WITH_BUDGET", label: "有预算" },
  { value: "WITH_LOGS", label: "有日志" },
  { value: "WITH_CALENDAR", label: "有日历" },
];

const STATUS_ICON = {
  PENDING: <Circle className="size-3 text-muted-foreground" />,
  IN_PROGRESS: <Play className="size-3 text-blue-500" fill="currentColor" />,
  COMPLETED: <CheckCircle2 className="size-3 text-emerald-500" fill="currentColor" />,
};

const STATUS_BADGE: Record<Task["status"], "secondary" | "default" | "outline"> = {
  PENDING: "secondary",
  IN_PROGRESS: "default",
  COMPLETED: "outline",
};

const PRIORITY_CLASS: Record<string, string> = {
  P0: "bg-red-100 text-red-700",
  P1: "bg-amber-100 text-amber-700",
  P2: "bg-muted text-muted-foreground",
  P3: "bg-muted/60 text-muted-foreground",
};

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

function matchesControlFilter(task: Task, filter: ControlFilter) {
  if (filter === "ALL") return true;
  if (filter === "MISSING") return getMissingFields(task).length > 0;
  if (filter === "OVERDUE") return isOverdue(task);
  if (filter === "WITH_BUDGET") return task._count.budgets > 0;
  if (filter === "WITH_LOGS") return task._count.logs > 0;
  if (filter === "WITH_CALENDAR") return task._count.calendarEntries > 0;
  return true;
}

function matchesSearch(task: Task, phaseName: string, query: string) {
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
    phaseName,
  ].some((value) => value?.toLowerCase().includes(normalizedQuery));
}

function isEditingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

function ControlTableRow({
  task,
  phaseName,
  focused,
}: {
  task: Task;
  phaseName: string;
  focused: boolean;
}) {
  const router = useRouter();
  const [assignee, setAssignee] = useState(task.assignee ?? "");
  const [department, setDepartment] = useState(task.department ?? "");
  const [deadline, setDeadline] = useState(toDateInputValue(task.deadline));
  const [notes, setNotes] = useState(task.notes ?? "");
  const [saving, setSaving] = useState(false);

  const missing = getMissingFields({
    ...task,
    assignee,
    department,
    deadline: deadline || null,
  });
  const overdue = isOverdue({ ...task, deadline: deadline || null });
  const dirty =
    assignee !== (task.assignee ?? "") ||
    department !== (task.department ?? "") ||
    deadline !== toDateInputValue(task.deadline) ||
    notes !== (task.notes ?? "");

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("taskId", task.id);
      formData.set("name", task.name);
      formData.set("assignee", assignee);
      formData.set("department", department);
      formData.set("deadline", deadline);
      formData.set("description", task.description ?? "");
      formData.set("notes", notes);

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

  function saveOnEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    }
  }

  return (
    <tr
      id={`control-task-${task.id}`}
      className={cn(
        "bg-card transition-colors hover:bg-muted/30",
        focused && "bg-primary/5 ring-1 ring-inset ring-primary/30"
      )}
    >
      <td className="px-3 py-2 text-muted-foreground">
        <span className="line-clamp-1">{phaseName}</span>
      </td>
      <td className="px-3 py-2">
        <div className="space-y-0.5">
          <p className="font-medium leading-5">{task.name}</p>
          {task.description && (
            <p className="line-clamp-1 text-[11px] text-muted-foreground">
              {task.description}
            </p>
          )}
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
        <Badge variant={STATUS_BADGE[task.status]} className="gap-1">
          {STATUS_ICON[task.status]}
          {TASK_STATUS_MAP[task.status]}
        </Badge>
      </td>
      <td className="px-3 py-2">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${PRIORITY_CLASS[task.priority] ?? PRIORITY_CLASS.P2}`}>
          {task.priority}
        </span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
        {task._count.logs}
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
  );
}

export function ProjectControlTable({
  tasks,
  phases,
}: {
  tasks: Task[];
  phases: Phase[];
}) {
  const router = useRouter();
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ControlFilter>("ALL");
  const [query, setQuery] = useState("");
  const [bulkAssignee, setBulkAssignee] = useState("");
  const [bulkDepartment, setBulkDepartment] = useState("");
  const [bulkDeadline, setBulkDeadline] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();
  const phaseName = (phaseId: string | null) =>
    phaseId ? phases.find((phase) => phase.id === phaseId)?.name ?? "未分组" : "未分组";

  const missingCount = tasks.reduce(
    (sum, task) => sum + getMissingFields(task).length,
    0
  );
  const overdueCount = tasks.filter(isOverdue).length;
  const incompleteTasks = tasks
    .map((task) => ({
      task,
      missing: getMissingFields(task),
      overdue: isOverdue(task),
      phaseName: phaseName(task.phaseId),
    }))
    .filter((item) => item.missing.length > 0 || item.overdue)
    .sort((a, b) => {
      if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
      return b.missing.length - a.missing.length;
    });
  const totalRequiredFields = tasks.length * 3;
  const readiness = totalRequiredFields > 0
    ? Math.round(((totalRequiredFields - missingCount) / totalRequiredFields) * 100)
    : 100;
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
    const name = phaseName(task.phaseId);
    return matchesControlFilter(task, filter) && matchesSearch(task, name, query);
  });
  const visibleIncompleteTasks = visibleTasks.filter((task) => getMissingFields(task).length > 0);

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

  async function applyBulkFill() {
    if (bulkSaving) return;
    if (visibleIncompleteTasks.length === 0) {
      toast.info("当前筛选范围没有待补字段");
      return;
    }
    if (!bulkAssignee.trim() && !bulkDepartment.trim() && !bulkDeadline) {
      toast.error("至少填写一个要补齐的字段");
      return;
    }

    setBulkSaving(true);
    try {
      const formData = new FormData();
      formData.set("taskIds", JSON.stringify(visibleIncompleteTasks.map((task) => task.id)));
      formData.set("assignee", bulkAssignee);
      formData.set("department", bulkDepartment);
      formData.set("deadline", bulkDeadline);

      const result = await fillMissingTaskFields(formData);
      if (result.success) {
        toast.success(
          result.message
            ? `${result.message}，已写入活动流摘要`
            : "批量补齐完成，已写入活动流摘要"
        );
        setBulkAssignee("");
        setBulkDepartment("");
        setBulkDeadline("");
        router.refresh();
      } else {
        toast.error(result.message ?? "批量补齐失败");
      }
    } catch {
      toast.error("批量补齐失败");
    } finally {
      setBulkSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">项目管控表</p>
          <p className="text-xs text-muted-foreground">
            一屏查看任务、责任、进度、风险和待补信息
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={missingCount > 0 ? "destructive" : "secondary"}>
            {missingCount} 个待补字段
          </Badge>
          <Badge variant={overdueCount > 0 ? "destructive" : "outline"}>
            {overdueCount} 个逾期事项
          </Badge>
        </div>
      </div>

      {tasks.length > 0 && (
        <div className="rounded-lg border bg-muted/20 p-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Target className="size-4 text-primary" />
                <p className="text-sm font-medium">信息补齐队列</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                AI 生成后优先确认负责人、部门和截止日期，避免执行口径漂移
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={readiness >= 90 ? "secondary" : "destructive"}>
                完整度 {readiness}%
              </Badge>
              <Badge variant={incompleteTasks.length > 0 ? "outline" : "secondary"}>
                {incompleteTasks.length} 条需确认
              </Badge>
            </div>
          </div>

          {incompleteTasks.length === 0 ? (
            <div className="mt-3 flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-xs text-emerald-600">
              <CheckCircle2 className="size-3.5" />
              核心管控信息已完整，可以进入执行跟踪。
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="rounded-md border bg-background p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-medium">快速补齐当前筛选</p>
                    <p className="text-[11px] text-muted-foreground">
                      只填空字段，不覆盖已有负责人、部门或截止日期
                    </p>
                  </div>
                  <Badge variant="outline">
                    {visibleIncompleteTasks.length} 条可补齐
                  </Badge>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-[1fr_1fr_160px_auto]">
                  <input
                    data-bulk-fill="assignee"
                    value={bulkAssignee}
                    onChange={(event) => setBulkAssignee(event.target.value)}
                    placeholder="负责人"
                    className="h-8 rounded-md border bg-background px-2 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-primary"
                  />
                  <input
                    data-bulk-fill="department"
                    value={bulkDepartment}
                    onChange={(event) => setBulkDepartment(event.target.value)}
                    placeholder="部门"
                    className="h-8 rounded-md border bg-background px-2 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-primary"
                  />
                  <input
                    data-bulk-fill="deadline"
                    type="text"
                    inputMode="numeric"
                    value={bulkDeadline}
                    onChange={(event) => setBulkDeadline(event.target.value)}
                    placeholder="截止日期 YYYY-MM-DD"
                    className="h-8 rounded-md border bg-background px-2 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-primary"
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-8"
                    onClick={applyBulkFill}
                    disabled={bulkSaving || visibleIncompleteTasks.length === 0}
                  >
                    {bulkSaving ? "补齐中" : "补齐"}
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                  <History className="size-3.5" />
                  <span>成功后生成 1 条项目活动摘要，并在每个任务保留字段变更明细。</span>
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {incompleteTasks.slice(0, 6).map((item) => (
                  <button
                    key={item.task.id}
                    type="button"
                    onClick={() => jumpToTask(item.task.id, item.missing[0])}
                    className="rounded-md border bg-background p-2 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="line-clamp-1 text-xs font-medium">
                        {item.task.name}
                      </span>
                      {item.overdue && (
                        <AlertTriangle className="size-3.5 shrink-0 text-destructive" />
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                      <span>{item.phaseName}</span>
                      {item.missing.map((field) => (
                        <span
                          key={field}
                          className="rounded-full bg-amber-50 px-1.5 py-0.5 font-medium text-amber-700"
                        >
                          缺{field}
                        </span>
                      ))}
                      {item.overdue && (
                        <span className="rounded-full bg-red-50 px-1.5 py-0.5 font-medium text-red-700">
                          已逾期
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
              {visibleIncompleteTasks.length !== incompleteTasks.length && (
                <p className="text-[11px] text-muted-foreground">
                  已按当前筛选/搜索限定补齐范围，清空筛选可处理全部待补事项。
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">暂无管控事项</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            用 AI 生成项目，或切到看板新增第一条事项
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
              <table className="w-full min-w-[1120px] text-left text-xs">
                <thead className="border-b bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="w-28 px-3 py-2 font-medium">阶段</th>
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
                        phaseName={phaseName(task.phaseId)}
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
