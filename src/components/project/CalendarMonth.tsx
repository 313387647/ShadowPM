"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dateKey, monthKey, type CalendarEntry } from "@/components/project/calendar-types";

export function CalendarMonth({ entries, month, onOpen, onMonthChange, onDayOpen }: { entries: CalendarEntry[]; month: Date; onOpen: (entry: CalendarEntry) => void; onMonthChange: (month: Date) => void; onDayOpen: (date: string) => void }) {
  const today = new Date();
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const start = new Date(first); start.setDate(first.getDate() - first.getDay());
  const end = new Date(last); end.setDate(last.getDate() + (6 - last.getDay()));
  const days: Date[] = [];
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) days.push(new Date(day));
  const byDay = new Map<string, CalendarEntry[]>();
  entries.filter((entry) => entry.date).forEach((entry) => {
    const key = dateKey(entry.date);
    byDay.set(key, [...(byDay.get(key) ?? []), entry]);
  });
  const todayKey = dateKey(today);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="上个月"><ChevronLeft className="size-4" /></Button>
          <p className="min-w-28 text-center text-sm font-medium">{month.getFullYear()}年{month.getMonth() + 1}月</p>
          <Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="下个月"><ChevronRight className="size-4" /></Button>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onMonthChange(new Date(today.getFullYear(), today.getMonth(), 1))}>今天</Button>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[620px]">
          <div className="grid grid-cols-7 border-b border-border text-center text-xs text-muted-foreground">{["日", "一", "二", "三", "四", "五", "六"].map((day) => <span key={day} className="py-2">{day}</span>)}</div>
          <div className="grid grid-cols-7 border-l border-t border-border">
            {days.map((day) => {
              const key = monthKey(day).slice(0, 7) + `-${String(day.getDate()).padStart(2, "0")}`;
              const items = byDay.get(key) ?? [];
              return <div key={key} className={cn("min-h-24 border-b border-r border-border p-2", day.getMonth() !== month.getMonth() && "bg-surface-1/40 text-muted-foreground", key === todayKey && "bg-primary/[0.035]")}>
                <button type="button" onClick={() => onDayOpen(key)} className={cn("grid size-6 place-items-center rounded text-xs font-medium hover:bg-surface-3", key === todayKey && "bg-primary text-primary-foreground")}>{day.getDate()}</button>
                <div className="mt-1 space-y-1">{items.slice(0, 2).map((entry) => <button key={entry.id} type="button" onClick={() => onOpen(entry)} className="block w-full truncate text-left text-[11px] hover:text-primary">{entry.startTime ? `${entry.startTime} ` : ""}{entry.content}</button>)}{items.length > 2 && <button type="button" onClick={() => onDayOpen(key)} className="text-[11px] text-muted-foreground hover:text-foreground">另 {items.length - 2} 项</button>}</div>
              </div>;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
