export type WeeklyHealthProject = {
  name: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  missingOwnerTasks: number;
  upcomingCalendarEntries: number;
  unscheduledCalendarEntries: number;
};

export type WeeklyHealthInput = {
  projectCount: number;
  pending: number;
  inProgress: number;
  completed: number;
  overdueCount: number;
  missingOwnerCount: number;
  plannedBudget: number;
  allocatedBudget: number;
  consumedBudget: number;
  projects: WeeklyHealthProject[];
};

function formatMoney(value: number) {
  return `¥${Math.round(value).toLocaleString("zh-CN")}`;
}

function formatProjectProgress(project: WeeklyHealthProject) {
  if (project.totalTasks === 0) return "暂无管控事项";
  return `${Math.round((project.completedTasks / project.totalTasks) * 100)}%（${project.completedTasks}/${project.totalTasks}）`;
}

/** Uses official records only, so the dashboard stays available without a model call. */
export function buildWeeklyHealthSummary(input: WeeklyHealthInput) {
  if (input.projectCount === 0) {
    return "本周尚无项目数据。先创建项目或导入项目管控表，系统会在这里汇总正式记录。";
  }

  const lines = [
    `本周共跟踪 ${input.projectCount} 个项目，管控事项：待启动 ${input.pending}、进行中 ${input.inProgress}、已完成 ${input.completed}。`,
  ];
  const attention = [
    input.overdueCount > 0 ? `${input.overdueCount} 项已逾期` : null,
    input.missingOwnerCount > 0 ? `${input.missingOwnerCount} 项缺负责人` : null,
  ].filter((value): value is string => Boolean(value));
  lines.push(attention.length > 0 ? `优先处理：${attention.join("；")}。` : "当前没有逾期或缺负责人的明显阻塞。"
  );

  if (input.allocatedBudget > 0) {
    const balance = input.allocatedBudget - input.consumedBudget;
    const usage = Math.round((input.consumedBudget / input.allocatedBudget) * 100);
    lines.push(`预算：确认预算池 ${formatMoney(input.allocatedBudget)}，已使用 ${formatMoney(input.consumedBudget)}，结余 ${formatMoney(balance)}（使用 ${usage}%）。`);
  } else if (input.plannedBudget > 0) {
    lines.push(`预算：计划预算 ${formatMoney(input.plannedBudget)}，但尚未确认预算池；请在资金账本确认预算。`);
  } else {
    lines.push("预算：尚无计划或确认预算记录，可在资金账本补充。");
  }

  const rankedProjects = [...input.projects]
    .sort((a, b) => (
      (b.overdueTasks * 4 + b.missingOwnerTasks * 2 + b.unscheduledCalendarEntries) -
      (a.overdueTasks * 4 + a.missingOwnerTasks * 2 + a.unscheduledCalendarEntries)
    ))
    .slice(0, 2);
  if (rankedProjects.length > 0) {
    lines.push(`项目进展：${rankedProjects.map((project) => `${project.name} ${formatProjectProgress(project)}`).join("；")}。`);
  }

  return lines.join("\n");
}
