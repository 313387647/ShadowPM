"use server";

import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/permissions";
import { isCommandCenterWriteRequest, isProjectHealthQuery, isProjectListQuery } from "@/lib/command-center-query";
import { getProjectBudgetSummary } from "@/lib/budget-summary";

export type CopilotResponse = {
  message: string;
  actions?: { label: string; href: string }[];
};

const SYSTEM_PROMPT = `你是 ShadowPM 的 AI 项目助手。用户会用自然语言跟你对话，你需要：

1. 判断用户意图
2. 返回结构化 JSON

当前 Command Center 只负责查询、总结、定位和解释，不负责直接更新管控事项、进度或预算。

如果是**查询**（查看预算、进度、项目列表、执行日历、待处理事项等），返回：
{
  "intent": "query",
  "message": "用友好的中文回复用户的问题，包含关键数据",
  "taskName": null,
  "action": null,
  "projectName": null,
  "newStatus": null,
  "logContent": null
}

如果用户要求更新状态、追加进度、修改预算、创建排期或其他写入操作，不要生成操作 JSON。
请返回 intent: "query"，并提示用户直接在项目管控表、资金账本或执行日历中编辑，因为这些表格是正式数据入口。

如果用户意图不明确，返回 intent: "unknown"。

查询时必须优先利用上下文里的正式数据，尤其是项目、管控事项、预算和执行日历。不要编造日期、负责人、渠道或状态；缺失就说“待确认”。

只返回 JSON，不要加任何 markdown 代码块或其他文字。`;

const CALENDAR_STATUS_LABEL: Record<string, string> = {
  PLANNED: "计划中",
  CONFIRMED: "已确认",
  DONE: "已完成",
  CANCELED: "已取消",
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

function readableProjectWhere(user: Awaited<ReturnType<typeof requireCurrentUser>>) {
  return user.role === "LEADER"
    ? {}
    : {
        OR: [
          { ownerId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      };
}

export async function processCopilotMessage(input: string): Promise<CopilotResponse> {
  const user = await requireCurrentUser();

  if (!input.trim()) return { message: "请输入内容" };

  try {
    // 1. 查询用户相关的项目和任务上下文
    const [userProjects, userTasks] = await Promise.all([
      prisma.project.findMany({
        where: readableProjectWhere(user),
        select: {
          id: true,
          name: true,
          totalBudget: true,
          budgetMode: true,
          budgetItems: { select: { plannedAmount: true, status: true } },
          budgetFlows: { select: { amount: true, action: true, flowType: true } },
          tasks: {
            select: {
              id: true,
              name: true,
              status: true,
              assignee: true,
              deadline: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.task.findMany({
        where: {
          ...(user.role === "LEADER" ? {} : { project: readableProjectWhere(user) }),
          status: { not: "COMPLETED" },
        },
        select: {
          id: true,
          name: true,
          status: true,
          assignee: true,
          department: true,
          deadline: true,
          project: { select: { id: true, name: true } },
        },
        orderBy: { deadline: "asc" },
      }),
    ]);
    const userProjectIds = userProjects.map((project) => project.id);
    const userCalendarEntries = await prisma.executionCalendarEntry.findMany({
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
    });

    const budgetSummaries = userProjects.map((project) => {
      const budget = getProjectBudgetSummary(project);

      return {
        id: project.id,
        name: project.name,
        plannedBudget: budget.planned,
        allocatedBudget: budget.confirmedBudget,
        balance: budget.spendRemaining,
        used: budget.actualSpend,
        expense: budget.expense,
        refund: budget.refund,
        flowCount: project.budgetFlows.length,
      };
    });

    if (isCommandCenterWriteRequest(input)) {
      return {
        message: "ShadowPM 把正式写入放在对应的表格中，避免对话和数据不同步。请在项目里直接编辑：进度/状态在管控总表，预算在资金账本，排期在执行日历。",
      };
    }

    if (isProjectListQuery(input)) {
      if (userProjects.length === 0) return { message: "当前你可查看的项目为空。" };
      return {
        message: `📂 当前可查看的项目（${userProjects.length}）：\n\n${userProjects.map((project) => {
          const active = project.tasks.filter((task) => task.status !== "COMPLETED").length;
          return `• ${project.name}｜进行中的管控事项 ${active}`;
        }).join("\n")}`,
        actions: userProjects.slice(0, 3).map((project) => ({ label: `进入 ${project.name}`, href: `/projects/${project.id}` })),
      };
    }

    if (isProjectHealthQuery(input)) {
      const matchingProjects = userProjects.filter((project) => textMatchesInput(input, project.name));
      const projectsToShow = matchingProjects.length > 0 ? matchingProjects : userProjects.slice(0, 5);
      if (projectsToShow.length === 0) return { message: "当前还没有可查询的项目。" };
      return {
        message: `📈 项目进展：\n\n${projectsToShow.map((project) => {
          const completed = project.tasks.filter((task) => task.status === "COMPLETED").length;
          const total = project.tasks.length;
          const overdue = project.tasks.filter((task) => task.deadline && task.deadline < new Date() && task.status !== "COMPLETED").length;
          const missingOwner = project.tasks.filter((task) => task.status !== "COMPLETED" && !task.assignee?.trim()).length;
          const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
          return `• ${project.name}\n  完成 ${progress}%（${completed}/${total}）｜逾期 ${overdue}｜缺负责人 ${missingOwner}`;
        }).join("\n")}`,
        actions: projectsToShow.slice(0, 3).map((project) => ({ label: `进入 ${project.name}`, href: `/projects/${project.id}?tab=tasks` })),
      };
    }

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
          `• ${project.name}\n  计划预算：${formatMoney(project.plannedBudget)}｜确认预算：${formatMoney(project.allocatedBudget)}｜已使用：${formatMoney(project.used)}｜结余：${formatMoney(project.balance)}｜支出流水：${formatMoney(project.expense)}｜退款：${formatMoney(project.refund)}｜流水 ${project.flowCount} 条`
        ).join("\n")}`,
        actions: budgetsToShow[0]
          ? [{ label: `进入 ${budgetsToShow[0].name}`, href: `/projects/${budgetsToShow[0].id}` }]
          : undefined,
      };
    }

    const now = new Date();
    const soon = new Date(Date.now() + 7 * 86400000);
    const attentionTasks = userTasks.filter((task) =>
      !task.assignee?.trim() ||
      !task.deadline ||
      (task.deadline < now && task.status !== "COMPLETED") ||
      (task.deadline <= soon && task.status === "PENDING")
    );

    if (/风险|逾期|快到期|快要|待确认|阻塞|未处理|没人|缺负责人/.test(input)) {
      if (attentionTasks.length === 0) {
        return { message: "✅ 当前管控表里没有明显的逾期、缺负责人或日期待确认事项。" };
      }

      return {
        message: `⚠️ 需要优先处理的管控事项：\n\n${attentionTasks.slice(0, 8).map((task) => {
          const signals = [
            !task.assignee?.trim() ? "缺负责人" : null,
            !task.deadline ? "缺截止日期" : null,
            task.deadline && task.deadline < now ? "已逾期" : null,
            task.deadline && task.deadline <= soon && task.status === "PENDING" ? "即将到期未启动" : null,
          ].filter(Boolean).join("、");
          return `• ${task.name}\n  项目：${task.project.name}｜状态：${task.status}｜负责人：${task.assignee ?? "待确认"}｜部门：${task.department ?? "待确认"}｜截止：${task.deadline ? task.deadline.toLocaleDateString("zh-CN") : "待确认"}｜${signals}`;
        }).join("\n")}`,
        actions: attentionTasks[0]
          ? [{ label: `进入 ${attentionTasks[0].project.name}`, href: `/projects/${attentionTasks[0].project.id}` }]
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
      `• ${project.name}：计划预算 ${formatMoney(project.plannedBudget)}，确认预算 ${formatMoney(project.allocatedBudget)}，已使用 ${formatMoney(project.used)}，结余 ${formatMoney(project.balance)}，支出流水 ${formatMoney(project.expense)}，退款 ${formatMoney(project.refund)}`
    ).join("\n");
    const calendarList = userCalendarEntries.map((entry) =>
      `• [${CALENDAR_STATUS_LABEL[entry.status] ?? entry.status}] ${formatCalendarDate(entry.date)}${entry.startTime ? ` ${entry.startTime}` : ""} · ${entry.content} → 项目: ${entry.project.name} · ${entry.workstream ?? "未分组"} · ${entry.channel ?? "渠道待确认"} · ${entry.owner ?? "负责人待确认"}`
    ).join("\n");
    const attentionList = attentionTasks.slice(0, 12).map((task) =>
      `• [${task.status}] ${task.name} → 项目: ${task.project.name} · 负责人:${task.assignee ?? "待确认"} · 截止:${task.deadline ? task.deadline.toISOString().slice(0, 10) : "待确认"}`
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

需要优先处理的管控事项：
${attentionList || "（无）"}

用户说：${input}

请分析用户意图并返回 JSON。必须优先使用上面的正式项目、任务、预算、执行日历和待处理管控事项。
如果用户想更新进度或状态，请引导用户进入项目管控表直接修改，不要承诺代写入。`;

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
      return { message: `🤔 我不太确定你的意思。\n\n你可以试试这样问我：\n•「Aster X9 国内上市整合传播的预算还有多少」\n•「现在有哪些项目」\n•「哪些事项快到期了」` };
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const intent = parsed.intent as string;

    // 4. 处理查询 — 直接返回 LLM 生成的消息
    if (intent === "query") {
      return {
        message: parsed.message as string,
        actions: parsed.projectName
          ? await getProjectActions(parsed.projectName as string, user)
          : undefined,
      };
    }

    // 5. 未知意图
    return {
      message: `🤔 我不太确定你的意思。\n\n你可以试试：\n• 「U7海外整合营销预算还有多少」— 查看预算\n• 「接下来有哪些执行日历」— 查看排期\n• 「有哪些项目」— 列出项目\n• 「哪些事项逾期或待确认」— 检查需要关注的管控项`,
    };
  } catch (error) {
    console.error("Copilot error:", error);
    return {
      message: "暂时无法完成这个开放式查询。你可以直接问：项目列表、某项目预算、执行日历、逾期或待确认事项。",
    };
  }
}

// 辅助：根据项目名查找项目并返回操作链接
async function getProjectActions(name: string, user: Awaited<ReturnType<typeof requireCurrentUser>>) {
  const project = await prisma.project.findFirst({
    where: {
      name: { contains: name },
      ...readableProjectWhere(user),
    },
    select: { id: true, name: true },
  });
  if (!project) return undefined;
  return [{ label: `进入 ${project.name}`, href: `/projects/${project.id}` }];
}
