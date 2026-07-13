export function normalizeShareExpiryDays(value: number) {
  if (!Number.isFinite(value)) return 30;
  return Math.min(Math.max(Math.round(value), 1), 90);
}

export function isValidShareToken(token: string) {
  return /^[A-Za-z0-9_-]{40,64}$/.test(token);
}

export type CalendarFeedEntry = {
  id: string;
  date: Date | null;
  startTime: string | null;
  endTime: string | null;
  content: string;
  workstream: string | null;
  channel: string | null;
  owner: string | null;
  notes: string | null;
  status: string;
};

export function buildCalendarFeed(projectName: string, entries: CalendarFeedEntry[], generatedAt = new Date()) {
  const events = entries.filter((entry) => entry.date).map((entry) => buildEvent(entry, projectName, generatedAt)).join("\r\n");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ShadowPM//Project Execution Calendar//ZH-CN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeICal(projectName)} 执行日历`,
    events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

function buildEvent(entry: CalendarFeedEntry, projectName: string, generatedAt: Date) {
  const date = entry.date!;
  const datePart = date.toISOString().slice(0, 10).replaceAll("-", "");
  const isTimed = Boolean(entry.startTime);
  const start = isTimed ? `${datePart}T${entry.startTime!.replace(":", "")}00` : datePart;
  const end = isTimed
    ? `${datePart}T${(entry.endTime ?? addMinutes(entry.startTime!, 60)).replace(":", "")}00`
    : addOneDay(date).toISOString().slice(0, 10).replaceAll("-", "");
  const valueType = isTimed ? "" : ";VALUE=DATE";
  return [
    "BEGIN:VEVENT",
    `UID:${entry.id}@shadowpm`,
    `DTSTAMP:${generatedAt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "")}`,
    `DTSTART${valueType}:${start}`,
    `DTEND${valueType}:${end}`,
    `SUMMARY:${escapeICal(entry.content)}`,
    `DESCRIPTION:${escapeICal([projectName, entry.workstream, entry.channel, entry.owner, entry.notes].filter(Boolean).join(" · "))}`,
    entry.status === "CANCELED" ? "STATUS:CANCELLED" : "STATUS:CONFIRMED",
    "END:VEVENT",
  ].join("\r\n");
}

function escapeICal(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function addOneDay(date: Date) {
  return new Date(date.getTime() + 86400000);
}

function addMinutes(time: string, minutes: number) {
  const [hours, minute] = time.split(":").map(Number);
  const total = (hours * 60 + minute + minutes) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
