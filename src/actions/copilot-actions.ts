"use server";

import OpenAI from "openai";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { assertCanWriteTask, requireCurrentUser } from "@/lib/permissions";
import { calculateBudgetSnapshot } from "@/lib/budget";

export type CopilotResponse = {
  message: string;
  actions?: { label: string; href: string }[];
};

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
  "taskName": "用户提到的管控事项名称（精确提取，用于匹配数据库）",
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

export async function processCopilotMessage(input: string): Promise<CopilotResponse> {
  const user = await requireCurrentUser();

  if (!input.trim()) return { message: "请输入内容" };

  try {
    // 1. 查询用户相关的项目和任务上下文
    const [userProjects, userTasks] = await Promise.all([
      prisma.project.findMany({
        where: user.role === "LEADER" ? {} : { ownerId: user.id },
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
          ...(user.role === "LEADER"
            ? {}
            : {
                project: { ownerId: user.id },
              }),
          OR: user.role === "LEADER"
            ? [
                { assignee: user.name },
                { project: { ownerId: user.id } },
              ]
            : undefined,
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
      const flows = project.tasks.flatMap((task) => task.budgets);
      const allocated = flows
        .filter((flow) => flow.flowType === "ALLOCATE")
        .reduce((sum, flow) => sum.add(flow.amount), new Prisma.Decimal(0));
      const expense = flows
        .filter((flow) => flow.flowType === "EXPENSE")
        .reduce((sum, flow) => sum.add(flow.amount), new Prisma.Decimal(0));
      const refund = flows
        .filter((flow) => flow.flowType === "REFUND")
        .reduce((sum, flow) => sum.add(flow.amount), new Prisma.Decimal(0));
      const budget = calculateBudgetSnapshot({
        plannedBudget: project.totalBudget,
        allocated,
        expense,
        refund,
      });

      return {
        id: project.id,
        name: project.name,
        plannedBudget: budget.plannedBudget.toNumber(),
        allocatedBudget: budget.allocated.toNumber(),
        balance: budget.balance.toNumber(),
        used: budget.consumed.toNumber(),
        expense: budget.expense.toNumber(),
        refund: budget.refund.toNumber(),
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

请分析用户意图并返回 JSON。如果是操作，taskName 必须从上面正在进行中的任务列表中精确匹配。如果是查询，必须优先使用上面的正式项目、任务、预算、执行日历和待处理管控事项。`;

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
      return { message: `🤔 我不太确定你的意思。\n\n你可以试试这样问我：\n•「仰望一万台的预算还有多少」\n•「公关通稿已经写完了」\n•「有哪些项目」\n•「哪些事项快到期了」` };
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
          message: `❌ 没找到名为「${parsed.taskName}」的管控事项。\n\n你当前的管控事项列表：\n${taskList || "（无）"}\n\n请确认事项名称后再试。`,
        };
      }

      if (parsed.action === "update_status" && parsed.newStatus) {
        await assertCanWriteTask(matchedTask.id);
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
        await assertCanWriteTask(matchedTask.id);
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
          ? await getProjectActions(parsed.projectName as string, user)
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
async function getProjectActions(name: string, user: Awaited<ReturnType<typeof requireCurrentUser>>) {
  const project = await prisma.project.findFirst({
    where: {
      name: { contains: name },
      ...(user.role === "LEADER" ? {} : { ownerId: user.id }),
    },
    select: { id: true, name: true },
  });
  if (!project) return undefined;
  return [{ label: `进入 ${project.name}`, href: `/projects/${project.id}` }];
}
