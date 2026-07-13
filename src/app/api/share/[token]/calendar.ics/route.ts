import { NextResponse } from "next/server";
import { getSharedProject } from "@/lib/project-share";
import { buildCalendarFeed } from "@/lib/p2-rules";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { token: string } }) {
  const shared = await getSharedProject(params.token);
  if (!shared) return new NextResponse("Calendar feed not found", { status: 404 });

  const calendar = buildCalendarFeed(shared.project.name, shared.project.calendarEntries);

  return new NextResponse(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(`${shared.project.name}-执行日历.ics`)}`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
