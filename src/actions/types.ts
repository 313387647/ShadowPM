// ── 统一 Action 返回值 ──
export type ActionResult<T = void> = {
  success: boolean;
  message?: string;
  data?: T;
};

// ── 项目 ──
export interface ProjectCreateDTO {
  name: string;
  totalBudget?: number;
  startDate?: string;
  endDate?: string;
}

// ── 任务 ──
export interface TaskCreateDTO {
  projectId: string;
  name: string;
  assignee?: string;
  deadline?: string;
}

// ── 工作台展示用 ──
export interface ProjectWithTaskCount {
  id: string;
  name: string;
  totalBudget: number;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  _count: { tasks: number };
}
