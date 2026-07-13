import { shouldCreateConfirmedBudgetFlow } from "@/lib/ai-import-rules";

type ImportTask = {
  name: string;
  assignee?: string | null;
  department?: string | null;
  deadline?: string | null;
  confidence?: "high" | "medium" | "low" | null;
  missingFields?: string[];
  conflicts?: string[];
};

type ImportBudgetItem = {
  title: string;
  amount: number | null;
  type?: string | null;
  status?: string | null;
  confidence?: "high" | "medium" | "low" | null;
  missingFields?: string[];
  conflicts?: string[];
};

type ImportCalendarEntry = {
  content: string;
  date: string | null;
  owner?: string | null;
  confidence?: "high" | "medium" | "low" | null;
  missingFields?: string[];
  conflicts?: string[];
};

export type AIImportPlanInput = {
  projectName: string;
  totalBudget: number | null;
  startDate: string | null;
  endDate: string | null;
  tasks: ImportTask[];
  budgetItems?: ImportBudgetItem[];
  calendarEntries?: ImportCalendarEntry[];
  missingFields?: string[];
  conflicts?: string[];
  createBudgetFlow?: boolean;
};

export function buildAIImportPlan(draft: AIImportPlanInput) {
  const namedTasks = draft.tasks.filter((task) => task.name.trim());
  const validBudgetItems = (draft.budgetItems ?? []).filter(
    (item) => item.title?.trim() && typeof item.amount === "number" && item.amount > 0
  );
  const confirmedBudgetItems = validBudgetItems.filter(shouldCreateConfirmedBudgetFlow);
  const deferredBudgetItems = validBudgetItems.filter((item) => !shouldCreateConfirmedBudgetFlow(item));
  const calendarEntries = (draft.calendarEntries ?? []).filter((entry) => entry.content?.trim());
  const lowConfidenceTasks = namedTasks.filter((task) => task.confidence === "low").length;
  const rowsWithDiagnostics = [
    ...namedTasks,
    ...validBudgetItems,
    ...calendarEntries,
  ].filter((item) => (item.missingFields?.length ?? 0) > 0 || (item.conflicts?.length ?? 0) > 0 || item.confidence === "low").length;

  const requiredGaps: string[] = [];
  if (!draft.projectName.trim()) requiredGaps.push("项目名称");
  if (namedTasks.length === 0) requiredGaps.push("至少一条管控事项");

  const optionalGaps: string[] = [];
  if (!draft.totalBudget || draft.totalBudget <= 0) optionalGaps.push("预算池待确认");
  if (!draft.startDate || !draft.endDate) optionalGaps.push("项目周期不完整");

  const missingAssignee = namedTasks.filter((task) => !task.assignee?.trim()).length;
  const missingDeadline = namedTasks.filter((task) => !task.deadline).length;
  const missingDepartment = namedTasks.filter((task) => !task.department?.trim()).length;
  if (missingAssignee > 0) optionalGaps.push(`${missingAssignee} 条事项缺负责人`);
  if (missingDeadline > 0) optionalGaps.push(`${missingDeadline} 条事项缺截止日期`);
  if (missingDepartment > 0) optionalGaps.push(`${missingDepartment} 条事项缺负责部门`);

  const projectConflicts = draft.conflicts ?? [];
  const clarificationQuestions = [
    ...requiredGaps.map((gap) => `创建前请确认：${gap}`),
    ...projectConflicts.slice(0, 2).map((conflict) => `源文件存在冲突：${conflict}`),
    ...optionalGaps.slice(0, requiredGaps.length > 0 ? 1 : 3).map((gap) => `可稍后补齐：${gap}`),
  ].slice(0, 3);

  const initialBudgetFlowCount =
    draft.createBudgetFlow && draft.totalBudget && draft.totalBudget > 0 && confirmedBudgetItems.length === 0 ? 1 : 0;

  return {
    canCreateNow: requiredGaps.length === 0,
    requiredGaps,
    optionalGaps,
    clarificationQuestions,
    controlItemCount: namedTasks.length,
    lowConfidenceTasks,
    rowsWithDiagnostics,
    confirmedBudgetFlowCount: confirmedBudgetItems.length + initialBudgetFlowCount,
    deferredBudgetCandidateCount: deferredBudgetItems.length,
    calendarEntryCount: calendarEntries.length,
    calendarNeedsConfirmationCount: calendarEntries.filter(
      (entry) => !entry.date || !entry.owner?.trim() || entry.confidence === "low" || (entry.conflicts?.length ?? 0) > 0
    ).length,
  };
}
