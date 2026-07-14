import Link from "next/link";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import type { getLeaderDashboardCalendar } from "@/actions/dashboard-actions";

type CalendarEntry = Awaited<ReturnType<typeof getLeaderDashboardCalendar>>["entries"][number];

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const STATUS_STYLE: Record<string, string> = {
  CONFIRMED: "border-success/30 bg-success/10 text-success",
  PLANNED: "border-primary/30 bg-primary/10 text-primary",
  DONE: "border-border bg-muted text-muted-foreground",
};

export function GlobalExecutionCalendar({ month, entries }: Awaited<ReturnType<typeof getLeaderDashboardCalendar>>) {
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  const firstDay = new Date(year, monthIndex - 1, 1);
  const lastDay = new Date(year, monthIndex, 0);
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - firstDay.getDay());
  const gridEnd = new Date(lastDay);
  gridEnd.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
  const days = getCalendarDays(gridStart, gridEnd);
  const entriesByDay = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const key = toDayKey(entry.date);
    entriesByDay.set(key, [...(entriesByDay.get(key) ?? []), entry]);
  }
  const previousMonth = toMonthKey(year, monthIndex - 2);
  const nextMonth = toMonthKey(year, monthIndex);

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-4" />跨项目执行月历</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatMonth(firstDay)} · {entries.length} 个正式节点</p>
        </div>
        <div className="flex items-center gap-1">
          <MonthButton month={previousMonth} label="上个月"><ChevronLeft className="size-4" /></MonthButton>
          <Link href="/dashboard?view=calendar" className="rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted">本月</Link>
          <MonthButton month={nextMonth} label="下个月"><ChevronRight className="size-4" /></MonthButton>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[840px]">
          <div className="grid grid-cols-7 border-b bg-muted/25">
            {WEEKDAYS.map((day) => <div key={day} className="px-3 py-2 text-center text-[11px] font-medium text-muted-foreground">周{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = toDayKey(day);
              const dayEntries = entriesByDay.get(key) ?? [];
              const inMonth = day.getMonth() === firstDay.getMonth();
              const isToday = toDayKey(day) === toDayKey(new Date());
              return (
                <div key={key} className={inMonth ? "min-h-32 border-b border-r border-border/70 p-2 last:border-r-0" : "min-h-32 border-b border-r border-border/70 bg-muted/20 p-2 last:border-r-0"}>
                  <div className="mb-1 flex items-center justify-between"><span className={isToday ? "flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground" : "text-xs text-muted-foreground"}>{day.getDate()}</span>{dayEntries.length > 3 && <span className="text-[10px] text-muted-foreground">+{dayEntries.length - 3}</span>}</div>
                  <div className="space-y-1">
                    {dayEntries.slice(0, 3).map((entry) => <CalendarEntryChip key={entry.id} entry={entry} />)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 border-t px-4 py-2.5 text-[11px] text-muted-foreground"><Legend className="bg-primary" label="计划中" /><Legend className="bg-success" label="已确认" /><Legend className="bg-muted-foreground/50" label="已完成" /></div>
    </section>
  );
}

function CalendarEntryChip({ entry }: { entry: CalendarEntry }) {
  const href = `/projects/${entry.projectId}?tab=calendar${entry.taskId ? `&calendarTask=${entry.taskId}` : ""}`;
  return <Link href={href} title={`${entry.content} · ${entry.projectName}`} className={`block truncate rounded border px-1.5 py-1 text-[10px] leading-4 transition-colors hover:brightness-95 ${STATUS_STYLE[entry.status] ?? STATUS_STYLE.PLANNED}`}><span className="mr-1 font-mono opacity-80">{entry.startTime ?? "全天"}</span>{entry.content}</Link>;
}

function MonthButton({ month, label, children }: { month: string; label: string; children: React.ReactNode }) {
  return <Link href={`/dashboard?view=calendar&month=${month}`} aria-label={label} title={label} className="flex size-7 items-center justify-center rounded-md border transition-colors hover:bg-muted">{children}</Link>;
}

function Legend({ className, label }: { className: string; label: string }) {
  return <span className="flex items-center gap-1.5"><span className={`size-2 rounded-full ${className}`} />{label}</span>;
}

function getCalendarDays(start: Date, end: Date) {
  const days: Date[] = [];
  for (const day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) days.push(new Date(day));
  return days;
}

function toDayKey(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
}

function toMonthKey(year: number, zeroBasedMonth: number) {
  const date = new Date(year, zeroBasedMonth, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long" }).format(value);
}
