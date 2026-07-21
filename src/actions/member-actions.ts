"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertCanManageProjectMembers, assertCanReadProject } from "@/lib/permissions";
import type { ActionResult } from "@/actions/types";

export async function getProjectMembers(projectId: string) {
  const user = await assertCanReadProject(projectId);

  const [project, users] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        ownerId: true,
        owner: { select: { id: true, name: true, role: true } },
        members: {
          include: { user: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    user.isExternalTester
      ? Promise.resolve([])
      : prisma.user.findMany({
          where: { isExternalTester: false },
          orderBy: [{ role: "asc" }, { name: "asc" }],
          select: { id: true, name: true, role: true },
        }),
  ]);

  if (!project) return null;
  const memberUserIds = new Set(project.members.map((member) => member.userId));

  return {
    owner: project.owner,
    members: project.members.map((member) => ({
      id: member.id,
      userId: member.userId,
      role: member.role,
      user: member.user,
      createdAt: member.createdAt,
    })),
    candidateUsers: users.filter((candidate) => candidate.id !== project.ownerId && !memberUserIds.has(candidate.id)),
    canManage: project.ownerId === user.id,
  };
}

export async function addProjectMember(formData: FormData): Promise<ActionResult> {
  const projectId = (formData.get("projectId") as string) || "";
  const userId = (formData.get("userId") as string) || "";
  const roleRaw = ((formData.get("role") as string) || "EDITOR").toUpperCase();
  const role = roleRaw === "VIEWER" ? "VIEWER" : "EDITOR";
  const actor = await assertCanManageProjectMembers(projectId);

  if (!userId) return { success: false, message: "请选择协作者" };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, ownerId: true },
  });
  if (!project) return { success: false, message: "项目不存在" };
  if (project.ownerId === userId) return { success: false, message: "项目负责人已默认拥有编辑权" };

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });
  if (!target) return { success: false, message: "用户不存在" };

  await prisma.$transaction([
    prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId } },
      create: { projectId, userId, role, createdBy: actor.name },
      update: { role, createdBy: actor.name },
    }),
    prisma.activityLog.create({
      data: {
        projectId,
        targetType: "PROJECT_MEMBER",
        targetId: userId,
        changeType: "UPDATE",
        source: "HUMAN",
        createdBy: actor.name,
        summary: `协作者授权：${target.name} → ${role === "EDITOR" ? "可编辑" : "只读"}`,
        afterState: { userId, userName: target.name, role },
      },
    }),
  ]);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/team");
  revalidatePath("/workspace");
  return { success: true, message: `${target.name} 已加入项目协作者` };
}

export async function removeProjectMember(formData: FormData): Promise<ActionResult> {
  const projectId = (formData.get("projectId") as string) || "";
  const membershipId = (formData.get("membershipId") as string) || "";
  const actor = await assertCanManageProjectMembers(projectId);

  if (!membershipId) return { success: false, message: "协作者记录不存在" };

  const membership = await prisma.projectMember.findFirst({
    where: { id: membershipId, projectId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!membership) return { success: false, message: "协作者记录不存在" };

  await prisma.$transaction([
    prisma.projectMember.delete({ where: { id: membership.id } }),
    prisma.activityLog.create({
      data: {
        projectId,
        targetType: "PROJECT_MEMBER",
        targetId: membership.userId,
        changeType: "UPDATE",
        source: "HUMAN",
        createdBy: actor.name,
        summary: `协作者移除：${membership.user.name}`,
        beforeState: { userId: membership.userId, userName: membership.user.name, role: membership.role },
      },
    }),
  ]);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/team");
  revalidatePath("/workspace");
  return { success: true, message: `${membership.user.name} 已移出协作者` };
}
