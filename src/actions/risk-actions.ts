"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertCanReadProject, assertCanWriteProject } from "@/lib/permissions";
import type { ActionResult } from "@/actions/types";

const RISK_STATUSES = ["OPEN", "ACKNOWLEDGED", "MITIGATED", "CLOSED"] as const;

const STATUS_LABEL: Record<string, string> = {
  OPEN: "未处理",
  ACKNOWLEDGED: "已知悉",
  MITIGATED: "已缓解",
  CLOSED: "已关闭",
};

export async function getProjectRisks(projectId: string) {
  await assertCanReadProject(projectId);

  return prisma.risk.findMany({
    where: { projectId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

export async function updateRiskStatus(formData: FormData): Promise<ActionResult> {
  const riskId = formData.get("riskId") as string;
  const statusRaw = formData.get("status") as string;
  const status = RISK_STATUSES.includes(statusRaw as (typeof RISK_STATUSES)[number])
    ? statusRaw
    : null;

  if (!riskId || !status) {
    return { success: false, message: "风险和状态为必填项" };
  }

  const risk = await prisma.risk.findUnique({
    where: { id: riskId },
    select: { id: true, projectId: true, title: true, status: true, level: true, type: true },
  });
  if (!risk) return { success: false, message: "风险不存在" };
  const user = await assertCanWriteProject(risk.projectId);
  if (risk.status === status) return { success: true, message: "状态未变化" };

  await prisma.$transaction(async (tx) => {
    await tx.risk.update({
      where: { id: riskId },
      data: { status },
    });

    await tx.activityLog.create({
      data: {
        projectId: risk.projectId,
        targetType: "RISK",
        targetId: risk.id,
        changeType: "STATUS_CHANGE",
        source: "HUMAN",
        createdBy: user.name,
        summary: [
          `⚠️ 项目风险状态变更：${risk.title ?? risk.type}`,
          `状态：${STATUS_LABEL[risk.status] ?? risk.status} → ${STATUS_LABEL[status] ?? status}`,
          `等级：${risk.level}｜类型：${risk.type}`,
        ].join("\n"),
        beforeState: { status: risk.status },
        afterState: { status },
      },
    });
  });

  revalidatePath(`/projects/${risk.projectId}`);
  return { success: true, message: `风险状态已更新：${risk.title ?? risk.id}` };
}
