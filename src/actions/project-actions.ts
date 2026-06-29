"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertCanReadProject, assertCanWriteProject, requireCurrentUser } from "@/lib/permissions";
import type { ActionResult } from "@/actions/types";
import { initProjectFolders } from "@/actions/wiki-actions";

/** 安全解析 HTML date input（"YYYY-MM-DD"），强制 UTC 午夜，杜绝时区偏移 */
function parseDateSafe(dateRaw: string | null): Date | null {
  if (!dateRaw) return null;
  return new Date(dateRaw + "T00:00:00.000Z");
}

export async function createProject(formData: FormData): Promise<ActionResult<{ projectId: string }>> {
  const user = await requireCurrentUser();

  const name = formData.get("name") as string;
  const budgetRaw = formData.get("totalBudget") as string;

  if (!name?.trim()) {
    return { success: false, message: "项目名称为必填项" };
  }

  const totalBudget = budgetRaw
    ? new Prisma.Decimal(budgetRaw)
    : new Prisma.Decimal(0);
  if (totalBudget.isNaN() || totalBudget.lt(0)) {
    return { success: false, message: "预算不能为负数" };
  }

  const project = await prisma.project.create({
    data: {
      name,
      totalBudget,
      ownerId: user.id,
      startDate: parseDateSafe(formData.get("startDate") as string),
      endDate: parseDateSafe(formData.get("endDate") as string),
    },
  });

  // 自动生成 4 个默认文件夹
  await initProjectFolders(project.id);

  // 自动创建占位任务；有确认预算时才创建初始 ALLOCATE 流水
  const placeholderTask = await prisma.task.create({
    data: {
      projectId: project.id,
      name: "项目统筹",
      assignee: user.name,
      status: "IN_PROGRESS",
    },
  });
  if (totalBudget.gt(0)) {
    await prisma.budgetFlow.create({
      data: {
        taskId: placeholderTask.id,
        flowType: "ALLOCATE",
        amount: totalBudget,
        description: `「${name}」项目初始预算分配`,
        createdBy: user.name,
      },
    });
  }

  revalidatePath("/workspace");
  return { success: true, message: `项目「${name}」创建成功`, data: { projectId: project.id } };
}

export async function getUserProjects() {
  const user = await requireCurrentUser();

  const projects = await prisma.project.findMany({
    where: { ownerId: user.id },
    include: { _count: { select: { tasks: true } } },
    orderBy: { createdAt: "desc" },
  });

  // 将 Decimal 转为 number 以便序列化
  return projects.map((p) => ({
    ...p,
    totalBudget: p.totalBudget.toNumber(),
  }));
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  await assertCanWriteProject(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  if (!project) return { success: false, message: "项目不存在" };

  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/workspace");
  return { success: true, message: `项目「${project.name}」已删除` };
}

export async function getProjectDetail(projectId: string) {
  await assertCanReadProject(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, name: true, role: true } },
      _count: { select: { tasks: true } },
    },
  });

  if (!project) return null;

  // 将 Decimal 转为 number 以便序列化
  return {
    ...project,
    totalBudget: project.totalBudget.toNumber(),
  };
}
