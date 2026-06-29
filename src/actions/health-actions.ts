"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

// ── 定时快照（Leader 可手动触发） ──

export async function takeHealthSnapshot() {
  const user = await getCurrentUser();
  if (!user || user.role !== "LEADER") return { success: false };

  const projects = await prisma.project.findMany({
    include: {
      tasks: { select: { status: true, deadline: true } },
      risks: { select: { id: true } },
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
    const riskCount = p.risks.length;
    const overallScore = Math.round((scheduleHealth + budgetHealth) / 2) - riskCount * 5;

    await prisma.healthSnapshot.create({
      data: { projectId: p.id, budgetHealth, scheduleHealth: Math.round(scheduleHealth), riskCount, overallScore: Math.max(0, overallScore) },
    });
    count++;
  }

  return { success: true, count };
}

// ── 获取快照历史 ──

export async function getHealthHistory(projectId: string) {
  return prisma.healthSnapshot.findMany({
    where: { projectId },
    orderBy: { timestamp: "desc" },
    take: 14, // 最近 14 次
  });
}

// ── Team 工作负载 ──

export async function getTeamWorkload() {
  const user = await getCurrentUser();
  if (!user || user.role !== "LEADER") return [];

  const members = await prisma.user.findMany({
    include: {
      projects: {
        include: {
          tasks: { select: { id: true, assignee: true, status: true, deadline: true, name: true } },
        },
      },
    },
  });

  return members.map((m) => {
    const allTasks = m.projects.flatMap((p) =>
      p.tasks.filter((t) => t.assignee === m.name || t.assignee === null).map((t) => ({ ...t, projectId: p.id, projectName: p.name }))
    );

    const inProgress = allTasks.filter((t) => t.status === "IN_PROGRESS").length;
    const pending = allTasks.filter((t) => t.status === "PENDING").length;
    const overdue = allTasks.filter(
      (t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "COMPLETED"
    ).length;

    const total = inProgress + pending;
    let load: string;
    if (total >= 6 || overdue >= 3) load = "🔴 过载";
    else if (total >= 3 || overdue >= 1) load = "🟡 适中";
    else load = "🟢 空闲";

    return {
      id: m.id,
      name: m.name,
      role: m.role,
      inProgress,
      pending,
      overdue,
      total,
      load,
      tasks: allTasks.filter((t) => t.status !== "COMPLETED").slice(0, 5),
    };
  });
}
