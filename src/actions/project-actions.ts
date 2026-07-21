"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertCanManageProject, assertCanReadProject, assertCanWriteProject, requireCurrentUser } from "@/lib/permissions";
import { getProjectBudgetSummary } from "@/lib/budget-summary";
import { canWriteProject } from "@/lib/permission-rules";
import type { ActionResult } from "@/actions/types";

/** 安全解析 HTML date input（"YYYY-MM-DD"），强制 UTC 午夜，杜绝时区偏移 */
function parseDateSafe(dateRaw: string | null): Date | null {
  if (!dateRaw) return null;
  return new Date(dateRaw + "T00:00:00.000Z");
}

type InitialBudgetItem = {
  title: string;
  plannedAmount: Prisma.Decimal;
  category: string | null;
  description: string | null;
};

function parseInitialBudgetItems(raw: string | null): InitialBudgetItem[] | null {
  if (!raw?.trim()) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const items: InitialBudgetItem[] = [];
    for (const value of parsed) {
      if (!value || typeof value !== "object") return null;
      const item = value as { title?: unknown; plannedAmount?: unknown; category?: unknown; description?: unknown };
      const title = typeof item.title === "string" ? item.title.trim() : "";
      const plannedAmount = new Prisma.Decimal(String(item.plannedAmount ?? ""));
      if (!title || plannedAmount.isNaN() || plannedAmount.lte(0)) return null;
      items.push({
        title,
        plannedAmount,
        category: typeof item.category === "string" && item.category.trim() ? item.category.trim() : null,
        description: typeof item.description === "string" && item.description.trim() ? item.description.trim() : null,
      });
    }
    return items;
  } catch {
    return null;
  }
}

export async function createProject(formData: FormData): Promise<ActionResult<{ projectId: string }>> {
  const user = await requireCurrentUser();

  const name = formData.get("name") as string;
  const budgetRaw = formData.get("totalBudget") as string;
  const budgetModeRaw = String(formData.get("budgetMode") ?? "");
  const budgetMode = ["CONFIRMED", "PENDING", "NOT_MANAGED"].includes(budgetModeRaw)
    ? budgetModeRaw as "CONFIRMED" | "PENDING" | "NOT_MANAGED"
    : budgetRaw?.trim() ? "CONFIRMED" : "PENDING";
  const initialBudgetItems = parseInitialBudgetItems(formData.get("budgetItemsJson") as string | null);

  if (!name?.trim()) {
    return { success: false, message: "项目名称为必填项" };
  }
  if (!initialBudgetItems) return { success: false, message: "预算项格式无效，请检查名称和金额。" };

  const proposedTotalBudget = budgetRaw
    ? new Prisma.Decimal(budgetRaw)
    : new Prisma.Decimal(0);
  if (proposedTotalBudget.isNaN() || proposedTotalBudget.lt(0)) {
    return { success: false, message: "预算不能为负数" };
  }
  if (budgetMode === "CONFIRMED" && proposedTotalBudget.lte(0)) {
    return { success: false, message: "选择“已有明确预算”时，项目总预算必须大于 0。" };
  }
  if (budgetMode === "NOT_MANAGED" && initialBudgetItems.length > 0) {
    return { success: false, message: "本项目不管理预算，不能同时创建预算项。" };
  }
  if (budgetMode === "PENDING" && initialBudgetItems.length > 0) {
    return { success: false, message: "预算待确认时请先创建项目，确认总预算后再编排预算项。" };
  }
  const totalBudget = budgetMode === "CONFIRMED" ? proposedTotalBudget : new Prisma.Decimal(0);
  const plannedBudget = initialBudgetItems.reduce((sum, item) => sum.add(item.plannedAmount), new Prisma.Decimal(0));
  if (budgetMode === "CONFIRMED" && plannedBudget.gt(totalBudget)) {
    return { success: false, message: `预算项合计超出项目总预算 ¥${plannedBudget.sub(totalBudget).toNumber().toLocaleString("zh-CN")}。` };
  }

  const startDate = parseDateSafe(formData.get("startDate") as string);
  const endDate = parseDateSafe(formData.get("endDate") as string);
  if (startDate && endDate && startDate > endDate) {
    return { success: false, message: "结束日期不能早于开始日期。" };
  }

  const project = await prisma.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        name: name.trim(),
        totalBudget,
        budgetMode,
        budgetConfirmedAt: budgetMode === "CONFIRMED" ? new Date() : null,
        // Compatibility only. New budget paths use budgetMode.
        budgetStatus: budgetMode === "CONFIRMED" ? "CONFIRMED" : "UNCONFIRMED",
        ownerId: user.id,
        isExternalProject: user.isExternalTester,
        startDate,
        endDate,
      },
    });
    const poolFlow = budgetMode === "CONFIRMED"
      ? await tx.budgetFlow.create({
          data: {
            projectId: created.id,
            flowType: "ALLOCATE",
            operation: "CONFIRM_POOL",
            action: "POOL_CONFIRMED",
            amount: totalBudget,
            description: "创建项目时确认项目总预算",
            createdBy: user.name,
          },
        })
      : null;
    const createdBudgetItems = initialBudgetItems.length
      ? await Promise.all(initialBudgetItems.map((item) => tx.budgetItem.create({
          data: {
            projectId: created.id,
            title: item.title,
            plannedAmount: item.plannedAmount,
            category: item.category,
            description: item.description,
            status: "DRAFT",
            source: "MANUAL",
            createdBy: user.name,
          },
        })))
      : [];
    await tx.activityLog.create({
      data: {
        projectId: created.id,
        targetType: "PROJECT",
        targetId: created.id,
        changeType: "CREATE",
        source: "HUMAN",
        createdBy: user.name,
        summary: [
          `创建项目：${created.name}`,
          budgetMode === "CONFIRMED" ? `确认项目总预算：¥${totalBudget.toNumber().toLocaleString("zh-CN")}` : budgetMode === "PENDING" ? "预算待确认" : "本项目不管理预算",
          createdBudgetItems.length > 0 ? `初始预算草稿：${createdBudgetItems.length} 条` : null,
        ].filter(Boolean).join("\n"),
        afterState: {
          budgetMode,
          totalBudget: totalBudget.toString(),
          budgetPoolFlowId: poolFlow?.id ?? null,
          budgetItemIds: createdBudgetItems.map((item) => item.id),
        },
      },
    });
    return created;
  });

  revalidatePath("/workspace");
  return { success: true, message: `项目「${name}」创建成功`, data: { projectId: project.id } };
}

export async function getUserProjects() {
  const user = await requireCurrentUser();

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id, role: "EDITOR" } } },
      ],
    },
    include: {
      _count: { select: { tasks: true } },
      budgetItems: { select: { plannedAmount: true, status: true } },
      budgetFlows: { select: { amount: true, action: true, flowType: true } },
      activityLogs: {
        where: { changeType: "IMPORT" },
        select: { afterState: true },
        orderBy: { createdAt: "desc" },
        take: 3,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // 将 Decimal 转为 number 以便序列化
  return projects.map((p) => ({
    ...p,
    budgetItems: undefined,
    budgetFlows: undefined,
    activityLogs: undefined,
    totalBudget: p.totalBudget.toNumber(),
    confirmedBudget: getProjectBudgetSummary(p).confirmedBudget,
    pendingBudgetSignal: extractPendingBudgetSignal(p.activityLogs.map((log) => log.afterState)),
  }));
}

function extractPendingBudgetSignal(states: unknown[]) {
  let total = 0;
  let count = 0;

  for (const state of states) {
    if (!state || typeof state !== "object") continue;
    const diagnostics = "importDiagnostics" in state
      ? (state as { importDiagnostics?: unknown }).importDiagnostics
      : null;
    if (!diagnostics || typeof diagnostics !== "object") continue;
    const items = "lowConfidenceBudgetItems" in diagnostics
      ? (diagnostics as { lowConfidenceBudgetItems?: unknown }).lowConfidenceBudgetItems
      : null;
    if (!Array.isArray(items)) continue;

    for (const item of items) {
      if (!item || typeof item !== "object") continue;
      const amount = "amount" in item ? (item as { amount?: unknown }).amount : null;
      if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
        total += amount;
        count += 1;
      }
    }
  }

  return { total, count };
}

export async function deleteProject(projectId: string): Promise<ActionResult> {
  const user = await assertCanWriteProject(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  if (!project) return { success: false, message: "项目不存在" };

  await prisma.$transaction([
    prisma.activityLog.create({
      data: {
        projectId,
        targetType: "PROJECT",
        targetId: projectId,
        changeType: "DELETE",
        summary: `删除项目：${project.name}`,
        source: "HUMAN",
        createdBy: user.name,
      },
    }),
    prisma.project.delete({ where: { id: projectId } }),
  ]);
  revalidatePath("/workspace");
  revalidatePath("/dashboard");
  return { success: true, message: `项目「${project.name}」已删除` };
}

export async function updateProjectInfo(formData: FormData): Promise<ActionResult> {
  const projectId = (formData.get("projectId") as string) || "";
  const user = await assertCanManageProject(projectId);
  const name = ((formData.get("name") as string) || "").trim();
  const startDate = parseDateSafe((formData.get("startDate") as string) || null);
  const endDate = parseDateSafe((formData.get("endDate") as string) || null);

  if (!name) return { success: false, message: "项目名称不能为空" };
  if (startDate && endDate && startDate > endDate) {
    return { success: false, message: "结束日期不能早于开始日期" };
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true, startDate: true, endDate: true },
  });
  if (!project) return { success: false, message: "项目不存在" };

  const before = {
    name: project.name,
    startDate: project.startDate?.toISOString().slice(0, 10) ?? null,
    endDate: project.endDate?.toISOString().slice(0, 10) ?? null,
  };
  const after = {
    name,
    startDate: startDate?.toISOString().slice(0, 10) ?? null,
    endDate: endDate?.toISOString().slice(0, 10) ?? null,
  };
  const changes = [
    before.name !== after.name ? `项目名称：${before.name} → ${after.name}` : null,
    before.startDate !== after.startDate ? `开始日期：${before.startDate ?? "未设置"} → ${after.startDate ?? "未设置"}` : null,
    before.endDate !== after.endDate ? `结束日期：${before.endDate ?? "未设置"} → ${after.endDate ?? "未设置"}` : null,
  ].filter((item): item is string => Boolean(item));

  if (changes.length === 0) return { success: true, message: "项目基本信息无变化" };

  await prisma.$transaction([
    prisma.project.update({ where: { id: projectId }, data: { name, startDate, endDate } }),
    prisma.activityLog.create({
      data: {
        projectId,
        targetType: "PROJECT",
        targetId: projectId,
        changeType: "UPDATE",
        summary: `项目基本信息更新\n${changes.map((change) => `- ${change}`).join("\n")}`,
        beforeState: before,
        afterState: after,
        source: "HUMAN",
        createdBy: user.name,
      },
    }),
  ]);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/workspace");
  revalidatePath("/dashboard");
  return { success: true, message: "项目基本信息已更新" };
}

export async function setProjectArchived(projectId: string, archived: boolean): Promise<ActionResult> {
  const user = await assertCanManageProject(projectId);
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { name: true, archivedAt: true } });
  if (!project) return { success: false, message: "项目不存在" };
  if (Boolean(project.archivedAt) === archived) {
    return { success: true, message: archived ? "项目已归档" : "项目已恢复" };
  }

  await prisma.$transaction([
    prisma.project.update({ where: { id: projectId }, data: { archivedAt: archived ? new Date() : null } }),
    prisma.activityLog.create({
      data: {
        projectId,
        targetType: "PROJECT",
        targetId: projectId,
        changeType: archived ? "ARCHIVE" : "RESTORE",
        summary: archived ? `项目已归档：${project.name}` : `项目已恢复到工作区：${project.name}`,
        source: "HUMAN",
        createdBy: user.name,
      },
    }),
  ]);

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/workspace");
  revalidatePath("/dashboard");
  return { success: true, message: archived ? "项目已归档" : "项目已恢复" };
}

export async function getProjectDetail(projectId: string) {
  const user = await assertCanReadProject(projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, name: true, role: true } },
      members: { where: { userId: user.id }, select: { role: true }, take: 1 },
      _count: { select: { tasks: true } },
      tasks: { select: { status: true, deadline: true } },
      calendarEntries: {
        where: { status: { notIn: ["DONE", "CANCELED"] }, date: { not: null } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        take: 1,
        select: { date: true, content: true },
      },
      budgetItems: { select: { plannedAmount: true, status: true } },
      budgetFlows: { select: { amount: true, action: true, flowType: true } },
    },
  });

  if (!project) return null;

  // 将 Decimal 转为 number 以便序列化
  const budgetSummary = getProjectBudgetSummary(project);
  return {
    ...project,
    members: undefined,
    totalBudget: project.totalBudget.toNumber(),
    archivedAt: project.archivedAt,
    budgetSummary,
    viewerName: user.name,
    canEdit: canWriteProject({
      userId: user.id,
      role: user.role,
      ownerId: project.ownerId,
      memberRole: project.members[0]?.role ?? null,
    }),
    canManage: project.ownerId === user.id,
  };
}
