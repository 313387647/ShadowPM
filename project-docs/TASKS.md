# 开发任务清单 (Roadmap)

## Phase 1: MVP 基础建设 ✅ (已完成)
- [x] 初始化 Next.js 项目，配置 Tailwind 和 Shadcn UI。
- [x] 初始化 Prisma 并应用 `DATABASE.md` 中的 Schema，执行 migrate。
- [x] 编写全局 Layout 结构 (侧边栏导航)。
- [x] 实现基础登录逻辑 (硬编码或简单鉴权区隔 LEADER 和 MEMBER)。
- [x] 实现 `workspace` 页面：创建项目和展示个人项目列表。

## Phase 2: 核心业务视图 (The Core)
- [x] 实现 `projects/[id]` 页面框架，包含 4 个 Tab (总控/时间轴/账本/文档)。
- [x] 完成任务树 (TaskList) 的增删改查。
- [x] 完成流水账本 (LedgerTable) 的 Server Actions 及前端表单，实现动态结余计算。
- [x] 完成时光机 (TimelineView) 的录入和倒序渲染逻辑。
- [x] 知识库 (Wiki) 模块初始化：目录树和简单的富文本/链接记录。

## Phase 3: 全局大盘与 AI 融合 ✅ (已完成)
- [x] 引入 Recharts，开发 Dashboard 页面，汇总所有项目的预算状态。
- [x] 接入对话框组件，预留 AI Copilot 意图解析接口。
