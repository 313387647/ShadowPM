"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertCanReadProject, assertCanWriteProject } from "@/lib/permissions";
import type { ActionResult } from "@/actions/types";

const CALENDAR_STATUSES = ["PLANNED", "CONFIRMED", "DONE", "CANCELED"] as const;

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function parseDateSafe(dateRaw: string | null): Date | null {
  if (!dateRaw) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
    ? new Date(`${dateRaw}T00:00:00.000Z`)
    : null;
}

function formatTextValue(value: string | null) {
  return value ?? "未填写";
}

function formatDateValue(value: Date | null) {
  return value ? value.toISOString().slice(0, 10) : "未填写";
}

function buildCalendarChangeLog(
  before: {
    date: Date | null;
    owner: string | null;
    status: string;
    notes: string | null;
    taskId: string | null;
    task?: { name: string } | null;
  },
  after: {
    date: Date | null;
    owner: string | null;
    status: string;
    notes: string | null;
    taskId: string | null;
    taskName: string | null;
  }
) {
  const changes: string[] = [];
  if (formatDateValue(before.date) !== formatDateValue(after.date)) {
    changes.push(`日期：${formatDateValue(before.date)} → ${formatDateValue(after.date)}`);
  }
  if (before.owner !== after.owner) {
    changes.push(`负责人：${formatTextValue(before.owner)} → ${formatTextValue(after.owner)}`);
  }
  if (before.status !== after.status) {
    changes.push(`状态：${before.status} → ${after.status}`);
  }
  if (before.notes !== after.notes) {
    changes.push(`备注：${formatTextValue(before.notes)} → ${formatTextValue(after.notes)}`);
  }
  if (before.taskId !== after.taskId) {
    changes.push(`关联事项：${formatTextValue(before.task?.name ?? null)} → ${formatTextValue(after.taskName)}`);
  }
  return changes;
}

export async function getProjectCalendarEntries(projectId: string) {
  await assertCanReadProject(projectId);

  return prisma.executionCalendarEntry.findMany({
    where: { projectId },
    include: {
      task: { select: { id: true, name: true, status: true } },
    },
    orderBy: [
      { date: "asc" },
      { createdAt: "desc" },
    ],
  });
}

export async function updateCalendarEntry(formData: FormData): Promise<ActionResult> {
  const entryId = formData.get("entryId") as string;
  const dateRaw = (formData.get("date") as string) || null;
  const statusRaw = (formData.get("status") as string) || "PLANNED";
  const owner = (formData.get("owner") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const taskId = normalizeText((formData.get("taskId") as string) || null);

  if (!entryId) return { success: false, message: "日历项 ID 为必填项" };

  const status = CALENDAR_STATUSES.includes(statusRaw as (typeof CALENDAR_STATUSES)[number])
    ? statusRaw
    : "PLANNED";

  const entry = await prisma.executionCalendarEntry.findUnique({
    where: { id: entryId },
    select: {
      projectId: true,
      content: true,
      date: true,
      owner: true,
      status: true,
      notes: true,
      taskId: true,
      task: { select: { name: true } },
    },
  });
  if (!entry) return { success: false, message: "日历项不存在" };
  const user = await assertCanWriteProject(entry.projectId);
  const relatedTask = taskId
    ? await prisma.task.findFirst({
        where: { id: taskId, projectId: entry.projectId },
        select: { id: true, name: true },
      })
    : null;
  if (taskId && !relatedTask) return { success: false, message: "关联事项不存在" };

  const nextEntry = {
    date: parseDateSafe(dateRaw),
    status,
    owner: normalizeText(owner),
    notes: normalizeText(notes),
    taskId,
    taskName: relatedTask?.name ?? null,
  };
  const changes = buildCalendarChangeLog(entry, nextEntry);

  await prisma.$transaction([
    prisma.executionCalendarEntry.update({
      where: { id: entryId },
      data: {
        date: nextEntry.date,
        status: nextEntry.status,
        owner: nextEntry.owner,
        notes: nextEntry.notes,
        taskId: nextEntry.taskId,
      },
    }),
    ...(changes.length > 0
      ? [
          prisma.activityLog.create({
            data: {
              projectId: entry.projectId,
              targetType: "CALENDAR_ENTRY",
              targetId: entryId,
              changeType: "UPDATE",
              summary: `📆 执行日历更新：${entry.content}\n${changes.map((change) => `- ${change}`).join("\n")}`,
              beforeState: {
                date: entry.date?.toISOString() ?? null,
                owner: entry.owner,
                status: entry.status,
                notes: entry.notes,
                taskId: entry.taskId,
              },
              afterState: {
                date: nextEntry.date?.toISOString() ?? null,
                owner: nextEntry.owner,
                status: nextEntry.status,
                notes: nextEntry.notes,
                taskId: nextEntry.taskId,
              },
              source: "HUMAN",
              createdBy: user.name,
            },
          }),
        ]
      : []),
  ]);

  revalidatePath(`/projects/${entry.projectId}`);
  return { success: true, message: changes.length > 0 ? "日历已更新，变更已记录" : "日历无变化" };
}
