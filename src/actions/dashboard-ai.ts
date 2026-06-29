"use server";

import OpenAI from "openai";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/permissions";

export async function generateDashboardSummary(): Promise<string | null> {
  const user = await requireCurrentUser();
  if (user.role !== "LEADER") return null;

  try {
    const now = new Date();

    const [projects, taskAgg, allocAgg, expenseAgg, refundAgg, overdueCount] = await Promise.all([
      prisma.project.findMany({
        select: {
          name: true, totalBudget: true,
          _count: { select: { tasks: true } },
          tasks: { select: { status: true, deadline: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.task.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.budgetFlow.aggregate({
        _sum: { amount: true },
        where: { flowType: "ALLOCATE" },
      }),
      prisma.budgetFlow.aggregate({
        _sum: { amount: true },
        where: { flowType: "EXPENSE" },
      }),
      prisma.budgetFlow.aggregate({
        _sum: { amount: true },
        where: { flowType: "REFUND" },
      }),
      prisma.task.count({
        where: { deadline: { lt: now }, status: { not: "COMPLETED" } },
      }),
    ]);

    if (projects.length === 0) return null;

    const plannedBudget = projects.reduce((s, p) => s.add(p.totalBudget), new Prisma.Decimal(0));
    const totalAllocated = allocAgg._sum.amount ?? new Prisma.Decimal(0);
    const totalExpense = (expenseAgg._sum.amount ?? new Prisma.Decimal(0)).abs();
    const totalRefund = refundAgg._sum.amount ?? new Prisma.Decimal(0);
    const consumed = totalExpense.sub(totalRefund);

    const pending = taskAgg.find((g) => g.status === "PENDING")?._count.id ?? 0;
    const inProgress = taskAgg.find((g) => g.status === "IN_PROGRESS")?._count.id ?? 0;
    const completed = taskAgg.find((g) => g.status === "COMPLETED")?._count.id ?? 0;

    const projectLines = projects.map((p) => {
      const completedTasks = p.tasks.filter((t) => t.status === "COMPLETED").length;
      const total = p._count.tasks;
      const progress = total > 0 ? Math.round((completedTasks / total) * 100) : 0;
      return `• ${p.name}：${progress}% 完成（${completedTasks}/${total}）`;
    }).join("\n");

    const prompt = `你是 ShadowPM 的 Dashboard AI 摘要助手。请根据以下团队数据，用 3-5 句简洁的中文生成今日项目状态摘要。

要点：
- 语气亲切专业，像团队助理
- 突出最关键的信息（风险、进度、超支）
- 如果有逾期任务，必须提到
- 如果用"万"单位更易读，可以这样表达
- 控制在 150 字以内

数据：
• 总项目数：${projects.length}
• 计划预算：¥${plannedBudget.toNumber().toLocaleString()}
• 已确认预算池：¥${totalAllocated.toNumber().toLocaleString()}
• 已使用：¥${consumed.toNumber().toLocaleString()}
• 待启动任务：${pending} | 进行中：${inProgress} | 已完成：${completed}
• 逾期未完成：${overdueCount} 个
• 各项目进度：
${projectLines}

请直接返回摘要文字，不要 JSON，不要 markdown。`;

    const openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY!,
      baseURL: "https://api.deepseek.com/v1",
    });

    const response = await openai.chat.completions.create({
      model: "deepseek-chat",
      max_tokens: 300,
      messages: [
        { role: "system", content: "你是 ShadowPM 的 AI 摘要助手。请用简洁的中文生成项目状态摘要，控制在 3-5 句话、150 字以内。" },
        { role: "user", content: prompt },
      ],
    });

    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
}
