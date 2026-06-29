"use server";

import OpenAI from "openai";
import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertCanReadProject, assertCanWriteProject, assertCanWriteTask } from "@/lib/permissions";
import { calculateBudgetSnapshot } from "@/lib/budget";
import type { ActionResult } from "@/actions/types";

type ProjectAIInsight = {
  summary: string;
  risks: string[];
  nextActions: string[];
  missingInfo: string[];
  budgetSignals: string[];
};

// ── 项目维度聚合时间轴（跨所有任务） ──

export async function getProjectTimeline(projectId: string) {
  await assertCanReadProject(projectId);

  const [progressLogs, activityLogs] = await Promise.all([
    prisma.progressLog.findMany({
      where: { task: { projectId } },
      include: {
        task: { select: { id: true, name: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.activityLog.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return [
    ...progressLogs
      .filter((log) => !isLegacyBudgetImportProgress(log.content))
      .filter((log) => !isBulkControlFillProgress(log.content))
      .map((log) => {
        const legacyRiskStatus = isLegacyRiskStatusProgress(log.content);

        return {
          id: log.id,
          type: legacyRiskStatus ? "ACTIVITY" as const : "PROGRESS" as const,
          taskId: legacyRiskStatus ? null : log.taskId,
          content: log.content,
          createdBy: log.createdBy,
          createdAt: log.createdAt,
          task: legacyRiskStatus ? null : log.task,
          targetId: legacyRiskStatus ? null : log.taskId,
          targetType: legacyRiskStatus ? "RISK" : "TASK",
          changeType: legacyRiskStatus ? "STATUS_CHANGE" : "COMMENT",
          source: "HUMAN",
        };
      }),
    ...activityLogs.map((log) => ({
      id: log.id,
      type: "ACTIVITY" as const,
      taskId: null,
      content: log.summary,
      createdBy: log.createdBy,
      createdAt: log.createdAt,
      task: null,
      targetId: log.targetId,
      targetType: log.targetType,
      changeType: log.changeType,
      afterState: log.afterState,
      source: log.source,
    })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function isLegacyBudgetImportProgress(content: string) {
  return content.startsWith("💰 AI 导入预算候选已确认入账：");
}

function isLegacyRiskStatusProgress(content: string) {
  return content.startsWith("⚠️ 项目风险状态变更：");
}

function isBulkControlFillProgress(content: string) {
  return content.startsWith("🧩 批量补齐管控字段");
}

// ── 纯 Append 模式插入 —— 绝对不修改任何已有记录 ──

export async function addProgressLog(formData: FormData): Promise<ActionResult> {
  const taskId = formData.get("taskId") as string;
  const { user } = await assertCanWriteTask(taskId);
  const content = formData.get("content") as string;

  if (!taskId || !content?.trim()) {
    return { success: false, message: "所属任务和汇报内容为必填项" };
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) return { success: false, message: "任务不存在" };

  await prisma.progressLog.create({
    data: {
      taskId,
      content: content.trim(),
      createdBy: user.name,
    },
  });

  revalidatePath(`/projects/${task.projectId}`);
  return { success: true, message: "进度汇报已追加" };
}

export async function generateProjectActivitySummary(projectId: string): Promise<ActionResult<ProjectAIInsight>> {
  const user = await assertCanReadProject(projectId);
  if (!process.env.DEEPSEEK_API_KEY) return { success: false, message: "缺少 DEEPSEEK_API_KEY，暂时无法生成 AI 摘要" };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      totalBudget: true,
      startDate: true,
      endDate: true,
      tasks: {
        select: {
          name: true,
          assignee: true,
          department: true,
          deadline: true,
          status: true,
          priority: true,
          notes: true,
        },
        orderBy: [{ priority: "asc" }, { deadline: "asc" }],
        take: 80,
      },
      risks: {
        select: {
          title: true,
          type: true,
          level: true,
          status: true,
          description: true,
          suggestion: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      activityLogs: {
        select: {
          targetType: true,
          changeType: true,
          summary: true,
          source: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 30,
      },
    },
  });

  if (!project) return { success: false, message: "项目不存在" };

  const taskIds = await prisma.task.findMany({
    where: { projectId },
    select: { id: true },
  });
  const taskIdList = taskIds.map((task) => task.id);
  const [budgetExpense, budgetAllocation, budgetRefund, recentProgressLogs, calendarEntries] = await Promise.all([
    prisma.budgetFlow.aggregate({
      where: { taskId: { in: taskIdList }, flowType: "EXPENSE" },
      _sum: { amount: true },
    }),
    prisma.budgetFlow.aggregate({
      where: { taskId: { in: taskIdList }, flowType: "ALLOCATE" },
      _sum: { amount: true },
    }),
    prisma.budgetFlow.aggregate({
      where: { taskId: { in: taskIdList }, flowType: "REFUND" },
      _sum: { amount: true },
    }),
    prisma.progressLog.findMany({
      where: { task: { projectId } },
      select: {
        content: true,
        createdAt: true,
        task: { select: { name: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.executionCalendarEntry.findMany({
      where: { projectId },
      select: {
        date: true,
        channel: true,
        workstream: true,
        content: true,
        status: true,
      },
      orderBy: [{ date: "asc" }, { createdAt: "desc" }],
      take: 30,
    }),
  ]);

  const now = new Date();
  const taskStats = {
    total: project.tasks.length,
    pending: project.tasks.filter((task) => task.status === "PENDING").length,
    inProgress: project.tasks.filter((task) => task.status === "IN_PROGRESS").length,
    completed: project.tasks.filter((task) => task.status === "COMPLETED").length,
    overdue: project.tasks.filter((task) => task.deadline && task.deadline < now && task.status !== "COMPLETED").length,
    missingOwner: project.tasks.filter((task) => !task.assignee?.trim()).length,
    p0: project.tasks.filter((task) => task.priority === "P0").length,
  };
  const openRisks = project.risks.filter((risk) => risk.status !== "CLOSED");
  const budget = calculateBudgetSnapshot({
    plannedBudget: project.totalBudget,
    allocated: budgetAllocation._sum.amount,
    expense: budgetExpense._sum.amount,
    refund: budgetRefund._sum.amount,
  });

  const prompt = `你是 ShadowPM 的项目状态分析助手。ShadowPM 不是任务管理工具，而是 AI Native Project Management Platform。

请基于项目管控总表、预算流转、执行日历、风险和活动流，生成结构化项目判断。

输出要求：
- 中文
- 只输出 JSON，不要 Markdown，不要解释
- summary 不超过 180 字
- risks / nextActions / missingInfo / budgetSignals 每项不超过 4 条
- nextActions 必须是可执行动作，不要写“持续关注”
- missingInfo 只写真正影响判断或执行的信息
- 不要泛泛而谈，不要说“建议持续关注”这种空话
- 如果数据不足，明确说还缺哪些关键信息

JSON 结构：
{
  "summary": "string",
  "risks": ["string"],
  "nextActions": ["string"],
  "missingInfo": ["string"],
  "budgetSignals": ["string"]
}

项目：
- 名称：${project.name}
- 周期：${formatDate(project.startDate)} 至 ${formatDate(project.endDate)}
- 计划预算：${formatMoney(budget.plannedBudget)}
- 已确认预算池：${formatMoney(budget.allocated)}
- 已使用预算：${formatMoney(budget.consumed)}
- 可用结余：${formatMoney(budget.balance)}
- 支出流水：${formatMoney(budget.expense)}
- 退款：${formatMoney(budget.refund)}

管控总表：
- 总事项：${taskStats.total}
- 待启动：${taskStats.pending}
- 进行中：${taskStats.inProgress}
- 已完成：${taskStats.completed}
- 逾期未完成：${taskStats.overdue}
- 缺负责人：${taskStats.missingOwner}
- P0 事项：${taskStats.p0}

高优先级/异常事项：
${project.tasks
  .filter((task) => task.priority === "P0" || !task.assignee || task.deadline && task.deadline < now && task.status !== "COMPLETED")
  .slice(0, 12)
  .map((task) => `- ${task.name}｜${task.status}｜${task.priority}｜负责人:${task.assignee ?? "缺失"}｜截止:${formatDate(task.deadline)}｜备注:${task.notes ?? "无"}`)
  .join("\n") || "- 暂无"}

未关闭风险：
${openRisks.slice(0, 8).map((risk) => `- ${risk.level}/${risk.type}｜${risk.title ?? risk.description}｜建议:${risk.suggestion ?? "无"}`).join("\n") || "- 暂无"}

执行日历：
${calendarEntries.slice(0, 10).map((entry) => `- ${formatDate(entry.date)}｜${entry.channel ?? "未填渠道"}｜${entry.workstream ?? "未填模块"}｜${entry.content}｜${entry.status}`).join("\n") || "- 暂无"}

最近活动：
${project.activityLogs.slice(0, 12).map((log) => `- ${formatDate(log.createdAt)}｜${log.targetType}/${log.changeType}/${log.source}｜${log.summary}`).join("\n") || "- 暂无"}

最近人工进度：
${recentProgressLogs.slice(0, 8).map((log) => `- ${formatDate(log.createdAt)}｜${log.task.name}/${log.task.status}｜${log.content}`).join("\n") || "- 暂无"}`;

  try {
    const openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://api.deepseek.com/v1",
    });

    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 700,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "你是 ShadowPM 的项目状态分析助手，输出必须是短、准、可执行的 JSON。" },
        { role: "user", content: prompt },
      ],
    });
    const content = response.choices[0]?.message?.content?.trim();
    if (!content) return { success: false, message: "AI 未返回有效摘要" };
    const insight = parseProjectAIInsight(content);
    if (!insight) return { success: false, message: "AI 摘要结构不完整，请重试" };

    await prisma.activityLog.create({
      data: {
        projectId,
        targetType: "PROJECT",
        changeType: "AI_ACTION",
        summary: `🤖 AI 项目状态摘要：${insight.summary}`,
        source: "AI",
        createdBy: user.name,
        afterState: {
          ...insight,
          taskStats,
          budget: {
            planned: budget.plannedBudget.toString(),
            allocated: budget.allocated.toString(),
            consumed: budget.consumed.toString(),
            balance: budget.balance.toString(),
            expense: budget.expense.toString(),
            refund: budget.refund.toString(),
          },
          openRiskCount: openRisks.length,
          generatedAt: new Date().toISOString(),
        },
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return { success: true, data: insight };
  } catch {
    return { success: false, message: "AI 摘要生成失败，请稍后重试" };
  }
}

export async function adoptAIActionSuggestion(formData: FormData): Promise<ActionResult<{ taskId: string }>> {
  const projectId = formData.get("projectId") as string;
  const user = await assertCanWriteProject(projectId);
  const activityLogId = formData.get("activityLogId") as string;
  const actionIndex = Number(formData.get("actionIndex"));
  const name = normalizeOptionalText(formData.get("name"));
  const assignee = normalizeOptionalText(formData.get("assignee"));
  const department = normalizeOptionalText(formData.get("department"));
  const deadline = parseDateSafe(normalizeOptionalText(formData.get("deadline")));

  if (!projectId || !activityLogId || !Number.isInteger(actionIndex) || actionIndex < 0) {
    return { success: false, message: "AI 行动建议参数无效" };
  }

  const log = await prisma.activityLog.findFirst({
    where: {
      id: activityLogId,
      projectId,
      targetType: "PROJECT",
      changeType: "AI_ACTION",
      source: "AI",
    },
  });
  if (!log) return { success: false, message: "AI 判断记录不存在" };

  const insight = parseStoredProjectAIInsight(log.afterState);
  if (!insight) return { success: false, message: "AI 判断结构不完整，无法采纳" };

  const action = insight.nextActions[actionIndex];
  if (!action) return { success: false, message: "AI 行动建议不存在" };
  const taskName = name ?? action;
  if (!taskName.trim()) return { success: false, message: "管控事项名称不能为空" };
  if (insight.adoptedActionIndexes.includes(actionIndex)) {
    return { success: false, message: "这条 AI 行动建议已采纳" };
  }

  const task = await prisma.$transaction(async (tx) => {
    const createdTask = await tx.task.create({
      data: {
        projectId,
        name: taskName.trim().slice(0, 120),
        description: `来自 AI 项目判断的行动建议：${action}`,
        notes: `采纳自活动流记录：${activityLogId}`,
        assignee,
        department,
        deadline,
        priority: "P1",
      },
    });

    const nextInsightState = {
      ...insight.raw,
      adoptedActionIndexes: [...insight.adoptedActionIndexes, actionIndex],
      adoptedTasks: [
        ...insight.adoptedTasks,
        {
              actionIndex,
              taskId: createdTask.id,
              name: createdTask.name,
              assignee,
              department,
              deadline: deadline?.toISOString() ?? null,
              adoptedBy: user.name,
              adoptedAt: new Date().toISOString(),
            },
      ],
    } as Prisma.InputJsonValue;

    await tx.activityLog.update({
      where: { id: activityLogId },
      data: {
        afterState: nextInsightState,
      },
    });

    await tx.activityLog.create({
      data: {
        projectId,
        targetType: "CONTROL_ITEM",
        targetId: createdTask.id,
        changeType: "AI_ACTION",
        summary: `🤖 已采纳 AI 行动建议并创建管控事项：${createdTask.name}`,
        source: "AI",
        createdBy: user.name,
        afterState: {
          sourceActivityLogId: activityLogId,
          actionIndex,
          taskId: createdTask.id,
          action,
          adoptedTask: {
            name: createdTask.name,
            assignee,
            department,
            deadline: deadline?.toISOString() ?? null,
          },
        },
      },
    });

    return createdTask;
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, message: "AI 行动建议已采纳为管控事项", data: { taskId: task.id } };
}

export async function scheduleAIActionSuggestion(formData: FormData): Promise<ActionResult<{ calendarEntryId: string }>> {
  const projectId = formData.get("projectId") as string;
  const user = await assertCanWriteProject(projectId);
  const activityLogId = formData.get("activityLogId") as string;
  const actionIndex = Number(formData.get("actionIndex"));
  const content = normalizeOptionalText(formData.get("content"));
  const taskId = normalizeOptionalText(formData.get("taskId"));
  const date = parseDateSafe(normalizeOptionalText(formData.get("date")));
  const startTime = normalizeOptionalText(formData.get("startTime"));
  const endTime = normalizeOptionalText(formData.get("endTime"));
  const channel = normalizeOptionalText(formData.get("channel"));
  const workstream = normalizeOptionalText(formData.get("workstream"));
  const owner = normalizeOptionalText(formData.get("owner"));
  const department = normalizeOptionalText(formData.get("department"));
  const notes = normalizeOptionalText(formData.get("notes"));

  if (!projectId || !activityLogId || !Number.isInteger(actionIndex) || actionIndex < 0) {
    return { success: false, message: "AI 排期建议参数无效" };
  }

  const [log, relatedTask] = await Promise.all([
    prisma.activityLog.findFirst({
      where: {
        id: activityLogId,
        projectId,
        targetType: "PROJECT",
        changeType: "AI_ACTION",
        source: "AI",
      },
    }),
    taskId
      ? prisma.task.findFirst({
          where: { id: taskId, projectId },
          select: { id: true, name: true },
        })
      : null,
  ]);
  if (!log) return { success: false, message: "AI 判断记录不存在" };
  if (taskId && !relatedTask) return { success: false, message: "关联管控事项不存在" };

  const insight = parseStoredProjectAIInsight(log.afterState);
  if (!insight) return { success: false, message: "AI 判断结构不完整，无法排期" };

  const action = insight.nextActions[actionIndex];
  if (!action) return { success: false, message: "AI 行动建议不存在" };
  const entryContent = content ?? action;
  if (!entryContent.trim()) return { success: false, message: "日历内容不能为空" };
  if (insight.scheduledActionIndexes.includes(actionIndex)) {
    return { success: false, message: "这条 AI 行动建议已排入日历" };
  }

  const calendarEntry = await prisma.$transaction(async (tx) => {
    const createdEntry = await tx.executionCalendarEntry.create({
      data: {
        projectId,
        taskId,
        date,
        startTime,
        endTime,
        channel,
        workstream,
        content: entryContent.trim().slice(0, 240),
        owner,
        department,
        status: date ? "CONFIRMED" : "PLANNED",
        notes: notes ?? `来自 AI 项目判断的行动建议：${action}`,
        source: "AI_IMPORT",
        createdBy: user.name,
      },
    });

    const nextInsightState = {
      ...insight.raw,
      scheduledActionIndexes: [...insight.scheduledActionIndexes, actionIndex],
      scheduledCalendarEntries: [
        ...insight.scheduledCalendarEntries,
        {
          actionIndex,
          calendarEntryId: createdEntry.id,
          taskId,
          taskName: relatedTask?.name ?? null,
          content: createdEntry.content,
          date: date?.toISOString() ?? null,
          channel,
          workstream,
          owner,
          department,
          scheduledBy: user.name,
          scheduledAt: new Date().toISOString(),
        },
      ],
    } as Prisma.InputJsonValue;

    await tx.activityLog.update({
      where: { id: activityLogId },
      data: { afterState: nextInsightState },
    });

    await tx.activityLog.create({
      data: {
        projectId,
        targetType: "CALENDAR_ENTRY",
        targetId: createdEntry.id,
        changeType: "AI_ACTION",
        summary: `📆 已将 AI 行动建议排入执行日历：${createdEntry.content}`,
        source: "AI",
        createdBy: user.name,
        afterState: {
          sourceActivityLogId: activityLogId,
          actionIndex,
            calendarEntryId: createdEntry.id,
            taskId,
            taskName: relatedTask?.name ?? null,
            action,
          scheduledEntry: {
            content: createdEntry.content,
            date: date?.toISOString() ?? null,
            startTime,
            endTime,
            channel,
            workstream,
            owner,
            department,
          },
        },
      },
    });

    return createdEntry;
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, message: "AI 行动建议已排入执行日历", data: { calendarEntryId: calendarEntry.id } };
}

export async function adoptAIRiskSignal(formData: FormData): Promise<ActionResult<{ riskId: string }>> {
  const projectId = formData.get("projectId") as string;
  const user = await assertCanWriteProject(projectId);
  const activityLogId = formData.get("activityLogId") as string;
  const riskIndex = Number(formData.get("riskIndex"));
  const title = normalizeOptionalText(formData.get("title"));
  const description = normalizeOptionalText(formData.get("description"));
  const suggestion = normalizeOptionalText(formData.get("suggestion"));
  const type = normalizeRiskType(normalizeOptionalText(formData.get("type")));
  const level = normalizeRiskLevel(normalizeOptionalText(formData.get("level")));

  if (!projectId || !activityLogId || !Number.isInteger(riskIndex) || riskIndex < 0) {
    return { success: false, message: "AI 风险信号参数无效" };
  }

  const log = await prisma.activityLog.findFirst({
    where: {
      id: activityLogId,
      projectId,
      targetType: "PROJECT",
      changeType: "AI_ACTION",
      source: "AI",
    },
  });
  if (!log) return { success: false, message: "AI 判断记录不存在" };

  const insight = parseStoredProjectAIInsight(log.afterState);
  if (!insight) return { success: false, message: "AI 判断结构不完整，无法确认风险" };

  const riskSignal = insight.risks[riskIndex];
  if (!riskSignal) return { success: false, message: "AI 风险信号不存在" };
  if (insight.adoptedRiskIndexes.includes(riskIndex)) {
    return { success: false, message: "这条 AI 风险信号已确认" };
  }

  const riskDescription = description ?? riskSignal;
  const risk = await prisma.$transaction(async (tx) => {
    const createdRisk = await tx.risk.create({
      data: {
        projectId,
        title: title ?? riskSignal.slice(0, 80),
        type,
        level,
        description: riskDescription,
        suggestion,
        status: "OPEN",
        source: "AI_DETECTION",
      },
    });

    const nextInsightState = {
      ...insight.raw,
      adoptedRiskIndexes: [...insight.adoptedRiskIndexes, riskIndex],
      adoptedRisks: [
        ...insight.adoptedRisks,
        {
          riskIndex,
          riskId: createdRisk.id,
          title: createdRisk.title,
          type,
          level,
          adoptedBy: user.name,
          adoptedAt: new Date().toISOString(),
        },
      ],
    } as Prisma.InputJsonValue;

    await tx.activityLog.update({
      where: { id: activityLogId },
      data: { afterState: nextInsightState },
    });

    await tx.activityLog.create({
      data: {
        projectId,
        targetType: "RISK",
        targetId: createdRisk.id,
        changeType: "AI_ACTION",
        summary: `⚠️ 已确认 AI 风险信号：${createdRisk.title ?? createdRisk.type}`,
        source: "AI",
        createdBy: user.name,
        afterState: {
          sourceActivityLogId: activityLogId,
          riskIndex,
          riskId: createdRisk.id,
          riskSignal,
          adoptedRisk: {
            title: createdRisk.title,
            type,
            level,
            description: riskDescription,
            suggestion,
          },
        },
      },
    });

    return createdRisk;
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, message: "AI 风险信号已确认为正式风险", data: { riskId: risk.id } };
}

export async function adoptAIBudgetSignal(formData: FormData): Promise<ActionResult<{ budgetFlowId: string }>> {
  const projectId = formData.get("projectId") as string;
  const user = await assertCanWriteProject(projectId);
  const activityLogId = formData.get("activityLogId") as string;
  const budgetIndex = Number(formData.get("budgetIndex"));
  const taskId = formData.get("taskId") as string;
  const flowType = normalizeFlowType(normalizeOptionalText(formData.get("flowType")));
  const amountRaw = normalizeOptionalText(formData.get("amount"));
  const description = normalizeOptionalText(formData.get("description"));

  if (!projectId || !activityLogId || !Number.isInteger(budgetIndex) || budgetIndex < 0) {
    return { success: false, message: "AI 预算信号参数无效" };
  }
  if (!taskId || !amountRaw || !description) {
    return { success: false, message: "管控事项、金额和事由为必填项" };
  }

  let amount = new Prisma.Decimal(amountRaw);
  if (amount.isNaN() || amount.lte(0)) {
    return { success: false, message: "金额必须为正数" };
  }
  if (flowType === "EXPENSE") amount = amount.negated();

  const [log, task] = await Promise.all([
    prisma.activityLog.findFirst({
      where: {
        id: activityLogId,
        projectId,
        targetType: "PROJECT",
        changeType: "AI_ACTION",
        source: "AI",
      },
    }),
    prisma.task.findFirst({
      where: { id: taskId, projectId },
      select: { id: true, name: true },
    }),
  ]);
  if (!log) return { success: false, message: "AI 判断记录不存在" };
  if (!task) return { success: false, message: "关联管控事项不存在" };

  const insight = parseStoredProjectAIInsight(log.afterState);
  if (!insight) return { success: false, message: "AI 判断结构不完整，无法确认预算信号" };

  const budgetSignal = insight.budgetSignals[budgetIndex];
  if (!budgetSignal) return { success: false, message: "AI 预算信号不存在" };
  if (insight.adoptedBudgetSignalIndexes.includes(budgetIndex)) {
    return { success: false, message: "这条 AI 预算信号已记账" };
  }

  const budgetFlow = await prisma.$transaction(async (tx) => {
    const createdFlow = await tx.budgetFlow.create({
      data: {
        taskId,
        flowType,
        amount,
        description,
        createdBy: user.name,
      },
    });

    const nextInsightState = {
      ...insight.raw,
      adoptedBudgetSignalIndexes: [...insight.adoptedBudgetSignalIndexes, budgetIndex],
      adoptedBudgetFlows: [
        ...insight.adoptedBudgetFlows,
        {
          budgetIndex,
          budgetFlowId: createdFlow.id,
          taskId,
          taskName: task.name,
          flowType,
          amount: amount.toString(),
          description,
          adoptedBy: user.name,
          adoptedAt: new Date().toISOString(),
        },
      ],
    } as Prisma.InputJsonValue;

    await tx.activityLog.update({
      where: { id: activityLogId },
      data: { afterState: nextInsightState },
    });

    await tx.activityLog.create({
      data: {
        projectId,
        targetType: "BUDGET_ITEM",
        targetId: createdFlow.id,
        changeType: "AI_ACTION",
        summary: `💰 已确认 AI 预算信号并写入预算流转：${description}`,
        source: "AI",
        createdBy: user.name,
        afterState: {
          sourceActivityLogId: activityLogId,
          budgetIndex,
          budgetFlowId: createdFlow.id,
          budgetSignal,
          adoptedBudgetFlow: {
            taskId,
            taskName: task.name,
            flowType,
            amount: amount.toString(),
            description,
          },
        },
      },
    });

    return createdFlow;
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, message: "AI 预算信号已写入预算流转", data: { budgetFlowId: budgetFlow.id } };
}

function parseProjectAIInsight(content: string): ProjectAIInsight | null {
  try {
    const parsed = JSON.parse(content) as Partial<ProjectAIInsight>;
    if (!parsed.summary || typeof parsed.summary !== "string") return null;

    return {
      summary: parsed.summary.trim().slice(0, 220),
      risks: normalizeStringList(parsed.risks),
      nextActions: normalizeStringList(parsed.nextActions),
      missingInfo: normalizeStringList(parsed.missingInfo),
      budgetSignals: normalizeStringList(parsed.budgetSignals),
    };
  } catch {
    return null;
  }
}

function parseStoredProjectAIInsight(value: Prisma.JsonValue | null) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const state = value as Record<string, unknown>;
  if (typeof state.summary !== "string") return null;

  return {
    raw: state,
    summary: state.summary.trim(),
    risks: normalizeStringList(state.risks),
    nextActions: normalizeStringList(state.nextActions),
    missingInfo: normalizeStringList(state.missingInfo),
    budgetSignals: normalizeStringList(state.budgetSignals),
    adoptedActionIndexes: Array.isArray(state.adoptedActionIndexes)
      ? state.adoptedActionIndexes.filter((item): item is number => Number.isInteger(item))
      : [],
    adoptedTasks: Array.isArray(state.adoptedTasks)
      ? state.adoptedTasks.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      : [],
    scheduledActionIndexes: Array.isArray(state.scheduledActionIndexes)
      ? state.scheduledActionIndexes.filter((item): item is number => Number.isInteger(item))
      : [],
    scheduledCalendarEntries: Array.isArray(state.scheduledCalendarEntries)
      ? state.scheduledCalendarEntries.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      : [],
    adoptedRiskIndexes: Array.isArray(state.adoptedRiskIndexes)
      ? state.adoptedRiskIndexes.filter((item): item is number => Number.isInteger(item))
      : [],
    adoptedRisks: Array.isArray(state.adoptedRisks)
      ? state.adoptedRisks.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      : [],
    adoptedBudgetSignalIndexes: Array.isArray(state.adoptedBudgetSignalIndexes)
      ? state.adoptedBudgetSignalIndexes.filter((item): item is number => Number.isInteger(item))
      : [],
    adoptedBudgetFlows: Array.isArray(state.adoptedBudgetFlows)
      ? state.adoptedBudgetFlows.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      : [],
  };
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeOptionalText(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseDateSafe(value: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return new Date(`${value}T00:00:00.000Z`);
}

function normalizeRiskType(value: string | null) {
  const allowed = ["BUDGET", "SCHEDULE", "RESOURCE", "SCOPE", "COMMUNICATION", "OTHER"];
  return value && allowed.includes(value) ? value : "OTHER";
}

function normalizeRiskLevel(value: string | null) {
  const allowed = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  return value && allowed.includes(value) ? value : "MEDIUM";
}

function normalizeFlowType(value: string | null) {
  const allowed = ["ALLOCATE", "EXPENSE", "REFUND"] as const;
  return allowed.includes(value as (typeof allowed)[number])
    ? value as (typeof allowed)[number]
    : "EXPENSE";
}

function formatDate(value: Date | string | null | undefined) {
  if (!value) return "未填写";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "未填写";
  return date.toISOString().slice(0, 10);
}

function formatMoney(value: Prisma.Decimal | number | null | undefined) {
  const amount = value instanceof Prisma.Decimal ? value.toNumber() : value ?? 0;
  return `¥${amount.toLocaleString("zh-CN")}`;
}
