"use server";

import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export type CopilotResponse = {
  message: string;
  actions?: { label: string; href: string }[];
};

// ── 风险检测（Copilot 内嵌，无需额外 Action） ──

export async function detectProjectRisks(): Promise<CopilotResponse> {
  const user = await getCurrentUser();
  if (!user) return { message: "请先登录" };

  const now = new Date();
  const projects = await prisma.project.findMany({
    include: {
      _count: { select: { tasks: true } },
      tasks: { select: { id: true, name: true, status: true, deadline: true } },
    },
  });

  const findings: string[] = [];
  let newRiskCount = 0;

  for (const project of projects) {
    const overdue = project.tasks.filter(
      (t) => t.deadline && new Date(t.deadline) < now && t.status !== "COMPLETED"
    );
    const total = project._count.tasks;
    const completed = project.tasks.filter((t) => t.status === "COMPLETED").length;

    // 检测逾期风险
    if (overdue.length > 0) {
      const existingScheduleRisk = await prisma.risk.findFirst({
        where: {
          projectId: project.id,
          type: "SCHEDULE",
          source: "AI_DETECTION",
          status: { not: "CLOSED" },
        },
        orderBy: { createdAt: "desc" },
      });

      const scheduleRiskData = {
        title: "任务逾期风险",
        level: overdue.length >= 3 ? "HIGH" : "MEDIUM",
        description: `${overdue.length} 个任务已逾期，最早为「${overdue[0].name}」`,
        suggestion: "请与负责人确认延期原因并更新截止日期",
      };

      if (existingScheduleRisk) {
        await prisma.risk.update({
          where: { id: existingScheduleRisk.id },
          data: scheduleRiskData,
        });
      } else {
        await prisma.risk.create({
          data: {
            projectId: project.id,
            type: "SCHEDULE",
            source: "AI_DETECTION",
            ...scheduleRiskData,
          },
        });
      }
      findings.push(`🔴 ${project.name}：${overdue.length} 个任务逾期`);
      newRiskCount++;
    }

    // 检测进度风险
    if (total > 0 && completed === 0 && project.tasks.some((t) => t.deadline && new Date(t.deadline) < new Date(Date.now() + 7 * 86400000))) {
      findings.push(`🟡 ${project.name}：有任务即将到期但尚未启动`);
    }
  }

  if (findings.length === 0) {
    return { message: "✅ 风险检测完成：当前所有项目状态正常，未发现风险。" };
  }

  return {
    message: `⚠️ 风险检测发现 ${newRiskCount} 个风险项：\n\n${findings.join("\n")}`,
    actions: projects.filter((p) => findings.some((f) => f.includes(p.name))).slice(0, 3).map((p) => ({
      label: `进入 ${p.name}`,
      href: `/projects/${p.id}`,
    })),
  };
}

const SYSTEM_PROMPT = `你是 ShadowPM 的 AI 项目助手。用户会用自然语言跟你对话，你需要：

1. 判断用户意图（查询 or 操作）
2. 返回结构化 JSON

如果是**查询**（查看预算、进度、项目列表等），返回：
{
  "intent": "query",
  "message": "用友好的中文回复用户的问题，包含关键数据",
  "taskName": null,
  "action": null,
  "projectName": null,
  "newStatus": null,
  "logContent": null
}

如果是**操作**（更新状态、汇报进度），返回：
{
  "intent": "action",
  "message": "用友好的中文确认即将执行的操作",
  "taskName": "用户提到的任务名称（精确提取，用于匹配数据库）",
  "action": "update_status" 或 "add_log",
  "projectName": "关联的项目名称",
  "newStatus": "PENDING" 或 "IN_PROGRESS" 或 "COMPLETED"（仅 update_status 时填写）,
  "logContent": "进度日志的内容"（仅 add_log 时填写）
}

操作类型说明：
- update_status: 用户说"完成了"、"搞定了"、"做完了" → 标记为 COMPLETED
  用户说"开始做"、"在进行"→ 标记为 IN_PROGRESS
- add_log: 用户汇报了具体进展内容 → 追加进度日志

如果用户意图不明确，返回 intent: "unknown"。

查询时必须优先利用上下文里的正式数据，尤其是项目、任务、预算和执行日历。不要编造日期、负责人、渠道或状态；缺失就说“待确认”。

只返回 JSON，不要加任何 markdown 代码块或其他文字。`;

const CALENDAR_STATUS_LABEL: Record<string, string> = {
  PLANNED: "计划中",
  CONFIRMED: "已确认",
  DONE: "已完成",
  CANCELED: "已取消",
};

const RISK_LEVEL_LABEL: Record<string, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  CRITICAL: "严重",
};

const RISK_STATUS_LABEL: Record<string, string> = {
  OPEN: "未处理",
  ACKNOWLEDGED: "已知悉",
  MITIGATED: "已缓解",
  CLOSED: "已关闭",
};

function formatCalendarDate(value: Date | null) {
  if (!value) return "日期待确认";
  return value.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
}

function formatMoney(value: number) {
  return `¥${Math.round(value).toLocaleString("zh-CN")}`;
}

function textMatchesInput(input: string, value: string) {
  if (input.includes(value) || value.includes(input)) return true;

  const chunks = value
    .split(/[-—_\s]+/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= 2);

  return chunks.some((chunk) => {
    if (input.includes(chunk)) return true;
    for (let start = 0; start < chunk.length; start++) {
      for (let end = start + 4; end <= chunk.length; end++) {
        if (input.includes(chunk.slice(start, end))) return true;
      }
    }
    return false;
  });
}

export async function processCopilotMessage(input: string): Promise<CopilotResponse> {
  const user = await getCurrentUser();
  if (!user) return { message: "请先登录" };

  if (!input.trim()) return { message: "请输入内容" };

  try {
    // 1. 查询用户相关的项目和任务上下文
    const [userProjects, userTasks] = await Promise.all([
      prisma.project.findMany({
        select: {
          id: true,
          name: true,
          totalBudget: true,
          tasks: {
            select: {
              budgets: {
                select: {
                  amount: true,
                  flowType: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.task.findMany({
        where: {
          OR: [
            { assignee: user.name },
            { project: { ownerId: user.id } },
          ],
          status: { not: "COMPLETED" },
        },
        select: { id: true, name: true, status: true, project: { select: { id: true, name: true } } },
        orderBy: { deadline: "asc" },
      }),
    ]);
    const userProjectIds = userProjects.map((project) => project.id);
    const [userCalendarEntries, openRisks] = await Promise.all([
      prisma.executionCalendarEntry.findMany({
        where: { projectId: { in: userProjectIds } },
        select: {
          id: true,
          date: true,
          startTime: true,
          channel: true,
          workstream: true,
          content: true,
          owner: true,
          status: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: [{ date: "asc" }, { createdAt: "desc" }],
        take: 20,
      }),
      prisma.risk.findMany({
        where: {
          projectId: { in: userProjectIds },
          status: { not: "CLOSED" },
        },
        select: {
          id: true,
          title: true,
          type: true,
          level: true,
          description: true,
          suggestion: true,
          status: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    const budgetSummaries = userProjects.map((project) => {
      const flows = project.tasks.flatMap((task) => task.budgets);
      const flowSum = flows.reduce((sum, flow) => sum + flow.amount.toNumber(), 0);
      const totalBudget = project.totalBudget.toNumber();
      const expense = flows
        .filter((flow) => flow.flowType === "EXPENSE")
        .reduce((sum, flow) => sum + Math.abs(flow.amount.toNumber()), 0);

      return {
        id: project.id,
        name: project.name,
        totalBudget,
        balance: flowSum,
        used: totalBudget - flowSum,
        expense,
        flowCount: flows.length,
      };
    });

    const matchedBudgetSummaries = budgetSummaries.filter((project) =>
      textMatchesInput(input, project.name)
    );
    const budgetsToShow = matchedBudgetSummaries.length > 0
      ? matchedBudgetSummaries
      : budgetSummaries.slice(0, 5);

    if (/预算|花了|用了|支出|余额|结余|费用/.test(input)) {
      if (budgetsToShow.length === 0) {
        return { message: "当前还没有项目预算数据。" };
      }

      return {
        message: `💰 当前预算概览：\n\n${budgetsToShow.map((project) =>
          `• ${project.name}\n  总预算：${formatMoney(project.totalBudget)}｜已使用：${formatMoney(project.used)}｜结余：${formatMoney(project.balance)}｜支出流水：${formatMoney(project.expense)}｜流水 ${project.flowCount} 条`
        ).join("\n")}`,
        actions: budgetsToShow[0]
          ? [{ label: `进入 ${budgetsToShow[0].name}`, href: `/projects/${budgetsToShow[0].id}` }]
          : undefined,
      };
    }

    const matchedRisks = openRisks.filter((risk) => textMatchesInput(input, risk.project.name));
    const risksToShow = matchedRisks.length > 0 ? matchedRisks : openRisks.slice(0, 8);

    if (/风险|待关闭|没关|未关闭|未处理/.test(input)) {
      if (risksToShow.length === 0) {
        return { message: "✅ 当前没有未关闭的正式风险。" };
      }

      return {
        message: `⚠️ 当前未关闭风险：\n\n${risksToShow.map((risk) =>
          `• [${RISK_LEVEL_LABEL[risk.level] ?? risk.level}｜${RISK_STATUS_LABEL[risk.status] ?? risk.status}] ${risk.title ?? risk.type}\n  项目：${risk.project.name}\n  ${risk.description}${risk.suggestion ? `\n  建议：${risk.suggestion}` : ""}`
        ).join("\n")}`,
        actions: risksToShow[0]
          ? [{ label: `进入 ${risksToShow[0].project.name}`, href: `/projects/${risksToShow[0].project.id}` }]
          : undefined,
      };
    }

    const unscheduledCalendarEntries = userCalendarEntries.filter((entry) => !entry.date);
    if (/没排期|未排期|日期待确认|待确认.*日历|日历.*待确认/.test(input)) {
      if (unscheduledCalendarEntries.length === 0) {
        return { message: "✅ 当前正式执行日历里没有日期待确认的节点。" };
      }

      return {
        message: `📆 日期待确认的执行节点：\n\n${unscheduledCalendarEntries.slice(0, 8).map((entry) =>
          `• ${entry.content}\n  项目：${entry.project.name}｜${entry.workstream ?? "未分组"}｜${entry.channel ?? "渠道待确认"}｜${entry.owner ?? "负责人待确认"}｜${CALENDAR_STATUS_LABEL[entry.status] ?? entry.status}`
        ).join("\n")}`,
        actions: unscheduledCalendarEntries[0]
          ? [{ label: `进入 ${unscheduledCalendarEntries[0].project.name}`, href: `/projects/${unscheduledCalendarEntries[0].project.id}` }]
          : undefined,
      };
    }

    // 2. 构建上下文
    const projectList = userProjects.map((p) => `• ${p.name} (id: ${p.id})`).join("\n");
    const taskList = userTasks.map((t) =>
      `• [${t.status}] ${t.name} → 项目: ${t.project.name} (taskId: ${t.id})`
    ).join("\n");
    const budgetList = budgetSummaries.map((project) =>
      `• ${project.name}：总预算 ${formatMoney(project.totalBudget)}，已使用 ${formatMoney(project.used)}，结余 ${formatMoney(project.balance)}，支出流水 ${formatMoney(project.expense)}`
    ).join("\n");
    const calendarList = userCalendarEntries.map((entry) =>
      `• [${CALENDAR_STATUS_LABEL[entry.status] ?? entry.status}] ${formatCalendarDate(entry.date)}${entry.startTime ? ` ${entry.startTime}` : ""} · ${entry.content} → 项目: ${entry.project.name} · ${entry.workstream ?? "未分组"} · ${entry.channel ?? "渠道待确认"} · ${entry.owner ?? "负责人待确认"}`
    ).join("\n");
    const riskList = openRisks.map((risk) =>
      `• [${risk.level}/${risk.status}] ${risk.title ?? risk.type} → 项目: ${risk.project.name} · ${risk.description}`
    ).join("\n");

    if (/日历|排期|传播节点|执行节点|发布|什么时候|哪天/.test(input)) {
      const relatedEntries = userCalendarEntries.filter((entry) =>
        textMatchesInput(input, entry.project.name) ||
        input.includes(entry.content) ||
        (entry.workstream ? input.includes(entry.workstream) : false) ||
        (entry.channel ? input.includes(entry.channel) : false)
      );
      const entriesToShow = relatedEntries.length > 0 ? relatedEntries : userCalendarEntries.slice(0, 8);

      if (entriesToShow.length === 0) {
        return {
          message: "当前还没有正式执行日历。可以先从 AI 导入候选里确认日历项，或在项目里补充执行节点。",
        };
      }

      return {
        message: `📆 当前正式执行日历：\n\n${entriesToShow.map((entry) =>
          `• ${formatCalendarDate(entry.date)}${entry.startTime ? ` ${entry.startTime}` : ""}｜${entry.content}\n  项目：${entry.project.name}｜${entry.workstream ?? "未分组"}｜${entry.channel ?? "渠道待确认"}｜${entry.owner ?? "负责人待确认"}｜${CALENDAR_STATUS_LABEL[entry.status] ?? entry.status}`
        ).join("\n")}`,
        actions: entriesToShow[0]
          ? [{ label: `进入 ${entriesToShow[0].project.name}`, href: `/projects/${entriesToShow[0].project.id}` }]
          : undefined,
      };
    }

    const contextMsg = `当前用户：${user.name}
用户的项目：
${projectList || "（无）"}

正在进行中的任务：
${taskList || "（无）"}

预算概览：
${budgetList || "（无）"}

正式执行日历：
${calendarList || "（无）"}

未关闭风险：
${riskList || "（无）"}

用户说：${input}

请分析用户意图并返回 JSON。如果是操作，taskName 必须从上面正在进行中的任务列表中精确匹配。如果是查询，必须优先使用上面的正式项目、任务、预算、执行日历和风险数据。`;

    // 3. 调 LLM
    const openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY!,
      baseURL: "https://api.deepseek.com/v1",
    });

    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: contextMsg },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { message: `🤔 我不太确定你的意思。\n\n你可以试试这样问我：\n•「仰望一万台的预算还有多少」\n•「公关通稿已经写完了」\n•「有哪些项目」\n•「哪些任务快到期了」` };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const intent = parsed.intent as string;

    // 4. 处理操作
    if (intent === "action" && parsed.taskName) {
      const matchedTask = userTasks.find(
        (t) => t.name.includes(parsed.taskName as string) || (parsed.taskName as string).includes(t.name)
      );

      if (!matchedTask) {
        return {
          message: `❌ 没找到名为「${parsed.taskName}」的任务。\n\n你当前的任务列表：\n${taskList || "（无）"}\n\n请确认任务名称后再试。`,
        };
      }

      if (parsed.action === "update_status" && parsed.newStatus) {
        const STATUS_LABEL: Record<string, string> = {
          PENDING: "待启动", IN_PROGRESS: "进行中", COMPLETED: "已完成",
        };

        const oldStatus = matchedTask.status;
        const newStatus = parsed.newStatus as string;

        if (oldStatus === newStatus) {
          return { message: `「${matchedTask.name}」当前已经是「${STATUS_LABEL[newStatus] ?? newStatus}」状态了。` };
        }

        // 执行状态变更（复用现有 task-actions 逻辑）
        await prisma.$transaction([
          prisma.progressLog.create({
            data: {
              taskId: matchedTask.id,
              content: `📌 状态变更：${STATUS_LABEL[oldStatus] ?? oldStatus} → **${STATUS_LABEL[newStatus] ?? newStatus}**（AI Copilot 自动操作）`,
              createdBy: user.name,
            },
          }),
          prisma.task.update({
            where: { id: matchedTask.id },
            data: { status: newStatus as "PENDING" | "IN_PROGRESS" | "COMPLETED" },
          }),
        ]);

        return {
          message: `✅ 已将「${matchedTask.name}」标记为「${STATUS_LABEL[newStatus] ?? newStatus}」\n\n系统已自动追加状态变更日志。`,
          actions: [{ label: "查看项目", href: `/projects/${matchedTask.project.id}` }],
        };
      }

      if (parsed.action === "add_log" && parsed.logContent) {
        await prisma.progressLog.create({
          data: {
            taskId: matchedTask.id,
            content: parsed.logContent as string,
            createdBy: user.name,
          },
        });

        return {
          message: `✅ 已为「${matchedTask.name}」追加进度日志：\n\n> ${parsed.logContent}\n\n— ${user.name}`,
          actions: [{ label: "查看项目", href: `/projects/${matchedTask.project.id}` }],
        };
      }
    }

    // 5. 处理查询 — 直接返回 LLM 生成的消息
    if (intent === "query") {
      return {
        message: parsed.message as string,
        actions: parsed.projectName
          ? await getProjectActions(parsed.projectName as string)
          : undefined,
      };
    }

    // 6. 未知意图
    return {
      message: `🤔 我不太确定你的意思。\n\n你可以试试：\n• 「公关线搞定了」— 更新任务状态\n• 「仰望一万台花了多少钱」— 查看预算\n• 「有哪些项目」— 列出项目\n• 「有什么风险」— 检查逾期`,
    };
  } catch (error) {
    console.error("Copilot error:", error);
    return { message: "❌ AI 处理请求时出错，请稍后重试。" };
  }
}

// 辅助：根据项目名查找项目并返回操作链接
async function getProjectActions(name: string) {
  const project = await prisma.project.findFirst({
    where: { name: { contains: name } },
    select: { id: true, name: true },
  });
  if (!project) return undefined;
  return [{ label: `进入 ${project.name}`, href: `/projects/${project.id}` }];
}
