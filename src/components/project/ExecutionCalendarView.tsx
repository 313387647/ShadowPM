"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { createCalendarEntry } from "@/actions/calendar-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarAgenda } from "@/components/project/CalendarAgenda";
import { CalendarEntrySheet } from "@/components/project/CalendarEntrySheet";
import { CalendarMonth } from "@/components/project/CalendarMonth";
import { isOverdue, type CalendarEntry, type CalendarFilter, type TaskOption } from "@/components/project/calendar-types";

export function ExecutionCalendarView({ projectId, entries, tasks, canEdit }: { projectId: string; entries: CalendarEntry[]; tasks: TaskOption[]; canEdit: boolean }) {
  const [view, setView] = useState<"agenda" | "month">("agenda"); const [filter, setFilter] = useState<CalendarFilter>("ALL"); const [query, setQuery] = useState(""); const [selected, setSelected] = useState<CalendarEntry | null>(null); const [quickAdd, setQuickAdd] = useState(false); const [creating, setCreating] = useState(false);
  const router = useRouter();
  const visible = useMemo(() => entries.filter((entry) => (filter === "ALL" || filter === "UNSCHEDULED" && !entry.date || filter === "OVERDUE" && isOverdue(entry)) && [entry.content, entry.channel, entry.owner, entry.workstream, entry.task?.name, entry.notes].filter(Boolean).join(" ").toLowerCase().includes(query.trim().toLowerCase())), [entries, filter, query]);
  async function add(formData: FormData) { setCreating(true); formData.set("projectId", projectId); try { const result = await createCalendarEntry(formData); if (!result.success) toast.error(result.message ?? "添加失败"); else { toast.success("执行节点已添加"); router.refresh(); setQuickAdd(false); } } catch { toast.error("添加失败"); } finally { setCreating(false); } }
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-base font-semibold">执行日历</h2><p className="mt-1 text-xs text-muted-foreground">按日期安排传播、执行与关键节点。</p></div>{canEdit && <Button size="sm" onClick={() => setQuickAdd((open) => !open)}><Plus className="mr-1.5 size-3.5" />添加节点</Button>}</div>{quickAdd && <form action={add} className="grid gap-2 border-y border-border py-3 sm:grid-cols-[150px_minmax(0,1fr)_180px_auto]"><input name="date" type="date" className="h-9 rounded-md border bg-background px-2 text-sm" /><input name="content" required placeholder="执行内容" className="h-9 rounded-md border bg-background px-3 text-sm" /><select name="taskId" className="h-9 rounded-md border bg-background px-2 text-sm"><option value="">不关联事项</option>{tasks.map((task) => <option key={task.id} value={task.id}>{task.name}</option>)}</select><Button size="sm" type="submit" disabled={creating}>{creating ? "添加中" : "添加"}</Button></form>}<div className="flex flex-wrap items-center justify-between gap-3"><div className="flex rounded-md border border-border p-0.5"><Button size="sm" variant={view === "agenda" ? "default" : "ghost"} onClick={() => setView("agenda")}>议程</Button><Button size="sm" variant={view === "month" ? "default" : "ghost"} onClick={() => setView("month")}>月历</Button></div><div className="flex gap-1">{([{ value: "ALL", label: "全部" }, { value: "UNSCHEDULED", label: "待排期" }, { value: "OVERDUE", label: "已逾期" }] as const).map((item) => <Button key={item.value} size="sm" variant={filter === item.value ? "default" : "ghost"} onClick={() => setFilter(item.value)}>{item.label}</Button>)}</div></div><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索执行内容、渠道、负责人或事项" className="h-9 pl-8 text-sm" /></div>{view === "agenda" ? <CalendarAgenda entries={visible} onOpen={setSelected} /> : <CalendarMonth entries={visible} onOpen={setSelected} />}<CalendarEntrySheet entry={selected} tasks={tasks} canEdit={canEdit} onClose={() => setSelected(null)} /></div>;
}
