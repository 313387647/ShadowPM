"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/permissions";
import { getProjectLifecycle, type ProjectLifecycle } from "@/lib/project-lifecycle";

export type SidebarProject = {
  id: string;
  name: string;
  ownerName: string;
  relationship: "OWNED" | "MEMBER";
  lifecycle: ProjectLifecycle;
  archivedAt: Date | null;
  updatedAt: Date;
  isFocused: boolean;
};

function getProjectRelationship(ownerId: string, userId: string): SidebarProject["relationship"] {
  if (ownerId === userId) return "OWNED";
  return "MEMBER";
}

function sidebarProjectWhere(userId: string): Prisma.ProjectWhereInput {
  return {
    OR: [
      { ownerId: userId },
      { members: { some: { userId } } },
    ],
  };
}

function readableProjectWhere(user: Awaited<ReturnType<typeof requireCurrentUser>>): Prisma.ProjectWhereInput {
  if (user.role === "LEADER") return {};
  return {
    OR: [
      { ownerId: user.id },
      { members: { some: { userId: user.id } } },
    ],
  };
}

export async function getSidebarProjects(): Promise<SidebarProject[]> {
  const user = await requireCurrentUser();
  const projects = await prisma.project.findMany({
    where: sidebarProjectWhere(user.id),
    select: {
      id: true,
      name: true,
      ownerId: true,
      startDate: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: { name: true } },
      tasks: { select: { status: true } },
      focuses: { where: { userId: user.id }, select: { id: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return projects
    .map((project) => ({
      id: project.id,
      name: project.name,
      ownerName: project.owner.name,
      relationship: getProjectRelationship(project.ownerId, user.id),
      lifecycle: getProjectLifecycle({ startDate: project.startDate, taskStatuses: project.tasks.map((task) => task.status) }),
      archivedAt: project.archivedAt,
      updatedAt: project.updatedAt,
      isFocused: project.focuses.length > 0,
    }))
    .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
}

export async function toggleProjectFocus(projectId: string) {
  const user = await requireCurrentUser();
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...readableProjectWhere(user) },
    select: { id: true },
  });
  if (!project) return { success: false, message: "无权关注这个项目" };

  const existing = await prisma.projectFocus.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
    select: { id: true },
  });

  if (existing) {
    await prisma.projectFocus.delete({ where: { id: existing.id } });
  } else {
    await prisma.projectFocus.create({ data: { projectId, userId: user.id } });
  }

  revalidatePath("/workspace");
  return { success: true, isFocused: !existing };
}
