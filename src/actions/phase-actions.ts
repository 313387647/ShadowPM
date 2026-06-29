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
  await assertCanWriteProject(projectId);
  const name = formData.get("name") as string;

  if (!projectId || !name?.trim()) {
    return { success: false, message: "项目 ID 和阶段名称为必填项" };
  }

  await prisma.phase.create({
    data: { projectId, name: name.trim() },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, message: `阶段「${name.trim()}」已创建` };
}
