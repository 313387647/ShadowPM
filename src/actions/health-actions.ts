"use server";

import { prisma } from "@/lib/prisma";
import { assertCanReadProject, requireCurrentUser } from "@/lib/permissions";

// ── 定时快照（Leader 可手动触发） ──

export async function takeHealthSnapshot() {
  const user = await requireCurrentUser();
  if (user.role !== "LEADER") return { success: false };

  const projects = await prisma.project.findMany({
    include: {
      tasks: { select: { status: true, deadline: true } },
    },
  });

  let count = 0;
  for (const p of projects) {
    const total = p.tasks.length;
    if (total === 0) continue;

    const now = new Date();
    const overdue = p.tasks.filter((t) => t.deadline && new Date(t.deadline) < now && t.status !== "COMPLETED").length;

    const scheduleHealth = Math.max(0, 100 - (overdue / total) * 100);
    const budgetHealth = 100; // Stubbed — full budget analysis needs per-project flow aggregation
    const overallScore = Math.round((scheduleHealth + budgetHealth) / 2);

    await prisma.healthSnapshot.create({
      data: { projectId: p.id, budgetHealth, scheduleHealth: Math.round(scheduleHealth), riskCount: 0, overallScore: Math.max(0, overallScore) },
    });
    count++;
  }

  return { success: true, count };
}

// ── 获取快照历史 ──

export async function getHealthHistory(projectId: string) {
  await assertCanReadProject(projectId);
  return prisma.healthSnapshot.findMany({
    where: { projectId },
    orderBy: { timestamp: "desc" },
    take: 14, // 最近 14 次
  });
}

// ── Team 工作负载 ──

export async function getTeamWorkload() {
  const user = await requireCurrentUser();
  if (user.role !== "LEADER") return [];

  const [members, assignedTasks] = await Promise.all([
    prisma.user.findMany({
      include: {
        projects: {
          include: {
            tasks: { select: { id: true, assignee: true, status: true, deadline: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        projectMemberships: {
          include: {
            project: {
              select: {
                id: true,
                name: true,
                ownerId: true,
                owner: { select: { name: true } },
                tasks: { select: { id: true, assignee: true, status: true, deadline: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.task.findMany({
      where: { assignee: { not: null } },
      select: {
        id: true,
        name: true,
        assignee: true,
        status: true,
        deadline: true,
        project: { select: { id: true, name: true, ownerId: true, owner: { select: { name: true } } } },
      },
    }),
  ]);

  return members.map((m) => {
    const ownedTasks = m.projects.flatMap((p) =>
      p.tasks.map((t) => ({ ...t, projectId: p.id, projectName: p.name }))
    );
    const namedTasks = assignedTasks
      .filter((task) => task.assignee === m.name)
      .map((task) => ({
        id: task.id,
        name: task.name,
        status: task.status,
        deadline: task.deadline,
        projectId: task.project.id,
        projectName: task.project.name,
        projectOwnerName: task.project.owner.name,
        canMemberOpen: task.project.ownerId === m.id,
      }));
    const editableProjectIds = new Set(m.projects.map((project) => project.id));
    for (const membership of m.projectMemberships) {
      if (membership.role === "EDITOR") editableProjectIds.add(membership.projectId);
    }
    const outsideAssignedTasks = namedTasks.filter((task) => !editableProjectIds.has(task.projectId));
    const editorMemberships = m.projectMemberships.filter((membership) => membership.role === "EDITOR");
    const viewerMemberships = m.projectMemberships.filter((membership) => membership.role === "VIEWER");

    const activeOwnedTasks = ownedTasks.filter((task) => task.status !== "COMPLETED");
    const inProgress = activeOwnedTasks.filter((t) => t.status === "IN_PROGRESS").length;
    const pending = activeOwnedTasks.filter((t) => t.status === "PENDING").length;
    const overdue = activeOwnedTasks.filter(
      (t) => t.deadline && new Date(t.deadline) < new Date()
    ).length;
    const missingOwner = activeOwnedTasks.filter((task) => !task.assignee?.trim()).length;
    const activeAssigned = namedTasks.filter((task) => task.status !== "COMPLETED").length;
    const assignedOutsideEditable = outsideAssignedTasks.filter((task) => task.status !== "COMPLETED").length;

    const total = inProgress + pending;
    let load: string;
    if (total >= 6 || overdue >= 3) load = "过载";
    else if (total >= 3 || overdue >= 1) load = "适中";
    else load = "空闲";

    return {
      id: m.id,
      name: m.name,
      role: m.role,
      ownedProjectCount: m.projects.length,
      collaboratorProjectCount: m.projectMemberships.length,
      editableProjectCount: m.projects.length + editorMemberships.length,
      readableScope: m.role === "LEADER" ? "全部项目" : m.projectMemberships.length > 0 ? "本人 + 协作项目" : "本人项目",
      writableScope: editorMemberships.length > 0 ? `本人 + ${editorMemberships.length} 个授权项目` : "本人项目",
      inProgress,
      pending,
      overdue,
      missingOwner,
      activeAssigned,
      assignedOutsideEditable,
      total,
      load,
      projects: m.projects.slice(0, 4).map((project) => ({
        id: project.id,
        name: project.name,
        activeTasks: project.tasks.filter((task) => task.status !== "COMPLETED").length,
        overdueTasks: project.tasks.filter((task) => task.deadline && new Date(task.deadline) < new Date() && task.status !== "COMPLETED").length,
      })),
      collaboratorProjects: m.projectMemberships.slice(0, 4).map((membership) => ({
        id: membership.project.id,
        name: membership.project.name,
        role: membership.role,
        ownerName: membership.project.owner.name,
        activeTasks: membership.project.tasks.filter((task) => task.status !== "COMPLETED").length,
      })),
      viewerProjectCount: viewerMemberships.length,
      tasks: activeOwnedTasks.slice(0, 5),
      outsideAssignedTasks: outsideAssignedTasks.slice(0, 3),
    };
  });
}
