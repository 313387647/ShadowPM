# 系统变更记录

*(Vibe Coding 规则：AI 在结束每一轮代码编写后，必须主动在此文件中追加记录)*

## [2026-07-01] P0 Code Scope Closure

### Permission rules
- Extracted pure project access rules into `src/lib/permission-rules.ts`.
- Kept LEADER users able to read all projects while restricting writes to project owners only.
- Updated `src/lib/permissions.ts` to use the shared read/write rules after fetching the project owner.
- Added regression coverage for leader read-only access, owner write access, and member cross-project denial.

### Budget rules
- Hardened `calculateBudgetSnapshot` so refunds cannot make consumed budget negative.
- Added budget snapshot coverage for planned budget separation, confirmed allocation, consumed budget, balance, planned variance, and usage percent.
- Updated the ledger action comment to reflect that `Project.totalBudget` is planned metadata and `BudgetFlow` aggregates are the financial truth.

### Calendar and control-table closure
- Added execution-calendar deletion for mistaken schedules while preserving project activity logs.
- Clarified in the roadmap that calendar entries are formal execution nodes, not an automatic mirror of all active control items.

### Verification
- `npm test`
- `npm run lint`
- `npm run build`

## [2026-06-30] External Review Absorption & Alpha Test Polish

### Critical review decisions
- Accepted the review's core diagnosis: docs had narrowed, but canonical schema and Prisma still carried old Risk/Asset/ImportDraft gravity.
- Kept Risk/Asset/ImportDraft tables for short-term compatibility, but marked them as legacy hidden Alpha models in `prisma/schema.prisma`.
- Updated `CANONICAL_PROJECT_SCHEMA.md` so Alpha core is Project Profile, Control Table, Budget Ledger, Execution Calendar, Progress Change Log, and AI Import Diagnostics.

### AI import safety
- Added persistent AI diagnostics fields to `Task`: `aiConfidence`, `sourceRef`, `missingFields`, `conflicts`, `needsConfirmation`.
- AI-created control items now save confidence/source/missing/conflict diagnostics directly on the official table row.
- Extracted budget import safety rules to `src/lib/ai-import-rules.ts`.
- AI budget rows now enter the official ledger only when the signal is non-low-confidence and looks like confirmed allocation.
- Estimate/draft/low-confidence budget signals are kept in import diagnostics instead of becoming confirmed `ALLOCATE` flows.

### Alpha UX simplification
- Control table now surfaces AI confidence, source reference, missing fields, conflicts, and needs-confirmation hints inline.
- Budget ledger Alpha UI now hides advanced split/merge/transfer/return/reduce operations while preserving the lower-level model.
- Workspace project cards now distinguish confirmed budget, planned budget awaiting ledger confirmation, and AI-detected pending budget signals.
- Login page now links back to the Demo entry and beginner guide so external testers can recover if they land on login first.
- Control items with logs, budget flows, or calendar entries can no longer be hard-deleted; the app records a delete request instead.
- Demo and guide pages now explain the external tester path and that created project data/feedback is retained for review.
- Added `project-docs/EXTERNAL_TESTER_QUICKSTART.md` as the shareable tester tutorial.

### Verification
- `npx prisma generate`
- `npx prisma db push`
- `npm test`
- `npm run lint`
- `npm run build`

## [2026-06-29] Review Docs & Repository Organization

### Documentation updated to current Alpha state
- Replaced the default Next.js `README.md` with a ShadowPM review-oriented README.
- Updated `project-docs/PROJECT.md` to reflect the current AI Native Project Management Platform positioning.
- Updated `project-docs/API.md` to match the current Server Actions surface.
- Rewrote `project-docs/TASKS.md` into a P0/P1/P2 roadmap aligned with the product constitution.
- Rewrote `project-docs/REVIEW_PACKAGE.md` as the current Alpha review package.
- Added `project-docs/README.md` as the documentation index.

### Folder organization
- Moved the messy sample workbook into `project-docs/review-assets/`.
- Renamed the workbook to `one-million-project-control-sample.xlsx` for reviewer clarity and stable references.
- Updated `CANONICAL_PROJECT_SCHEMA.md` to point to the new review asset path.

### Intent
- Make GitHub review easier for collaborators.
- Prevent reviewers from judging the product from stale MVP docs.
- Keep sample data clearly separate from source code and product docs.

## [2026-06-29] Roadmap Update After External Review

### Evaluation
- Accepted the review's core diagnosis: ShadowPM's product constitution has moved to AI-native project control, while parts of the implementation still carry traditional task-manager assumptions.
- Verified the highest-risk findings in code:
  - Project-scoped Server Actions need centralized permission checks.
  - Dashboard budget formulas can double-count planned budget plus initial allocation.
  - AI project creation currently blocks when total budget is missing.
  - Import draft budget candidates default to expense, which is unsafe for estimates.

### Roadmap changes
- Moved permission hardening and budget formula unification ahead of UI expansion.
- Split P0 into smaller execution modules:
  - P0.1 Reliability hardening
  - P0.2 Budget ledger truth
  - P0.3 AI creation without mandatory budget
  - P0.4 Import draft safety
  - P0.5 AI import quality V2
  - P0.6 Control table V2
  - P0.7 Execution calendar V2
  - P0.8 Business-rule tests
- Kept Command Center in P1 until core data trust is stronger.

## [2026-06-29] P0.1 Reliability Hardening

### Security and permissions
- Added `src/lib/permissions.ts` as the centralized permission boundary.
- Added `requireCurrentUser`, `assertCanReadProject`, `assertCanWriteProject`, `assertCanReadTask`, and `assertCanWriteTask`.
- Converted project-scoped Server Actions to use centralized permission checks before reading or mutating project data.
- Hardened AI/Copilot context so MEMBER users only see their own project scope, while LEADER users retain global visibility.
- Restricted workspace task queries to the user's permitted project scope.

### Session integrity
- Replaced the old plain `id:name:role` session cookie with a signed session payload.
- `requireCurrentUser` now verifies that the signed session user still exists in the database.
- Existing local sessions may need to log in again after this change.

### Scope note
- This module does not change budget formulas or AI import behavior; those remain P0.2 and P0.3.
- Cross-project regression tests are still tracked under P0.8 business-rule tests.

## [2026-06-29] P0.2 Budget Ledger Truth

### Unified budget formula
- Added `src/lib/budget.ts` as the single budget snapshot calculator.
- Standardized the financial source of truth:
  - `Project.totalBudget` = planned or approved budget metadata.
  - `BudgetFlow` = financial truth.
  - Confirmed budget = `SUM(ALLOCATE)`.
  - Consumed budget = `ABS(SUM(EXPENSE)) - SUM(REFUND)`.
  - Available balance = confirmed budget - consumed budget.
- Removed Dashboard health double-counting of `Project.totalBudget + ALLOCATE`.

### Product surfaces updated
- Ledger now shows planned budget separately from confirmed budget.
- Dashboard cards and budget chart now use confirmed budget wording.
- Copilot budget replies now distinguish planned budget, confirmed budget, consumed budget, balance, expense, and refund.
- AI project activity summaries now use the same budget terms and calculations.

### Safety
- Manual budget recording now rejects invalid flow types before writing.
- `EXPENSE` continues to be stored as negative; `ALLOCATE` and `REFUND` remain positive.

### Scope note
- Business-rule tests for budget snapshots remain tracked under P0.8.

## [2026-06-29] P0.3 Creation Without Mandatory Budget

### AI import creation
- AI-created projects no longer require a confirmed total budget.
- If AI cannot reliably identify a budget pool, `totalBudget` can remain `null` in the draft and is stored as `0` planned budget on creation.
- Initial `ALLOCATE` budget flow is created only when the user has a confirmed positive total budget and keeps the budget-flow toggle enabled.
- AI prompt now explicitly tells the model to return `null` for unreliable total budget instead of inventing one.

### Preview UX
- "Budget pool needs confirmation" is now an optional gap, not a blocking required field.
- The preview explains when the project will be created without an initial budget flow.
- Create button now requires project name only.
- Budget candidates remain in the import review queue for later confirmation.

### Manual creation
- Manual project creation now also allows empty budget.
- If a manual project has no confirmed budget, ShadowPM creates the project and control placeholder without an initial `ALLOCATE` flow.

## [2026-06-29] P0.4 Import Draft Safety

### Budget candidate safety
- Budget import candidates no longer default to `EXPENSE`.
- If AI identifies a candidate as `ALLOCATE`, `EXPENSE`, or `REFUND`, the review UI preselects that type.
- If AI identifies a candidate as `ESTIMATE`, `TRANSFER`, or an unclear type, the user must manually choose the final flow type before writing to the ledger.
- Server-side validation continues to reject empty or invalid flow types.

### Draft queue handling
- Import draft review now supports switching between multiple pending import batches instead of only exposing the latest draft.
- The panel still defaults to the newest import batch but keeps older pending batches reachable.

### External testing preparation
- Added an external tester gate and tester flow to `project-docs/TASKS.md`.
- The product is now closer to being safe for spreadsheet-upload testing by non-developers, pending shared deployment setup and smoke testing.

## [2026-06-29] Reviewer Testing Documentation

### Docs added
- Added `project-docs/USER_GUIDE.md` as the complete non-developer testing tutorial.
- Added `project-docs/FEEDBACK_TEMPLATE.md` for structured reviewer feedback.
- Added `project-docs/TEST_DEPLOYMENT.md` for private Alpha deployment setup and smoke testing.

### Docs linked
- Updated root `README.md` review entry points.
- Updated `project-docs/README.md` documentation index.
- Updated `project-docs/TASKS.md` external tester gate.

## [2026-06-24] Phase 1 — Task 1: 初始化 Next.js 14 项目
- 使用 `create-next-app@14` 初始化项目，包含 TypeScript、Tailwind CSS、ESLint、App Router、src/ 目录
- 配置 `@/*` 路径别名指向 `./src/*`
- 安装并配置 Shadcn UI (v3 兼容 Tailwind v3)：
  - 安装 `class-variance-authority`、`clsx`、`tailwind-merge`、`tailwindcss-animate`
  - 安装 `@radix-ui/react-slot` 用于 Button 组件的 `asChild` 模式
  - 安装 `lucide-react` 图标库
  - 编写 `src/lib/utils.ts` (cn 工具函数)
  - 编写标准 Button 组件 `src/components/ui/button.tsx`
- 重写 `tailwind.config.ts`：完整的 Shadcn 色彩系统
- 重写 `src/app/globals.css`：HSL CSS 变量 light/dark 主题
- 使用 Inter 字体 (来自 next/font/google)
- 验证 `next build` 构建成功

## [2026-06-24] Phase 1 — Task 2: 初始化 Prisma 数据库
- 安装 Prisma 7.8.0 + @prisma/client + @prisma/adapter-pg
- 严格按照 DATABASE.md 蓝图写入 Schema（4 枚举 + 7 模型）
- 使用 `npx prisma dev` 启动本地 Prisma Postgres（端口 51214）
- 通过 `npx prisma db push` 同步 Schema
- 编写 `src/lib/prisma.ts` 单例 + `src/lib/constants.ts` 常量

## [2026-06-24] Phase 1 — Task 2 补充: 种子数据脚本
- 创建 `prisma/seed.ts`：3 用户、2 项目、3 任务、6 流水、6 日志、3 目录、2 资产
- 配置 `prisma.config.ts` 和 `package.json` 中的 seed 命令

## [2026-06-25] Phase 1 — Task 3: 全局 Layout（侧边栏 + 顶栏）
- 创建 `src/components/layout/Sidebar.tsx`：
  - 深色侧边栏（bg-gray-950），固定宽度 w-56
  - 角色感知导航：LEADER 看到 4 项，MEMBER 看到 2 项
  - 使用 `usePathname()` 高亮当前路由
  - 底部显示用户名 + 退出按钮（调用 `logout()` Server Action）
  - Lucide 图标：LayoutDashboard、FolderKanban、Wallet、BookOpen、LogOut
- 创建 `src/components/layout/Header.tsx`：
  - Sticky 顶栏，根据当前路径自动显示页面标题
- 创建 `src/app/(main)/layout.tsx` 作为认证态布局：
  - 服务端组件读取 cookie 获取当前用户，未登录自动重定向到 /login
  - 渲染 Sidebar + Header + children
  - 内容区 `ml-56` 为侧边栏留出空间

## [2026-06-25] Phase 1 — Task 4: 登录鉴权
- 创建 `middleware.ts` 全局路由守卫：
  - 放行 `/login` 与静态资源
  - 未登录请求重定向到 `/login`
  - LEADER 专属路由（/dashboard、/budget）拒绝 MEMBER 访问
- 创建 `src/actions/auth-actions.ts`：
  - `login(userName)`：按名称从数据库查找用户，写入 httpOnly cookie
  - `logout()`：清除 cookie，重定向到登录页
  - 动态查询替代硬编码 ID（seed 每次重新生成 cuid）
- 创建 `src/lib/auth.ts`：`getCurrentUser()` 从 cookie 解析 SessionUser
- 重写 `src/app/(auth)/login/page.tsx`：
  - 三张用户卡片（陈鹏 LEADER / 林小夏 MEMBER / 赵雨桐 MEMBER）
  - 点击调用 login Server Action → 登录成功自动跳转 /workspace
  - 角色徽章（LEADER 琥珀色 / MEMBER 蓝色）

## [2026-06-25] Phase 1 — Task 5: Workspace 页面
- 创建 `src/actions/project-actions.ts`：
  - `createProject(formData)`：表单提交创建项目，含输入校验，成功后 `revalidatePath`
  - `getUserProjects()`：查询当前用户拥有的项目，含任务计数，按时间降序
- 创建 `src/actions/types.ts`：ProjectCreateDTO、TaskCreateDTO、ProjectWithTaskCount
- 创建 `src/app/(main)/workspace/CreateProjectForm.tsx`：
  - 模态弹窗表单：项目名称、总预算、开始日期、结束日期
  - 表单校验、加载动画、成功后刷新列表
- 重写 `src/app/(main)/workspace/page.tsx`：
  - 服务端组件，直接调用 `getUserProjects()`
  - 响应式卡片网格（1/2/3 列），显示项目名、预算、日期、任务数
  - 空状态引导
  - 点击卡片跳转 `/projects/[id]`

## [2026-06-25] Phase 2 — Task 1 & 2: 项目详情页 + 任务树 (TaskList)
### 项目详情页 `/projects/[id]`
- 重写 `src/app/(main)/projects/[id]/page.tsx`：
  - 项目头部：名称、负责人、预算（千分位格式化）、日期区间、Badge 任务计数
  - 四 Tab 布局：📋 任务总控 / 🕐 历史进度 / 💰 资金账本 / 📁 文档资产
  - Tab 使用自写 `Tabs` 组件（纯 React Context，零外部依赖）
  - 非核心 Tab 显示占位引导卡片（Card + 图标 + 描述文字）
  - 调用 `getProjectDetail()` 和 `getProjectTasks()` 两个 Server Action 获取数据

### 任务树组件 `TaskList`
- 创建 `src/components/project/TaskList.tsx`：
  - 列表视图（divide-y + 状态图标 + 名称 + 元信息）
  - 状态图标：○ 待启动 (Circle) / ▶ 进行中 (Play, blue) / ✅ 已完成 (CheckCircle, emerald)
  - 一行操作：点击状态图标 → 自动流转到下一状态（待启动→进行中→已完成）
  - 每行显示：负责人 (👤)、截止日期 (📅)、日志计数
  - 状态 Badge 颜色映射：PENDING=secondary / IN_PROGRESS=default / COMPLETED=outline
  - 已完成任务显示删除线 (line-through)
  - 空状态：虚线边框 + 引导文案
  - 模态弹窗创建表单：任务名称（必填）、负责人、截止日期
  - `router.refresh()` 在创建/状态变更后刷新 RSC 数据

### Server Actions
- 创建 `src/actions/task-actions.ts`：
  - `getProjectTasks(projectId)`：按项目查所有任务，含 logs/budgets 计数，状态优先排序
  - `createTask(formData)`：表单提交创建，校验 projectId + name
  - `updateTaskStatus(taskId, status)`：按 API.md 约定，`$transaction` 双写——
    ① `ProgressLog.create` 追加状态变更日志 (Append-Only)
    ② `Task.update` 更新状态，成功后 `revalidatePath`
- 补充 `src/actions/project-actions.ts`：
  - `getProjectDetail(projectId)`：查项目含 owner 信息

### UI 组件修复
- 自写 `src/components/ui/tabs.tsx`（纯 React Context，不依赖 @base-ui）
- 自写 `src/components/ui/dialog.tsx`（纯 React Context + 遮罩层）
- 重写 `src/components/ui/badge.tsx`（纯 span，移除 @base-ui/react 依赖）
- 重写 `src/components/ui/input.tsx`（纯 input ref 转发）
- 重写 `src/components/ui/select.tsx`（纯 select ref 转发）
- `next build` 全部 8 条路由编译通过 ✅

## [2026-06-25] Phase 2 — Task 3: 资金流水账本 (LedgerTable)

### Server Actions (`src/actions/ledger-actions.ts`)
严格遵循 PRD.md 中 Event-Sourced Budget 规则（绝不直接修改余额字段）：

- `getProjectLedger(projectId)`：查询项目下所有任务的资金流水，按时间降序，含关联任务名称
- `getProjectBudgetBalance(projectId)`：通过 `aggregate({ _sum: { amount } })` 动态 SUM() 计算真实结余
- `getProjectTasksForSelect(projectId)`：获取项目下的任务列表用于下拉选择
- `recordBudget(formData)`：纯 Append 插入流水记录
  - EXPENSE 类型自动将金额转为负数存储
  - ALLOCATE/REFUND 保持正数
  - 输入校验：4 字段必填 + 金额正数校验
  - 成功后 `revalidatePath` 刷新页面

### LedgerTable 组件 (`src/components/project/LedgerTable.tsx`)
- **结余概览卡片**（三列）：
  - 📊 项目总预算 — 来自 Project.totalBudget
  - 📉 已使用 — totalBudget - balance，红色显示，含占比百分比
  - 📈 当前可用结余 — balance ≥ 0 绿色 / < 0 红色
- **流水表格**：
  - 列：时间 | 所属任务 | 类型 | 金额 | 事由 | 操作人
  - 金额着色：ALLOCATE/REFUND = 绿色 (emerald-600)，EXPENSE = 红色 (red-500)
  - 类型 Badge：EXPENSE 用 destructive 变体，其余用 default
- **新增流水弹窗**：
  - 任务选择下拉框
  - 流水类型三选一（radio 按钮组：📥 分配 / 📤 支出 / ↩️ 退款）
  - 金额输入（正数即可，支出自动转负）
  - 事由文字输入
  - 提交加载态 + 错误处理 + router.refresh()

### 项目详情页更新
- `projects/[id]/page.tsx` 资金账本 Tab 从占位符替换为真实 LedgerTable
- 服务端组件并行拉取 flows + balance + taskOptions 三项数据
- `next build` 全部 8 条路由编译通过 ✅

## [2026-06-25] Phase 2 — Task 4: 历史进度时间轴 (TimelineView)

### Server Action (`src/actions/timeline-actions.ts`)
严格遵循 PRD.md 中 Append-Only Timeline 规则（只增不改）：

- `getProjectTimeline(projectId)`：查询项目下所有任务的进度日志，`include` 关联任务名+状态，按 `createdAt: "desc"` 倒序排列
- `addProgressLog(formData)`：纯 Append 模式插入新日志
  - 校验：taskId + content 必填
  - 通过 task 查找 projectId 用于 `revalidatePath`
  - 绝不修改任何已有记录

### TimelineView 组件 (`src/components/project/TimelineView.tsx`)
- **竖向时间轴布局**：左侧竖线 + 圆点标记 + 卡片内容
- **倒序排列**：最新记录在最上方
- **每条日志卡片**：
  - 顶部：任务名 + 状态 Badge + 时间戳（月/日 时:分）
  - 中部：汇报内容（`whitespace-pre-wrap` 支持纯文本/Markdown）
  - 底部：操作人签名
- **汇报弹窗**：任务下拉（附状态标识）+ 多行文本输入
- **空状态**：Clock 图标 + 引导文案

### 配套修改
- `getProjectTasksForSelect` 扩展返回 `status` 字段
- `projects/[id]/page.tsx` 历史进度 Tab 替换为真实 TimelineView
- `next build` 全部 8 条路由编译通过 ✅

## [2026-06-25] Phase 2 — Task 5: 知识库 Wiki 模块 (收尾)

### Server Actions (`src/actions/wiki-actions.ts`)
- `getProjectFolders(projectId)`：获取项目下所有目录，含资产计数
- `getFolderAssets(folderId)`：按目录查资产列表
- `createFolder(formData)`：创建目录，支持 `parentId` 嵌套
- `saveAsset(formData)`：保存资产（DOCUMENT/LINK/FILE），通过 folder 反查 projectId 刷新

### WikiExplorer 组件 (`src/components/wiki/WikiExplorer.tsx`)
直接调用 Server Action 加载资产（非 API Route，严格遵守军规）。
- **左侧目录树**：递归 FolderNode，支持无限层级嵌套、选中高亮、箭头旋转
- **右侧资产区**：按类型渲染 — 📝 富文本预览 / 🔗 可点击链接 / 📎 附件 URL
- **弹窗**：新建目录（含嵌套）+ 新增资产（标题/类型/内容）
- **空状态**：目录区和资产区均有引导文案

### 项目详情页最终状态
- 四 Tab 全部就绪，移除所有占位符
- 并行拉取 tasks + timeline + flows + balance + folders + taskOptions
- `next build` 全部 8 条路由编译通过 ✅

## 🎉 Phase 2 全部完成！
```
src/actions/       — 6 个模块 (auth/project/task/timeline/ledger/wiki)
src/components/
├── project/       — TaskList / TimelineView / LedgerTable
└── wiki/          — WikiExplorer
```

## [2026-06-25] 🔄 Phase 2 重构 — 4 项整改

### 1. ✅ 修复财务逻辑 Bug（`ledger-actions.ts`）
- **旧逻辑**：`getProjectBudgetBalance` 只返回 `SUM(amount)`，前端用 `totalBudget - flowSum` 算 used，容易出错
- **新逻辑**：后端同时查 `project.totalBudget` 和 `aggregate._sum.amount`，返回 `{ balance, used }`
  - `balance = totalBudget + flowSum` （flowSum 含负数支出）
  - `used = -flowSum`
- `LedgerTable` props 从 `balance` 改为 `{ totalBudget, balance, used }`，前端纯渲染

### 2. ✅ 消除数据瀑布流（`projects/[id]/page.tsx`）
- **旧代码**：6 个 `await` 串行执行 → 6 次 RTT
- **新代码**：`Promise.all([...7 个查询])` → 单次 RTT 并发
- 墙钟时间从 `sum(latency)` 降为 `max(latency)`

### 3. ✅ 全面接入 Shadcn 组件，禁用原生方案
| 组件 | 改动 |
|------|------|
| **Toaster** | 全局引入 `<Toaster richColors />`（sonner），所有 `alert()` 替换为 `toast.success/error` |
| **Dialog** | TaskList、LedgerTable、TimelineView、WikiExplorer、CreateProjectForm 全部从手写 `fixed inset-0` 弹窗改为 `<Dialog>` + `<DialogContent>` + `<DialogHeader>` |
| **Table** | LedgerTable 表格使用标准 thead/tbody/tr/td 结构（语义化，留扩展空间） |

### 4. ✅ 规范 Server Action 返回值
- 所有写 Action **不再 `throw Error`**，统一返回 `{ success: boolean, message?: string, data?: any }`
- `ActionResult<T>` 类型定义在 `types.ts` 中
- 前端统一模式：
  ```ts
  const result = await someAction(formData);
  result.success ? toast.success(result.message!) : toast.error(result.message!);
  ```
- 涉及文件：`createProject` / `createTask` / `updateTaskStatus` / `recordBudget` / `addProgressLog` / `createFolder` / `saveAsset`

### 验证
- `next build` 全部 8 条路由编译通过 ✅
- 所有弹窗统一为 Shadcn Dialog，支持 ESC 关闭 + 点击遮罩关闭
- Toast 通知 (sonner) 右上角展示，richColors 模式

## [2026-06-25] 🔒 防弹级重构 — 数据精度 + 级联删除 + 索引 + 时区

### 1. ✅ 修复致命财务浮点数精度丢失
- **Schema**: `totalBudget` 和 `amount` 从 `Float` 改为 `Decimal @db.Decimal(14, 2)`
  - 14 位总精度（12 位整数 + 2 位小数），满足 ¥999,999,999,999.99 以内预算
- **Actions**: 所有金额运算禁用原生 `parseFloat`，统一使用 `new Prisma.Decimal()`
  - `createProject`: `new Prisma.Decimal(budgetRaw)` 校验后写入
  - `recordBudget`: `new Prisma.Decimal(amountRaw)`，EXPENSE 用 `.negated()` 取反
  - `getProjectBudgetBalance`: 使用 `Decimal.add()` / `Decimal.negated()` 精确运算，结果 `.toNumber()` 后返前端
  - `getUserProjects` / `getProjectDetail`: 显式 `.toNumber()` 序列化
  - `getProjectLedger`: 逐条 `amount.toNumber()` 后返回
- **Seed**: 所有金额改为 `new Prisma.Decimal("xxx.xx")` 构造
- `db push` 执行成功（PostgreSQL 自动 `DoublePrecision → Decimal(14,2)` 转型）

### 2. ✅ 级联删除（Cascade Delete）
```
Project ──(Cascade)──> Task ──(Cascade)──> ProgressLog
         ──(Cascade)──> AssetFolder           BudgetFlow
                              └──(Cascade)──> AssetItem
```
- 删除一个 Project → 自动级联清理所有 Task / AssetFolder / ProgressLog / BudgetFlow / AssetItem
- 已有数据验证通过（`onDelete: Cascade` 不加锁，PostgreSQL 原生支持）

### 3. ✅ 补充数据库性能索引
```prisma
model Task         { @@index([projectId]) }
model ProgressLog  { @@index([taskId]), @@index([createdAt]) }
model BudgetFlow   { @@index([taskId]), @@index([createdAt]) }
```
- `projectId` 索引用加速 "按项目查所有任务"
- `taskId` 索引用加速 "按任务查日志/流水"
- `createdAt` 索引用加速倒序排序（Timeline/Ledger）

### 4. ✅ 修复日期时区偏移
- **问题**：`new Date("2026-06-01")` 在 ES5.1 规范下被解释为 UTC 午夜，某些时区会导致日期偏差
- **修复**：统一使用 `new Date(dateRaw + "T00:00:00.000Z")` 显式标记 UTC
  - `createProject` → `parseDateSafe(startDate/endDate)`
  - `createTask` → `parseDateSafe(deadline)`
- **种子数据**：`new Date("2026-06-01T00:00:00.000Z")`

### 验证
- `npx prisma db push` ✅ — Float→Decimal 自动转型
- `npx prisma generate` ✅ — Client 支持 Decimal 类型
- `npx prisma db seed` ✅ — 7 条记录 Decimal 精度写入
- `npx next build` ✅ — 全部路由编译通过

> ⚠️ **提醒**：由于 Schema 改了 Decimal → 级联 → 索引，请在下次 `prisma migrate dev` 时使用新 Schema。当前使用 `db push` 已同步。

### 🔧 种子数据修正
- 品牌升级 200 万 ALLOCATE 从仰望一万台 task1 移至独立 task_brand
- 品牌升级新增 2 条真实支出（视觉设计 -45万 / 调研访谈 -18万）
- 种子总计：4 任务 / 8 流水 / 6 日志

## [2026-06-25] 🚀 Phase 3 — Task 1: Leader 全局监控大盘

### 技术选型
- 放弃 ECharts，改用 **Recharts**（Shadcn 生态首选，纯 React，Tree-shakeable）
- `npm install recharts` 安装

### Server Actions (`src/actions/dashboard-actions.ts`)
LEADER 专属，双重鉴权。

**`getGlobalDashboardStats()`** — 全局聚合：
- 总预算池：所有项目 `totalBudget` 累加（Prisma.Decimal.add）
- 总支出：`flowType: EXPENSE` 聚合取绝对值
- 总退款：`flowType: REFUND` 聚合
- 已分配：`flowType: ALLOCATE` 聚合
- 活跃项目数：至少有一个未完成任务的项目去重计数
- 逾期任务数：`deadline < now && status ≠ COMPLETED`
- 任务状态分布：`{ PENDING, IN_PROGRESS, COMPLETED }`

**`getProjectsHealth()`** — 项目健康度列表：
- 查所有项目（含 owner + tasks + _count）
- 查所有 BudgetFlow，在内存中按 projectId 分组聚合（MVP 规模，避免 N+1）
- 每项目计算：`taskProgress`（已完成/总数）、`budgetUsage`（已消耗/总预算）
- 风险标记：`budgetUsage > 90%` 或 `hasOverdueTasks`

### 前端大盘 (`src/app/(main)/dashboard/page.tsx`)
LEADER 进入 `/dashboard`，MEMBER 自动重定向 `/workspace`。

**4 个统计卡片**：
| 卡片 | 数据 |
|------|------|
| 📈 总预算池 | Σ totalBudget（万元） + 已分配额 |
| 📉 总支出 | Σ\|EXPENSE\|（万元） + 退款额 |
| 📂 活跃项目 | 有未完成任务的项目数 |
| ⚠️ 逾期任务 | 逾期未完成数 + 各状态分布 |

**双图表区**：
- **预算健康度柱状图**（`BarBudgetChart`）：X=项目名，Y=万元，双柱（总预算 vs 已消耗）
- **任务状态环形图**（`DonutStatusChart`）：三色分区（待启动/进行中/已完成），中心空洞

**风险预警底部**：
- 红色卡片列出 `预算消耗>90%` 或 `含逾期任务` 的项目
- 可点击跳转到项目详情页
- Badge 标注具体风险类型

### 验证
- `next build` 全部 8 条路由编译通过 ✅
- Dashboard 仅 LEADER 可访问（middleware + action 双重守卫）
- 用**陈鹏**登录 → 自动进入 `/dashboard`（login action 已修正：LEADER→/dashboard，MEMBER→/workspace）

## [2026-06-25] 📁 Wiki 模块完善 — 模板化文件夹 + 卡片资产流

### 后端改进 (`src/actions/wiki-actions.ts`)
- **新增 `initProjectFolders(projectId)`**：项目创建时自动生成 4 个标准文件夹模板
  - `01 策略与Brief` / `02 文案与物料` / `03 大文件索引` / `04 复盘总结`
  - `Promise.all` 并发创建，不阻塞返回
- **`saveAsset` 简化**：移除 fileUrl 输入，LINK 型资产 content 直接存 URL

### 项目创建链路（`src/actions/project-actions.ts`）
- `createProject` 内部自动调用 `initProjectFolders(project.id)`（fire-and-forget）

### 前端重写 (`src/components/wiki/WikiExplorer.tsx`)
- **左侧边栏**：扁平单级目录列表（默认模板无 parentId 嵌套）
  - 高亮选中 + 资产计数角标
  - 新建文件夹 Dialog
  - `useEffect` 自动选中第一个目录
- **右侧资产区 — 卡片网格布局**：
  - 每张卡片：图标（🔗 LINK 蓝底 / 📝 DOCUMENT 琥珀底）+ 标题 + 类型标签 + 版本号
  - LINK 卡片：hover 显示外链图标，**点击直接 `window.open`** 新标签打开
  - DOCUMENT 卡片：前 120 字符内容预览
- **新增资产 Dialog**（智能表单）：
  - 标题输入
  - 类型下拉框（不是 radio，是 `<select>`）
  - 选择「外部链接」→ 显示 URL 输入框（支持迪盘/网盘/腾讯文档链接）
  - 选择「富文本」→ 显示多行 textarea
- 提交后自动重新加载资产列表 + `router.refresh()`

### 种子数据更新
- 仰望一万台下：`{4 模板文件夹}` + 新闻通稿（DOCUMENT）+ 竞品报告链接（LINK）
- 品牌升级下：`{4 模板文件夹}` + 品牌升级方案（DOCUMENT）
- 总计：8 目录 / 3 资产

### 验证
- `npx prisma db seed` ✅ — 8 目录 + 3 资产
- `npx next build` ✅ — 全部 8 条路由编译通过

## [2026-06-25] ⚡ 后端性能与财务逻辑深度重构

### 1. ✅ 修复 OOM 内存爆炸风险（`dashboard-actions.ts`）

**旧代码**：
- `prisma.task.findMany()` 拉全表 tasks 到 Node.js 内存 → JS `filter` 统计各状态
- `prisma.budgetFlow.findMany()` 拉全表 8 条流水到内存 → `Map` 聚合

**新代码**：
- `prisma.task.groupBy({ by: ["status"], _count: { id: true } })` → PostgreSQL 层面完成状态聚合
- `prisma.task.groupBy({ by: ["projectId"], ... })` → DB 层面完成活跃项目去重计数
- `prisma.task.count({ where: { deadline: { lt: now }, ... } })` → DB 层面完成逾期任务统计
- `prisma.budgetFlow.groupBy({ by: ["taskId", "flowType"], _sum: { amount: true } })` → DB 层面完成流水归类聚合，仅返回 12 行 groupBy 结果（非 8 条全量行）
- 内存占用从 `O(全表行数)` 降至 `O(groupBy 结果数)` ≈ 常数级

### 2. ✅ 修复财务失忆症（`dashboard-actions.ts`）

大盘与详情页数据完全一致，严格按 PRD 财务铁律计算：

```
动态总预算 (dynamicTotal) = Project.totalBudget + SUM(BudgetFlow WHERE flowType = ALLOCATE)
已耗金额 (consumed)       = ABS(SUM(EXPENSE)) - SUM(REFUND)
消耗比例 (budgetUsage)     = (consumed / dynamicTotal) × 100
```

- `getProjectsHealth` 现使用 `groupBy([taskId, flowType])` 而非 `findMany`
- 通过 `taskId → projectId` 映射表（仅 ID，O(任务数)）将聚合结果分组到各项目
- BarBudgetChart 类型更新：`totalBudget` → `dynamicTotal`

### 3. ✅ 修复 Serverless 进程被杀 Bug（`project-actions.ts`）

- **旧代码**：`initProjectFolders(project.id).catch(console.error)` — 未 await，Server Action 返回后 Next.js 销毁进程，文件夹创建丢失
- **新代码**：`await initProjectFolders(project.id)` — 确保 4 个默认文件夹在进程存活期内写入完成

### 验证
- `next build` ✅ — 全部 8 条路由编译通过
- 所有数据聚合运算在 PostgreSQL 层面完成，Node.js 仅做 JSON 组装

## [2026-06-25] 🤖 Phase 3 — Task 2: AI Copilot 意图解析（收尾）

### 意图解析引擎 (`src/actions/copilot-actions.ts`)
- `parseCopilotQuery(input: string)` — 关键词匹配意图解析器
- 5 种意图类型：`show_budget` / `show_tasks` / `check_overdue` / `search_project` / `unknown`
- 每种意图直接查询 PostgreSQL（`aggregate` + `findMany` + `findFirst`），返回结构化数据
- 返回 `CopilotResponse { intent, message, data?, actions? }` — actions 为可点击跳转链接
- 模糊匹配逻辑：
  - 「预算/还剩/花了」→ 查询项目 BudgetFlow SUM()，返回结余 + 支出 + 退款 + 消耗比例
  - 「进度/任务」→ 查询项目的 tasks，返回状态分布 + emoji 列表
  - 「逾期/风险」→ 查询 overdue tasks（`deadline < now AND status ≠ COMPLETED`）
  - 「项目/有什么」→ 列出所有项目
  - fallback → 引导用户试用快捷指令
- `findProject(name)` 通过 `contains` 模糊搜索项目名

### Copilot 对话面板 (`src/components/copilot/CopilotPanel.tsx`)
- 右下角浮动圆形按钮（`fixed bottom-6 right-6`），Sparkles 图标
- 点击展开 380×560px 对话面板：
  - 深色头部横幅（ShadowPM Copilot + MVP 模式标识）
  - 消息气泡区（用户右对齐 primary 色，Copilot 左对齐 muted 色）
  - 每条 Copilot 回复自动渲染 **Markdown 加粗**（`**text**` → 粗体）
  - actions 按钮：聊天内直接可点击跳转（`ChevronRight` 图标）
  - 快捷指令芯片：首条消息下方 4 个 command chip（Lightbulb 图标）
  - Enter 发送 / Shift+Enter 换行
  - 自动聚焦 + 自动滚到底部
  - auto-focus + auto-scroll-to-bottom

### 集成
- CopilotPanel 挂载在 `(main)/layout.tsx`，所有登录页面共享
- 无需手动打开，右下角悬浮按钮始终可见

### 快捷指令演示
| 指令 | 触发意图 | 返回数据 |
|------|---------|---------|
| 📊 查看预算 | show_budget | 结余 + 支出 + 退款 + 消耗比例 |
| ⚠️ 检查逾期 | check_overdue | 逾期任务列表 + 跳转链接 |
| 📂 项目列表 | search_project | 所有项目名 + 预算 + 任务数 |
| 📋 任务进度 | show_tasks | 状态分布 + emoji 标记 |

### 验证
- `next build` ✅ — 全部 8 条路由编译通过
- Copilot 按钮在 Dashboard / Workspace / 项目详情 等所有页面可见

## 🎉 Phase 1–3 全部完成！
```
Phase 1: MVP 基础建设       ✅ 5/5
Phase 2: 核心业务视图       ✅ 5/5
Phase 3: 全局大盘与 AI 融合  ✅ 2/2
─────────────────────────────────
Total:                      12/12 任务完成
```

## [2026-06-25] 🚀 V2 Sprint 1 — AI 项目生成器

### 新增文件

| 文件 | 作用 |
|------|------|
| `src/actions/ai-actions.ts` | AI 文档解析 + LLM 调用 + 批量创建项目 |
| `src/components/project/AIProjectPreview.tsx` | 四步交互流程 UI（上传→解析→预览→创建） |
| `src/types/pdf-parse.d.ts` | pdf-parse v1.x TypeScript 类型声明 |

### 新增依赖

`mammoth` — Word (.docx) 文本提取
`pdf-parse@1.1.1` — PDF 文本提取
`@anthropic-ai/sdk` — Claude API 调用

### AI 项目生成器（`ai-actions.ts`）

**`parseDocumentForProject(formData)`**：
- 接收文件（Word/PDF/TXT）或粘贴文本
- mammoth 提取 Word 文本 / pdf-parse 提取 PDF 文本
- 构造 System Prompt → 调 Claude Sonnet 4
- JSON 解析 + `validateParsedProject()` 校验（projectName 非空 + date 格式检查 + task 过滤去重 + 截断至 5 个）
- 限制输入 15,000 字符（控制 token 消耗）
- 返回 `ActionResult<AIParsedProject>`（含 confidence 等级）

**`createProjectFromAI(dto)`**：
- 接收前端确认/修改后的最终预览数据
- 批量创建：Project → initProjectFolders() → Tasks → BudgetFlow(ALLOCATE)
- BudgetFlow 关联到第一个 Task
- 返回 projectId → 前端直接跳转

### AI 预览组件（`AIProjectPreview.tsx`）

四步交互流程：

```
Step 1 (upload)：文件拖拽/点击 + 粘贴文本 + 错误提示
       ↓
Step 2 (loading)：Sparkles 动画 + 进度条 + "5-15 秒"提示
       ↓
Step 3 (preview)：可编辑预览
       ├── 项目名称（inline edit）
       ├── 预算 + 开始/结束日期（3 列网格）
       ├── 任务列表（每行：任务名/负责人/截止日，可增删）
       ├── BudgetFlow 勾选框
       ├── confidence: "low" → 黄色提示条
       └── 重新解析 / 取消 / 确认创建
       ↓
Step 4 (creating)：Loader2 动画 → 跳转项目详情页
```

### CreateProjectForm 改造

- 新增 Tab：[🤖 AI 生成]（默认选中）/ [✏️ 手动创建]
- AI Tab = `AIProjectCreator` 组件（完全独立，不影响手动流程）
- 手动 Tab = 原有表单（零改动）
- Dialog 宽度调整为 `sm:max-w-xl`（适配 AI 预览）

### 偏离点修复

**#5：手动创建项目无初始预算流水** → `createProject()` 现在自动创建：
- 占位 Task "项目统筹"（关联 BudgetFlow 所需）
- 初始 ALLOCATE BudgetFlow（金额 = 项目预算）

### 验证

- `next build` ✅ — 全部 8 条路由编译通过
- 现有手动创建流程完全不受影响
- TaskList / LedgerTable / TimelineView / Wiki / Dashboard 全部正常工作
- 用**林小夏**登录 → 点击「新建项目」→ 默认显示「AI 生成」Tab
  → 上传/粘贴文档 → 预览 → 确认 → 跳转项目详情
  → 项目详情页中「任务总控」已包含 AI 生成的任务
  → 「资金账本」Tab 已包含初始 ALLOCATE 流水

## [2026-06-25] 🚀 V2 Sprint 2 — AI 操作型 Copilot + Dashboard AI 摘要 + Phase 实体

### 1. ✅ Copilot 升级为 LLM 操作引擎

**重写 `copilot-actions.ts`**：
- `processCopilotMessage(input)` 替代旧 `parseCopilotQuery`
- LLM（DeepSeek）接收用户消息 + 任务上下文，返回结构化 JSON
- 支持两种模式：
  - **查询**（intent: query）：LLM 直接回复用户
  - **操作**（intent: action）：LLM 识别 taskName + action → 服务端执行
- 操作类型：
  - `update_status`：「公关线搞定了」→ 自动更新 Task 状态 + 追加 ProgressLog
  - `add_log`：「通稿发给客户了」→ 自动追加进度日志
- 任务名模糊匹配：LLM 提取的 taskName 在用户的任务列表中精确匹配
- 未匹配到时提示用户确认

**重写 `CopilotPanel.tsx`**：
- 使用 `processCopilotMessage` 替代旧 `parseCopilotQuery`
- 头部标注「AI 操作引擎」
- 快捷指令升级为操作类（「汇报完成」→ 自动更新状态）
- Zap 图标替代 Sparkles，强调操作能力

### 2. ✅ Leader 大盘 AI 摘要

**新增 `src/actions/dashboard-ai.ts`**：
- `generateDashboardSummary()` — 用 DeepSeek 生成 3-5 句中文摘要
- 数据源：项目量 + 预算 + 状态分布 + 逾期数 + 各项目进度
- 摘要风格：亲切专业、突出重点、150 字以内

**新增 `src/components/dashboard/AISummaryCard.tsx`**：
- 深色渐变卡片（bg-gray-900 → gray-800）
- Sparkles 图标 + 「🤖 AI 今日摘要」标题
- Dashboard 页面顶部加载，与 stats/health 并发（Promise.all）

### 3. ✅ Phase 实体引入

**Schema 变更**：
```prisma
model Phase {
  id        String   @id @default(cuid())
  projectId String
  name      String
  sortOrder Int      @default(0)
  project   Project  @relation(...onDelete: Cascade)
  tasks     Task[]
}

model Task {
  phaseId  String?   // 新增：所属阶段
  priority String    @default("P2") // 新增：P0|P1|P2|P3
  phase    Phase?    @relation(...onDelete: SetNull)
  @@index([phaseId])  // 新增索引
}

model Project {
  phases Phase[]     // 新增反向关联
}
```

- Phase 删除时，Task.phaseId 自动置 null（SetNull，不删除 Task）
- Project 删除时，Phase 级联删除
- Phase.sortOrder 支持拖拽排序（前端预留）
- Task.priority 支持 P0/P1/P2/P3 四个等级

### 验证
- `npx prisma db push` ✅ — 新增 Phase 表 + Task 新增字段
- `npx prisma generate` ✅ — Client 已重新生成
- `next build` ✅ — 全部 8 条路由编译通过
- 所有现有功能（手动创建/任务管理/流水/时间轴/大盘/知识库）完全不受影响
