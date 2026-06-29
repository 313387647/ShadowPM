"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { ActionResult } from "@/actions/types";

/** 安全解析 HTML date input（"YYYY-MM-DD"），强制 UTC 午夜，杜绝时区偏移 */
function parseDateSafe(dateRaw: string | null): Date | null {
  if (!dateRaw) return null;
  return new Date(dateRaw + "T00:00:00.000Z");
}

function normalizeText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatTextValue(value: string | null) {
  return value ?? "未填写";
}

function formatDateValue(value: Date | null) {
  return value ? value.toISOString().split("T")[0] : "未填写";
}

function buildTaskChangeLog(
  before: {
    name: string;
    assignee: string | null;
    department: string | null;
    deadline: Date | null;
    description: string | null;
    notes: string | null;
  },
  after: {
    name: string;
    assignee: string | null;
    department: string | null;
    deadline: Date | null;
    description: string | null;
    notes: string | null;
  }
) {
  const changes: string[] = [];
  const pushTextChange = (label: string, key: keyof Omit<typeof before, "deadline">) => {
    if (before[key] !== after[key]) {
      changes.push(`${label}：${formatTextValue(before[key])} → ${formatTextValue(after[key])}`);
    }
  };

  pushTextChange("事项", "name");
  pushTextChange("负责人", "assignee");
  pushTextChange("部门", "department");
  pushTextChange("详细描述", "description");
  pushTextChange("进度/结论", "notes");

  if (formatDateValue(before.deadline) !== formatDateValue(after.deadline)) {
    changes.push(`截止日期：${formatDateValue(before.deadline)} → ${formatDateValue(after.deadline)}`);
  }

  return changes;
}

// ── 读取 ──

export async function getProjectTasks(projectId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录");

  return prisma.task.findMany({
    where: { projectId },
    include: { _count: { select: { logs: true, budgets: true, calendarEntries: true } } },
    orderBy: [{ priority: "asc" }, { status: "asc" }, { name: "asc" }],
  });
}

// ── 新增 ──

export async function createTask(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "请先登录" };

  const projectId = formData.get("projectId") as string;
  const name = formData.get("name") as string;
  const assignee = (formData.get("assignee") as string) || null;
  const phaseId = (formData.get("phaseId") as string) || null;
  const description = (formData.get("description") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const department = (formData.get("department") as string) || null;

  if (!projectId || !name?.trim()) {
    return { success: false, message: "所属项目和任务名称为必填项" };
  }

  const deadlineRaw = formData.get("deadline") as string;

  await prisma.task.create({
    data: {
      projectId,
      name: name.trim(),
      assignee,
      phaseId,
      description: description?.trim() || null,
      notes: notes?.trim() || null,
      department: department?.trim() || null,
      deadline: parseDateSafe(deadlineRaw),
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, message: "任务创建成功" };
}

// ── 状态变更（按 API.md 约定：自动追加 ProgressLog） ──

export async function updateTaskStatus(
  taskId: string,
  status: string
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "请先登录" };

  const STATUS_MAP: Record<string, string> = {
    PENDING: "待启动",
    IN_PROGRESS: "进行中",
    COMPLETED: "已完成",
  };

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { success: false, message: "任务不存在" };

  await prisma.$transaction([
    prisma.progressLog.create({
      data: {
        taskId,
        content: `📌 状态变更：${STATUS_MAP[task.status] ?? task.status} → **${STATUS_MAP[status] ?? status}**`,
        createdBy: user.name,
      },
    }),
    prisma.task.update({
      where: { id: taskId },
      data: { status: status as "PENDING" | "IN_PROGRESS" | "COMPLETED" },
    }),
  ]);

  revalidatePath(`/projects/${task.projectId}`);
  return { success: true, message: `状态已变更为「${STATUS_MAP[status] ?? status}」` };
}

// ── 编辑任务 ──

export async function updateTask(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "请先登录" };

  const taskId = formData.get("taskId") as string;
  const name = (formData.get("name") as string) || null;
  const assignee = (formData.get("assignee") as string) || null;
  const deadlineRaw = (formData.get("deadline") as string) || null;
  const description = (formData.get("description") as string) || null;
  const notes = (formData.get("notes") as string) || null;
  const department = (formData.get("department") as string) || null;

  if (!taskId || !name?.trim()) {
    return { success: false, message: "任务 ID 和名称为必填项" };
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      projectId: true,
      name: true,
      assignee: true,
      department: true,
      deadline: true,
      description: true,
      notes: true,
    },
  });
  if (!task) return { success: false, message: "任务不存在" };

  const nextTask = {
    name: name.trim(),
    assignee: normalizeText(assignee),
    deadline: parseDateSafe(deadlineRaw),
    description: normalizeText(description),
    notes: normalizeText(notes),
    department: normalizeText(department),
  };
  const changes = buildTaskChangeLog(task, nextTask);

  await prisma.$transaction([
    prisma.task.update({
      where: { id: taskId },
      data: nextTask,
    }),
    ...(changes.length > 0
      ? [
          prisma.progressLog.create({
            data: {
              taskId,
              content: `📝 管控表字段更新\n${changes.map((change) => `- ${change}`).join("\n")}`,
              createdBy: user.name,
            },
          }),
        ]
      : []),
  ]);

  revalidatePath(`/projects/${task.projectId}`);
  return {
    success: true,
    message: changes.length > 0 ? "任务已更新，变更已记录" : "任务无变化",
  };
}

export async function fillMissingTaskFields(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "请先登录" };

  const taskIdsRaw = (formData.get("taskIds") as string) || "[]";
  const assignee = normalizeText(formData.get("assignee") as string | null);
  const department = normalizeText(formData.get("department") as string | null);
  const deadline = parseDateSafe((formData.get("deadline") as string) || null);

  let taskIds: string[] = [];
  try {
    const parsed = JSON.parse(taskIdsRaw);
    taskIds = Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return { success: false, message: "批量补齐范围无效" };
  }

  if (taskIds.length === 0) return { success: false, message: "没有可补齐的管控事项" };
  if (!assignee && !department && !deadline) {
    return { success: false, message: "至少填写一个要补齐的字段" };
  }

  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds } },
    select: {
      id: true,
      projectId: true,
      name: true,
      assignee: true,
      department: true,
      deadline: true,
      description: true,
      notes: true,
    },
  });

  if (tasks.length === 0) return { success: false, message: "没有找到可补齐的管控事项" };

  const updates = tasks
    .map((task) => {
      const nextTask = {
        name: task.name,
        assignee: task.assignee ?? assignee,
        department: task.department ?? department,
        deadline: task.deadline ?? deadline,
        description: task.description,
        notes: task.notes,
      };
      const changes = buildTaskChangeLog(task, nextTask);
      return { task, nextTask, changes };
    })
    .filter((update) => update.changes.length > 0);

  if (updates.length === 0) {
    return { success: true, message: "当前范围没有缺失字段需要补齐" };
  }

  const projectId = updates[0]?.task.projectId;
  const summaryItems = updates
    .slice(0, 5)
    .map((update) => `- ${update.task.name}`)
    .join("\n");
  const moreSummary = updates.length > 5 ? `\n- 另 ${updates.length - 5} 条` : "";
  const operations = [
    ...(projectId
      ? [
          prisma.activityLog.create({
            data: {
              projectId,
              targetType: "CONTROL_ITEM",
              targetId: updates.length === 1 ? updates[0]?.task.id : null,
              changeType: "BULK_UPDATE",
              summary: `🧩 批量补齐管控字段：${updates.length} 条事项\n${summaryItems}${moreSummary}`,
              afterState: {
                affectedTasks: updates.map((update) => ({
                  id: update.task.id,
                  name: update.task.name,
                })),
              },
              source: "HUMAN",
              createdBy: user.name,
            },
          }),
        ]
      : []),
    ...updates.flatMap(({ task, nextTask, changes }) => [
      prisma.task.update({
        where: { id: task.id },
        data: {
          assignee: nextTask.assignee,
          department: nextTask.department,
          deadline: nextTask.deadline,
        },
      }),
      prisma.progressLog.create({
        data: {
          taskId: task.id,
          content: `🧩 批量补齐管控字段\n${changes.map((change) => `- ${change}`).join("\n")}`,
          createdBy: user.name,
        },
      }),
    ]),
  ];

  await prisma.$transaction(operations);
  if (projectId) revalidatePath(`/projects/${projectId}`);

  return {
    success: true,
    message: `已补齐 ${updates.length} 条管控事项`,
  };
}

// ── 删除任务 ──

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "请先登录" };

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true, name: true },
  });
  if (!task) return { success: false, message: "任务不存在" };

  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath(`/projects/${task.projectId}`);
  return { success: true, message: `任务「${task.name}」已删除` };
}
