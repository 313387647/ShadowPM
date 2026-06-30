"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarDays, Loader2, Plus, Sparkles, Table2, Upload, WalletCards, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AIParsedProject, CreateProjectFromAIDTO } from "@/actions/ai-actions";
import { parseDocumentForProject, createProjectFromAI } from "@/actions/ai-actions";

type Step = "upload" | "loading" | "clarify" | "preview" | "creating";

interface Props {
  onClose: () => void;
}

export function AIProjectCreator({ onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<AIParsedProject | null>(null);
  const [edited, setEdited] = useState<CreateProjectFromAIDTO | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  function createDraft(project: AIParsedProject): CreateProjectFromAIDTO {
    return {
      projectName: project.projectName,
      totalBudget: project.totalBudget,
      startDate: project.startDate,
      endDate: project.endDate,
      tasks: project.tasks.map((t) => ({ ...t })),
      budgetItems: project.budgetItems,
      calendarEntries: project.calendarEntries,
      risks: [],
      sourceQuality: project.sourceQuality,
      confidence: project.confidence,
      createBudgetFlow: Boolean(project.totalBudget && project.totalBudget > 0),
    };
  }

  function sourceQualityLabel(quality?: AIParsedProject["sourceQuality"]) {
    const labels = {
      clean: "结构清晰",
      usable: "可用",
      messy: "结构混乱",
      unsafe: "需人工确认",
    };
    return labels[quality ?? "messy"];
  }

  function candidateCount(project: {
    budgetItems?: AIParsedProject["budgetItems"];
    calendarEntries?: AIParsedProject["calendarEntries"];
  } | null) {
    if (!project) return 0;
    return (project.budgetItems?.length ?? 0) + (project.calendarEntries?.length ?? 0);
  }

  function validBudgetItemCount(project: { budgetItems?: AIParsedProject["budgetItems"] } | null) {
    if (!project) return 0;
    return (project.budgetItems ?? []).filter((item) => typeof item.amount === "number" && item.amount > 0).length;
  }

  function removeBudgetCandidate(index: number) {
    if (!edited) return;
    setEdited({
      ...edited,
      budgetItems: (edited.budgetItems ?? []).filter((_, i) => i !== index),
    });
  }

  function removeCalendarCandidate(index: number) {
    if (!edited) return;
    setEdited({
      ...edited,
      calendarEntries: (edited.calendarEntries ?? []).filter((_, i) => i !== index),
    });
  }

  function getRequiredGaps(draft: CreateProjectFromAIDTO | null) {
    if (!draft) return [];
    const gaps: string[] = [];
    if (!draft.projectName.trim()) gaps.push("项目名称");
    if (!draft.tasks.some((task) => task.name.trim())) gaps.push("至少一条管控事项");
    return gaps;
  }

  function getOptionalGapSummary(draft: CreateProjectFromAIDTO | null) {
    if (!draft) return [];
    const gaps: string[] = [];
    if (!draft.totalBudget || draft.totalBudget <= 0) gaps.push("预算池待确认");
    if (!draft.startDate || !draft.endDate) gaps.push("项目周期不完整");

    const namedTasks = draft.tasks.filter((task) => task.name.trim());
    const missingAssignee = namedTasks.filter((task) => !task.assignee?.trim()).length;
    const missingDeadline = namedTasks.filter((task) => !task.deadline).length;
    const missingDepartment = namedTasks.filter((task) => !task.department?.trim()).length;

    if (missingAssignee > 0) gaps.push(`${missingAssignee} 条事项缺负责人`);
    if (missingDeadline > 0) gaps.push(`${missingDeadline} 条事项缺截止日期`);
    if (missingDepartment > 0) gaps.push(`${missingDepartment} 条事项缺负责部门`);
    return gaps;
  }

  function shouldClarify(draft: CreateProjectFromAIDTO) {
    return getRequiredGaps(draft).length > 0 || getOptionalGapSummary(draft).length > 0;
  }

  // ── Upload phase ──
  async function handleUpload(formData: FormData) {
    setStep("loading");
    setErrorMsg("");
    try {
      const result = await parseDocumentForProject(formData);
      if (result.success && result.data) {
        setParsed(result.data);
        const draft = createDraft(result.data);
        setEdited(draft);
        setStep(shouldClarify(draft) ? "clarify" : "preview");
      } else {
        setErrorMsg(result.message ?? "解析失败");
        setStep("upload");
        toast.error(result.message ?? "解析失败");
      }
    } catch {
      setErrorMsg("解析失败，请重试");
      setStep("upload");
      toast.error("解析失败，请重试");
    }
  }

  // ── Confirm phase ──
  async function handleConfirm() {
    if (!edited) return;
    setStep("creating");
    try {
      const result = await createProjectFromAI(edited);
      if (result.success && result.data) {
        toast.success(result.message!);
        onClose();
        router.push(`/projects/${result.data.projectId}`);
      } else {
        toast.error(result.message ?? "创建失败");
        setStep("preview");
      }
    } catch {
      toast.error("创建失败，请重试");
      setStep("preview");
    }
  }

  function handleClarifyContinue() {
    if (!edited) return;
    const requiredGaps = getRequiredGaps(edited);
    if (requiredGaps.length > 0) {
      toast.error(`请先补充：${requiredGaps.join("、")}`);
      return;
    }
    setStep("preview");
  }

  // ── Re-parse ──
  async function handleReparse() {
    if (!parsed) return;
    setStep("loading");
    setErrorMsg("");
    try {
      const formData = new FormData();
      formData.set("text", JSON.stringify(parsed));
      const result = await parseDocumentForProject(formData);
      if (result.success && result.data) {
        setParsed(result.data);
        const draft = createDraft(result.data);
        setEdited(draft);
        setStep(shouldClarify(draft) ? "clarify" : "preview");
      }
    } catch {
      setStep("preview");
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Step: Upload ── */}
      {step === "upload" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            上传项目文档或粘贴文本，AI 将自动提取项目信息并生成管控表。
          </p>

          {/* File upload */}
          <form
            action={handleUpload}
            className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50"
          >
            <Upload className="size-8 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium">拖拽文件到此处，或点击选择</p>
              <p className="text-xs text-muted-foreground mt-1">
                支持 Word (.docx) / PDF (.pdf) / Excel (.xlsx) / 文本 (.txt)
              </p>
            </div>
            <input
              type="file"
              name="file"
              accept=".docx,.pdf,.xlsx,.xls,.txt"
              className="text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            />
            <Button type="submit" size="sm" className="gap-2">
              <Sparkles className="size-3.5" /> 开始解析
            </Button>
          </form>

          {/* Or paste text */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">或粘贴文本</span>
            </div>
          </div>

          <form action={handleUpload} className="space-y-2">
            <textarea
              name="text"
              rows={6}
              placeholder="粘贴项目 Brief 或方案文本...&#10;&#10;例如：&#10;项目名称：仰望一万台整合营销&#10;预算：500万元&#10;时间：2026年6月-12月&#10;&#10;主要模块：&#10;1. 公关传播线，林小夏负责，8月15日前&#10;2. 社交媒体线，赵雨桐负责，9月30日前"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
            />
            <div className="flex justify-end">
              <Button type="submit" size="sm" variant="outline" className="gap-2">
                <Sparkles className="size-3.5" /> 解析文本
              </Button>
            </div>
          </form>

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div>
                <p>{errorMsg}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  请尝试上传格式更清晰的文档，或切换到手动创建。
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Step: Loading ── */}
      {step === "loading" && (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="size-6 text-primary animate-pulse" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-sm font-medium">AI 正在分析文档...</p>
            <p className="text-xs text-muted-foreground">这通常需要 5–15 秒</p>
          </div>
          <div className="w-48 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary rounded-full animate-[loading_2s_ease-in-out_infinite]" style={{ width: "60%" }} />
          </div>
        </div>
      )}

      {/* ── Step: Clarify ── */}
      {step === "clarify" && edited && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-start gap-3">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Sparkles className="size-4" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">AI 已生成管控表草稿，但有信息需要确认</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  必填项现在补齐；负责人、部门、截止日期等非阻塞信息可以进入草稿后直接在管控表中补。
                </p>
              </div>
            </div>
          </div>

          {getRequiredGaps(edited).length > 0 && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-amber-900">
                <AlertTriangle className="size-4" />
                创建前必须确认
              </div>

              {!edited.projectName.trim() && (
                <div>
                  <label className="block text-xs font-medium mb-1 text-amber-950">项目名称</label>
                  <input
                    value={edited.projectName}
                    onChange={(e) => setEdited({ ...edited, projectName: e.target.value })}
                    placeholder="例如：仰望一万台整合营销"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}

              {!edited.tasks.some((task) => task.name.trim()) && (
                <div>
                  <label className="block text-xs font-medium mb-1 text-amber-950">第一条管控事项</label>
                  <input
                    value={edited.tasks[0]?.name ?? ""}
                    onChange={(e) => {
                      const firstTask = edited.tasks[0] ?? { name: "", assignee: null, deadline: null };
                      const tasks = edited.tasks.length > 0 ? [...edited.tasks] : [firstTask];
                      tasks[0] = { ...firstTask, name: e.target.value };
                      setEdited({ ...edited, tasks });
                    }}
                    placeholder="例如：公关传播线"
                    className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              )}
            </div>
          )}

          {getOptionalGapSummary(edited).length > 0 && (
            <div className="rounded-lg border p-3">
              <p className="text-sm font-medium">可稍后在管控表中补充</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {getOptionalGapSummary(edited).map((gap) => (
                  <span key={gap} className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {gap}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="ghost" onClick={() => setStep("upload")}>
              重新上传
            </Button>
            <Button onClick={handleClarifyContinue} className="gap-2">
              进入管控表草稿
            </Button>
          </div>
        </div>
      )}

      {/* ── Step: Preview ── */}
      {step === "preview" && edited && (
        <div className="space-y-4 max-h-[60vh] overflow-y-auto -mx-2 px-2">
          {/* Confidence warning */}
          {parsed?.confidence === "low" && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              AI 对此文档信心较低，建议仔细检查每个字段。
            </div>
          )}

          {parsed && (
            <div className="rounded-lg border bg-muted/20 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">AI 分诊结果</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    源结构：{sourceQualityLabel(parsed.sourceQuality)} · 置信度：{parsed.confidence}
                  </p>
                </div>
                <span className="rounded-full bg-background px-2 py-1 text-xs text-muted-foreground">
                  同步生成 {candidateCount(edited)}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-4 gap-2">
                <div className="rounded-md bg-background p-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Table2 className="size-3" /> 管控总表
                  </div>
                  <p className="mt-1 text-base font-semibold">{edited.tasks.length}</p>
                </div>
                <div className="rounded-md bg-background p-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <WalletCards className="size-3" /> 预算
                  </div>
                  <p className="mt-1 text-base font-semibold">{edited.budgetItems?.length ?? 0}</p>
                </div>
                <div className="rounded-md bg-background p-2">
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <CalendarDays className="size-3" /> 日历
                  </div>
                  <p className="mt-1 text-base font-semibold">{edited.calendarEntries?.length ?? 0}</p>
                </div>
              </div>
            </div>
          )}

          {parsed && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">本次创建范围</p>
                  <p className="text-xs leading-relaxed text-blue-900/80">
                    将创建项目资料和项目管控总表。
                    {validBudgetItemCount(edited) > 0
                      ? ` 将直接生成 ${validBudgetItemCount(edited)} 条预算流水，项目总预算作为计划预算保留，避免重复入账。`
                      : edited.totalBudget && edited.totalBudget > 0 && edited.createBudgetFlow
                      ? " 已确认的总预算会生成一条初始 ALLOCATE 预算流水。"
                      : " 当前预算池未确认，不会自动生成初始预算流水。"}
                    {candidateCount(edited) > 0
                      ? ` AI 识别出的预算和日历会随项目一起生成；你可以在创建前排除明显错误项，创建后直接在表格中修改。`
                      : " 未识别到可同步生成的预算或日历。"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Project fields */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              项目基本信息
            </h4>

            <div>
              <label className="block text-xs font-medium mb-1">项目名称</label>
              <input
                value={edited.projectName}
                onChange={(e) => setEdited({ ...edited, projectName: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">总预算 (¥)</label>
                <input
                  type="number"
                  value={edited.totalBudget || ""}
                  onChange={(e) => {
                    const totalBudget = Number(e.target.value) || null;
                    setEdited({
                      ...edited,
                      totalBudget,
                      createBudgetFlow: Boolean(totalBudget && totalBudget > 0),
                    });
                  }}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">开始日期</label>
                <input
                  type="date"
                  value={edited.startDate ?? ""}
                  onChange={(e) => setEdited({ ...edited, startDate: e.target.value || null })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">结束日期</label>
                <input
                  type="date"
                  value={edited.endDate ?? ""}
                  onChange={(e) => setEdited({ ...edited, endDate: e.target.value || null })}
                  className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Control item list */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                项目管控总表 ({edited.tasks.length})
              </h4>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs"
                onClick={() =>
                  setEdited({
                    ...edited,
                    tasks: [...edited.tasks, { name: "", assignee: null, deadline: null }],
                  })
                }
              >
                <Plus className="size-3" /> 添加
              </Button>
            </div>

            {edited.tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                未识别到任务，请手动添加
              </p>
            ) : (
              <div className="space-y-2">
                {edited.tasks.map((task, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2"
                  >
                    <input
                      value={task.name}
                      onChange={(e) => {
                        const copy = [...edited.tasks];
                        copy[i] = { ...copy[i], name: e.target.value };
                        setEdited({ ...edited, tasks: copy });
                      }}
                      placeholder="任务名称"
                      className="flex-1 min-w-0 rounded border-0 bg-transparent px-0 py-0 text-sm outline-none"
                    />
                    <input
                      value={task.workstream ?? ""}
                      onChange={(e) => {
                        const copy = [...edited.tasks];
                        copy[i] = { ...copy[i], workstream: e.target.value || null };
                        setEdited({ ...edited, tasks: copy });
                      }}
                      placeholder="模块"
                      className="w-20 rounded border-0 bg-transparent px-0 py-0 text-xs text-muted-foreground outline-none"
                    />
                    <input
                      value={task.assignee ?? ""}
                      onChange={(e) => {
                        const copy = [...edited.tasks];
                        copy[i] = { ...copy[i], assignee: e.target.value || null };
                        setEdited({ ...edited, tasks: copy });
                      }}
                      placeholder="负责人"
                      className="w-20 rounded border-0 bg-transparent px-0 py-0 text-xs text-muted-foreground outline-none"
                    />
                    <input
                      type="date"
                      value={task.deadline ?? ""}
                      onChange={(e) => {
                        const copy = [...edited.tasks];
                        copy[i] = { ...copy[i], deadline: e.target.value || null };
                        setEdited({ ...edited, tasks: copy });
                      }}
                      className="w-32 rounded border-0 bg-transparent px-0 py-0 text-xs outline-none"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-6 shrink-0"
                      onClick={() => {
                        const copy = edited.tasks.filter((_, j) => j !== i);
                        setEdited({ ...edited, tasks: copy });
                      }}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {parsed && (
            <div className="space-y-3 rounded-lg border border-dashed bg-muted/10 p-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    将生成预算流水 ({edited.budgetItems?.length ?? 0})
                  </h4>
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                    自动入账
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  有明确金额的预算项会直接进入资金账本；无金额线索不会入账，后续可在管控表或资金账本中补齐。
                </p>
              </div>
              {(edited.budgetItems?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">未识别到独立预算项</p>
              ) : (
                <div className="space-y-1.5">
                  {(edited.budgetItems ?? []).slice(0, 8).map((item, i) => (
                    <div key={`${item.title}-${i}`} className="flex items-center gap-2 rounded-md bg-background px-2 py-1.5 text-xs">
                      <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      {item.workstream && <span className="shrink-0 text-muted-foreground">{item.workstream}</span>}
                      <span className="shrink-0 font-mono">
                        {item.amount ? `¥${item.amount.toLocaleString("zh-CN")}` : "金额待确认"}
                      </span>
                      {item.status && <span className="shrink-0 text-muted-foreground">{item.status}</span>}
                      <button
                        type="button"
                        onClick={() => removeBudgetCandidate(i)}
                        className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        排除
                      </button>
                    </div>
                  ))}
                  {(edited.budgetItems?.length ?? 0) > 8 && (
                    <p className="text-[11px] text-muted-foreground">还有 {(edited.budgetItems?.length ?? 0) - 8} 条预算项未显示</p>
                  )}
                </div>
              )}
            </div>
          )}

          {parsed && (edited.calendarEntries?.length ?? 0) > 0 && (
            <div className="space-y-2 rounded-lg border border-dashed bg-muted/10 p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  将生成执行日历 ({edited.calendarEntries?.length ?? 0})
                </h4>
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  自动创建
                </span>
              </div>
              {(edited.calendarEntries ?? []).slice(0, 5).map((entry, i) => (
                <div key={`${entry.content}-${i}`} className="rounded-md bg-background px-2 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">{entry.date ?? "日期待确认"}</span>
                    {entry.channel && <span className="min-w-0 flex-1 truncate text-muted-foreground">{entry.channel}</span>}
                    <button
                      type="button"
                      onClick={() => removeCalendarCandidate(i)}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      排除
                    </button>
                  </div>
                  <p className="mt-0.5 line-clamp-1">{entry.content}</p>
                </div>
              ))}
            </div>
          )}

          {/* Budget flow toggle */}
          {edited.totalBudget && edited.totalBudget > 0 ? (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={edited.createBudgetFlow}
                onChange={(e) =>
                  setEdited({ ...edited, createBudgetFlow: e.target.checked })
                }
                className="rounded"
              />
              创建项目预算池初始流水（ALLOCATE: ¥{edited.totalBudget.toLocaleString()}）
            </label>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              未确认总预算：项目会先创建，预算可稍后在资金账本中补齐。
            </div>
          )}

          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2 border-t">
            <Button variant="ghost" size="sm" onClick={handleReparse} className="gap-1.5 text-xs">
              <Sparkles className="size-3" /> 重新解析
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                取消
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!edited.projectName.trim()}
                className="gap-2"
              >
                <Sparkles className="size-4" /> 创建项目与管控表
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step: Creating ── */}
      {step === "creating" && (
        <div className="flex flex-col items-center justify-center py-12 space-y-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm font-medium">正在创建项目...</p>
        </div>
      )}
    </div>
  );
}
