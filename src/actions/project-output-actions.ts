"use server";

import OpenAI from "openai";
import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertCanReadProject, assertCanWriteProject } from "@/lib/permissions";
import { normalizeShareExpiryDays } from "@/lib/p2-rules";
import { getProjectBudgetSummary } from "@/lib/budget-summary";
import type { ActionResult } from "@/actions/types";

export type ProjectReportPeriod = "WEEKLY" | "MONTHLY";

export async function getProjectOutputs(projectId: string) {
  await assertCanReadProject(projectId);

  try {
    const [reports, sources, shareLinks] = await Promise.all([
    prisma.projectReport.findMany({
      where: { projectId },
      select: {
        id: true,
        periodType: true,
        periodStart: true,
        periodEnd: true,
        content: true,
        generatedBy: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.projectSource.findMany({
      where: { projectId },
      select: { id: true, fileName: true, mediaType: true, uploadedBy: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.projectShareLink.findMany({
      where: { projectId },
      select: { id: true, label: true, expiresAt: true, revokedAt: true, createdBy: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    ]);

    return { reports, sources, shareLinks };
  } catch (error) {
    console.error("project outputs unavailable; database schema may need sync:", error);
    return { reports: [], sources: [], shareLinks: [] };
  }
}

export async function generateProjectReport(
  projectId: string,
  periodType: ProjectReportPeriod
): Promise<ActionResult<{ reportId: string; content: string }>> {
  const user = await assertCanWriteProject(projectId);
  const now = new Date();
  const periodStart = periodType === "WEEKLY"
    ? new Date(now.getTime() - 6 * 86400000)
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = now;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { name: true } },
      tasks: {
        include: {
          phase: { select: { name: true } },
          logs: { where: { createdAt: { gte: periodStart, lte: periodEnd } }, orderBy: { createdAt: "desc" } },
        },
        orderBy: [{ status: "asc" }, { deadline: "asc" }],
      },
      calendarEntries: {
        where: { OR: [{ date: null }, { date: { gte: periodStart } }] },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        take: 30,
      },
      budgetItems: { select: { plannedAmount: true, status: true } },
      budgetFlows: { select: { amount: true, action: true, flowType: true } },
      sources: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });
  if (!project) return { success: false, message: "项目不存在" };

  const budget = getProjectBudgetSummary(project);
  const facts = {
    project: {
      name: project.name,
      owner: project.owner.name,
      startDate: project.startDate,
      endDate: project.endDate,
    },
    period: { type: periodType, start: periodStart, end: periodEnd },
    controlItems: project.tasks.map((task) => ({
      workstream: task.phase?.name ?? null,
      name: task.name,
      status: task.status,
      assignee: task.assignee,
      deadline: task.deadline,
      latestConclusion: task.notes,
      periodUpdates: task.logs.map((log) => ({ content: log.content, createdAt: log.createdAt })),
    })),
    budget: {
      planned: budget.planned,
      confirmed: budget.confirmedBudget,
      consumed: budget.actualSpend,
      balance: budget.spendRemaining,
      usagePercent: budget.usagePercent,
    },
    calendar: project.calendarEntries.map((entry) => ({
      date: entry.date,
      content: entry.content,
      channel: entry.channel,
      owner: entry.owner,
      status: entry.status,
    })),
    groundingSources: project.sources.map((source) => ({
      fileName: source.fileName,
      excerpt: source.extractedText.slice(0, 2400),
    })),
  };

  const generated = await generateGroundedReport(facts, periodType);
  const report = await prisma.$transaction(async (tx) => {
    const created = await tx.projectReport.create({
      data: {
        projectId,
        periodType,
        periodStart,
        periodEnd,
        content: generated.content,
        sourceSnapshot: facts,
        generatedBy: user.name,
      },
    });
    await tx.activityLog.create({
      data: {
        projectId,
        targetType: "REPORT",
        targetId: created.id,
        changeType: "CREATE",
        summary: `生成${periodType === "WEEKLY" ? "周报" : "月报"}，引用 ${project.sources.length} 个来源证据`,
        source: generated.usedAI ? "AI" : "SYSTEM",
        createdBy: user.name,
      },
    });
    return created;
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, message: "报告已生成并记录到项目活动", data: { reportId: report.id, content: report.content } };
}

export async function createProjectShareLink(
  projectId: string,
  expiryDays = 30
): Promise<ActionResult<{ shareUrl: string; calendarUrl: string }>> {
  const user = await assertCanWriteProject(projectId);
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const safeExpiryDays = normalizeShareExpiryDays(expiryDays);
  const expiresAt = new Date(Date.now() + safeExpiryDays * 86400000);

  await prisma.$transaction(async (tx) => {
    const link = await tx.projectShareLink.create({
      data: {
        projectId,
        tokenHash,
        label: `${safeExpiryDays} 天只读分享`,
        expiresAt,
        createdBy: user.name,
      },
    });
    await tx.activityLog.create({
      data: {
        projectId,
        targetType: "SHARE_LINK",
        targetId: link.id,
        changeType: "CREATE",
        summary: `创建只读分享链接，有效期 ${safeExpiryDays} 天`,
        source: "HUMAN",
        createdBy: user.name,
      },
    });
  });

  const baseUrl = getBaseUrl();
  revalidatePath(`/projects/${projectId}`);
  return {
    success: true,
    message: "只读分享链接已创建",
    data: {
      shareUrl: `${baseUrl}/share/${token}`,
      calendarUrl: `${baseUrl}/api/share/${token}/calendar.ics`,
    },
  };
}

export async function revokeProjectShareLink(linkId: string): Promise<ActionResult> {
  const link = await prisma.projectShareLink.findUnique({ where: { id: linkId }, select: { id: true, projectId: true, revokedAt: true } });
  if (!link) return { success: false, message: "分享链接不存在" };
  const user = await assertCanWriteProject(link.projectId);
  if (link.revokedAt) return { success: true, message: "分享链接已失效" };

  await prisma.$transaction([
    prisma.projectShareLink.update({ where: { id: linkId }, data: { revokedAt: new Date() } }),
    prisma.activityLog.create({
      data: {
        projectId: link.projectId,
        targetType: "SHARE_LINK",
        targetId: linkId,
        changeType: "UPDATE",
        summary: "撤销只读分享链接",
        source: "HUMAN",
        createdBy: user.name,
      },
    }),
  ]);
  revalidatePath(`/projects/${link.projectId}`);
  return { success: true, message: "分享链接已撤销" };
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const requestHeaders = headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  return host ? `${protocol}://${host}` : "http://localhost:3000";
}

async function generateGroundedReport(facts: unknown, periodType: ProjectReportPeriod) {
  const fallback = buildDeterministicReport(facts as ReportFacts, periodType);
  if (!process.env.DEEPSEEK_API_KEY) return { content: fallback, usedAI: false };

  try {
    const openai = new OpenAI({ apiKey: process.env.DEEPSEEK_API_KEY, baseURL: "https://api.deepseek.com/v1" });
    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      temperature: 0.1,
      max_tokens: 1800,
      messages: [
        {
          role: "system",
          content: "你是 ShadowPM 项目报告引擎。仅使用提供的结构化事实和来源摘录，不编造。输出简洁中文 Markdown，固定包含：本期结论、关键进展、预算状态、近期执行、待确认。明确区分已发生、计划中、缺失信息。",
        },
        {
          role: "user",
          content: `生成${periodType === "WEEKLY" ? "周报" : "月报"}：\n${JSON.stringify(facts)}`,
        },
      ],
    });
    const content = response.choices[0]?.message?.content?.trim();
    return content ? { content, usedAI: true } : { content: fallback, usedAI: false };
  } catch (error) {
    console.error("report generation failed:", error);
    return { content: fallback, usedAI: false };
  }
}

type ReportFacts = {
  project: { name: string };
  controlItems: Array<{ name: string; status: string; assignee: string | null; deadline: Date | null; latestConclusion: string | null }>;
  budget: { planned: number; confirmed: number; consumed: number; balance: number; usagePercent: number };
  calendar: Array<{ date: Date | null; content: string; status: string }>;
  groundingSources: Array<{ fileName: string }>;
};

function buildDeterministicReport(facts: ReportFacts, periodType: ProjectReportPeriod) {
  const completed = facts.controlItems.filter((item) => item.status === "COMPLETED");
  const active = facts.controlItems.filter((item) => item.status === "IN_PROGRESS");
  const missingOwner = facts.controlItems.filter((item) => !item.assignee);
  const upcoming = facts.calendar.filter((entry) => entry.status !== "DONE" && entry.status !== "CANCELED").slice(0, 5);
  return [
    `# ${facts.project.name}${periodType === "WEEKLY" ? "周报" : "月报"}`,
    "",
    "## 本期结论",
    `当前共 ${facts.controlItems.length} 项管控事项，已完成 ${completed.length} 项，进行中 ${active.length} 项。`,
    "",
    "## 关键进展",
    ...(active.length > 0 ? active.slice(0, 6).map((item) => `- ${item.name}${item.latestConclusion ? `：${item.latestConclusion}` : ""}`) : ["- 暂无进行中事项。"]),
    "",
    "## 预算状态",
    `- 计划预算：¥${facts.budget.planned.toLocaleString("zh-CN")}`,
    `- 已确认预算：¥${facts.budget.confirmed.toLocaleString("zh-CN")}`,
    `- 已使用：¥${facts.budget.consumed.toLocaleString("zh-CN")}，可用结余：¥${facts.budget.balance.toLocaleString("zh-CN")}`,
    "",
    "## 近期执行",
    ...(upcoming.length > 0 ? upcoming.map((entry) => `- ${entry.date ? entry.date.toLocaleDateString("zh-CN") : "日期待确认"}：${entry.content}`) : ["- 暂无待执行日历节点。"]),
    "",
    "## 待确认",
    ...(missingOwner.length > 0 ? missingOwner.slice(0, 6).map((item) => `- ${item.name}：负责人待确认`) : ["- 当前没有缺失负责人事项。"]),
    facts.groundingSources.length > 0 ? `- 已引用来源：${facts.groundingSources.map((source) => source.fileName).join("、")}` : "- 当前项目没有已留存的上传来源，报告仅依据正式项目数据生成。",
  ].join("\n");
}
