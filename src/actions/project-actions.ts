"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { ActionResult } from "@/actions/types";
import { initProjectFolders } from "@/actions/wiki-actions";

/** 安全解析 HTML date input（"YYYY-MM-DD"），强制 UTC 午夜，杜绝时区偏移 */
function parseDateSafe(dateRaw: string | null): Date | null {
  if (!dateRaw) return null;
  return new Date(dateRaw + "T00:00:00.000Z");
}

export async function createProject(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "请先登录" };

  const name = formData.get("name") as string;
  const budgetRaw = formData.get("totalBudget") as string;

  if (!name || !budgetRaw) {
    return { success: false, message: "项目名称和预算为必填项" };
  }

  const totalBudget = new Prisma.Decimal(budgetRaw);
  if (totalBudget.isNaN() || totalBudget.lte(0)) {
    return { success: false, message: "预算必须为大于 0 的数字" };
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

  // 自动创建占位任务 + 初始 ALLOCATE 预算流水（修复偏离点 #5）
  const placeholderTask = await prisma.task.create({
    data: {
      projectId: project.id,
      name: "项目统筹",
      assignee: user.name,
      status: "IN_PROGRESS",
    },
  });
  await prisma.budgetFlow.create({
    data: {
      taskId: placeholderTask.id,
      flowType: "ALLOCATE",
      amount: totalBudget,
      description: `「${name}」项目初始预算分配`,
      createdBy: user.name,
    },
  });

  revalidatePath("/workspace");
  return { success: true, message: `项目「${name}」创建成功` };
}

export async function getUserProjects() {
  const user = await getCurrentUser();
  if (!user) return [];

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
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "请先登录" };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, ownerId: true },
  });
  if (!project) return { success: false, message: "项目不存在" };
  if (project.ownerId !== user.id) return { success: false, message: "无权删除此项目" };

  await prisma.project.delete({ where: { id: projectId } });
  revalidatePath("/workspace");
  return { success: true, message: `项目「${project.name}」已删除` };
}

export async function getProjectDetail(projectId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录");

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
