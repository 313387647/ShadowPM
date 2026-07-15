"use client";

import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate, formatTime, isOverdue, STATUS_LABEL, type CalendarEntry } from "@/components/project/calendar-types";

export function CalendarAgenda({ entries, onOpen }: { entries: CalendarEntry[]; onOpen: (entry: CalendarEntry) => void }) {
  const unscheduled = entries.filter((entry) => !entry.date);
  const dated = entries.filter((entry) => entry.date).reduce<Map<string, CalendarEntry[]>>((groups, entry) => {
    const key = new Date(entry.date!).toISOString().slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), entry]);
    return groups;
  }, new Map());
  return <div className="divide-y divide-border border-y border-border">
    {unscheduled.length > 0 && <AgendaGroup title="待排期" entries={unscheduled} onOpen={onOpen} />}
    {Array.from(dated.entries()).sort(([left], [right]) => left.localeCompare(right)).map(([date, items]) => <AgendaGroup key={date} title={formatDate(items[0]?.date ?? null)} entries={items.sort((left, right) => (left.startTime ?? "99:99").localeCompare(right.startTime ?? "99:99"))} onOpen={onOpen} />)}
    {entries.length === 0 && <div className="flex flex-col items-center py-16 text-center text-sm text-muted-foreground"><CalendarClock className="mb-3 size-5" />当前条件下没有执行节点</div>}
  </div>;
}

function AgendaGroup({ title, entries, onOpen }: { title: string; entries: CalendarEntry[]; onOpen: (entry: CalendarEntry) => void }) {
  return <section><h3 className="px-1 py-3 text-sm font-semibold">{title}</h3><div className="divide-y divide-border">{entries.map((entry) => <button key={entry.id} type="button" onClick={() => onOpen(entry)} className="grid w-full grid-cols-[68px_minmax(0,1fr)] gap-3 px-1 py-3 text-left transition-colors hover:bg-muted/35 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:px-3"><p className="pt-0.5 font-mono text-xs text-muted-foreground">{formatTime(entry)}</p><div className="min-w-0"><p className="truncate text-sm font-medium">{entry.content}</p><p className="mt-1 truncate text-xs text-muted-foreground">{[entry.channel, entry.owner, entry.task?.name].filter(Boolean).join(" · ") || "未关联事项"}</p></div><span className={cn("hidden self-center text-xs sm:block", isOverdue(entry) ? "text-destructive" : entry.status === "DONE" ? "text-success" : "text-muted-foreground")}>{isOverdue(entry) ? "已逾期" : STATUS_LABEL[entry.status] ?? entry.status}</span></button>)}</div></section>;
}
