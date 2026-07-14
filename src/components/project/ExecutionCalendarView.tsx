"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, CircleDashed, Loader2, Pencil, Save, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteCalendarEntry, updateCalendarEntry } from "@/actions/calendar-actions";
import { cn } from "@/lib/utils";

type CalendarEntry = {
  id: string;
  date: Date | string | null;
  startTime: string | null;
  endTime: string | null;
  channel: string | null;
  workstream: string | null;
  content: string;
  owner: string | null;
  department: string | null;
  status: string;
  notes: string | null;
  source: string;
  createdAt: Date | string;
  taskId: string | null;
  task: { id: string; name: string; status: string } | null;
};
type CalendarFilter = "ALL" | "UNSCHEDULED" | "PLANNED" | "CONFIRMED" | "DONE" | "CANCELED";
type CalendarMode = "AGENDA" | "WEEK" | "MONTH";
type TaskOption = { id: string; name: string; status: string };

const CALENDAR_FILTERS: { value: CalendarFilter; label: string }[] = [
  { value: "ALL", label: "全部" },
  { value: "UNSCHEDULED", label: "待排期" },
  { value: "PLANNED", label: "计划中" },
  { value: "CONFIRMED", label: "已确认" },
  { value: "DONE", label: "已完成" },
  { value: "CANCELED", label: "已取消" },
];

const STATUS_LABEL: Record<string, string> = {
  PLANNED: "计划中",
  CONFIRMED: "已确认",
  DONE: "已完成",
  CANCELED: "已取消",
};

function formatDate(value: CalendarEntry["date"]) {
  if (!value) return "日期待确认";
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

function toDateInputValue(value: CalendarEntry["date"]) {
  if (!value) return "";
  if (typeof value === "string") return value.split("T")[0] ?? "";
  return toLocalDayKey(value);
}

function formatTime(entry: CalendarEntry) {
  if (!entry.startTime && !entry.endTime) return "";
  return [entry.startTime, entry.endTime].filter(Boolean).join("-");
}

function toLocalDayKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseEntryDate(value: CalendarEntry["date"]) {
  if (!value) return null;
  const date = typeof value === "string" ? new Date(value) : value;
  return Number.isFinite(date.getTime()) ? date : null;
}

function isCalendarOverdue(entry: CalendarEntry) {
  const date = parseEntryDate(entry.date);
  if (!date || ["DONE", "CANCELED"].includes(entry.status)) return false;
  date.setHours(23, 59, 59, 999);
  return date < new Date();
}

function buildGroupSummary(entries: CalendarEntry[], field: "workstream" | "channel" | "owner") {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    const value = entry[field]?.trim() || "待确认";
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-CN"))
    .slice(0, 6);
}

function getNextSevenDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return date;
  });
}

function getCurrentMonthDays() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());
  const end = new Date(lastDay);
  end.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

  const days: Date[] = [];
  for (const date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    days.push(new Date(date));
  }
  return days;
}

function ExecutionCalendarRow({
  projectId,
  entry,
  tasks,
  focused,
  canEdit,
}: {
  projectId: string;
  entry: CalendarEntry;
  tasks: TaskOption[];
  focused: boolean;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [date, setDate] = useState(toDateInputValue(entry.date));
  const [startTime, setStartTime] = useState(entry.startTime ?? "");
  const [endTime, setEndTime] = useState(entry.endTime ?? "");
  const [workstream, setWorkstream] = useState(entry.workstream ?? "");
  const [channel, setChannel] = useState(entry.channel ?? "");
  const [content, setContent] = useState(entry.content);
  const [owner, setOwner] = useState(entry.owner ?? "");
  const [department, setDepartment] = useState(entry.department ?? "");
  const [status, setStatus] = useState(entry.status);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [taskId, setTaskId] = useState(entry.taskId ?? "");
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const isEditing = canEdit && editMode;

  const dirty =
    date !== toDateInputValue(entry.date) ||
    startTime !== (entry.startTime ?? "") ||
    endTime !== (entry.endTime ?? "") ||
    workstream !== (entry.workstream ?? "") ||
    channel !== (entry.channel ?? "") ||
    content !== entry.content ||
    owner !== (entry.owner ?? "") ||
    department !== (entry.department ?? "") ||
    status !== entry.status ||
    notes !== (entry.notes ?? "") ||
    taskId !== (entry.taskId ?? "");

  async function save() {
    if (!canEdit || !dirty || saving) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("entryId", entry.id);
      formData.set("date", date);
      formData.set("startTime", startTime);
      formData.set("endTime", endTime);
      formData.set("workstream", workstream);
      formData.set("channel", channel);
      formData.set("content", content);
      formData.set("owner", owner);
      formData.set("department", department);
      formData.set("status", status);
      formData.set("notes", notes);
      formData.set("taskId", taskId);

      const result = await updateCalendarEntry(formData);
      if (result.success) {
        toast.success("执行日历已更新");
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

  async function confirmDelete() {
    if (!canEdit || deleting) return;
    setDeleting(true);
    try {
      const result = await deleteCalendarEntry(entry.id);
      if (result.success) {
        toast.success("执行日历已删除");
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

  function saveOnEnter(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      save();
    }
  }

  return (
    <tr className={cn("bg-card transition-colors hover:bg-primary/[0.045]", focused && "bg-primary/[0.075] ring-1 ring-inset ring-primary/35", editMode && "bg-primary/[0.04]")}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          {date ? (
            <CheckCircle2 className="size-3 text-emerald-500" />
          ) : (
            <CircleDashed className="size-3 text-amber-700" />
          )}
          {isEditing ? <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              onInput={(event) => setDate(event.currentTarget.value)}
              onKeyDown={saveOnEnter}
              className="w-full rounded border border-transparent bg-transparent px-1 py-1 outline-none transition-colors focus:border-primary focus:bg-background"
            /> : <span className={cn("truncate", !date && "font-medium text-warning")}>{date ? formatDate(date) : "日期待确认"}</span>}
        </div>
      </td>
      <td className="px-3 py-2 font-mono text-muted-foreground">
        {isEditing ? <div className="flex items-center gap-1"><input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} onKeyDown={saveOnEnter} className="w-20 rounded border border-transparent bg-transparent px-1 py-1 outline-none transition-colors focus:border-primary focus:bg-background" /><span className="text-muted-foreground/50">-</span><input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} onKeyDown={saveOnEnter} className="w-20 rounded border border-transparent bg-transparent px-1 py-1 outline-none transition-colors focus:border-primary focus:bg-background" /></div> : <span>{formatTime(entry) || "未填时间"}</span>}
      </td>
      <td className="px-3 py-2">
        {isEditing ? <input value={workstream} onChange={(event) => setWorkstream(event.target.value)} onKeyDown={saveOnEnter} placeholder="未分组" className="w-full rounded border border-transparent bg-transparent px-1 py-1 outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background" /> : <span className="text-muted-foreground">{entry.workstream || "未分组"}</span>}
      </td>
      <td className="px-3 py-2">
        {isEditing ? <input value={channel} onChange={(event) => setChannel(event.target.value)} onKeyDown={saveOnEnter} placeholder="渠道待确认" className="w-full rounded border border-transparent bg-transparent px-1 py-1 outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background" /> : <span className="text-muted-foreground">{entry.channel || "渠道待确认"}</span>}
      </td>
      <td className="px-3 py-2">
        {isEditing ? <select value={taskId} onChange={(event) => setTaskId(event.target.value)} className="w-full rounded border border-transparent bg-transparent px-1 py-1 outline-none transition-colors focus:border-primary focus:bg-background"><option value="">未关联</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}</select> : entry.taskId ? <button type="button" className="max-w-full truncate text-left text-primary hover:underline" onClick={() => router.push(`/projects/${projectId}?tab=tasks&focusTask=${entry.taskId}`)}>{entry.task?.name ?? "已关联事项"}</button> : <span className="text-muted-foreground">未关联</span>}
      </td>
      <td className="px-3 py-2">
        {isEditing ? <div className="space-y-0.5"><textarea value={content} onChange={(event) => setContent(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); save(); } }} rows={2} className="w-full resize-none rounded border border-transparent bg-transparent px-1 py-1 font-medium leading-5 outline-none transition-colors focus:border-primary focus:bg-background" /><input value={notes} onChange={(event) => setNotes(event.target.value)} onKeyDown={saveOnEnter} placeholder="备注" className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-[11px] text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background" /></div> : <div><p className="font-medium leading-5">{entry.content}</p>{entry.notes && <p className="mt-0.5 text-[11px] text-muted-foreground">{entry.notes}</p>}</div>}
      </td>
      <td className="px-3 py-2">
        {isEditing ? <div className="space-y-1"><input value={owner} onChange={(event) => setOwner(event.target.value)} onKeyDown={saveOnEnter} placeholder="负责人" className="w-full rounded border border-transparent bg-transparent px-1 py-1 outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background" /><input value={department} onChange={(event) => setDepartment(event.target.value)} onKeyDown={saveOnEnter} placeholder="部门" className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-[11px] text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background" /></div> : <div><p>{entry.owner || "负责人待确认"}</p>{entry.department && <p className="mt-0.5 text-[11px] text-muted-foreground">{entry.department}</p>}</div>}
      </td>
      <td className="px-3 py-2">
        {isEditing ? <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full rounded border border-transparent bg-transparent px-1 py-1 outline-none transition-colors focus:border-primary focus:bg-background"><option value="PLANNED">计划中</option><option value="CONFIRMED">已确认</option><option value="DONE">已完成</option><option value="CANCELED">已取消</option></select> : <Badge variant={entry.status === "DONE" ? "secondary" : entry.status === "CANCELED" ? "outline" : entry.status === "CONFIRMED" ? "default" : "secondary"}>{STATUS_LABEL[entry.status] ?? entry.status}</Badge>}
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          <span>{entry.source === "AI_IMPORT" ? "AI 导入" : "手动"}</span>
          {canEdit && (
            <Button
              size="sm"
              variant={editMode && dirty ? "default" : "ghost"}
              className="h-6 shrink-0 gap-1 px-2 text-[10px]"
              onClick={() => {
                if (!editMode) setEditMode(true);
                else if (dirty) void save();
                else setEditMode(false);
              }}
              disabled={saving}
            >
              {saving ? "保存中" : editMode && dirty ? <><Save className="size-3" />保存</> : editMode ? "完成" : <><Pencil className="size-3" />编辑</>}
            </Button>
          )}
        </div>
      </td>
      {canEdit && (
        <td className="px-3 py-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
            title="删除误排期"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>删除执行日历</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <p className="font-medium">{entry.content}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(entry.date)} {formatTime(entry) || ""} · {entry.channel ?? entry.workstream ?? "未分组"}
                  </p>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  删除只移除这个执行排期，不会删除关联的管控事项。系统会在项目活动里保留删除记录，方便回溯误排期或测试数据。
                </p>
                <DialogFooter>
                  <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
                    取消
                  </Button>
                  <Button type="button" variant="destructive" disabled={deleting} onClick={confirmDelete} className="gap-1.5">
                    {deleting && <Loader2 className="size-3.5 animate-spin" />}
                    确认删除
                  </Button>
                </DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
        </td>
      )}
    </tr>
  );
}

export function ExecutionCalendarView({
  projectId,
  entries,
  tasks,
  canEdit,
}: {
  projectId: string;
  entries: CalendarEntry[];
  tasks: TaskOption[];
  canEdit: boolean;
}) {
  const [mode, setMode] = useState<CalendarMode>("AGENDA");
  const [filter, setFilter] = useState<CalendarFilter>("ALL");
  const [query, setQuery] = useState("");
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const normalizedQuery = query.trim().toLowerCase();
  const scheduledCount = entries.filter((entry) => entry.date).length;
  const unscheduledCount = entries.length - scheduledCount;
  const overdueEntries = useMemo(() => entries.filter(isCalendarOverdue), [entries]);
  const workstreamGroups = useMemo(() => buildGroupSummary(entries, "workstream"), [entries]);
  const channelGroups = useMemo(() => buildGroupSummary(entries, "channel"), [entries]);
  const ownerGroups = useMemo(() => buildGroupSummary(entries, "owner"), [entries]);
  const unscheduledEntries = useMemo(
    () => entries.filter((entry) => !entry.date).slice(0, 6),
    [entries]
  );
  const filterCounts = useMemo(() => {
    return CALENDAR_FILTERS.reduce<Record<CalendarFilter, number>>((counts, item) => {
      counts[item.value] = entries.filter((entry) => matchesCalendarFilter(entry, item.value)).length;
      return counts;
    }, {
      ALL: 0,
      UNSCHEDULED: 0,
      PLANNED: 0,
      CONFIRMED: 0,
      DONE: 0,
      CANCELED: 0,
    });
  }, [entries]);
  const visibleEntries = useMemo(
    () => entries.filter((entry) => matchesCalendarFilter(entry, filter) && matchesCalendarQuery(entry, normalizedQuery)),
    [entries, filter, normalizedQuery]
  );
  const weekDays = useMemo(() => getNextSevenDays(), []);
  const monthDays = useMemo(() => getCurrentMonthDays(), []);
  const currentMonth = useMemo(() => {
    const today = new Date();
    return today.getMonth();
  }, []);
  const entriesByDay = useMemo(() => {
    return weekDays.map((day) => {
      const key = toLocalDayKey(day);
      const dayEntries = entries
        .filter((entry) => {
          const date = parseEntryDate(entry.date);
          return date ? toLocalDayKey(date) === key : false;
        })
        .sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"));
      return { day, key, entries: dayEntries };
    });
  }, [entries, weekDays]);
  const monthEntriesByDay = useMemo(() => {
    return monthDays.map((day) => {
      const key = toLocalDayKey(day);
      const dayEntries = entries
        .filter((entry) => {
          const date = parseEntryDate(entry.date);
          return date ? toLocalDayKey(date) === key : false;
        })
        .sort((a, b) => (a.startTime ?? "99:99").localeCompare(b.startTime ?? "99:99"));
      return { day, key, entries: dayEntries };
    });
  }, [entries, monthDays]);

  useEffect(() => {
    const taskId = searchParams.get("calendarTask");
    if (!taskId) return;
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;

    setFilter("ALL");
    setQuery(task.name);
    setFocusedTaskId(taskId);
    window.setTimeout(() => setFocusedTaskId(null), 1800);
  }, [searchParams, tasks]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">执行日历</p>
          <p className="text-xs text-muted-foreground">
            管理传播、执行、发布和关键节点，日期缺失时先进入待确认区
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{scheduledCount} 个已排期</Badge>
          <Badge variant={unscheduledCount > 0 ? "destructive" : "secondary"}>
            {unscheduledCount} 个日期待确认
          </Badge>
          {overdueEntries.length > 0 && (
            <Badge variant="destructive">{overdueEntries.length} 个逾期未完成</Badge>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-background p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{mode === "AGENDA" ? "近期议程" : "本月排期"}</p>
            <p className="text-xs text-muted-foreground">
              {mode === "AGENDA" ? "下方按日期列出近期执行节点；点击一行查看或编辑详情。" : "按月浏览执行节奏，点击日期可过滤到当天。"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border bg-muted/20 p-0.5">
              {(["AGENDA", "MONTH"] as const).map((item) => (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={mode === item ? "default" : "ghost"}
                  className="h-6 rounded-full px-2 text-xs"
                  onClick={() => setMode(item)}
                >
                  {item === "AGENDA" ? "议程" : "月历"}
                </Button>
              ))}
            </div>
            {unscheduledCount > 0 && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                onClick={() => setFilter("UNSCHEDULED")}
              >
                {unscheduledCount} 个待排期
              </Button>
            )}
          </div>
        </div>
        {mode === "AGENDA" ? (
          <div className="rounded-md border border-dashed border-border px-3 py-5 text-center text-xs leading-5 text-muted-foreground">近期执行节点已在下方议程表中按日期展示。需要通盘浏览时，可切换到月历。</div>
        ) : mode === "WEEK" ? (
          <div className="grid gap-2 md:grid-cols-7">
            {entriesByDay.map(({ day, key, entries: dayEntries }) => {
            const doneCount = dayEntries.filter((entry) => entry.status === "DONE").length;
            const activeCount = dayEntries.length - doneCount;
            return (
              <div key={key} className="min-h-28 rounded-md border bg-muted/10 p-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-medium">
                      {day.toLocaleDateString("zh-CN", { weekday: "short" })}
                    </p>
                    <p className="text-xs text-muted-foreground">{key.slice(5)}</p>
                  </div>
                  {dayEntries.length > 0 && (
                    <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {activeCount}/{dayEntries.length}
                    </span>
                  )}
                </div>
                <div className="mt-2 space-y-1">
                  {dayEntries.slice(0, 3).map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => {
                        setFilter("ALL");
                        setQuery(entry.content);
                      }}
                      className={cn(
                        "block w-full rounded border bg-background px-2 py-1 text-left text-[11px] leading-4 transition-colors hover:border-primary/50",
                        entry.status === "DONE" && "text-muted-foreground line-through"
                      )}
                    >
                      <span className="block truncate font-medium">{entry.content}</span>
                      <span className="block truncate text-muted-foreground">
                        {formatTime(entry) || "未填时间"} · {entry.channel ?? entry.workstream ?? "未分组"}
                      </span>
                    </button>
                  ))}
                  {dayEntries.length === 0 && (
                    <p className="rounded border border-dashed px-2 py-3 text-center text-[11px] text-muted-foreground/60">无排期</p>
                  )}
                  {dayEntries.length > 3 && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilter("ALL");
                        setQuery(key);
                      }}
                      className="w-full rounded bg-muted px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      另 {dayEntries.length - 3} 条
                    </button>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-1">
            {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
              <div key={day} className="px-2 pb-1 text-center text-[11px] font-medium text-muted-foreground">
                {day}
              </div>
            ))}
            {monthEntriesByDay.map(({ day, key, entries: dayEntries }) => {
              const isCurrentMonth = day.getMonth() === currentMonth;
              const isToday = key === toLocalDayKey(new Date());
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setFilter("ALL");
                    setQuery(key);
                  }}
                  className={cn(
                    "min-h-20 rounded-md border bg-background p-2 text-left transition-colors hover:border-primary/50",
                    !isCurrentMonth && "bg-muted/20 text-muted-foreground/50",
                    isToday && "border-primary/60"
                  )}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-medium">{day.getDate()}</span>
                    {dayEntries.length > 0 && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                        {dayEntries.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 space-y-1">
                    {dayEntries.slice(0, 2).map((entry) => (
                      <p key={entry.id} className="truncate rounded bg-muted/50 px-1.5 py-0.5 text-[10px]">
                        {entry.startTime ? `${entry.startTime} ` : ""}{entry.content}
                      </p>
                    ))}
                    {dayEntries.length > 2 && (
                      <p className="text-[10px] text-muted-foreground">另 {dayEntries.length - 2} 条</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {entries.length > 0 && (
        <div className="grid gap-2 rounded-lg border bg-muted/10 p-3 lg:grid-cols-3">
          {[
            { title: "按模块/执行线", items: workstreamGroups },
            { title: "按渠道", items: channelGroups },
            { title: "按负责人", items: ownerGroups },
          ].map((group) => (
            <div key={group.title} className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">{group.title}</p>
              <div className="flex flex-wrap gap-1.5">
                {group.items.map((item) => (
                  <button
                    key={`${group.title}-${item.label}`}
                    type="button"
                    onClick={() => {
                      setFilter("ALL");
                      setQuery(item.label);
                    }}
                    className="rounded-full border bg-background px-2 py-1 text-[11px] transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    {item.label} <span className="text-muted-foreground">{item.count}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {unscheduledEntries.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-amber-950">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-medium">待排期队列</p>
              <p className="mt-0.5 text-xs text-amber-900/75">
                这些日历项缺少日期，优先补日期和关联事项即可进入周/月历。
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-amber-300 bg-background px-2 text-xs"
              onClick={() => {
                setFilter("UNSCHEDULED");
                setQuery("");
              }}
            >
              查看全部 {unscheduledCount} 条
            </Button>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {unscheduledEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => {
                  setFilter("UNSCHEDULED");
                  setQuery(entry.content);
                }}
                className="rounded-md border border-amber-200 bg-background/80 px-3 py-2 text-left text-xs transition-colors hover:border-amber-400"
              >
                <p className="line-clamp-1 font-medium">{entry.content}</p>
                <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">
                  {[entry.workstream, entry.channel, entry.owner ?? entry.department].filter(Boolean).join(" · ") || "缺模块/渠道/负责人"}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {CALENDAR_FILTERS.map((item) => (
          <Button
            key={item.value}
            type="button"
            size="sm"
            variant={filter === item.value ? "default" : "outline"}
            className="h-7 gap-1.5 rounded-full px-3 text-xs"
            onClick={() => setFilter(item.value)}
          >
            {item.label}
            <span className={cn(
              "rounded-full px-1.5 text-[10px]",
              filter === item.value ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
            )}>
              {filterCounts[item.value]}
            </span>
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[260px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索内容、渠道、模块、负责人、备注"
            className="h-9 rounded-full pl-8 pr-9 text-xs"
            data-calendar-search="true"
          />
          {query && (
            <button
              type="button"
              aria-label="清空日历搜索"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          显示 {visibleEntries.length} / {entries.length} 条
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 text-center">
          <CalendarDays className="mb-3 size-6 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">暂无正式执行日历</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            本次上传未识别到可落日历的日期节点；管控事项会先进入总表，后续可从事项补日期并生成排期。
          </p>
        </div>
      ) : visibleEntries.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-14 text-center">
          <CalendarDays className="mb-3 size-6 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">当前条件下暂无日历项</p>
          <p className="mt-1 text-xs text-muted-foreground/60">调整筛选或清空搜索查看完整执行日历</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="w-[110px] px-3 py-2 font-medium">日期</th>
                <th className="w-[180px] px-3 py-2 font-medium">时间</th>
                <th className="w-[140px] px-3 py-2 font-medium">模块/执行线</th>
                <th className="w-[140px] px-3 py-2 font-medium">渠道</th>
                <th className="w-[180px] px-3 py-2 font-medium">关联事项</th>
                <th className="px-3 py-2 font-medium">内容</th>
                <th className="w-[130px] px-3 py-2 font-medium">负责人/部门</th>
                <th className="w-[96px] px-3 py-2 font-medium">状态</th>
                <th className="w-[82px] px-3 py-2 font-medium">来源</th>
                {canEdit && <th className="w-[64px] px-3 py-2 font-medium">操作</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {visibleEntries.map((entry) => (
                <ExecutionCalendarRow
                  key={entry.id}
                  projectId={projectId}
                  entry={entry}
                  tasks={tasks}
                  focused={focusedTaskId === entry.taskId}
                  canEdit={canEdit}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function matchesCalendarFilter(entry: CalendarEntry, filter: CalendarFilter) {
  if (filter === "ALL") return true;
  if (filter === "UNSCHEDULED") return !entry.date;
  return entry.status === filter;
}

function matchesCalendarQuery(entry: CalendarEntry, query: string) {
  if (!query) return true;
  const haystack = [
    entry.content,
    entry.channel ?? "渠道待确认",
    entry.workstream ?? "模块待确认",
    entry.owner ?? "负责人待确认",
    entry.department ?? "部门待确认",
    entry.task?.name,
    entry.task?.status,
    entry.notes,
    entry.source === "AI_IMPORT" ? "AI 导入" : "手动",
    STATUS_LABEL[entry.status] ?? entry.status,
    toDateInputValue(entry.date),
    formatTime(entry),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}
