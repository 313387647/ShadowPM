"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { createCalendarEntry } from "@/actions/calendar-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { CalendarAgenda } from "@/components/project/CalendarAgenda";
import { CalendarEntrySheet } from "@/components/project/CalendarEntrySheet";
import { CalendarMonth } from "@/components/project/CalendarMonth";
import { dateKey, isOverdue, monthKey, parseMonth, type CalendarEntry, type CalendarFilter, type TaskOption } from "@/components/project/calendar-types";

const FILTERS: Array<{ value: CalendarFilter; label: string }> = [{ value: "ALL", label: "全部" }, { value: "UNSCHEDULED", label: "待排期" }, { value: "OVERDUE", label: "已逾期" }];

export function ExecutionCalendarView({ projectId, entries, tasks, canEdit }: { projectId: string; entries: CalendarEntry[]; tasks: TaskOption[]; canEdit: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "month" ? "month" : "agenda";
  const filter = isCalendarFilter(searchParams.get("calendarFilter")) ? searchParams.get("calendarFilter") as CalendarFilter : "ALL";
  const day = searchParams.get("calendarDay");
  const month = parseMonth(searchParams.get("month"));
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<CalendarEntry | null>(null);
  const [quickAdd, setQuickAdd] = useState(false);
  const [creating, setCreating] = useState(false);

  const visible = useMemo(() => entries.filter((entry) => {
    const matchesFilter = filter === "ALL" || (filter === "UNSCHEDULED" && !entry.date) || (filter === "OVERDUE" && isOverdue(entry));
    const matchesDay = !day || dateKey(entry.date) === day;
    const matchesQuery = [entry.content, entry.channel, entry.owner, entry.workstream, entry.task?.name, entry.notes].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase());
    return matchesFilter && matchesDay && matchesQuery;
  }), [day, entries, filter, query]);

  function updateCalendarParams(next: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(next).forEach(([key, value]) => value ? params.set(key, value) : params.delete(key));
    router.replace(`/projects/${projectId}?${params.toString()}`, { scroll: false });
  }

  async function add(formData: FormData) {
    setCreating(true); formData.set("projectId", projectId);
    try {
      const result = await createCalendarEntry(formData);
      if (!result.success) toast.error(result.message ?? "添加失败");
      else { setQuickAdd(false); router.refresh(); }
    } catch { toast.error("添加失败"); } finally { setCreating(false); }
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
      <div className="flex items-center gap-1" role="tablist" aria-label="日历视图">
        <button type="button" role="tab" aria-selected={view === "agenda"} onClick={() => updateCalendarParams({ view: null, month: null, calendarDay: null })} className={view === "agenda" ? "border-b-2 border-primary px-2 py-2 text-sm font-medium" : "border-b-2 border-transparent px-2 py-2 text-sm text-muted-foreground hover:text-foreground"}>议程</button>
        <button type="button" role="tab" aria-selected={view === "month"} onClick={() => updateCalendarParams({ view: "month", calendarDay: null, month: monthKey(month) })} className={view === "month" ? "border-b-2 border-primary px-2 py-2 text-sm font-medium" : "border-b-2 border-transparent px-2 py-2 text-sm text-muted-foreground hover:text-foreground"}>月历</button>
      </div>
      {canEdit && <Button size="sm" onClick={() => setQuickAdd((open) => !open)}><Plus className="mr-1.5 size-3.5" />添加节点</Button>}
    </div>
    {quickAdd && <form action={add} className="grid gap-2 border-b border-border pb-3 sm:grid-cols-[150px_minmax(0,1fr)_180px_auto]">
      <Input name="date" type="date" className="h-9" />
      <Input name="content" required placeholder="执行内容" className="h-9" />
      <Select name="taskId" className="h-9"><option value="">暂不关联事项</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}</Select>
      <Button size="sm" type="submit" disabled={creating}>{creating ? "添加中" : "添加"}</Button>
    </form>}
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex gap-1">{FILTERS.map((item) => <button key={item.value} type="button" onClick={() => updateCalendarParams({ calendarFilter: item.value === "ALL" ? null : item.value, calendarDay: null })} className={filter === item.value ? "rounded-md bg-surface-3 px-2.5 py-1.5 text-xs font-medium text-foreground" : "rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground"}>{item.label}</button>)}</div>
      <div className="relative w-full sm:w-72"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索执行内容、渠道、负责人" className="h-9 pl-8 text-sm" /></div>
    </div>
    {day && view === "agenda" && <div className="flex items-center justify-between border-b border-border pb-2 text-sm"><span>{day}</span><button type="button" onClick={() => updateCalendarParams({ calendarDay: null })} className="text-xs text-muted-foreground hover:text-foreground">查看全部</button></div>}
    {view === "agenda"
      ? <CalendarAgenda entries={visible} onOpen={setSelected} />
      : <CalendarMonth entries={visible} month={month} onOpen={setSelected} onMonthChange={(nextMonth) => updateCalendarParams({ month: monthKey(nextMonth), view: "month" })} onDayOpen={(nextDay) => updateCalendarParams({ view: null, calendarDay: nextDay })} />}
    <CalendarEntrySheet entry={selected} tasks={tasks} canEdit={canEdit} onClose={() => setSelected(null)} />
  </div>;
}

function isCalendarFilter(value: string | null): value is CalendarFilter { return value === "ALL" || value === "UNSCHEDULED" || value === "OVERDUE"; }
