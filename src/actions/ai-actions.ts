"use server";

import mammoth from "mammoth";
import OpenAI from "openai";
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
} & AIImportDiagnostics;

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

export type AIParsedRisk = {
  title: string;
  description?: string | null;
  type?: string | null;
  level?: string | null;
  status?: string | null;
  owner?: string | null;
  relatedItemName?: string | null;
};

export type AIParsedProject = {
  projectName: string;
  totalBudget: number | null;
  startDate: string | null;
  endDate: string | null;
  objective?: string | null;
  background?: string | null;
  tasks: AIParsedTask[];
  budgetItems: AIParsedBudgetItem[];
  calendarEntries: AIParsedCalendarEntry[];
  risks: AIParsedRisk[];
  sourceQuality: "clean" | "usable" | "messy" | "unsafe";
  confidence: AIConfidence;
  missingFields: string[];
  conflicts: string[];
};

export type CreateProjectFromAIDTO = {
  projectName: string;
  totalBudget: number | null;
  startDate: string | null;
  endDate: string | null;
  tasks: AIParsedTask[];
  budgetItems?: AIParsedBudgetItem[];
  calendarEntries?: AIParsedCalendarEntry[];
  risks?: AIParsedRisk[];
  sourceQuality?: AIParsedProject["sourceQuality"];
  confidence?: AIParsedProject["confidence"];
  missingFields?: string[];
  conflicts?: string[];
  createBudgetFlow: boolean;
};

type CreatedTaskRef = {
  id: string;
  name: string;
  workstream: string | null;
};

const SYSTEM_PROMPT = `你是 ShadowPM 的 AI 项目导入引擎。你必须把混乱的 Word/Excel/PDF/文本归一化为 ShadowPM canonical project draft，而不是照抄源表结构。

{
  "projectName": "项目名称",
  "totalBudget": 数字（元，如果是"万"单位请×10000；无法可靠判断则null，不要编造）,
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
  "risks": [],
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
17. missingFields 只写可以由用户补齐的字段名；conflicts 只写源数据矛盾或 AI 无法安全判断的信息。`;

const COMPACT_RETRY_PROMPT = `${SYSTEM_PROMPT}

紧急压缩模式：
上一次输出可能过长。现在必须返回一个更小但完整可解析的 JSON。
硬性上限：
- tasks 最多 18 条，只保留关键工作流和关键交付物。
- budgetItems 最多 12 条，优先保留所有明确金额。
- calendarEntries 最多 12 条，优先保留日期/时间/渠道较清晰的节点。
- risks 必须返回空数组；待确认、阻塞、权限、审批、排期类信息如需跟进，合并到 tasks.notes。
- 字段值未知就省略该字段或填 null。
- background 可简短说明“源表较大，已生成高置信候选，剩余内容需继续补充”。
必须输出一个完整闭合、可被 JSON.parse 解析的 JSON 对象。`;

const AI_IMPORT_MAX_TOKENS = 8192;

export async function parseDocumentForProject(
  formData: FormData
): Promise<ActionResult<AIParsedProject>> {
  await requireCurrentUser();

  try {
    let text = "";
    const file = formData.get("file") as File | null;
    const pastedText = formData.get("text") as string | null;

    if (file && file.size > 0) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const fileName = file.name.toLowerCase();

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

    if (text.length > 25000) {
      text = text.slice(0, 25000) + "\n\n[内容过长，已截断]";
    }

    const openai = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY!,
      baseURL: "https://api.deepseek.com/v1",
    });

    const parsed = await runProjectImport(openai, text);
    const validated = validateParsedProject(parsed);
    if (!validated.projectName) {
      return { success: false, message: "AI 无法从文档中识别项目名称。请尝试粘贴更清晰的文本。" };
    }

    return { success: true, data: validated };
  } catch (error) {
    console.error("parse error:", error);
    return { success: false, message: "AI 解析失败。请重试，或切换到手动创建。" };
  }
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

function findRelatedTaskId(
  candidate: { title?: string | null; relatedItemName?: string | null; workstream?: string | null },
  tasks: CreatedTaskRef[],
  fallbackTaskId: string | null
) {
  const tokens = [candidate.relatedItemName, candidate.title, candidate.workstream]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));

  for (const token of tokens) {
    const exact = tasks.find((task) => task.name === token || task.workstream === token);
    if (exact) return exact.id;
  }

  for (const token of tokens) {
    const fuzzy = tasks.find((task) => task.name.includes(token) || token.includes(task.name));
    if (fuzzy) return fuzzy.id;
  }

  return fallbackTaskId;
}

export async function createProjectFromAI(
  dto: CreateProjectFromAIDTO
): Promise<ActionResult<{ projectId: string }>> {
  const user = await requireCurrentUser();

  if (!dto.projectName.trim()) {
    return { success: false, message: "项目名称为必填项" };
  }

  const confirmedTotalBudget =
    typeof dto.totalBudget === "number" && dto.totalBudget > 0
      ? new Prisma.Decimal(dto.totalBudget.toString())
      : new Prisma.Decimal(0);
  const budgetItems = dto.budgetItems ?? [];
  const calendarEntries = dto.calendarEntries ?? [];

  const tasksToCreate = dto.tasks.filter((task) => task.name.trim());
  if (tasksToCreate.length === 0) {
    tasksToCreate.push({
      name: "项目统筹",
      assignee: user.name,
      department: null,
      deadline: null,
      description: "AI 未识别到明确管控事项，先创建统筹行，后续可在管控表中补充。",
      notes: null,
      status: "IN_PROGRESS",
    });
  }
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
        totalBudget: confirmedTotalBudget,
        ownerId: user.id,
        startDate: dto.startDate ? new Date(dto.startDate + "T00:00:00.000Z") : null,
        endDate: dto.endDate ? new Date(dto.endDate + "T00:00:00.000Z") : null,
      },
    });

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

    const createdTasks: CreatedTaskRef[] = [];
    let firstTaskId: string | null = null;
    for (let i = 0; i < tasksToCreate.length; i++) {
      const t = tasksToCreate[i];
      const workstream = t.workstream?.trim() || null;
      const status = ["PENDING", "IN_PROGRESS", "COMPLETED"].includes(t.status as string)
        ? (t.status as "PENDING" | "IN_PROGRESS" | "COMPLETED")
        : "PENDING";

      const task = await tx.task.create({
        data: {
          projectId: createdProject.id,
          phaseId: workstream ? phaseByWorkstream.get(workstream) ?? null : null,
          name: t.name.trim(),
          description: t.description?.trim() || null,
          notes: t.notes?.trim() || null,
          assignee: t.assignee?.trim() || null,
          department: t.department?.trim() || null,
          deadline: t.deadline ? new Date(t.deadline + "T00:00:00.000Z") : null,
          status,
        },
      });
      if (i === 0) firstTaskId = task.id;
      createdTasks.push({ id: task.id, name: task.name, workstream });
    }

    const validBudgetItems = budgetItems.filter(
      (item) => item.title?.trim() && typeof item.amount === "number" && item.amount > 0
    );

    if (dto.createBudgetFlow && confirmedTotalBudget.gt(0) && firstTaskId && validBudgetItems.length === 0) {
      await tx.budgetFlow.create({
        data: {
          taskId: firstTaskId,
          flowType: "ALLOCATE",
          operation: "CONFIRM",
          amount: confirmedTotalBudget,
          description: `「${dto.projectName}」项目预算确定`,
          createdBy: user.name,
        },
      });
    }

    const createdBudgetFlows: { id: string; title: string; amount: number; taskId: string }[] = [];
    for (const item of validBudgetItems) {
      const taskId = findRelatedTaskId(item, createdTasks, firstTaskId);
      if (!taskId || typeof item.amount !== "number") continue;

      const flow = await tx.budgetFlow.create({
        data: {
          taskId,
          flowType: "ALLOCATE",
          operation: "ALLOCATE",
          amount: new Prisma.Decimal(item.amount.toString()),
          description: `AI 导入预算：${item.title.trim()}${item.description ? `｜${item.description.trim()}` : ""}`,
          createdBy: user.name,
        },
      });
      createdBudgetFlows.push({ id: flow.id, title: item.title.trim(), amount: item.amount, taskId });
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

    if (createdBudgetFlows.length > 0 || createdCalendarEntries.length > 0) {
      await tx.activityLog.create({
        data: {
          projectId: createdProject.id,
          targetType: "PROJECT",
          targetId: createdProject.id,
          changeType: "IMPORT",
          source: "AI",
          createdBy: user.name,
          summary: [
            "🤖 AI 导入已自动生成项目三件套",
            createdBudgetFlows.length > 0 ? `预算流水：${createdBudgetFlows.length} 条` : null,
            createdCalendarEntries.length > 0 ? `执行日历：${createdCalendarEntries.length} 条` : null,
          ].filter(Boolean).join("\n"),
          afterState: {
            budgetFlowIds: createdBudgetFlows.map((flow) => flow.id),
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
              lowConfidenceBudgetItems: budgetItems
                .filter((item) => item.confidence === "low")
                .map((item) => ({
                  title: item.title,
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
    }

    return createdProject;
  });

  return { success: true, message: `项目「${dto.projectName}」创建成功`, data: { projectId: project.id } };
}

function validateParsedProject(parsed: AIParsedProject): AIParsedProject {
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
    totalBudget: typeof parsed.totalBudget === "number" && !isNaN(parsed.totalBudget) ? parsed.totalBudget : null,
    startDate: isValidDateStr(parsed.startDate) ? parsed.startDate : null,
    endDate: isValidDateStr(parsed.endDate) ? parsed.endDate : null,
  });
  const projectConflicts = normalizeStringList(parsed.conflicts);

  return {
    projectName: parsed.projectName?.trim() || "",
    totalBudget: typeof parsed.totalBudget === "number" && !isNaN(parsed.totalBudget) ? parsed.totalBudget : null,
    startDate: isValidDateStr(parsed.startDate) ? parsed.startDate : null,
    endDate: isValidDateStr(parsed.endDate) ? parsed.endDate : null,
    objective: parsed.objective?.trim() || null,
    background: parsed.background?.trim() || null,
    tasks,
    budgetItems,
    calendarEntries,
    risks: [],
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
