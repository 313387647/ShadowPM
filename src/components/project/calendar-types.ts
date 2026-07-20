export type CalendarEntry = {
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

export type TaskOption = { id: string; name: string; status: string };
export type CalendarFilter = "ALL" | "UNSCHEDULED" | "OVERDUE";

export const STATUS_LABEL: Record<string, string> = { PLANNED: "计划中", CONFIRMED: "已确认", DONE: "已完成", CANCELED: "已取消" };

export function toDateInput(value: CalendarEntry["date"]) { return value ? new Date(value).toISOString().slice(0, 10) : ""; }
export function dateKey(value: CalendarEntry["date"]) {
  if (!value) return "";
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
export function monthKey(value: Date) { return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}`; }
export function parseMonth(value: string | null) {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1);
}
export function formatDate(value: CalendarEntry["date"]) { if (!value) return "日期待确认"; return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date(value)); }
export function formatTime(entry: CalendarEntry) { return [entry.startTime, entry.endTime].filter(Boolean).join(" - ") || "时间待定"; }
export function isOverdue(entry: CalendarEntry) { if (!entry.date || ["DONE", "CANCELED"].includes(entry.status)) return false; const date = new Date(entry.date); date.setHours(23, 59, 59, 999); return date < new Date(); }
