"use server";

import mammoth from "mammoth";
import OpenAI from "openai";
import { createHash } from "node:crypto";
import parseXLSXBuffer from "@/lib/xlsx-parser";

// pdf-parse v1.x is CJS; dynamic import resolves module.exports = function
async function parsePDFBuffer(buffer: Buffer): Promise<string> {
  const pdfParse = await import("pdf-parse");
  const data = await (pdfParse as unknown as (b: Buffer) => Promise<{ text: string }>)(buffer);
  return data.text;
}

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/permissions";
import { resolveAIBudgetTaskId } from "@/lib/ai-import-rules";
import type { ActionResult } from "@/actions/types";

// ══ Enriched Types ══

export type AIConfidence = "high" | "medium" | "low";

type AIImportDiagnostics = {
  confidence?: AIConfidence | null;
  sourceRef?: string | null;
  missingFields?: string[];
  conflicts?: string[];
};

export type AIParsedTask = {
  name: string;
  workstream?: string | null;
  description?: string | null;
  assignee?: string | null;
  department?: string | null;
  deadline?: string | null;
  status?: string | null;
  notes?: string | null;
} & AIImportDiagnostics;

export type AIParsedBudgetItem = {
  title: string;
  amount: number | null;
  type?: string | null;
  status?: string | null;
  workstream?: string | null;
  description?: string | null;
  relatedItemName?: string | null;
  /** User-confirmed intent to write this AI candidate as a draft BudgetItem. */
  selected?: boolean;
} & AIImportDiagnostics;

export type AITotalBudgetCandidate = {
  amount: number;
  sourceRef?: string | null;
  confidence?: AIConfidence | null;
  conflicts?: string[];
};

export type AIParsedCalendarEntry = {
  date: string | null;
  startTime?: string | null;
  endTime?: string | null;
  channel?: string | null;
  workstream?: string | null;
  content: string;
  owner?: string | null;
  department?: string | null;
  status?: string | null;
  notes?: string | null;
} & AIImportDiagnostics;

export type AIParsedProject = {
  projectName: string;
  totalBudget: number | null;
  totalBudgetCandidates?: AITotalBudgetCandidate[];
  startDate: string | null;
  endDate: string | null;
  objective?: string | null;
  background?: string | null;
  tasks: AIParsedTask[];
  budgetItems: AIParsedBudgetItem[];
  calendarEntries: AIParsedCalendarEntry[];
  sourceQuality: "clean" | "usable" | "messy" | "unsafe";
  confidence: AIConfidence;
  missingFields: string[];
  conflicts: string[];
  sourceEvidence?: ProjectSourceEvidence | null;
};

export type ProjectSourceEvidence = {
  fileName: string;
  mediaType: string;
  sourceHash: string;
  extractedText: string;
};

export type CreateProjectFromAIDTO = {
  projectName: string;
  totalBudget: number | null;
  totalBudgetCandidates?: AITotalBudgetCandidate[];
  budgetMode: "CONFIRMED" | "PENDING" | "NOT_MANAGED";
  startDate: string | null;
  endDate: string | null;
  tasks: AIParsedTask[];
  budgetItems?: AIParsedBudgetItem[];
  calendarEntries?: AIParsedCalendarEntry[];
  sourceQuality?: AIParsedProject["sourceQuality"];
  confidence?: AIParsedProject["confidence"];
  missingFields?: string[];
  conflicts?: string[];
  sourceEvidence?: ProjectSourceEvidence | null;
};

const SYSTEM_PROMPT = `你是 ShadowPM 的 AI 项目导入引擎。你必须把混乱的 Word/Excel/PDF/文本归一化为 ShadowPM canonical project draft，而不是照抄源表结构。

{
  "projectName": "项目名称",
  "totalBudget": 数字（元，如果是"万"单位请×10000；无法可靠判断则null，不要编造）,
  "totalBudgetCandidates": [{"amount": 数字（元）, "sourceRef": "来源位置", "confidence": "high | medium | low", "conflicts": ["冲突说明"]}],
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "objective": "项目目标/背景，无法判断则null",
  "background": "补充上下文，无法判断则null",
  "tasks": [{
    "workstream": "工作流/模块/执行线，例如公关传播、社媒传播、终端传播",
    "name": "管控事项/交付物名称（必填）",
    "description": "详细描述（表格中的备注/说明列）",
    "assignee": "负责人姓名",
    "department": "负责部门",
    "deadline": "YYYY-MM-DD",
    "status": "PENDING | IN_PROGRESS | COMPLETED",
    "notes": "进度备注/结论",
    "confidence": "high | medium | low",
    "sourceRef": "来源位置，例如 工作表:项目总控表 行12 列C-F",
    "missingFields": ["assignee", "deadline"],
    "conflicts": ["同一事项出现两个负责人"]
  }],
  "budgetItems": [{
    "title": "预算项名称",
    "amount": 数字（元，无法判断则null）,
    "type": "ESTIMATE | ALLOCATE | EXPENSE | REFUND | TRANSFER",
    "status": "DRAFT | PENDING_APPROVAL | APPROVED | IN_PROGRESS | SETTLED | PAUSED | CANCELLED",
    "workstream": "关联工作流",
    "description": "说明",
    "relatedItemName": "关联管控事项名称",
    "confidence": "high | medium | low",
    "sourceRef": "来源位置，例如 工作表:预算 行8",
    "missingFields": ["amount", "type"],
    "conflicts": ["金额可能是总预算也可能是分项预算"]
  }],
  "calendarEntries": [{
    "date": "YYYY-MM-DD",
    "startTime": "HH:mm",
    "endTime": "HH:mm",
    "channel": "渠道/平台/触点",
    "workstream": "传播线/执行线",
    "content": "发布或执行内容",
    "owner": "负责人",
    "department": "负责部门",
    "status": "PLANNED | READY | PUBLISHED | DONE | DELAYED | CANCELLED",
    "notes": "备注",
    "confidence": "high | medium | low",
    "sourceRef": "来源位置，例如 工作表:传播日历 行20 列G",
    "missingFields": ["date", "owner"],
    "conflicts": ["单元格混合人名、渠道和内容，无法完全拆分"]
  }],
  "sourceQuality": "clean | usable | messy | unsafe",
  "confidence": "high | medium | low",
  "missingFields": ["项目级缺失字段，例如 totalBudget/endDate"],
  "conflicts": ["项目级冲突，例如 多个不同总预算"]
}

规则：
1. 预算不属于项目管控总表。源文本中类似"事项-267万"必须拆成 tasks.name="事项" 和 budgetItems.amount=2670000。
2. "预算管理"必须进入 budgetItems。不要把预算管理行生成普通 tasks，除非该行是明确的预算审批动作且没有金额。
3. 不生成独立风险列表。风险、待确定项、问题、阻塞、待确认如果需要被跟进，应进入 tasks，并在 notes 写清楚原因；否则忽略。
4. "公关传播@汤庆爽"应拆为 workstream="公关传播"，assignee/owner="汤庆爽"。
5. 日历矩阵中的人名、渠道、内容要尽量拆开；无法拆清楚则保留content并降低confidence。
6. 日期转为YYYY-MM-DD。只有月份且无年份时，默认2026年。
7. 进度：已完成→COMPLETED，进行中→IN_PROGRESS，待启动→PENDING。
8. 进度备注：表格中"进度或结论"列的内容→notes。
9. 详细描述：表格中"详细描述"列的内容→description。
10. tasks最多30条，budgetItems最多30条，calendarEntries最多30条。
11. 不要编造缺失信息。缺失就返回null或空数组。
12. 只返回 JSON，不要 markdown。
13. 返回紧凑 JSON。不要解释，不要缩进，不要重复字段，不要输出 source 原文。
14. 如果源表很大，优先保留最能代表项目管控、预算、执行日历的高价值条目，避免输出被截断。
15. 日历单元格里的 "/"、"-"、"无"、"待定" 不是执行内容，不要生成 calendarEntries。
16. 每条 task/budgetItem/calendarEntry 都要尽量给 confidence 和 sourceRef；不能定位来源时 sourceRef=null。
17. missingFields 只写可以由用户补齐的字段名；conflicts 只写源数据矛盾或 AI 无法安全判断的信息。
18. totalBudgetCandidates 必须列出每个可能的项目总预算及来源。存在多个可能金额时，不要替用户判断哪一个正确；totalBudget 可为null。`;

const COMPACT_RETRY_PROMPT = `${SYSTEM_PROMPT}

紧急压缩模式：
上一次输出可能过长。现在必须返回一个更小但完整可解析的 JSON。
硬性上限：
- tasks 最多 18 条，只保留关键工作流和关键交付物。
- budgetItems 最多 12 条，优先保留所有明确金额。
- calendarEntries 最多 12 条，优先保留日期/时间/渠道较清晰的节点。
- 待确认、阻塞、权限、审批、排期类信息如需跟进，合并到 tasks.notes。
- 字段值未知就省略该字段或填 null。
- background 可简短说明“源表较大，已生成高置信候选，剩余内容需继续补充”。
必须输出一个完整闭合、可被 JSON.parse 解析的 JSON 对象。`;

const AI_IMPORT_MAX_TOKENS = 8192;

export async function parseDocumentForProject(
  formData: FormData,
  options?: { allowMissingProjectName?: boolean }
): Promise<ActionResult<AIParsedProject>> {
  await requireCurrentUser();

  try {
    let text = "";
    let sourceFileName = "粘贴文本";
    let sourceMediaType = "text/plain";
    const file = formData.get("file") as File | null;
    const pastedText = formData.get("text") as string | null;

    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = file.name.toLowerCase();
      sourceFileName = file.name;
      sourceMediaType = file.type || "application/octet-stream";

      if (fileName.endsWith(".docx")) {
        const result = await mammoth.extractRawText({ buffer });
        text = result.value;
      } else if (fileName.endsWith(".pdf")) {
        text = await parsePDFBuffer(buffer);
      } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        text = parseXLSXBuffer(buffer);
      } else if (fileName.endsWith(".txt") || fileName.endsWith(".md")) {
        text = buffer.toString("utf-8");
      } else {
        return { success: false, message: `不支持的文件类型（${fileName.split(".").pop()}）。支持 .docx / .pdf / .xlsx / .txt` };
      }

      if (!text.trim()) {
        return { success: false, message: "文件内容为空，无法解析。" };
      }
    } else if (pastedText && pastedText.trim()) {
      text = pastedText.trim();
    } else {
      return { success: false, message: "请上传文件或粘贴文本内容" };
    }

    const sourceEvidence: ProjectSourceEvidence = {
      fileName: sourceFileName,
      mediaType: sourceMediaType,
      sourceHash: createHash("sha256").update(text).digest("hex"),
      extractedText: text.slice(0, 12000),
    };

    if (text.length > 25000) {
      text = text.slice(0, 25000) + "\n\n[内容过长，已截断]";
    }

    const openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY!,
      baseURL: "https://api.deepseek.com/v1",
    });

    const parsed = await runProjectImport(openai, text);
    const validated = validateParsedProject(parsed);
    if (!validated.projectName && !options?.allowMissingProjectName) {
      return { success: false, message: "AI 无法从文档中识别项目名称。请尝试粘贴更清晰的文本。" };
    }

    return { success: true, data: { ...validated, sourceEvidence } };
  } catch (error) {
    console.error("parse error:", error);
    return { success: false, message: "AI 解析失败。请重试，或切换到手动创建。" };
  }
}

/**
 * Reuses the safeguarded project parser for a budget-only import surface.
 * It returns reviewable drafts only; persistence is intentionally delegated to
 * createBudgetItems after the user has chosen which rows to retain.
 */
export async function parseBudgetDocument(
  formData: FormData
): Promise<ActionResult<{ items: AIParsedBudgetItem[]; sourceFileName: string }>> {
  const result = await parseDocumentForProject(formData, { allowMissingProjectName: true });
  if (!result.success || !result.data) {
    return { success: false, message: result.message ?? "预算文件解析失败。" };
  }
  const sourceFileName = result.data.sourceEvidence?.fileName ?? "AI 预算文件";
  const items = result.data.budgetItems
    .filter((item) => item.title?.trim() && typeof item.amount === "number" && item.amount > 0)
    .map((item) => ({
      ...item,
      sourceRef: [sourceFileName, item.sourceRef].filter(Boolean).join(" · "),
    }));
  if (items.length === 0) {
    return { success: false, message: "未识别到金额明确的预算项。请改用批量粘贴或手动录入。" };
  }
  return { success: true, message: `已识别 ${items.length} 条预算候选，请确认后写入草稿。`, data: { items, sourceFileName } };
}

async function runProjectImport(openai: OpenAI, text: string): Promise<AIParsedProject> {
  const primary = await requestProjectImport(openai, SYSTEM_PROMPT, text);

  try {
    return parseAIProjectJson(primary.content);
  } catch (error) {
    if (primary.finishReason !== "length" && !isLikelyTruncatedJson(primary.content)) {
      throw error;
    }
  }

  const compact = await requestProjectImport(openai, COMPACT_RETRY_PROMPT, text);
  return parseAIProjectJson(compact.content);
}

async function requestProjectImport(openai: OpenAI, systemPrompt: string, text: string) {
  const response = await openai.chat.completions.create({
    model: "deepseek-chat",
    max_tokens: AI_IMPORT_MAX_TOKENS,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `从以下文档提取项目信息：\n\n---\n${text}\n---` },
    ],
  });

  return {
    content: response.choices[0]?.message?.content ?? "",
    finishReason: response.choices[0]?.finish_reason ?? null,
  };
}

function parseAIProjectJson(content: string): AIParsedProject {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("AI import returned no JSON object");
  }

  return JSON.parse(jsonMatch[0]) as AIParsedProject;
}

function isLikelyTruncatedJson(content: string) {
  const trimmed = content.trim();
  return Boolean(trimmed) && !trimmed.endsWith("}");
}

function normalizeCalendarStatus(status: string | null | undefined) {
  const normalized = status?.trim().toUpperCase() ?? "";
  return ["PLANNED", "CONFIRMED", "DONE", "CANCELED"].includes(normalized)
    ? normalized
    : "PLANNED";
}

export async function createProjectFromAI(
  dto: CreateProjectFromAIDTO
): Promise<ActionResult<{ projectId: string }>> {
  const user = await requireCurrentUser();

  if (!dto.projectName.trim()) {
    return { success: false, message: "项目名称为必填项" };
  }

  const budgetMode = dto.budgetMode;
  if (!["CONFIRMED", "PENDING", "NOT_MANAGED"].includes(budgetMode)) {
    return { success: false, message: "请选择明确预算、预算待确认或不管理预算。" };
  }
  const proposedTotalBudget = typeof dto.totalBudget === "number" && dto.totalBudget > 0
    ? new Prisma.Decimal(dto.totalBudget.toString())
    : new Prisma.Decimal(0);
  if (budgetMode === "CONFIRMED" && proposedTotalBudget.lte(0)) {
    return { success: false, message: "确认项目总预算时，金额必须大于 0。" };
  }

  const totalBudget = budgetMode === "CONFIRMED" ? proposedTotalBudget : new Prisma.Decimal(0);
  const budgetItems = (dto.budgetItems ?? []).filter((item) => item.selected !== false);
  const validBudgetItems = budgetItems.filter(
    (item) => item.title?.trim() && typeof item.amount === "number" && item.amount > 0
  );
  const selectedBudgetTotal = validBudgetItems.reduce(
    (sum, item) => sum.add(new Prisma.Decimal(item.amount!.toString())),
    new Prisma.Decimal(0)
  );
  if (budgetMode === "NOT_MANAGED" && validBudgetItems.length > 0) {
    return { success: false, message: "当前项目不管理预算，请取消预算项写入或改为预算待确认。" };
  }
  if (budgetMode === "CONFIRMED" && selectedBudgetTotal.gt(totalBudget)) {
    return { success: false, message: `已选预算项合计超出项目总预算 ¥${selectedBudgetTotal.sub(totalBudget).toNumber().toLocaleString("zh-CN")}。` };
  }

  const calendarEntries = dto.calendarEntries ?? [];
  const tasksToCreate = dto.tasks.filter((task) => task.name.trim());
  const workstreams = Array.from(
    new Set(
      tasksToCreate
        .map((task) => task.workstream?.trim())
        .filter((workstream): workstream is string => Boolean(workstream))
    )
  );

  const project = await prisma.$transaction(async (tx) => {
    const createdProject = await tx.project.create({
      data: {
        name: dto.projectName.trim(),
        totalBudget,
        budgetMode,
        budgetConfirmedAt: budgetMode === "CONFIRMED" ? new Date() : null,
        // Compatibility only. New budget code reads Project.budgetMode.
        budgetStatus: budgetMode === "CONFIRMED" ? "CONFIRMED" : "UNCONFIRMED",
        ownerId: user.id,
        isExternalProject: user.isExternalTester,
        startDate: dto.startDate ? new Date(dto.startDate + "T00:00:00.000Z") : null,
        endDate: dto.endDate ? new Date(dto.endDate + "T00:00:00.000Z") : null,
      },
    });

    const source = dto.sourceEvidence
      ? await tx.projectSource.create({
          data: {
            projectId: createdProject.id,
            fileName: dto.sourceEvidence.fileName,
            mediaType: dto.sourceEvidence.mediaType,
            sourceHash: dto.sourceEvidence.sourceHash,
            extractedText: dto.sourceEvidence.extractedText,
            uploadedBy: user.name,
          },
        })
      : null;

    const phaseByWorkstream = new Map<string, string>();
    for (let i = 0; i < workstreams.length; i++) {
      const phase = await tx.phase.create({
        data: {
          projectId: createdProject.id,
          name: workstreams[i],
          sortOrder: i,
        },
      });
      phaseByWorkstream.set(workstreams[i], phase.id);
    }

    const createdTasks: Array<{ id: string; name: string; workstream: string | null }> = [];
    for (let i = 0; i < tasksToCreate.length; i++) {
      const t = tasksToCreate[i];
      const workstream = t.workstream?.trim() || null;
      const status = ["PENDING", "IN_PROGRESS", "COMPLETED"].includes(t.status as string)
        ? (t.status as "PENDING" | "IN_PROGRESS" | "COMPLETED")
        : "PENDING";

      const task = await tx.task.create({
        data: {
          projectId: createdProject.id,
          sortOrder: i,
          phaseId: workstream ? phaseByWorkstream.get(workstream) ?? null : null,
          name: t.name.trim(),
          description: t.description?.trim() || null,
          notes: t.notes?.trim() || null,
          assignee: t.assignee?.trim() || null,
          department: t.department?.trim() || null,
          deadline: t.deadline ? new Date(t.deadline + "T00:00:00.000Z") : null,
          status,
          aiConfidence: t.confidence ?? null,
          sourceRef: t.sourceRef ?? null,
          missingFields: t.missingFields ?? [],
          conflicts: t.conflicts ?? [],
          // Imported uncertainty remains in source evidence; it must not lock the editable control table.
          needsConfirmation: false,
        },
      });
      createdTasks.push({ id: task.id, name: task.name, workstream });
    }

    if (budgetMode === "CONFIRMED") {
      await tx.budgetFlow.create({
        data: {
          projectId: createdProject.id,
          flowType: "ALLOCATE",
          operation: "CONFIRM_POOL",
          action: "POOL_CONFIRMED",
          amount: totalBudget,
          description: "AI 导入确认项目预算池",
          createdBy: user.name,
        },
      });
    }

    const createdBudgetItems: { id: string; title: string; amount: number; taskId: string | null }[] = [];
    for (const item of validBudgetItems) {
      const taskId = resolveAIBudgetTaskId({
        title: item.title,
        relatedItemName: item.relatedItemName,
        workstream: item.workstream,
        tasks: createdTasks,
      });
      const budgetItem = await tx.budgetItem.create({
        data: {
          projectId: createdProject.id,
          title: item.title.trim(),
          plannedAmount: new Prisma.Decimal(item.amount!.toString()),
          category: item.workstream?.trim() || item.type?.trim() || null,
          description: item.description?.trim() || null,
          status: "DRAFT",
          source: "AI_IMPORT",
          aiConfidence: item.confidence ?? null,
          sourceRef: item.sourceRef ?? null,
          createdBy: user.name,
          taskRelations: taskId ? { create: { taskId } } : undefined,
        },
      });
      createdBudgetItems.push({ id: budgetItem.id, title: budgetItem.title, amount: item.amount!, taskId });
    }

    const createdCalendarEntries: { id: string; content: string }[] = [];
    for (const entry of calendarEntries.filter((item) => item.content?.trim())) {
      const calendarEntry = await tx.executionCalendarEntry.create({
        data: {
          projectId: createdProject.id,
          taskId: null,
          date: entry.date ? new Date(`${entry.date}T00:00:00.000Z`) : null,
          startTime: entry.startTime?.trim() || null,
          endTime: entry.endTime?.trim() || null,
          channel: entry.channel?.trim() || null,
          workstream: entry.workstream?.trim() || null,
          content: entry.content.trim(),
          owner: entry.owner?.trim() || null,
          department: entry.department?.trim() || null,
          status: normalizeCalendarStatus(entry.status),
          notes: entry.notes?.trim() || null,
          source: "AI_IMPORT",
          createdBy: user.name,
        },
      });
      createdCalendarEntries.push({ id: calendarEntry.id, content: entry.content.trim() });
    }

    await tx.activityLog.create({
      data: {
        projectId: createdProject.id,
        targetType: "PROJECT",
        targetId: createdProject.id,
        changeType: "IMPORT",
        source: "AI",
        createdBy: user.name,
        summary: [
          "AI 导入已生成项目管控工作区",
          `管控事项：${createdTasks.length} 条`,
          budgetMode === "CONFIRMED" ? `已确认预算池：¥${totalBudget.toNumber().toLocaleString("zh-CN")}` : budgetMode === "PENDING" ? "预算池待确认" : "本项目不管理预算",
          createdBudgetItems.length > 0 ? `预算草稿：${createdBudgetItems.length} 条` : null,
          (dto.budgetItems?.length ?? 0) > createdBudgetItems.length ? `未写入预算候选：${(dto.budgetItems?.length ?? 0) - createdBudgetItems.length} 条` : null,
          createdCalendarEntries.length > 0 ? `执行日历：${createdCalendarEntries.length} 条` : null,
          source ? `来源证据：${source.fileName}` : null,
        ].filter(Boolean).join("\n"),
        afterState: {
          sourceId: source?.id ?? null,
          budgetItemIds: createdBudgetItems.map((item) => item.id),
          calendarEntryIds: createdCalendarEntries.map((entry) => entry.id),
          importDiagnostics: {
            sourceQuality: dto.sourceQuality ?? null,
            confidence: dto.confidence ?? null,
            missingFields: dto.missingFields ?? [],
            conflicts: dto.conflicts ?? [],
            lowConfidenceTasks: tasksToCreate
              .filter((task) => task.confidence === "low")
              .map((task) => ({
                name: task.name,
                sourceRef: task.sourceRef ?? null,
                missingFields: task.missingFields ?? [],
                conflicts: task.conflicts ?? [],
              })),
            deferredBudgetItems: (dto.budgetItems ?? [])
              .filter((item) => item.selected === false || item.confidence !== "high" || (item.conflicts?.length ?? 0) > 0)
              .map((item) => ({
                title: item.title,
                amount: item.amount ?? null,
                type: item.type ?? null,
                status: item.status ?? null,
                sourceRef: item.sourceRef ?? null,
                missingFields: item.missingFields ?? [],
                conflicts: item.conflicts ?? [],
              })),
            lowConfidenceCalendarEntries: calendarEntries
              .filter((entry) => entry.confidence === "low")
              .map((entry) => ({
                content: entry.content,
                sourceRef: entry.sourceRef ?? null,
                missingFields: entry.missingFields ?? [],
                conflicts: entry.conflicts ?? [],
              })),
          },
        },
      },
    });

    return createdProject;
  });

  return { success: true, message: `项目「${dto.projectName}」创建成功`, data: { projectId: project.id } };
}

function validateParsedProject(parsed: AIParsedProject): AIParsedProject {
  const totalBudgetCandidates = (Array.isArray(parsed.totalBudgetCandidates) ? parsed.totalBudgetCandidates : [])
    .filter((candidate) => typeof candidate?.amount === "number" && Number.isFinite(candidate.amount) && candidate.amount > 0)
    .map((candidate) => ({
      amount: candidate.amount,
      sourceRef: normalizeOptionalText(candidate.sourceRef),
      confidence: normalizeConfidence(candidate.confidence),
      conflicts: normalizeStringList(candidate.conflicts),
    }));
  const normalizedTotalBudget = typeof parsed.totalBudget === "number" && !isNaN(parsed.totalBudget) && parsed.totalBudget > 0
    ? parsed.totalBudget
    : totalBudgetCandidates.length === 1
      ? totalBudgetCandidates[0].amount
      : null;
  if (normalizedTotalBudget && !totalBudgetCandidates.some((candidate) => candidate.amount === normalizedTotalBudget)) {
    totalBudgetCandidates.unshift({
      amount: normalizedTotalBudget,
      sourceRef: null,
      confidence: normalizeConfidence(parsed.confidence),
      conflicts: [],
    });
  }
  const budgetItems = (Array.isArray(parsed.budgetItems) ? parsed.budgetItems : [])
    .filter((item) => item?.title?.trim())
    .map((item) => {
      const normalized = {
        title: item.title.trim(),
        amount: typeof item.amount === "number" && !isNaN(item.amount) ? item.amount : null,
        type: item.type?.trim() || null,
        status: item.status?.trim() || null,
        workstream: item.workstream?.trim() || null,
        description: item.description?.trim() || null,
        relatedItemName: item.relatedItemName?.trim() || null,
        confidence: normalizeConfidence(item.confidence),
        sourceRef: normalizeOptionalText(item.sourceRef),
        missingFields: normalizeStringList(item.missingFields),
        conflicts: normalizeStringList(item.conflicts),
      };
      const missingFields = withDerivedMissingFields(normalized.missingFields, {
        amount: normalized.amount,
        type: normalized.type,
        relatedItemName: normalized.relatedItemName,
      });
      return {
        ...normalized,
        confidence: normalized.confidence ?? inferConfidence(missingFields, normalized.conflicts),
        missingFields,
      };
    })
    .slice(0, 30);

  const budgetNames = new Set(
    budgetItems.flatMap((item) => [item.title, item.relatedItemName].filter(Boolean) as string[])
  );

  const tasks = (Array.isArray(parsed.tasks) ? parsed.tasks : [])
    .filter((t) => t?.name?.trim())
    .map((t) => {
      const normalized = {
        workstream: t.workstream?.trim() || null,
        name: t.name.trim(),
        description: t.description?.trim() || null,
        notes: t.notes?.trim() || null,
        assignee: t.assignee?.trim() || null,
        department: t.department?.trim() || null,
        deadline: isValidDateStr(t.deadline) ? t.deadline : null,
        status: ["PENDING", "IN_PROGRESS", "COMPLETED"].includes(t.status as string) ? (t.status as string) : null,
        confidence: normalizeConfidence(t.confidence),
        sourceRef: normalizeOptionalText(t.sourceRef),
        missingFields: normalizeStringList(t.missingFields),
        conflicts: normalizeStringList(t.conflicts),
      };
      const missingFields = withDerivedMissingFields(normalized.missingFields, {
        assignee: normalized.assignee,
        department: normalized.department,
        deadline: normalized.deadline,
        status: normalized.status,
      });
      return {
        ...normalized,
        confidence: normalized.confidence ?? inferConfidence(missingFields, normalized.conflicts),
        missingFields,
      };
    })
    .filter((task) => !isBudgetOnlyTask(task, budgetNames))
    .slice(0, 30);

  const calendarEntries = (Array.isArray(parsed.calendarEntries) ? parsed.calendarEntries : [])
    .filter((entry) => isMeaningfulCandidateText(entry?.content))
    .map((entry) => {
      const normalized = {
        date: isValidDateStr(entry.date) ? entry.date : null,
        startTime: isValidTimeStr(entry.startTime) ? entry.startTime : null,
        endTime: isValidTimeStr(entry.endTime) ? entry.endTime : null,
        channel: entry.channel?.trim() || null,
        workstream: entry.workstream?.trim() || null,
        content: entry.content.trim(),
        owner: entry.owner?.trim() || null,
        department: entry.department?.trim() || null,
        status: entry.status?.trim() || null,
        notes: entry.notes?.trim() || null,
        confidence: normalizeConfidence(entry.confidence),
        sourceRef: normalizeOptionalText(entry.sourceRef),
        missingFields: normalizeStringList(entry.missingFields),
        conflicts: normalizeStringList(entry.conflicts),
      };
      const missingFields = withDerivedMissingFields(normalized.missingFields, {
        date: normalized.date,
        channel: normalized.channel,
        owner: normalized.owner,
      });
      return {
        ...normalized,
        confidence: normalized.confidence ?? inferConfidence(missingFields, normalized.conflicts),
        missingFields,
      };
    })
    .slice(0, 30);

  const projectMissingFields = withDerivedMissingFields(normalizeStringList(parsed.missingFields), {
    projectName: parsed.projectName?.trim() || null,
    totalBudget: normalizedTotalBudget,
    startDate: isValidDateStr(parsed.startDate) ? parsed.startDate : null,
    endDate: isValidDateStr(parsed.endDate) ? parsed.endDate : null,
  });
  const projectConflicts = normalizeStringList(parsed.conflicts);

  return {
    projectName: parsed.projectName?.trim() || "",
    totalBudget: normalizedTotalBudget,
    totalBudgetCandidates,
    startDate: isValidDateStr(parsed.startDate) ? parsed.startDate : null,
    endDate: isValidDateStr(parsed.endDate) ? parsed.endDate : null,
    objective: parsed.objective?.trim() || null,
    background: parsed.background?.trim() || null,
    tasks,
    budgetItems,
    calendarEntries,
    sourceQuality: ["clean", "usable", "messy", "unsafe"].includes(parsed.sourceQuality) ? parsed.sourceQuality : "messy",
    confidence: normalizeConfidence(parsed.confidence) ?? inferConfidence(projectMissingFields, projectConflicts),
    missingFields: projectMissingFields,
    conflicts: projectConflicts,
  };
}

function isBudgetOnlyTask(
  task: Pick<AIParsedTask, "name" | "workstream" | "description" | "notes">,
  budgetNames: Set<string>
) {
  const text = [task.workstream, task.name, task.description, task.notes].filter(Boolean).join(" ");
  const isBudgetLane = /预算|费用|采购报批|报批中/.test(text);
  const hasExplicitBudgetMatch = budgetNames.has(task.name);
  return isBudgetLane && hasExplicitBudgetMatch;
}

function normalizeConfidence(value: unknown): AIConfidence | null {
  return value === "high" || value === "medium" || value === "low" ? value : null;
}

function normalizeOptionalText(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeStringList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  ).slice(0, 6);
}

function withDerivedMissingFields(
  existing: string[],
  fields: Record<string, string | number | null | undefined>
) {
  const missing = new Set(existing);
  for (const [field, value] of Object.entries(fields)) {
    if (value === null || value === undefined || value === "") {
      missing.add(field);
    }
  }
  return Array.from(missing).slice(0, 8);
}

function inferConfidence(missingFields: string[], conflicts: string[]): AIConfidence {
  if (conflicts.length > 0 || missingFields.length >= 3) return "low";
  if (missingFields.length > 0) return "medium";
  return "high";
}

function isValidDateStr(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function isValidTimeStr(s: unknown): s is string {
  return typeof s === "string" && /^\d{1,2}:\d{2}$/.test(s);
}

function isMeaningfulCandidateText(value: unknown) {
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  return Boolean(normalized) && !["/", "-", "无", "待定", "N/A", "n/a"].includes(normalized);
}
