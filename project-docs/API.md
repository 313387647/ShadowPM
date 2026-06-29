# 接口设计约定 (Server Actions)

所有后端逻辑必须存放在 `src/actions/` 目录下，并带有 `'use server'` 指令。

## 1. project-actions.ts
- `createProject(data: ProjectCreateDTO)`: 创建项目。
- `getDashboardStats(userId: string)`: 获取全局大盘数据（总预算剩余、进行中项目数）。
- `getProjectDetails(projectId: string)`: 获取单一项目的详情。

## 2. task-actions.ts
- `createTask(data: TaskCreateDTO)`: 在项目下拆分任务。
- `updateTaskStatus(taskId: string, status: TaskStatus)`: 变更状态，要求在执行此操作时，系统必须自动触发 `addProgressLog` 记录一条"状态变更"历史。

## 3. timeline-actions.ts
- `addProgressLog(taskId: string, content: string)`: 纯 Append 模式插入历史记录。
- `getTimelineByTask(taskId: string)`: 获取按 `createdAt` 降序排列的历史记录。

## 4. ledger-actions.ts
- `recordBudget(taskId: string, type: FlowType, amount: number, desc: string)`: 插入一条资金流水。
- `getTaskBudgetBalance(taskId: string)`: 通过 SQL SUM() 动态计算当前任务/项目的真实结余。

## 5. wiki-actions.ts
- `createFolder(projectId: string, name: string, parentId?: string)`: 创建知识库目录。
- `saveAsset(folderId: string, title: string, type: AssetType, content: string)`: 保存资产文档。
