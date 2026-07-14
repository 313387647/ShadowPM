"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, CalendarDays, CalendarPlus, Loader2, MessageSquarePlus, Pencil, Plus, Save, Trash2, WalletCards, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { TASK_STATUS_MAP } from "@/lib/constants";
import { createTask, deleteTask, updateTask } from "@/actions/task-actions";
import { addProgressLog } from "@/actions/timeline-actions";
import { createCalendarEntryFromTask } from "@/actions/calendar-actions";
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
  budgetAmount: { toNumber?: () => number } | number;
  budgetStatus: string;
  aiConfidence?: string | null;
  sourceRef?: string | null;
  logs: { id: string; content: string; createdBy: string; createdAt: Date | string }[];
  _count: { logs: number; budgets: number; calendarEntries: number };
};

type ControlFilter = "ALL" | "OVERDUE" | "WITH_BUDGET" | "WITH_LOGS" | "WITH_CALENDAR";
type PhaseOption = { id: string; name: string };
type CreateDraft = {
  template: string;
  phaseName: string;
  name: string;
  assignee: string;
  department: string;
  deadline: string;
  status: Task["status"];
  priority: string;
  description: string;
  notes: string;
};

function budgetAmount(task: Pick<Task, "budgetAmount">) {
  return typeof task.budgetAmount === "number" ? task.budgetAmount : task.budgetAmount.toNumber?.() ?? 0;
}

const CONTROL_FILTERS: { value: ControlFilter; label: string }[] = [
  { value: "ALL", label: "全部事项" },
  { value: "OVERDUE", label: "已逾期" },
  { value: "WITH_BUDGET", label: "有预算" },
  { value: "WITH_LOGS", label: "有日志" },
  { value: "WITH_CALENDAR", label: "有日历" },
];

const CREATE_TEMPLATES: Array<{
  id: string;
  label: string;
  draft: Partial<CreateDraft>;
}> = [
  {
    id: "custom",
    label: "自定义事项",
    draft: {
      phaseName: "",
      name: "",
      description: "",
      notes: "",
      status: "PENDING",
      priority: "P2",
    },
  },
  {
    id: "approval",
    label: "审批/确认",
    draft: {
      phaseName: "审批确认",
      name: "关键审批确认",
      description: "确认审批口径、责任人、材料版本、截止时间和下一步动作。",
      notes: "待确认审批节点和反馈时间。",
      status: "PENDING",
      priority: "P1",
    },
  },
  {
    id: "execution",
    label: "执行交付",
    draft: {
      phaseName: "执行交付",
      name: "执行事项落地",
      description: "明确交付内容、验收标准、依赖方、执行窗口和风险点。",
      notes: "待补执行进度和当前结论。",
      status: "IN_PROGRESS",
      priority: "P1",
    },
  },
  {
    id: "budget",
    label: "预算跟进",
    draft: {
      phaseName: "预算管理",
      name: "预算确认与流转",
      description: "确认预算金额、用途、关联事项、付款/报销状态和后续流转动作。",
      notes: "预算金额待在资金账本补齐。",
      status: "PENDING",
      priority: "P1",
    },
  },
  {
    id: "calendar",
    label: "日历排期",
    draft: {
      phaseName: "执行日历",
      name: "排期与发布确认",
      description: "确认日期、渠道、负责人、内容版本、发布状态和复盘信息。",
      notes: "待同步到执行日历。",
      status: "PENDING",
      priority: "P2",
    },
  },
];

const EMPTY_CREATE_DRAFT: CreateDraft = {
  template: "custom",
  phaseName: "",
  name: "",
  assignee: "",
  department: "",
  deadline: "",
  status: "PENDING",
  priority: "P2",
  description: "",
  notes: "",
};

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

function formatDeadline(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" }).format(
    new Date(`${value}T00:00:00.000Z`)
  );
}

const STATUS_STYLE: Record<Task["status"], string> = {
  PENDING: "border-warning/25 bg-warning/10 text-warning",
  IN_PROGRESS: "border-primary/25 bg-primary/10 text-primary",
  COMPLETED: "border-success/25 bg-success/10 text-success",
};

function matchesControlFilter(task: Task, filter: ControlFilter) {
  if (filter === "ALL") return true;
  if (filter === "OVERDUE") return isOverdue(task);
  if (filter === "WITH_BUDGET") return budgetAmount(task) > 0;
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
  canEdit,
  phases,
}: {
  task: Task;
  focused: boolean;
  canEdit: boolean;
  phases?: PhaseOption[];
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
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const phaseName = phases?.find((phase) => phase.id === task.phaseId)?.name ?? "";
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
    if (!canEdit || !dirty || saving) return;
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
        setEditMode(false);
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

  function discardEdits() {
    const hadUnsavedChanges = dirty;
    setName(task.name);
    setDescription(task.description ?? "");
    setAssignee(task.assignee ?? "");
    setDepartment(task.department ?? "");
    setDeadline(toDateInputValue(task.deadline));
    setNotes(task.notes ?? "");
    setPriority(task.priority);
    setStatus(task.status);
    setEditMode(false);

    if (hadUnsavedChanges) toast("未保存修改已放弃");
  }

  async function submitProgressLog() {
    if (!canEdit || !logContent.trim() || logging) return;
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

  async function submitSchedule(formData: FormData) {
    if (!canEdit || scheduling) return;
    setScheduling(true);
    try {
      formData.set("taskId", task.id);
      const result = await createCalendarEntryFromTask(formData);
      if (result.success) {
        toast.success(result.message ?? "已创建执行日历");
        setScheduleOpen(false);
        router.push(`/projects/${task.projectId}?tab=calendar&calendarTask=${task.id}`);
        router.refresh();
      } else {
        toast.error(result.message ?? "排期失败");
      }
    } catch {
      toast.error("排期失败");
    } finally {
      setScheduling(false);
    }
  }

  async function confirmDelete() {
    if (!canEdit || deleting) return;
    setDeleting(true);
    try {
      const result = await deleteTask(task.id);
      if (result.success) {
        toast.success(result.message ?? "管控事项已删除");
        setDeleteOpen(false);
        router.refresh();
      } else {
        toast.error(result.message ?? "删除失败");
      }
    } catch {
      toast.error("删除失败");
    } finally {
      setDeleting(false);
    }
  }

  function saveOnEnter(event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    }
  }

  function handleEditShortcut(event: React.KeyboardEvent<HTMLTableRowElement>) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    discardEdits();
  }

  useEffect(() => {
    if (focused && canEdit) setEditMode(true);
  }, [canEdit, focused]);

  return (
    <Fragment>
      <tr
        id={`control-task-${task.id}`}
        onKeyDown={handleEditShortcut}
        className={cn(
          "bg-card transition-colors hover:bg-primary/[0.045]",
          focused && "bg-primary/[0.075] ring-1 ring-inset ring-primary/35",
          historyOpen && "bg-primary/[0.04]"
        )}
      >
      <td className="min-w-[300px] px-4 py-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {phaseName && <span className="rounded-md border border-border bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{phaseName}</span>}
            {task.sourceRef && <span className="rounded-md border border-primary/20 bg-primary/[0.07] px-1.5 py-0.5 text-[10px] text-primary">AI 导入</span>}
          </div>
          {editMode ? (
            <>
              <input value={name} onChange={(event) => setName(event.target.value)} onKeyDown={saveOnEnter} placeholder="管控事项" className="h-8 w-full rounded-md border bg-background px-2 text-sm font-medium outline-none focus:border-primary" />
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} onKeyDown={saveOnEnter} placeholder="详细描述" rows={2} className="w-full resize-none rounded-md border bg-background px-2 py-1.5 text-xs leading-5 text-muted-foreground outline-none focus:border-primary" />
            </>
          ) : (
            <button type="button" onClick={() => canEdit && setEditMode(true)} className="block w-full text-left">
              <p className="font-medium leading-5 text-foreground">{name}</p>
              <p className="mt-0.5 line-clamp-1 text-[11px] leading-5 text-muted-foreground">{description || "未补充描述"}</p>
            </button>
          )}
        </div>
      </td>
      <td className="min-w-[136px] px-3 py-3">
        {editMode ? (
          <div className="space-y-1.5">
            <input data-task-field={`${task.id}:assignee`} value={assignee} onChange={(event) => setAssignee(event.target.value)} onKeyDown={saveOnEnter} placeholder="负责人" className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-primary" />
            <input data-task-field={`${task.id}:department`} value={department} onChange={(event) => setDepartment(event.target.value)} onKeyDown={saveOnEnter} placeholder="部门" className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-primary" />
          </div>
        ) : (
          <div>
            <p className={assignee ? "font-medium" : "font-medium text-warning"}>{assignee || "负责人待补"}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{department || "部门待补"}</p>
          </div>
        )}
      </td>
      <td className="w-[108px] px-3 py-3">
        {editMode ? (
          <input data-task-field={`${task.id}:deadline`} type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} onKeyDown={saveOnEnter} className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-primary" />
        ) : (
          <div className={cn("flex items-center gap-1.5 text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
            {overdue && <AlertTriangle className="size-3" />}
            <span>{deadline ? formatDeadline(deadline) : "待补日期"}</span>
          </div>
        )}
      </td>
      <td className="w-[108px] px-3 py-3">
        {editMode ? (
          <div className="space-y-1.5">
            <Select value={status} onChange={(event) => setStatus(event.target.value as Task["status"])} className="h-8 text-xs"><option value="PENDING">待启动</option><option value="IN_PROGRESS">进行中</option><option value="COMPLETED">已完成</option></Select>
            <Select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-8 text-xs font-semibold"><option value="P0">P0</option><option value="P1">P1</option><option value="P2">P2</option><option value="P3">P3</option></Select>
          </div>
        ) : (
          <div className="space-y-1.5"><span className={cn("inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium", STATUS_STYLE[status])}>{TASK_STATUS_MAP[status]}</span><p className="text-[11px] font-semibold text-muted-foreground">{priority}</p></div>
        )}
      </td>
      <td className="w-[120px] px-3 py-3">
        <div className="flex items-center gap-1">
          <Button type="button" size="icon" variant={historyOpen ? "secondary" : "ghost"} className="size-7" title="查看进度历史" onClick={() => setHistoryOpen((value) => !value)}><MessageSquarePlus className="size-3.5" /><span className="sr-only">日志 {task._count.logs}</span></Button>
          {budgetAmount(task) > 0 && <Button type="button" size="icon" variant="ghost" className="size-7" title={`编辑事项预算：¥${budgetAmount(task).toLocaleString("zh-CN")}`} onClick={() => router.push(`/projects/${task.projectId}?tab=ledger&ledgerTask=${task.id}`)}><WalletCards className="size-3.5" /></Button>}
          {task._count.calendarEntries > 0 ? <Button type="button" size="icon" variant="ghost" className="size-7" title={`${task._count.calendarEntries} 个执行日历节点`} onClick={() => router.push(`/projects/${task.projectId}?tab=calendar&calendarTask=${task.id}`)}><CalendarDays className="size-3.5" /></Button> : canEdit && <Button type="button" size="icon" variant="ghost" className="size-7" title="创建执行日历" onClick={() => setScheduleOpen(true)}><CalendarPlus className="size-3.5" /></Button>}
        </div>
      </td>
      <td className="min-w-[220px] px-3 py-3">
        {editMode ? <input value={notes} onChange={(event) => setNotes(event.target.value)} onKeyDown={saveOnEnter} placeholder="进度/结论" className="h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:border-primary" /> : <p className="line-clamp-2 text-xs leading-5 text-secondary-foreground">{notes || "暂无进度结论"}</p>}
      </td>
      <td className="w-[126px] px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">点击事项直接编辑</span>
        </div>
      </td>
      {canEdit && (
        <td className="w-[84px] px-3 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {editMode ? <><Button type="button" size="icon" variant="ghost" className="size-7" title="收起并放弃未保存修改（Esc）" onClick={discardEdits} disabled={saving}><X className="size-3.5" /></Button><Button type="button" size="icon" className="size-7" title="保存修改" onClick={save} disabled={saving || !dirty}><Save className="size-3.5" /></Button></> : <Button type="button" size="icon" variant="ghost" className="size-7" title="编辑事项" onClick={() => setEditMode(true)}><Pencil className="size-3.5" /></Button>}
            <Button type="button" size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" title="删除事项" onClick={() => setDeleteOpen(true)}><Trash2 className="size-3.5" /></Button>
          </div>
        </td>
      )}
      </tr>
      {historyOpen && (
        <tr className="border-t bg-primary/[0.03]">
          <td colSpan={canEdit ? 8 : 7} className="px-4 py-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,0.8fr)]">
              <div className="space-y-2">
                {canEdit ? (
                  <>
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
                  </>
                ) : (
                  <div className="rounded-md border border-dashed bg-background/60 px-3 py-4 text-xs leading-5 text-muted-foreground">
                    当前为只读巡视模式。可查看该事项历史，但不能追加进度或改写当前结论。
                  </div>
                )}
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
      {(scheduleOpen || deleteOpen) && (
        <tr>
          <td colSpan={canEdit ? 8 : 7} className="p-0">
            <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>从管控事项创建执行日历</DialogTitle>
                </DialogHeader>
                <form action={submitSchedule} className="space-y-3">
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs leading-5 text-muted-foreground">
              排期是明确执行节点，不会因为事项“进行中”自动生成。这里确认后才会写入执行日历。
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">日历内容</label>
              <input
                name="content"
                required
                defaultValue={task.name}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">日期</label>
                <input
                  name="date"
                  type="date"
                  defaultValue={toDateInputValue(task.deadline)}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">开始</label>
                <input
                  name="startTime"
                  type="time"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">结束</label>
                <input
                  name="endTime"
                  type="time"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">模块/执行线</label>
                <input
                  name="workstream"
                  defaultValue={phaseName}
                  placeholder="例如：公关传播"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">渠道</label>
                <input
                  name="channel"
                  placeholder="例如：视频号/新闻稿/线下活动"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium">负责人</label>
                <input
                  name="owner"
                  defaultValue={task.assignee ?? ""}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">部门</label>
                <input
                  name="department"
                  defaultValue={task.department ?? ""}
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">备注</label>
              <input
                name="notes"
                placeholder="可留空，例如：排期待最终确认"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
              />
            </div>
            <input type="hidden" name="status" value="PLANNED" />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setScheduleOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={scheduling} className="gap-1.5">
                {scheduling && <Loader2 className="size-3.5 animate-spin" />}
                写入执行日历
              </Button>
            </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>删除管控事项</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                这会删除事项「{task.name}」及其关联的日历、预算明细和事项内进度。已有项目活动会保留删除记录。
              </p>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
                  取消
                </Button>
                <Button type="button" variant="destructive" disabled={deleting} onClick={confirmDelete}>
                  {deleting ? "删除中" : "确认删除"}
                </Button>
              </DialogFooter>
                  </div>
              </DialogContent>
            </Dialog>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export function ProjectControlTable({
  projectId,
  tasks,
  phases,
  canEdit,
}: {
  projectId: string;
  tasks: Task[];
  phases: PhaseOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const createFormRef = useRef<HTMLFormElement>(null);
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ControlFilter>("ALL");
  const [query, setQuery] = useState("");
  const [showCreate, setShowCreate] = useState(tasks.length === 0);
  const [creating, setCreating] = useState(false);
  const [createDraft, setCreateDraft] = useState<CreateDraft>(EMPTY_CREATE_DRAFT);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();

  const overdueCount = tasks.filter(isOverdue).length;
  const filterCounts = CONTROL_FILTERS.reduce<Record<ControlFilter, number>>((counts, item) => {
    counts[item.value] = tasks.filter((task) => matchesControlFilter(task, item.value)).length;
    return counts;
  }, {
    ALL: 0,
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

  function jumpToTask(taskId: string) {
    setFocusedTaskId(taskId);
    document.getElementById(`control-task-${taskId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
    window.setTimeout(() => {
      const row = document.getElementById(`control-task-${taskId}`);
      row?.querySelector<HTMLButtonElement>("button")?.click();
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
    if (!canEdit || creating) return;
    setCreating(true);
    try {
      formData.set("projectId", projectId);
      const result = await createTask(formData);
      if (result.success) {
        toast.success("管控事项已添加");
        createFormRef.current?.reset();
        setCreateDraft(EMPTY_CREATE_DRAFT);
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

  function updateCreateDraft(patch: Partial<CreateDraft>) {
    setCreateDraft((draft) => ({ ...draft, ...patch }));
  }

  function applyTemplate(templateId: string) {
    const template = CREATE_TEMPLATES.find((item) => item.id === templateId) ?? CREATE_TEMPLATES[0];
    setCreateDraft({
      ...EMPTY_CREATE_DRAFT,
      ...template.draft,
      template: template.id,
      assignee: createDraft.assignee,
      department: createDraft.department,
      deadline: createDraft.deadline,
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">项目管控总表</p>
          <p className="text-xs text-muted-foreground">
            {canEdit
              ? "默认快速扫描；点击事项或编辑图标后，再进入字段编辑。"
              : "快速查看事项、负责人、截止、状态、关联记录和最新结论。"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canEdit && (
            <Button
              type="button"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => setShowCreate((value) => !value)}
            >
              <Plus className="size-3.5" />
              新增管控事项
            </Button>
          )}
          <Badge variant={overdueCount > 0 ? "destructive" : "outline"} className="h-8 px-2.5">
            {overdueCount > 0 ? `${overdueCount} 个逾期事项` : "无逾期事项"}
          </Badge>
        </div>
      </div>

      {canEdit && showCreate && (
        <form
          ref={createFormRef}
          action={handleCreate}
          className="focus-surface rounded-xl p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">新增管控事项</p>
              <p className="mt-1 text-xs text-muted-foreground">
                选择模板后补负责人和日期即可；缺的信息创建后也能在表格里直接改。
              </p>
            </div>
            <Button type="submit" size="sm" className="h-8 gap-1.5" disabled={creating}>
              {creating ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
              添加
            </Button>
          </div>
          <div className="mt-3 grid gap-2 lg:grid-cols-[170px_1fr_1.4fr]">
            <Select
              value={createDraft.template}
              onChange={(event) => applyTemplate(event.target.value)}
              className="h-9 text-sm"
            >
              {CREATE_TEMPLATES.map((template) => (
                <option key={template.id} value={template.id}>{template.label}</option>
              ))}
            </Select>
            <input
              name="phaseName"
              list="control-phase-options"
              value={createDraft.phaseName}
              onChange={(event) => updateCreateDraft({ phaseName: event.target.value, template: "custom" })}
              placeholder="模块/执行线，例如：公关传播"
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            />
            <datalist id="control-phase-options">
              {phases.map((phase) => (
                <option key={phase.id} value={phase.name} />
              ))}
            </datalist>
            <input
              name="name"
              required
              value={createDraft.name}
              onChange={(event) => updateCreateDraft({ name: event.target.value, template: "custom" })}
              placeholder="管控事项，例如：发布会场地确认"
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            />
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-[1fr_1fr_150px_150px_150px]">
            <input
              name="assignee"
              value={createDraft.assignee}
              onChange={(event) => updateCreateDraft({ assignee: event.target.value })}
              placeholder="负责人"
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            />
            <input
              name="department"
              value={createDraft.department}
              onChange={(event) => updateCreateDraft({ department: event.target.value })}
              placeholder="部门"
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            />
            <input
              name="deadline"
              type="date"
              value={createDraft.deadline}
              onChange={(event) => updateCreateDraft({ deadline: event.target.value })}
              className="h-9 rounded-md border bg-background px-3 text-sm outline-none focus:border-primary"
            />
            <Select
              name="status"
              value={createDraft.status}
              onChange={(event) => updateCreateDraft({ status: event.target.value as Task["status"] })}
              className="h-9 text-sm"
            >
              <option value="PENDING">待启动</option>
              <option value="IN_PROGRESS">进行中</option>
              <option value="COMPLETED">已完成</option>
            </Select>
            <Select
              name="priority"
              value={createDraft.priority}
              onChange={(event) => updateCreateDraft({ priority: event.target.value })}
              className="h-9 text-sm"
            >
              <option value="P0">P0 - 必须马上处理</option>
              <option value="P1">P1 - 关键事项</option>
              <option value="P2">P2 - 常规事项</option>
              <option value="P3">P3 - 低优先级</option>
            </Select>
          </div>
          <div className="mt-2 grid gap-2 lg:grid-cols-2">
            <textarea
              name="description"
              value={createDraft.description}
              onChange={(event) => updateCreateDraft({ description: event.target.value, template: "custom" })}
              placeholder="详细描述，例如：确认场地档期、面积、搭建限制和报价"
              rows={2}
              className="min-h-16 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            />
            <textarea
              name="notes"
              value={createDraft.notes}
              onChange={(event) => updateCreateDraft({ notes: event.target.value, template: "custom" })}
              placeholder="进度/结论，例如：待供应商周五前反馈"
              rows={2}
              className="min-h-16 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground/50 focus:border-primary"
            />
          </div>
        </form>
      )}

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface-1/55 py-16 text-center">
          <p className="text-sm text-muted-foreground">暂无管控事项</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            使用上方「新增管控事项」添加第一条，或用 AI 生成项目
          </p>
        </div>
      ) : (
        <div className="table-shell">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/55 p-2.5">
            <div className="flex flex-wrap gap-1.5">
              {CONTROL_FILTERS.map((item) => (
                <button
                  key={item.value}
                  data-control-filter={item.value}
                  type="button"
                  onClick={() => setFilter(item.value)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-lg border px-2.5 text-xs transition-colors",
                    filter === item.value
                      ? "border-primary/35 bg-primary/15 text-primary"
                      : "bg-canvas/25 text-muted-foreground hover:border-primary/35 hover:text-foreground"
                  )}
                >
                  {item.label}
                  <span className={cn(
                    "rounded-full px-1.5 text-[10px]",
                    filter === item.value ? "bg-primary/15" : "bg-muted"
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
                className="h-8 w-full rounded-md border bg-background px-3 pr-14 text-xs outline-none placeholder:text-muted-foreground/50 focus:border-primary"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                /
              </span>
            </div>
          </div>
          <div className="border-b border-border bg-canvas/20 px-4 py-2 text-[11px] text-muted-foreground">
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
              <table className={cn("data-table w-full text-left text-xs", canEdit ? "min-w-[1120px]" : "min-w-[1030px]")}>
                <thead className="border-b border-border text-[11px] text-muted-foreground">
                  <tr>
                    <th className="min-w-[300px] px-4 py-2.5 font-medium">事项</th>
                    <th className="min-w-[136px] px-3 py-2.5 font-medium">负责人</th>
                    <th className="w-[108px] px-3 py-2.5 font-medium">截止</th>
                    <th className="w-[108px] px-3 py-2.5 font-medium">状态</th>
                    <th className="w-[120px] px-3 py-2.5 font-medium">关联</th>
                    <th className="min-w-[220px] px-3 py-2.5 font-medium">最新结论</th>
                    <th className="w-[126px] px-3 py-2.5 font-medium">完整度</th>
                    {canEdit && <th className="w-[84px] px-3 py-2.5 text-right font-medium">编辑</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visibleTasks.map((task) => {
                    return (
                    <ControlTableRow
                      key={task.id}
                      task={task}
                      focused={focusedTaskId === task.id}
                      canEdit={canEdit}
                      phases={phases}
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
