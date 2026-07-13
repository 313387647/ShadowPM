import { prisma } from "@/lib/prisma";
import { getCurrentUser, type SessionUser } from "@/lib/auth";
import { canManageProjectMembers, canReadProject, canWriteProject } from "@/lib/permission-rules";

export async function requireCurrentUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录");

  const persisted = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, name: true, role: true },
  });
  if (!persisted) throw new Error("登录已失效，请重新登录");

  return {
    id: persisted.id,
    name: persisted.name,
    role: persisted.role,
  };
}

export async function assertCanReadProject(projectId: string): Promise<SessionUser> {
  const user = await requireCurrentUser();

  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      members: { where: { userId: user.id }, select: { role: true }, take: 1 },
    },
  });
  const memberRole = project?.members[0]?.role ?? null;
  if (!project || !canReadProject({ userId: user.id, role: user.role, ownerId: project.ownerId, memberRole })) {
    throw new Error("无权访问此项目");
  }

  return user;
}

export async function assertCanWriteProject(projectId: string): Promise<SessionUser> {
  const user = await requireCurrentUser();

  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: {
      id: true,
      ownerId: true,
      members: { where: { userId: user.id }, select: { role: true }, take: 1 },
    },
  });
  const memberRole = project?.members[0]?.role ?? null;
  if (!project || !canWriteProject({ userId: user.id, role: user.role, ownerId: project.ownerId, memberRole })) {
    throw new Error("无权修改此项目");
  }

  return user;
}

export async function assertCanManageProjectMembers(projectId: string): Promise<SessionUser> {
  const user = await requireCurrentUser();

  const project = await prisma.project.findFirst({
    where: { id: projectId },
    select: { id: true, ownerId: true },
  });
  if (!project || !canManageProjectMembers({ userId: user.id, ownerId: project.ownerId })) {
    throw new Error("只有项目主负责人可以管理协作者");
  }

  return user;
}

export async function assertCanReadTask(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, name: true },
  });
  if (!task) throw new Error("管控事项不存在");

  const user = await assertCanReadProject(task.projectId);
  return { user, task };
}

export async function assertCanWriteTask(taskId: string) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true, name: true },
  });
  if (!task) throw new Error("管控事项不存在");

  const user = await assertCanWriteProject(task.projectId);
  return { user, task };
}
