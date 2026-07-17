"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertCanReadProject, assertCanWriteProject } from "@/lib/permissions";
import type { ActionResult } from "@/actions/types";

export async function getProjectPhases(projectId: string) {
  await assertCanReadProject(projectId);
  return prisma.phase.findMany({
    where: { projectId },
    include: { _count: { select: { tasks: true } } },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createPhase(formData: FormData): Promise<ActionResult> {
  const projectId = formData.get("projectId") as string;
  const user = await assertCanWriteProject(projectId);
  const name = formData.get("name") as string;

  if (!projectId || !name?.trim()) {
    return { success: false, message: "项目 ID 和阶段名称为必填项" };
  }

  const normalizedName = name.trim();
  const existing = await prisma.phase.findFirst({ where: { projectId, name: normalizedName }, select: { id: true } });
  if (existing) return { success: false, message: "已存在同名模块" };

  await prisma.$transaction([
    prisma.phase.create({ data: { projectId, name: normalizedName, sortOrder: await prisma.phase.count({ where: { projectId } }) } }),
    prisma.activityLog.create({
      data: {
        projectId,
        targetType: "PROJECT",
        targetId: projectId,
        changeType: "UPDATE",
        summary: `新增模块：${normalizedName}`,
        source: "HUMAN",
        createdBy: user.name,
      },
    }),
  ]);

  revalidatePath(`/projects/${projectId}`);
  return { success: true, message: `模块「${normalizedName}」已创建` };
}

export async function updatePhase(formData: FormData): Promise<ActionResult> {
  const phaseId = String(formData.get("phaseId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!phaseId || !name) return { success: false, message: "模块名称不能为空" };

  const phase = await prisma.phase.findUnique({ where: { id: phaseId }, select: { projectId: true, name: true } });
  if (!phase) return { success: false, message: "模块不存在" };
  const user = await assertCanWriteProject(phase.projectId);
  if (phase.name === name) return { success: true, message: "模块名称无变化" };

  const duplicate = await prisma.phase.findFirst({ where: { projectId: phase.projectId, name, id: { not: phaseId } }, select: { id: true } });
  if (duplicate) return { success: false, message: "已存在同名模块" };

  await prisma.$transaction([
    prisma.phase.update({ where: { id: phaseId }, data: { name } }),
    prisma.activityLog.create({
      data: {
        projectId: phase.projectId,
        targetType: "PROJECT",
        targetId: phaseId,
        changeType: "UPDATE",
        summary: `模块名称更新：${phase.name} → ${name}`,
        source: "HUMAN",
        createdBy: user.name,
      },
    }),
  ]);

  revalidatePath(`/projects/${phase.projectId}`);
  return { success: true, message: "模块名称已更新" };
}

export async function deletePhase(phaseId: string): Promise<ActionResult> {
  const phase = await prisma.phase.findUnique({ where: { id: phaseId }, select: { projectId: true, name: true, _count: { select: { tasks: true } } } });
  if (!phase) return { success: false, message: "模块不存在" };
  const user = await assertCanWriteProject(phase.projectId);

  await prisma.$transaction([
    prisma.task.updateMany({ where: { phaseId }, data: { phaseId: null } }),
    prisma.phase.delete({ where: { id: phaseId } }),
    prisma.activityLog.create({
      data: {
        projectId: phase.projectId,
        targetType: "PROJECT",
        targetId: phaseId,
        changeType: "UPDATE",
        summary: `删除模块：${phase.name}${phase._count.tasks ? `；${phase._count.tasks} 条事项改为未分模块` : ""}`,
        source: "HUMAN",
        createdBy: user.name,
      },
    }),
  ]);

  revalidatePath(`/projects/${phase.projectId}`);
  return { success: true, message: "模块已删除，事项已保留" };
}
