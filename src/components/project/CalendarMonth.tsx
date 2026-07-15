"use client";

import { cn } from "@/lib/utils";
import { type CalendarEntry } from "@/components/project/calendar-types";

export function CalendarMonth({ entries, onOpen }: { entries: CalendarEntry[]; onOpen: (entry: CalendarEntry) => void }) {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const start = new Date(first); start.setDate(first.getDate() - first.getDay());
  const end = new Date(last); end.setDate(last.getDate() + (6 - last.getDay()));
  const days: Date[] = []; for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) days.push(new Date(day));
  const byDay = new Map<string, CalendarEntry[]>(); entries.filter((entry) => entry.date).forEach((entry) => { const key = new Date(entry.date!).toISOString().slice(0, 10); byDay.set(key, [...(byDay.get(key) ?? []), entry]); });
  return <div className="overflow-x-auto"><div className="min-w-[620px]"><div className="grid grid-cols-7 gap-px text-center text-xs text-muted-foreground">{["日", "一", "二", "三", "四", "五", "六"].map((day) => <span key={day} className="py-2">{day}</span>)}</div><div className="grid grid-cols-7 gap-px border border-border bg-border">{days.map((day) => { const key = day.toISOString().slice(0, 10); const items = byDay.get(key) ?? []; return <div key={key} className={cn("min-h-24 bg-canvas p-2", day.getMonth() !== today.getMonth() && "bg-muted/20 text-muted-foreground", key === today.toISOString().slice(0, 10) && "bg-primary/[0.04]")}><p className="text-xs font-medium">{day.getDate()}</p><div className="mt-1 space-y-1">{items.slice(0, 2).map((entry) => <button key={entry.id} type="button" onClick={() => onOpen(entry)} className="block w-full truncate text-left text-[11px] hover:text-primary">{entry.startTime ? `${entry.startTime} ` : ""}{entry.content}</button>)}{items.length > 2 && <p className="text-[11px] text-muted-foreground">另 {items.length - 2} 项</p>}</div></div>; })}</div></div></div>;
}
