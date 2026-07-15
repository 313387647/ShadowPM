"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertCanReadProject, assertCanWriteProject, assertCanWriteTask } from "@/lib/permissions";
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
    startTime: string | null;
    endTime: string | null;
    channel: string | null;
    workstream: string | null;
    content: string;
    owner: string | null;
    department: string | null;
    status: string;
    notes: string | null;
    taskId: string | null;
    task?: { name: string } | null;
  },
  after: {
    date: Date | null;
    startTime: string | null;
    endTime: string | null;
    channel: string | null;
    workstream: string | null;
    content: string;
    owner: string | null;
    department: string | null;
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
  if (before.startTime !== after.startTime || before.endTime !== after.endTime) {
    changes.push(`时间：${formatTextValue([before.startTime, before.endTime].filter(Boolean).join("-") || null)} → ${formatTextValue([after.startTime, after.endTime].filter(Boolean).join("-") || null)}`);
  }
  if (before.workstream !== after.workstream) {
    changes.push(`模块/执行线：${formatTextValue(before.workstream)} → ${formatTextValue(after.workstream)}`);
  }
  if (before.channel !== after.channel) {
    changes.push(`渠道：${formatTextValue(before.channel)} → ${formatTextValue(after.channel)}`);
  }
  if (before.content !== after.content) {
    changes.push(`内容：${before.content} → ${after.content}`);
  }
  if (before.owner !== after.owner) {
    changes.push(`负责人：${formatTextValue(before.owner)} → ${formatTextValue(after.owner)}`);
  }
  if (before.department !== after.department) {
    changes.push(`部门：${formatTextValue(before.department)} → ${formatTextValue(after.department)}`);
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
  const startTime = (formData.get("startTime") as string) || null;
  const endTime = (formData.get("endTime") as string) || null;
  const channel = (formData.get("channel") as string) || null;
  const workstream = (formData.get("workstream") as string) || null;
  const content = (formData.get("content") as string) || null;
  const statusRaw = (formData.get("status") as string) || "PLANNED";
  const owner = (formData.get("owner") as string) || null;
  const department = (formData.get("department") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const taskId = normalizeText((formData.get("taskId") as string) || null);

  if (!entryId) return { success: false, message: "日历项 ID 为必填项" };
  if (!content?.trim()) return { success: false, message: "日历内容为必填项" };

  const status = CALENDAR_STATUSES.includes(statusRaw as (typeof CALENDAR_STATUSES)[number])
    ? statusRaw
    : "PLANNED";

  const entry = await prisma.executionCalendarEntry.findUnique({
    where: { id: entryId },
    select: {
      projectId: true,
      content: true,
      date: true,
      startTime: true,
      endTime: true,
      channel: true,
      workstream: true,
      owner: true,
      department: true,
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
    startTime: normalizeText(startTime),
    endTime: normalizeText(endTime),
    channel: normalizeText(channel),
    workstream: normalizeText(workstream),
    content: content.trim(),
    status,
    owner: normalizeText(owner),
    department: normalizeText(department),
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
        startTime: nextEntry.startTime,
        endTime: nextEntry.endTime,
        channel: nextEntry.channel,
        workstream: nextEntry.workstream,
        content: nextEntry.content,
        status: nextEntry.status,
        owner: nextEntry.owner,
        department: nextEntry.department,
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
                startTime: entry.startTime,
                endTime: entry.endTime,
                channel: entry.channel,
                workstream: entry.workstream,
                content: entry.content,
                owner: entry.owner,
                department: entry.department,
                status: entry.status,
                notes: entry.notes,
                taskId: entry.taskId,
              },
              afterState: {
                date: nextEntry.date?.toISOString() ?? null,
                startTime: nextEntry.startTime,
                endTime: nextEntry.endTime,
                channel: nextEntry.channel,
                workstream: nextEntry.workstream,
                content: nextEntry.content,
                owner: nextEntry.owner,
                department: nextEntry.department,
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

export async function createCalendarEntry(formData: FormData): Promise<ActionResult<{ calendarEntryId: string }>> {
  const projectId = (formData.get("projectId") as string | null)?.trim();
  const content = (formData.get("content") as string | null)?.trim();
  const taskId = normalizeText(formData.get("taskId") as string | null);
  if (!projectId || !content) return { success: false, message: "执行内容为必填项" };

  const user = await assertCanWriteProject(projectId);
  const task = taskId
    ? await prisma.task.findFirst({ where: { id: taskId, projectId }, select: { id: true, name: true } })
    : null;
  if (taskId && !task) return { success: false, message: "关联事项不存在" };

  const statusRaw = (formData.get("status") as string | null) ?? "PLANNED";
  const status = CALENDAR_STATUSES.includes(statusRaw as (typeof CALENDAR_STATUSES)[number]) ? statusRaw : "PLANNED";
  const created = await prisma.$transaction(async (tx) => {
    const entry = await tx.executionCalendarEntry.create({
      data: {
        projectId,
        taskId,
        date: parseDateSafe(formData.get("date") as string | null),
        startTime: normalizeText(formData.get("startTime") as string | null),
        endTime: normalizeText(formData.get("endTime") as string | null),
        channel: normalizeText(formData.get("channel") as string | null),
        workstream: normalizeText(formData.get("workstream") as string | null),
        content: content.slice(0, 240),
        owner: normalizeText(formData.get("owner") as string | null),
        department: normalizeText(formData.get("department") as string | null),
        notes: normalizeText(formData.get("notes") as string | null),
        status,
        source: "MANUAL",
        createdBy: user.name,
      },
    });
    await tx.activityLog.create({
      data: {
        projectId,
        targetType: "CALENDAR_ENTRY",
        targetId: entry.id,
        changeType: "CREATE",
        summary: `执行日历新增：${entry.content}`,
        afterState: { calendarEntryId: entry.id, taskId, taskName: task?.name ?? null, date: entry.date?.toISOString() ?? null, status: entry.status },
        source: "HUMAN",
        createdBy: user.name,
      },
    });
    return entry;
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, message: "执行节点已添加", data: { calendarEntryId: created.id } };
}

export async function createCalendarEntryFromTask(formData: FormData): Promise<ActionResult<{ calendarEntryId: string }>> {
  const taskId = formData.get("taskId") as string;
  const dateRaw = (formData.get("date") as string) || null;
  const startTime = (formData.get("startTime") as string) || null;
  const endTime = (formData.get("endTime") as string) || null;
  const channel = (formData.get("channel") as string) || null;
  const workstream = (formData.get("workstream") as string) || null;
  const content = (formData.get("content") as string) || null;
  const owner = (formData.get("owner") as string) || null;
  const department = (formData.get("department") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const statusRaw = (formData.get("status") as string) || "PLANNED";

  if (!taskId) return { success: false, message: "关联管控事项为必填项" };
  if (!content?.trim()) return { success: false, message: "日历内容为必填项" };

  const { user, task: taskRef } = await assertCanWriteTask(taskId);
  const task = await prisma.task.findUnique({
    where: { id: taskRef.id },
    select: {
      id: true,
      projectId: true,
      name: true,
      assignee: true,
      department: true,
      deadline: true,
      phase: { select: { name: true } },
    },
  });
  if (!task) return { success: false, message: "管控事项不存在" };

  const status = CALENDAR_STATUSES.includes(statusRaw as (typeof CALENDAR_STATUSES)[number])
    ? statusRaw
    : "PLANNED";
  const date = parseDateSafe(dateRaw);

  const calendarEntry = await prisma.$transaction(async (tx) => {
    const created = await tx.executionCalendarEntry.create({
      data: {
        projectId: task.projectId,
        taskId: task.id,
        date,
        startTime: normalizeText(startTime),
        endTime: normalizeText(endTime),
        channel: normalizeText(channel),
        workstream: normalizeText(workstream) ?? task.phase?.name ?? null,
        content: content.trim().slice(0, 240),
        owner: normalizeText(owner) ?? task.assignee,
        department: normalizeText(department) ?? task.department,
        status,
        notes: normalizeText(notes),
        source: "MANUAL",
        createdBy: user.name,
      },
    });

    await tx.activityLog.create({
      data: {
        projectId: task.projectId,
        targetType: "CALENDAR_ENTRY",
        targetId: created.id,
        changeType: "CREATE",
        summary: `📆 从管控事项创建执行日历：${created.content}`,
        afterState: {
          taskId: task.id,
          taskName: task.name,
          calendarEntryId: created.id,
          date: created.date?.toISOString() ?? null,
          startTime: created.startTime,
          endTime: created.endTime,
          channel: created.channel,
          workstream: created.workstream,
          content: created.content,
          owner: created.owner,
          department: created.department,
          status: created.status,
        },
        source: "HUMAN",
        createdBy: user.name,
      },
    });

    return created;
  });

  revalidatePath(`/projects/${task.projectId}`);
  return { success: true, message: "已从管控事项创建执行日历", data: { calendarEntryId: calendarEntry.id } };
}

export async function deleteCalendarEntry(entryId: string): Promise<ActionResult> {
  if (!entryId) return { success: false, message: "日历项 ID 为必填项" };

  const entry = await prisma.executionCalendarEntry.findUnique({
    where: { id: entryId },
    select: {
      id: true,
      projectId: true,
      taskId: true,
      date: true,
      startTime: true,
      endTime: true,
      channel: true,
      workstream: true,
      content: true,
      owner: true,
      department: true,
      status: true,
      notes: true,
      source: true,
      task: { select: { name: true } },
    },
  });
  if (!entry) return { success: false, message: "日历项不存在" };

  const user = await assertCanWriteProject(entry.projectId);

  await prisma.$transaction([
    prisma.activityLog.create({
      data: {
        projectId: entry.projectId,
        targetType: "CALENDAR_ENTRY",
        targetId: entry.id,
        changeType: "DELETE",
        summary: `删除执行日历：${entry.content}`,
        beforeState: {
          calendarEntryId: entry.id,
          taskId: entry.taskId,
          taskName: entry.task?.name ?? null,
          date: entry.date?.toISOString() ?? null,
          startTime: entry.startTime,
          endTime: entry.endTime,
          channel: entry.channel,
          workstream: entry.workstream,
          content: entry.content,
          owner: entry.owner,
          department: entry.department,
          status: entry.status,
          notes: entry.notes,
          source: entry.source,
        },
        source: "HUMAN",
        createdBy: user.name,
      },
    }),
    prisma.executionCalendarEntry.delete({ where: { id: entry.id } }),
  ]);

  revalidatePath(`/projects/${entry.projectId}`);
  return { success: true, message: `日历项「${entry.content}」已删除` };
}
