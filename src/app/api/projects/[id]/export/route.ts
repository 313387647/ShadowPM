import * as XLSX from "xlsx";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { assertCanReadProject } from "@/lib/permissions";
import { BUDGET_OPERATION_MAP, TASK_STATUS_MAP } from "@/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  try {
    await assertCanReadProject(params.id);
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        owner: { select: { name: true } },
        tasks: {
          include: {
            phase: { select: { name: true } },
            logs: { orderBy: { createdAt: "desc" } },
            budgets: { orderBy: { createdAt: "asc" } },
          },
          orderBy: [{ phaseId: "asc" }, { deadline: "asc" }],
        },
        calendarEntries: { orderBy: [{ date: "asc" }, { createdAt: "asc" }] },
        budgetFlows: { include: { task: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
        activityLogs: { orderBy: { createdAt: "desc" }, take: 200 },
        sources: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });

    const workbook = XLSX.utils.book_new();
    appendSheet(workbook, "项目信息", [{
      项目名称: project.name,
      主负责人: project.owner.name,
      项目预算池: project.totalBudget.toNumber(),
      预算池状态: project.budgetStatus,
      开始日期: formatDate(project.startDate),
      结束日期: formatDate(project.endDate),
      管控事项数: project.tasks.length,
      导出时间: new Date().toLocaleString("zh-CN"),
    }], [28, 14, 16, 14, 14, 12, 22]);

    appendSheet(workbook, "项目管控总表", project.tasks.map((task) => ({
      工作流: task.phase?.name ?? "",
      管控事项: task.name,
      详细描述: task.description ?? "",
      负责人: task.assignee ?? "",
      负责部门: task.department ?? "",
      截止日期: formatDate(task.deadline),
      状态: TASK_STATUS_MAP[task.status],
      优先级: task.priority,
      进度或结论: task.notes ?? "",
      是否待确认: task.needsConfirmation ? "是" : "否",
      来源定位: task.sourceRef ?? "",
    })), [16, 30, 42, 14, 16, 14, 12, 10, 42, 12, 32]);

    appendSheet(workbook, "预算管控表", project.tasks.map((task) => ({
      管控事项: task.name,
      当前预算: task.budgetAmount.toNumber(),
      预算状态: task.budgetStatus,
      划拨对象: task.budgetRecipient ?? "",
    })), [30, 16, 16, 24]);

    appendSheet(workbook, "预算变更记录", project.budgetFlows.map((flow) => ({
      管控事项: flow.task?.name ?? "项目预算池",
      业务动作: BUDGET_OPERATION_MAP[flow.operation as keyof typeof BUDGET_OPERATION_MAP] ?? flow.operation,
      流水类型: flow.flowType,
      金额: flow.amount.toNumber(),
      对方: flow.counterparty ?? "",
      事由: flow.description,
      记录人: flow.createdBy,
      记录时间: flow.createdAt.toLocaleString("zh-CN"),
    })), [28, 16, 12, 16, 24, 42, 14, 22]);

    appendSheet(workbook, "执行日历", project.calendarEntries.map((entry) => ({
      日期: formatDate(entry.date),
      开始时间: entry.startTime ?? "",
      结束时间: entry.endTime ?? "",
      工作流: entry.workstream ?? "",
      渠道: entry.channel ?? "",
      执行内容: entry.content,
      负责人: entry.owner ?? "",
      部门: entry.department ?? "",
      状态: entry.status,
      备注: entry.notes ?? "",
    })), [14, 12, 12, 16, 16, 42, 14, 16, 12, 30]);

    appendSheet(workbook, "进度变更记录", project.tasks.flatMap((task) => task.logs.map((log) => ({
      管控事项: task.name,
      更新内容: log.content,
      更新人: log.createdBy,
      更新时间: log.createdAt.toLocaleString("zh-CN"),
    }))), [30, 56, 14, 22]);

    appendSheet(workbook, "项目活动", project.activityLogs.map((log) => ({
      时间: log.createdAt.toLocaleString("zh-CN"),
      对象: log.targetType,
      动作: log.changeType,
      摘要: log.summary,
      来源: log.source,
      操作人: log.createdBy,
    })), [22, 16, 16, 52, 12, 14]);

    appendSheet(workbook, "来源证据", project.sources.map((source) => ({
      文件名: source.fileName,
      类型: source.mediaType,
      上传人: source.uploadedBy,
      上传时间: source.createdAt.toLocaleString("zh-CN"),
      内容哈希: source.sourceHash,
    })), [36, 24, 14, 22, 68]);

    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer", compression: true });
    const safeName = project.name.replace(/[\\/:*?"<>|]/g, "-");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${safeName}-项目管控工作簿.xlsx`)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("project export failed:", error);
    return NextResponse.json({ error: "无权导出该项目或导出失败" }, { status: 403 });
  }
}

function appendSheet(workbook: XLSX.WorkBook, name: string, rows: Record<string, unknown>[], widths: number[]) {
  const sheet = XLSX.utils.json_to_sheet(rows.length > 0 ? rows : [{ 提示: "暂无数据" }]);
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "";
}
