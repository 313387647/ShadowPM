"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Loader2, Plus, Sparkles, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { AIParsedProject, CreateProjectFromAIDTO } from "@/actions/ai-actions";
import { parseDocumentForProject, createProjectFromAI } from "@/actions/ai-actions";
import { buildAIImportPlan } from "@/lib/ai-import-plan";
import { shouldDefaultSelectAIBudgetItem } from "@/lib/ai-import-rules";

type Step = "upload" | "loading" | "clarify" | "preview" | "creating";

const IMPORT_STEPS = ["提供资料", "检查结果", "创建项目"];

const IMPORT_LOADING_STAGES = [
  {
    afterSeconds: 0,
    label: "正在读取来源",
    detail: "提取文档、表格与可识别文本。",
  },
  {
    afterSeconds: 3,
    label: "正在请求 AI 识别",
    detail: "按管控事项、预算和执行日历归类信息。",
  },
  {
    afterSeconds: 12,
    label: "正在生成可编辑草稿",
    detail: "源文件较复杂时会继续处理，请保持此窗口打开。",
  },
] as const;

function getImportLoadingStageIndex(elapsedSeconds: number) {
  for (let index = IMPORT_LOADING_STAGES.length - 1; index >= 0; index -= 1) {
    if (elapsedSeconds >= IMPORT_LOADING_STAGES[index].afterSeconds) return index;
  }
  return 0;
}

const IMPORT_LOADING_PROGRESS = [28, 62, 86] as const;

function getStepIndex(step: Step) {
  if (step === "upload") return 0;
  if (step === "loading") return 0;
  if (step === "clarify" || step === "preview") return 1;
  return 2;
}

interface Props {
  onClose: () => void;
}

export function AIProjectCreator({ onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<AIParsedProject | null>(null);
  const [edited, setEdited] = useState<CreateProjectFromAIDTO | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [loadingElapsedSeconds, setLoadingElapsedSeconds] = useState(0);
  const [taskDetailsOpen, setTaskDetailsOpen] = useState(false);
  const [budgetDetailsOpen, setBudgetDetailsOpen] = useState(false);
  const [calendarDetailsOpen, setCalendarDetailsOpen] = useState(false);
  const editedRef = useRef<CreateProjectFromAIDTO | null>(null);

  useEffect(() => { editedRef.current = edited; }, [edited]);

  useEffect(() => {
    if (step !== "loading") {
      setLoadingElapsedSeconds(0);
      return;
    }

    const startedAt = Date.now();
    const updateElapsed = () => setLoadingElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    updateElapsed();
    const timer = window.setInterval(updateElapsed, 500);
    return () => window.clearInterval(timer);
  }, [step]);

  useEffect(() => {
    const draft = editedRef.current;
    if (step !== "preview" || !draft) return;
    setTaskDetailsOpen(diagnosticCount(draft) > 0);
    setBudgetDetailsOpen((draft.budgetItems ?? []).some((item) => !shouldDefaultSelectAIBudgetItem(item) || (item.conflicts?.length ?? 0) > 0));
    setCalendarDetailsOpen((draft.calendarEntries ?? []).some((entry) => (entry.missingFields?.length ?? 0) > 0 || (entry.conflicts?.length ?? 0) > 0));
  }, [step]);

  function createDraft(project: AIParsedProject): CreateProjectFromAIDTO {
    return {
      projectName: project.projectName,
      totalBudget: project.totalBudget,
      totalBudgetCandidates: project.totalBudgetCandidates ?? [],
      // AI may suggest a value, but the project starts in "pending" until the
      // user explicitly chooses to confirm the budget pool.
      budgetMode: "PENDING",
      startDate: project.startDate,
      endDate: project.endDate,
      tasks: project.tasks.map((t) => ({ ...t })),
      budgetItems: project.budgetItems.map((item) => ({
        ...item,
        selected: shouldDefaultSelectAIBudgetItem(item),
      })),
      calendarEntries: project.calendarEntries,
      sourceQuality: project.sourceQuality,
      confidence: project.confidence,
      missingFields: project.missingFields,
      conflicts: project.conflicts,
      sourceEvidence: project.sourceEvidence,
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

  function confidenceLabel(confidence?: string | null) {
    if (confidence === "high") return "高";
    if (confidence === "medium") return "中";
    return "低";
  }

  function confidenceClass(confidence?: string | null) {
    if (confidence === "high") return "border border-success/25 bg-success/10 text-success";
    if (confidence === "medium") return "border border-warning/25 bg-warning/10 text-warning";
    return "border border-destructive/25 bg-destructive/10 text-destructive";
  }

  function diagnosticCount(project: CreateProjectFromAIDTO | null) {
    if (!project) return 0;
    const rowIssues = [
      ...project.tasks,
      ...(project.budgetItems ?? []),
      ...(project.calendarEntries ?? []),
    ].reduce((sum, item) => sum + (item.missingFields?.length ?? 0) + (item.conflicts?.length ?? 0), 0);
    return (project.missingFields?.length ?? 0) + (project.conflicts?.length ?? 0) + rowIssues;
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
    return draft ? buildAIImportPlan(draft).requiredGaps : [];
  }

  function getSelectedBudgetTotal(draft: CreateProjectFromAIDTO | null) {
    return (draft?.budgetItems ?? []).reduce(
      (sum, item) => item.selected && typeof item.amount === "number" && item.amount > 0 ? sum + item.amount : sum,
      0
    );
  }

  function shouldClarify(draft: CreateProjectFromAIDTO) {
    const plan = buildAIImportPlan(draft);
    return plan.requiredGaps.length > 0 || plan.clarificationQuestions.length > 0;
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

  function handleUploadSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleUpload(new FormData(event.currentTarget));
  }

  // ── Confirm phase ──
  async function handleConfirm() {
    if (!edited) return;
    const importPlan = buildAIImportPlan(edited);
    if (!importPlan.canCreateNow) {
      toast.error(`请先处理：${importPlan.requiredGaps.join("、")}`);
      return;
    }
    setStep("creating");
    try {
      const result = await createProjectFromAI(edited);
      if (result.success && result.data) {
        toast.success(result.message!);
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
    <div className="space-y-5">
      <ol className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-secondary/55 p-2">
        {IMPORT_STEPS.map((label, index) => {
          const current = getStepIndex(step);
          const complete = index < current;
          const active = index === current;
          return (
            <li key={label} className="min-w-0">
              <div className={complete || active ? "flex min-w-0 items-center gap-1.5 rounded-lg bg-primary/10 px-2 py-1.5 text-primary" : "flex min-w-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-muted-foreground"}>
                <span className={complete ? "flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground" : active ? "flex size-5 shrink-0 items-center justify-center rounded-full border border-primary bg-primary/10 text-[10px] font-semibold" : "flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px]"}>{complete ? "✓" : index + 1}</span>
                <span className="hidden truncate text-[11px] font-medium sm:block">{label}</span>
              </div>
            </li>
          );
        })}
      </ol>
      {/* ── Step: Upload ── */}
      {step === "upload" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            上传项目文档或粘贴文本，AI 将自动提取项目信息并生成管控表。
          </p>

          {/* File upload */}
          <form
            onSubmit={handleUploadSubmit}
            className="focus-surface flex flex-col items-center gap-3 rounded-xl border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50"
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

          <form onSubmit={handleUploadSubmit} className="space-y-2">
            <textarea
              name="text"
              rows={6}
              placeholder="粘贴项目 Brief 或方案文本...&#10;&#10;例如：&#10;项目名称：Aster X9 国内上市整合传播&#10;预算：520万元&#10;时间：2026年7月-9月&#10;&#10;主要模块：&#10;1. 媒体公关，周予安负责，7月25日前&#10;2. 社交内容，许闻澜负责，7月20日前"
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
        (() => {
          const currentStageIndex = getImportLoadingStageIndex(loadingElapsedSeconds);
          const currentStage = IMPORT_LOADING_STAGES[currentStageIndex];
          const progress = IMPORT_LOADING_PROGRESS[currentStageIndex];

          return (
            <div className="mx-auto flex max-w-md flex-col items-center justify-center py-12" role="status" aria-live="polite">
              <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                <Sparkles className="size-6 animate-pulse text-primary" />
              </div>
              <div className="mt-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <p className="text-sm font-semibold">{currentStage.label}</p>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] tabular-nums text-muted-foreground">
                    已等待 {loadingElapsedSeconds}s
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{currentStage.detail}</p>
              </div>

              <div className="mt-5 h-2.5 w-full overflow-hidden rounded-full bg-muted" aria-label="AI 导入处理阶段">
                <div
                  className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div className="mt-3 grid w-full grid-cols-3 gap-1.5" aria-label="AI 导入状态">
                {IMPORT_LOADING_STAGES.map((stage, index) => {
                  const isComplete = index < currentStageIndex;
                  const isActive = index === currentStageIndex;
                  return (
                    <div
                      key={stage.label}
                      className={
                        isComplete || isActive
                          ? "truncate text-center text-[11px] font-medium text-primary"
                          : "truncate text-center text-[11px] text-muted-foreground/60"
                      }
                    >
                      {stage.label.replace("正在", "")}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-center text-[11px] leading-5 text-muted-foreground">
                普通文本通常 10–20 秒；表格较大或结构复杂时可能需要更久。进度条表示处理阶段，不代表精确百分比。
              </p>
            </div>
          );
        })()
      )}

      {/* ── Step: Clarify ── */}
      {step === "clarify" && edited && (
        <div className="space-y-4">
          {(() => {
            const importPlan = buildAIImportPlan(edited);
            return (
          <div className="focus-surface rounded-xl p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">AI 只保留必要确认</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      不确定的信息不会阻塞创建，会进入管控表、预算账本或日历后人工补齐。
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                    {importPlan.canCreateNow ? "可直接创建" : "需先补必填"}
                  </span>
                </div>
                {importPlan.clarificationQuestions.length > 0 && (
                  <div className="mt-3 space-y-1">
                    {importPlan.clarificationQuestions.map((question) => (
                      <div key={question} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                        <span>{question}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="rounded-xl border border-primary/20 bg-primary/[0.055] p-4">
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
            <div className="space-y-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
              <div className="flex items-center gap-2 text-sm font-medium text-warning">
                <AlertTriangle className="size-4" />
                创建前必须确认
              </div>

              {!edited.projectName.trim() && (
                <div>
                  <label className="block text-xs font-medium mb-1 text-warning">项目名称</label>
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
                  <label className="block text-xs font-medium mb-1 text-warning">第一条管控事项</label>
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
        <div className="space-y-5">
          <section className="grid gap-4 border-y border-border py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div><p className="text-sm font-medium">来源资料</p><p className="mt-1 text-xs leading-5 text-muted-foreground">结构：{sourceQualityLabel(parsed?.sourceQuality)} · 置信度：{confidenceLabel(parsed?.confidence)} · {diagnosticCount(edited)} 处需要关注</p></div>
            <div><p className="text-sm font-medium">本次创建</p><p className="mt-1 text-sm text-muted-foreground">{buildAIImportPlan(edited).controlItemCount} 项事项 · {buildAIImportPlan(edited).selectedBudgetItemCount} 条预算草稿 · {buildAIImportPlan(edited).calendarEntryCount} 个执行节点</p><p className="mt-1 text-xs text-muted-foreground">AI 识别结果不会直接成为正式预算；未匹配事项的预算项会保持未关联。</p></div>
          </section>

          {/* Confidence warning */}
          {parsed?.confidence === "low" && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              AI 对此文档信心较低，建议仔细检查每个字段。
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

            <div className="grid grid-cols-2 gap-3">
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

            <div className="space-y-2 rounded-lg border border-primary/25 bg-primary/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">确认项目总预算</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">AI 金额只是来源线索；只有你选择“已有明确预算”才会建立项目预算池。</p>
                </div>
                <select value={edited.budgetMode} onChange={(event) => setEdited({ ...edited, budgetMode: event.target.value as CreateProjectFromAIDTO["budgetMode"] })} className="rounded-md border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary">
                  <option value="PENDING">预算待确认</option>
                  <option value="CONFIRMED">已有明确预算</option>
                  <option value="NOT_MANAGED">本项目不管理预算</option>
                </select>
              </div>
              {(edited.totalBudgetCandidates?.length ?? 0) > 0 && (
                <div className="space-y-1.5">
                  {edited.totalBudgetCandidates?.map((candidate, index) => (
                    <label key={`${candidate.amount}-${index}`} className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${edited.totalBudget === candidate.amount ? "border-primary bg-background" : "border-border bg-background/60"}`}>
                      <input type="radio" checked={edited.totalBudget === candidate.amount} onChange={() => setEdited({ ...edited, totalBudget: candidate.amount })} />
                      <span className="font-mono font-medium">¥{candidate.amount.toLocaleString("zh-CN")}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">{candidate.sourceRef ?? "来源位置未定位"}</span>
                      <span className={`rounded-full px-1.5 py-0.5 ${confidenceClass(candidate.confidence)}`}>置信度{confidenceLabel(candidate.confidence)}</span>
                    </label>
                  ))}
                </div>
              )}
              {edited.budgetMode !== "NOT_MANAGED" && <label className="block text-xs font-medium">确认金额 (¥)<input type="number" value={edited.totalBudget ?? ""} onChange={(event) => setEdited({ ...edited, totalBudget: Number(event.target.value) || null })} placeholder="可在此修改识别金额" className="mt-1 w-full rounded-md border bg-background px-2.5 py-2 font-mono text-sm outline-none focus:border-primary" /></label>}
              {(edited.totalBudgetCandidates?.length ?? 0) > 1 && <p className="text-[11px] text-warning">检测到多个总预算候选。请确认一个金额或自行修改后再建立预算池。</p>}
            </div>
          </div>

          {/* Control item list */}
          <details className="border-y border-border py-3" open={taskDetailsOpen} onToggle={(event) => setTaskDetailsOpen(event.currentTarget.open)}>
            <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">管控事项 <span className="font-normal text-muted-foreground">{edited.tasks.length} 项</span></summary>
            <div className="mt-3 flex justify-end"><Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => setEdited({ ...edited, tasks: [...edited.tasks, { name: "", assignee: null, deadline: null }] })}><Plus className="size-3" />添加事项</Button></div>

            {edited.tasks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                未识别到管控事项，请手动添加
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
                      placeholder="管控事项"
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
                    <div className="hidden min-w-[112px] shrink-0 flex-col gap-0.5 xl:flex">
                      <span className={`w-fit rounded-full px-1.5 py-0.5 text-[10px] ${confidenceClass(task.confidence)}`}>
                        置信度{confidenceLabel(task.confidence)}
                      </span>
                      {(task.missingFields?.length ?? 0) > 0 && (
                        <span className="truncate text-[10px] text-warning">
                          缺 {task.missingFields?.join("/")}
                        </span>
                      )}
                      {(task.conflicts?.length ?? 0) > 0 && (
                        <span className="truncate text-[10px] text-destructive">
                          冲突 {task.conflicts?.length}
                        </span>
                      )}
                      {task.sourceRef && (
                        <span className="truncate text-[10px] text-muted-foreground" title={task.sourceRef}>
                          {task.sourceRef}
                        </span>
                      )}
                    </div>
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
          </details>

          {parsed && (
            <details className="border-y border-border py-3" open={budgetDetailsOpen} onToggle={(event) => setBudgetDetailsOpen(event.currentTarget.open)}>
              <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">预算项草稿 <span className="font-normal text-muted-foreground">{edited.budgetItems?.length ?? 0} 条</span></summary>
            <div className="mt-3 space-y-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    确认预算项草稿 ({edited.budgetItems?.length ?? 0})
                  </h4>
                  <span className="rounded-md border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    写入草稿
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  高置信且金额明确的条目已默认选中。写入后均为预算草稿，不会自动成为正式预算；找不到事项时会保持未关联。
                </p>
              </div>
              {(edited.budgetItems?.length ?? 0) === 0 ? (
                <p className="text-xs text-muted-foreground">未识别到独立预算项</p>
              ) : (
                <div className="space-y-1.5">
                  {(edited.budgetItems ?? []).slice(0, 8).map((item, i) => (
                    <div key={`${item.title}-${i}`} className="rounded-md bg-background px-2 py-1.5 text-xs">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" checked={Boolean(item.selected)} onChange={(event) => {
                          const copy = [...(edited.budgetItems ?? [])];
                          copy[i] = { ...copy[i], selected: event.target.checked };
                          setEdited({ ...edited, budgetItems: copy });
                        }} className="shrink-0 rounded" aria-label={`写入预算项 ${item.title}`} />
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      {item.workstream && <span className="shrink-0 text-muted-foreground">{item.workstream}</span>}
                      <span className="shrink-0 font-mono">
                        {item.amount ? `¥${item.amount.toLocaleString("zh-CN")}` : "金额待确认"}
                      </span>
                      {item.status && <span className="shrink-0 text-muted-foreground">{item.status}</span>}
                        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${confidenceClass(item.confidence)}`}>
                          {confidenceLabel(item.confidence)}
                        </span>
                      <button
                        type="button"
                        onClick={() => removeBudgetCandidate(i)}
                        className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        移除
                      </button>
                      </div>
                      {((item.missingFields?.length ?? 0) > 0 || (item.conflicts?.length ?? 0) > 0 || item.sourceRef) && (
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">
                          {item.missingFields?.length ? `缺：${item.missingFields.join("/")} ` : ""}
                          {item.conflicts?.length ? `冲突：${item.conflicts.join("；")} ` : ""}
                          {item.sourceRef ? `来源：${item.sourceRef}` : ""}
                        </p>
                      )}
                    </div>
                  ))}
                  {(edited.budgetItems?.length ?? 0) > 8 && (
                    <p className="text-[11px] text-muted-foreground">还有 {(edited.budgetItems?.length ?? 0) - 8} 条预算项未显示</p>
                  )}
                </div>
              )}
              {edited.budgetMode === "CONFIRMED" && (() => {
                const selectedTotal = getSelectedBudgetTotal(edited);
                const remaining = (edited.totalBudget ?? 0) - selectedTotal;
                return <div className={`mt-2 grid grid-cols-3 gap-2 rounded-md border px-2 py-2 text-[11px] ${remaining < 0 ? "border-destructive/40 bg-destructive/5" : "border-border bg-canvas/30"}`}><div><p className="text-muted-foreground">项目总预算</p><p className="mt-0.5 font-mono font-medium">¥{(edited.totalBudget ?? 0).toLocaleString("zh-CN")}</p></div><div><p className="text-muted-foreground">已选预算草稿</p><p className="mt-0.5 font-mono font-medium">¥{selectedTotal.toLocaleString("zh-CN")}</p></div><div><p className="text-muted-foreground">剩余可编排</p><p className={`mt-0.5 font-mono font-medium ${remaining < 0 ? "text-destructive" : ""}`}>¥{remaining.toLocaleString("zh-CN")}</p></div>{remaining < 0 && <p className="col-span-3 text-destructive">预算项合计超过总预算，不能创建项目。</p>}</div>;
              })()}
            </div>
            </details>
          )}

          {parsed && (edited.calendarEntries?.length ?? 0) > 0 && (
            <details className="border-y border-border py-3" open={calendarDetailsOpen} onToggle={(event) => setCalendarDetailsOpen(event.currentTarget.open)}>
              <summary className="cursor-pointer list-none text-sm font-medium marker:hidden">执行日历 <span className="font-normal text-muted-foreground">{edited.calendarEntries?.length ?? 0} 个节点</span></summary>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  将生成执行日历 ({edited.calendarEntries?.length ?? 0})
                </h4>
                <span className="rounded-md border border-success/25 bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
                  自动创建
                </span>
              </div>
              {(edited.calendarEntries ?? []).slice(0, 5).map((entry, i) => (
                <div key={`${entry.content}-${i}`} className="rounded-md bg-background px-2 py-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground">{entry.date ?? "日期待确认"}</span>
                    {entry.channel && <span className="min-w-0 flex-1 truncate text-muted-foreground">{entry.channel}</span>}
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] ${confidenceClass(entry.confidence)}`}>
                      {confidenceLabel(entry.confidence)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeCalendarCandidate(i)}
                      className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      排除
                    </button>
                  </div>
                  <p className="mt-0.5 line-clamp-1">{entry.content}</p>
                  {((entry.missingFields?.length ?? 0) > 0 || (entry.conflicts?.length ?? 0) > 0 || entry.sourceRef) && (
                    <p className="mt-1 truncate text-[11px] text-muted-foreground">
                      {entry.missingFields?.length ? `缺：${entry.missingFields.join("/")} ` : ""}
                      {entry.conflicts?.length ? `冲突：${entry.conflicts.join("；")} ` : ""}
                      {entry.sourceRef ? `来源：${entry.sourceRef}` : ""}
                    </p>
                  )}
                </div>
              ))}
            </div>
            </details>
          )}

          {/* Action buttons */}
          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-popover/95 py-3 backdrop-blur">
            <div className="text-xs text-muted-foreground">{buildAIImportPlan(edited).controlItemCount} 项事项 · {buildAIImportPlan(edited).selectedBudgetItemCount} 条预算 · {buildAIImportPlan(edited).calendarEntryCount} 个节点 · {diagnosticCount(edited)} 处待确认</div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleReparse}>重新解析</Button>
              <Button variant="ghost" onClick={onClose}>取消</Button>
              <Button
                onClick={handleConfirm}
                disabled={!edited.projectName.trim() || (edited.budgetMode === "CONFIRMED" && ((edited.totalBudget ?? 0) <= 0 || getSelectedBudgetTotal(edited) > (edited.totalBudget ?? 0)))}
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
