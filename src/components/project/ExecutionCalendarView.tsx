"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, CircleDashed, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateCalendarEntry } from "@/actions/calendar-actions";
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
type CalendarMode = "WEEK" | "MONTH";
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
}: {
  projectId: string;
  entry: CalendarEntry;
  tasks: TaskOption[];
  focused: boolean;
}) {
  const router = useRouter();
  const [date, setDate] = useState(toDateInputValue(entry.date));
  const [owner, setOwner] = useState(entry.owner ?? "");
  const [status, setStatus] = useState(entry.status);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [taskId, setTaskId] = useState(entry.taskId ?? "");
  const [saving, setSaving] = useState(false);

  const dirty =
    date !== toDateInputValue(entry.date) ||
    owner !== (entry.owner ?? "") ||
    status !== entry.status ||
    notes !== (entry.notes ?? "") ||
    taskId !== (entry.taskId ?? "");

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("entryId", entry.id);
      formData.set("date", date);
      formData.set("owner", owner);
      formData.set("status", status);
      formData.set("notes", notes);
      formData.set("taskId", taskId);

      const result = await updateCalendarEntry(formData);
      if (result.success) {
        toast.success("执行日历已更新");
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
    <tr className={cn("bg-card transition-colors hover:bg-muted/30", focused && "bg-primary/5 ring-1 ring-inset ring-primary/30")}>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          {date ? (
            <CheckCircle2 className="size-3 text-emerald-500" />
          ) : (
            <CircleDashed className="size-3 text-amber-700" />
          )}
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            onInput={(event) => setDate(event.currentTarget.value)}
            onKeyDown={saveOnEnter}
            title={date ? formatDate(date) : "日期待确认"}
            className={`w-full rounded border border-transparent bg-transparent px-1 py-1 outline-none transition-colors focus:border-primary focus:bg-background ${
              date ? "" : "font-medium text-amber-700"
            }`}
          />
        </div>
      </td>
      <td className="px-3 py-2 font-mono text-muted-foreground">
        {formatTime(entry) || "-"}
      </td>
      <td className="px-3 py-2">
        <span className="line-clamp-1">{entry.workstream ?? "未分组"}</span>
      </td>
      <td className="px-3 py-2">
        <span className="line-clamp-1">{entry.channel ?? "渠道待确认"}</span>
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <select
            value={taskId}
            onChange={(event) => setTaskId(event.target.value)}
            className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-1 outline-none transition-colors focus:border-primary focus:bg-background"
          >
            <option value="">未关联</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>{task.name}</option>
            ))}
          </select>
          {entry.taskId && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-6 shrink-0 px-1.5 text-[10px]"
              onClick={() => router.push(`/projects/${projectId}?tab=tasks&focusTask=${entry.taskId}`)}
            >
              查看
            </Button>
          )}
        </div>
      </td>
      <td className="px-3 py-2">
        <div className="space-y-0.5">
          <p className="font-medium leading-5">{entry.content}</p>
          <input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onKeyDown={saveOnEnter}
            placeholder="备注"
            className="w-full rounded border border-transparent bg-transparent px-1 py-1 text-[11px] text-muted-foreground outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background"
          />
        </div>
      </td>
      <td className="px-3 py-2">
        <input
          value={owner}
          onChange={(event) => setOwner(event.target.value)}
          onKeyDown={saveOnEnter}
          placeholder={entry.department ?? "待确认"}
          className="w-full rounded border border-transparent bg-transparent px-1 py-1 outline-none transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:bg-background"
        />
      </td>
      <td className="px-3 py-2">
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="w-full rounded border border-transparent bg-transparent px-1 py-1 outline-none transition-colors focus:border-primary focus:bg-background"
        >
          <option value="PLANNED">计划中</option>
          <option value="CONFIRMED">已确认</option>
          <option value="DONE">已完成</option>
          <option value="CANCELED">已取消</option>
        </select>
      </td>
      <td className="px-3 py-2 text-muted-foreground">
        <div className="flex items-center justify-between gap-2">
          <span>{entry.source === "AI_IMPORT" ? "AI 导入" : "手动"}</span>
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

export function ExecutionCalendarView({
  projectId,
  entries,
  tasks,
}: {
  projectId: string;
  entries: CalendarEntry[];
  tasks: TaskOption[];
}) {
  const [mode, setMode] = useState<CalendarMode>("WEEK");
  const [filter, setFilter] = useState<CalendarFilter>("ALL");
  const [query, setQuery] = useState("");
  const [focusedTaskId, setFocusedTaskId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const normalizedQuery = query.trim().toLowerCase();
  const scheduledCount = entries.filter((entry) => entry.date).length;
  const unscheduledCount = entries.length - scheduledCount;
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
        </div>
      </div>

      <div className="rounded-lg border bg-background p-3">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">{mode === "WEEK" ? "未来 7 天" : "本月排期"}</p>
            <p className="text-xs text-muted-foreground">
              {mode === "WEEK" ? "快速查看近期排期密度和待执行节点" : "按月浏览执行节奏，点击日期可过滤到当天"}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-full border bg-muted/20 p-0.5">
              {(["WEEK", "MONTH"] as const).map((item) => (
                <Button
                  key={item}
                  type="button"
                  size="sm"
                  variant={mode === item ? "default" : "ghost"}
                  className="h-6 rounded-full px-2 text-xs"
                  onClick={() => setMode(item)}
                >
                  {item === "WEEK" ? "周" : "月"}
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
        {mode === "WEEK" ? (
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
            placeholder="搜索内容、渠道、工作流、负责人、备注"
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
            从 AI 导入候选确认日历项后，会出现在这里
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
                <th className="w-[88px] px-3 py-2 font-medium">时间</th>
                <th className="w-[140px] px-3 py-2 font-medium">工作流</th>
                <th className="w-[140px] px-3 py-2 font-medium">渠道</th>
                <th className="w-[180px] px-3 py-2 font-medium">关联事项</th>
                <th className="px-3 py-2 font-medium">内容</th>
                <th className="w-[110px] px-3 py-2 font-medium">负责人</th>
                <th className="w-[96px] px-3 py-2 font-medium">状态</th>
                <th className="w-[82px] px-3 py-2 font-medium">来源</th>
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
    entry.channel,
    entry.workstream,
    entry.owner,
    entry.department,
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
