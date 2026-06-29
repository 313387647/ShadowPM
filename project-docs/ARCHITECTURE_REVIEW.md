# ShadowPM 系统架构与代码评审交接文档

> **文档版本**: v1.0  
> **编制日期**: 2026-06-25  
> **评审范围**: Phase 1–3 MVP 完整交付物（42 个源文件）  
> **审查对象**: 外部第三方技术评审员  

---

## 1. 项目背景与执行愿景 (Executive Summary)

### 1.1 项目定位

**ShadowPM** 是一个为营销/公关团队量身定制的**"轻量级智能项目管控系统"（影子项目管理器）**。

它的存在意义是替代以下两种现实工作中的反模式：

| 反模式 | 痛点 | ShadowPM 的解法 |
|--------|------|-----------------|
| **OA 审批系统** | 繁冗的提交-驳回-重新提交流转链条 | 完全移除 OA 式审批，任务状态由负责人自主流转 |
| **Excel 表格** | 多人编辑冲突、预算算错、历史丢失 | 数据库强一致 + 事件溯源 + Append-Only 不可篡改日志 |

### 1.2 四大核心业务支柱

无论打开系统的哪个页面，所有功能都围绕以下四点展开：

```
┌─────────────────────────────────────────────────────────┐
│  1. 结构化任务控制 (Task Tree)                            │
│     Project → Task → 状态机 (PENDING/IN_PROGRESS/COMPLETED) │
│     每个 Task 有独立负责人、Deadline                        │
├─────────────────────────────────────────────────────────┤
│  2. 事件溯源资金账本 (Event-Sourced Budget)                │
│     绝不直接修改余额字段                                    │
│     所有预算变动 = 流水记录 (ALLOCATE / EXPENSE / REFUND)    │
│     当前结余 = Prisma.Decimal SUM(BudgetFlow.amount)        │
├─────────────────────────────────────────────────────────┤
│  3. 追加式时间轴日志 (Append-Only Timeline)                │
│     进度汇报、状态变更 = ProgressLog.create() 纯追加        │
│     无 UPDATE / DELETE 操作，形成不可篡改的倒序时间轴         │
├─────────────────────────────────────────────────────────┤
│  4. 轻量级知识库 (Asset & Wiki Hub)                        │
│     每个项目自带 4 个标准目录模板                            │
│     支持富文本文档 + 外部链接（迪盘/网盘）+ 附件              │
└─────────────────────────────────────────────────────────┘
```

### 1.3 用户角色与权限模型

| 角色 | 权限范围 | 首屏 |
|------|---------|------|
| **LEADER** (陈鹏) | 全局大盘 Dashboard、所有项目详情、预算中心 | `/dashboard` |
| **MEMBER** (林小夏、赵雨桐) | 仅自己负责的项目、工作台 | `/workspace` |

权限控制位置：
- **Middleware** (`middleware.ts`): 路由级守卫，LEADER 专属路由（`/dashboard`、`/budget`）拒绝 MEMBER
- **Server Actions**: 二次鉴权，`getGlobalDashboardStats()` / `getProjectsHealth()` 仅允许 `role === "LEADER"`

---

## 2. 技术栈与架构核心 (Tech Stack & Architecture)

### 2.1 完整技术栈

| 层级 | 技术选型 | 版本 | 选型理由 |
|------|---------|------|---------|
| **框架** | Next.js | 14.2.35 | App Router + RSC + Server Actions，一栈式全栈框架 |
| **语言** | TypeScript | 5.x | 全项目严格模式 (`strict: true`) |
| **样式** | Tailwind CSS | 3.4.x | 原子化 CSS，配合 Shadcn UI 设计系统 |
| **组件库** | Shadcn UI (v3 兼容) | — | Radix-slot + CVA，源码纳入项目（非黑盒依赖） |
| **图表** | Recharts | 2.x | 纯 React 实现，Tree-shakeable，替代 ECharts |
| **图标** | Lucide React | 1.21.x | 轻量、Tree-shakeable |
| **Toast** | Sonner | 2.x | 原生 React 18 支持，`richColors` 模式 |
| **ORM** | Prisma | 7.8.0 | 支持 PostgreSQL Driver Adapter、Decimal 类型、groupBy/aggregate |
| **数据库** | PostgreSQL | — | 通过 Prisma Postgres (本地 dev 模式，端口 51214) |
| **Driver Adapter** | @prisma/adapter-pg | 7.8.0 | Prisma 7 强制要求，替代传统 `pg` 直连 |

### 2.2 架构核心原则：零 API Routes，全 Server Actions

**我们完全放弃了传统的 Next.js API Routes (`/api/*`)**。所有后端逻辑均通过 `'use server'` 指令实现。

```
传统模式：
  前端 fetch("/api/projects") → route.ts → prisma.findMany() → Response.json()
                              ↑ 需要单独的路由文件、序列化、错误处理

ShadowPM 模式：
  RSC page.tsx → await getProjectTasks(id) → prisma.task.findMany()
                   ↑ 'use server' action     ↑ 直接返回类型安全的数据
```

**优势**：
1. **类型安全贯通**：Server Action 的返回类型自动推导到前端，无需手动维护 API 契约
2. **零文件冗余**：不需要 11 个 `route.ts` 文件（项目 6 个 action 模块覆盖全部业务）
3. **React 深度集成**：`revalidatePath()` 一行刷新 RSC 缓存，无需前端 refetch
4. **安全**：`'use server'` 函数不会被意外暴露为公开端点

### 2.3 目录架构（生产级状态）

```
src/
├── actions/                         ← 8 个 Server Action 模块（零 API Route）
│   ├── types.ts                     ← 统一 ActionResult<T> 类型
│   ├── auth-actions.ts              ← login / logout（cookie session）
│   ├── project-actions.ts           ← CRUD + initProjectFolders
│   ├── task-actions.ts              ← CRUD + status with auto-log
│   ├── timeline-actions.ts          ← Append-Only 进度日志
│   ├── ledger-actions.ts            ← Event-Sourcing 资金账本
│   ├── dashboard-actions.ts         ← Leader 大盘（PostgreSQL groupBy 聚合）
│   └── wiki-actions.ts              ← 知识库目录/资产
│
├── app/
│   ├── layout.tsx                   ← 根布局 + Toaster (sonner)
│   ├── page.tsx                     ← 首页重定向
│   ├── (auth)/login/page.tsx        ← 三用户卡片登录页
│   └── (main)/
│       ├── layout.tsx               ← 认证态布局（Sidebar + Header）
│       ├── dashboard/page.tsx       ← Leader 全局大盘（LEADER only）
│       ├── workspace/
│       │   ├── page.tsx             ← Member 项目列表（RSC）
│       │   └── CreateProjectForm.tsx← 新建项目 Dialog
│       └── projects/[id]/page.tsx   ← 项目控制台（四 Tab，Promise.all 并发）
│
├── components/
│   ├── ui/                          ← 9 个自写组件（零 @base-ui 依赖）
│   │   ├── badge.tsx                ← 纯 span
│   │   ├── button.tsx               ← Radix Slot + CVA
│   │   ├── card.tsx                 ← 纯 div
│   │   ├── dialog.tsx               ← 纯 React Context（自写，不依赖 @base-ui）
│   │   ├── input.tsx                ← 原生 input ref 转发
│   │   ├── label.tsx                ← 原生 label
│   │   ├── select.tsx               ← 原生 select ref 转发
│   │   ├── tabs.tsx                 ← 纯 React Context（自写）
│   │   └── textarea.tsx             ← 原生 textarea
│   ├── layout/
│   │   ├── Sidebar.tsx              ← 深色侧边栏 + 角色感知导航
│   │   └── Header.tsx               ← Sticky 顶栏
│   ├── project/
│   │   ├── TaskList.tsx             ← 任务树 + 状态流转 + Dialog 创建
│   │   ├── TimelineView.tsx         ← 竖线时间轴 + 倒序 Append-Only
│   │   └── LedgerTable.tsx          ← 财务三卡片 + 流水表格 + Dialog 记账
│   ├── dashboard/
│   │   ├── BarBudgetChart.tsx       ← Recharts 预算柱状图
│   │   └── DonutStatusChart.tsx     ← Recharts 环形状态图
│   └── wiki/
│       └── WikiExplorer.tsx         ← 目录树 + 卡片网格 + Dialog 智能表单
│
├── lib/
│   ├── auth.ts                      ← getCurrentUser (cookie → SessionUser)
│   ├── prisma.ts                    ← PrismaPg adapter 单例
│   ├── utils.ts                     ← cn() (clsx + tailwind-merge)
│   └── constants.ts                 ← 导航、角色、状态映射
│
├── generated/prisma/                ← Prisma 7 Client 生成目录
│
middleware.ts                        ← 路由守卫（cookie 解析 + 角色 RBAC）
prisma/
├── schema.prisma                    ← 7 模型 + 4 枚举 + 级联 + 索引 + Decimal
├── seed.ts                          ← 幂等种子脚本（8 目录 / 4 任务 / 8 流水 / 6 日志 / 3 资产）
└── config.ts                        ← Prisma 7 配置（含 seed 命令）
```

---

## 3. 核心数据库与业务逻辑设计 (Core Schema & Business Logic)

### 3.1 Prisma Schema 精简版

```prisma
enum Role      { LEADER MEMBER }
enum TaskStatus { PENDING IN_PROGRESS COMPLETED }
enum FlowType  { ALLOCATE EXPENSE REFUND }
enum AssetType { DOCUMENT LINK FILE }

model User {
  id   String @id @default(cuid())
  name String
  role Role   @default(MEMBER)
  projects Project[]
}

model Project {
  id          String  @id @default(cuid())
  name        String
  ownerId     String
  totalBudget Decimal @db.Decimal(14, 2)         // ← Decimal 精度
  startDate   DateTime?
  endDate     DateTime?
  owner       User    @relation(fields: [ownerId], references: [id])
  tasks       Task[]
  folders     AssetFolder[]
}

model Task {
  id        String     @id @default(cuid())
  projectId String
  name      String
  assignee  String?
  deadline  DateTime?
  status    TaskStatus @default(PENDING)
  project   Project    @relation(fields: [projectId], references: [id], onDelete: Cascade)
  logs      ProgressLog[]
  budgets   BudgetFlow[]
  @@index([projectId])
}

model ProgressLog {
  id        String   @id @default(cuid())
  taskId    String
  content   String                                    // 支持 Markdown
  createdBy String
  createdAt DateTime @default(now())
  task      Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  @@index([taskId])
  @@index([createdAt])
}

model BudgetFlow {
  id          String   @id @default(cuid())
  taskId      String
  flowType    FlowType
  amount      Decimal  @db.Decimal(14, 2)
  description String
  createdBy   String
  createdAt   DateTime @default(now())
  task        Task     @relation(fields: [taskId], references: [id], onDelete: Cascade)
  @@index([taskId])
  @@index([createdAt])
}

model AssetFolder {
  id        String      @id @default(cuid())
  projectId String
  name      String
  parentId  String?                                    // 支持树状层级
  project   Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assets    AssetItem[]
}

model AssetItem {
  id      String    @id @default(cuid())
  folderId String
  title   String
  type    AssetType
  content String?    // 富文本或外部链接
  fileUrl String?
  version Int       @default(1)
  folder  AssetFolder @relation(fields: [folderId], references: [id], onDelete: Cascade)
}
```

### 3.2 级联删除策略 (Cascade Delete)

```
Project ──(Cascade)──> Task ──(Cascade)──> ProgressLog
         ──(Cascade)──> AssetFolder        BudgetFlow
                              └──(Cascade)──> AssetItem
```

删除一个 Project → PostgreSQL 自动级联清理所有子孙数据，无孤儿行。

### 3.3 🔑 核心财务逻辑：事件溯源预算（Event-Sourced Budget）

**这是系统最关键的架构决策。** 本系统严格禁止直接修改任何余额字段。

#### 为什么不用传统做法？

传统系统中常见：
```sql
-- ❌ 反模式：直接修改余额
UPDATE Project SET remainingBudget = remainingBudget - 350000 WHERE id = '...';
```

问题：
1. **不可审计**：无法追溯谁在何时、因为什么扣了钱
2. **并发冲突**：两笔支出同时修改同一条记录，依赖数据库行锁
3. **纠错困难**：扣错一笔钱需要反向操作，没有历史记录

#### ShadowPM 的做法：流水账本

```typescript
// 所有资金变动皆为流水行（不可变追加）
// ✅ EXPENSE：存储为 -350000
await prisma.budgetFlow.create({
  data: {
    taskId: "xxx",
    flowType: "EXPENSE",
    amount: new Prisma.Decimal("-350000.00"),      // ← Prisma.Decimal 构造函数
    description: "新闻通稿撰写及媒体投放费用",
    createdBy: "林小夏",
  },
});

// ✅ ALLOCATE：存储为 +5000000
await prisma.budgetFlow.create({
  data: {
    taskId: "xxx",
    flowType: "ALLOCATE",
    amount: new Prisma.Decimal("5000000.00"),
    description: "仰望一万台项目初始预算分配",
    createdBy: "陈鹏",
  },
});

// ✅ REFUND：存储为 +15000
await prisma.budgetFlow.create({
  data: {
    taskId: "xxx",
    flowType: "REFUND",
    amount: new Prisma.Decimal("15000.00"),
    description: "达人档期冲突退款",
    createdBy: "林小夏",
  },
});
```

#### 结余计算（服务端精确运算）

```typescript
// src/actions/ledger-actions.ts
export async function getProjectBudgetBalance(projectId: string) {
  const [project, flowAgg] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { totalBudget: true },
    }),
    prisma.budgetFlow.aggregate({
      _sum: { amount: true },
      where: { task: { projectId } },
    }),
  ]);

  const totalBudget = project?.totalBudget ?? new Prisma.Decimal(0);
  const flowSum = flowAgg._sum.amount ?? new Prisma.Decimal(0);

  // 结余 = 流水总和（ALLOCATE − EXPENSE + REFUND）
  const balance = flowSum;
  // 已使用 = 项目总预算 − 当前结余
  const used = totalBudget.sub(balance);

  return { balance: balance.toNumber(), used: used.toNumber() };
}
```

#### 为什么用 `Prisma.Decimal` 而非 `Float`？

| 问题 | Float (Float64) | Decimal(14,2) |
|------|-----------------|---------------|
| `0.1 + 0.2` | `0.30000000000000004` ❌ | `0.30` ✅ |
| `5000000.00 + 0.01` | 可能丢失 0.01 | 精确保留 |
| 金额累加 | 累积误差随行数增长 | 零误差 |

**历史教训**：在 `npm install` 过程中，Prisma 曾被意外降级到 5.x，导致 Decimal 类型丢失、`@prisma/adapter-pg` 消失。该问题已修复并纳入 CI checklist。

#### 大盘与详情页的财务一致性

两个页面的公式严格统一：

```
详情页 (ledger-actions.ts):
  balance = SUM(amount)                      ← 流水总和即结余
  used    = totalBudget − SUM(amount)        ← 预算 − 结余

大盘 (dashboard-actions.ts):
  dynamicTotal = totalBudget + SUM(ALLOCATE) ← 初始预算 + 追加分配
  consumed     = ABS(SUM(EXPENSE)) − SUM(REFUND)  ← 纯支出 − 退款
  budgetUsage  = (consumed / dynamicTotal) × 100
```

> **注意**：大盘使用 `dynamicTotal` 而非 `totalBudget`，因为项目在创建后可能通过 ALLOCATE 追加预算。详情页已含初始预算的 ALLOCATE，公式等价。

### 3.4 🔐 历史进度：Append-Only（只增不改）

所有状态变更和进度汇报，只能通过 `prisma.progressLog.create()` 追加新行。

```
系统绝不执行的操作：
  ❌ UPDATE ProgressLog SET content = '...' WHERE id = '...';
  ❌ DELETE FROM ProgressLog WHERE id = '...';
  ❌ UPDATE Task SET status = '...' 后不记日志;

系统强制执行的操作：
  ✅ 状态流转 → $transaction([
       ProgressLog.create({ content: "状态变更: 待启动→进行中" }),
       Task.update({ status: "IN_PROGRESS" }),
     ])
```

**审计链示例**（仰望一万台——公关传播线）：
```
2026-06-25 16:30  📦 3 位达人已确认合作，Brief 已发出           — 林小夏
2026-06-25 11:00  📞 与 12 家核心媒体确认发布会档期              — 林小夏
2026-06-20 09:00  ✍️ 新闻通稿 V1 已交付                          — 林小夏
2026-06-15 09:00  📋 公关传播线正式启动，已完成媒体名单初筛       — 林小夏
2026-06-15 08:00  📌 状态变更：待启动 → 进行中                  — 林小夏 (自动)
```

### 3.5 🔐 Cookie-Based Session（轻量鉴权）

```typescript
// 登录时写入 httpOnly cookie
cookieStore.set("shadowpm-session", `${userId}:${userName}:${userRole}`);

// middleware.ts 解析 cookie
const [, , role] = session.value.split(":");
```

**警告**：本系统**未使用** JWT、bcrypt、OAuth 等生产级认证方案。当前实现是 MVP 阶段的轻量替代，建议生产环境替换为 NextAuth.js 或 Clerk。

---

## 4. MVP 阶段的技术妥协与已知问题 (Known Trade-offs in MVP)

### 4.1 认证与安全

| 妥协项 | 现状 | 建议升级方案 |
|--------|------|-------------|
| **登录鉴权** | Cookie 明文 `userId:userName:role`，无加密、无签名 | 替换为 NextAuth.js + JWT 签名 |
| **密码机制** | 无密码，点击用户卡片直登 | 接入 OAuth 2.0 (Google/Microsoft) 或 Email Magic Link |
| **CSRF 防护** | 无（Server Actions 内部有 origin 校验，但未显式配置） | 启用 CSRF token |
| **行级权限 (RLS)** | 无。任何登录用户拿到 projectId 即可访问任意项目详情 | 在 `getProjectDetail` 等 action 中加入 `ownerId` 校验 |

### 4.2 数据持久化与运维

| 妥协项 | 现状 | 建议升级方案 |
|--------|------|-------------|
| **数据库** | Prisma Postgres dev 模式（本地 `npx prisma dev`，端口 51214），每次重启数据库数据存活但连接池有限 | 迁移到生产环境 PostgreSQL（如 Supabase / Railway / RDS） |
| **数据库迁移** | 使用 `prisma db push` 同步 Schema（无 migration 文件记录历史变更） | 使用 `prisma migrate dev` 生成 migration 文件，纳入 Git |
| **连接泄漏** | `prisma dev` 重启时旧的 51214 端口进程可能残留，需手动 `kill` | 生产环境使用 managed PostgreSQL 连接池 |

### 4.3 前端架构

| 妥协项 | 现状 | 建议升级方案 |
|--------|------|-------------|
| **Tab 数据加载** | 进入项目详情页时 `Promise.all` 一次性拉取全部 6 路数据（tasks、timeline、flows、balance、folders、taskOptions），即使有些 Tab 未被点击 | 每个 Tab 使用 `<Suspense>` + React Server Components 按需流式加载 |
| **Wiki 状态管理** | `useState` 客户端状态驱动目录切换和资产加载，URL 不变 | 使用 `useSearchParams` 将选中目录编码到 URL（可分享、可回退） |
| **表单校验** | 纯 HTML5 原生校验（`required`、`type="number"`），无客户端级联校验 | 引入 `react-hook-form` + `zod` 实现复杂校验（如预算上限、日期先后顺序） |
| **Debounce 搜索** | 无搜索功能 | 为项目列表 / 任务列表添加 `useTransition` + `useDebouncedCallback` 搜索 |
| **国际化 (i18n)** | 所有中文硬编码在 JSX 和状态映射中 | 抽取为 i18n JSON，支持切换语言 |

### 4.4 后端性能

| 妥协项 | 现状 | 建议升级方案 |
|--------|------|-------------|
| **Dashboard 聚合** | `Promise.all` 9 路并发查询（已从 `findMany` 重构为 `groupBy` + `aggregate`），MVP 量级（3 用户、2 项目、4 任务）无明显瓶颈 | 用户量 > 100 时需为 `budgetFlow` 添加复合索引 `@@index([flowType, createdAt])` |
| **项目健康度** | `getProjectsHealth` 仍使用 `project.findMany`（包含 tasks），因为需要跨表判断逾期 | 当项目数 > 100 时考虑定时任务预聚合到缓存表 |
| **无缓存层** | 所有请求直连 PostgreSQL，无 Redis / in-memory cache | 引入 `unstable_cache`（Next.js 14 实验性 API）或 Redis 缓存大盘统计数据 |

### 4.5 种子数据

| 当前状态 | 说明 |
|---------|------|
| **幂等性** | ✅ `DELETE MANY` 后 `CREATE`，可重复执行 |
| **硬编码用户 ID** | ✅ 已修复为按 `userName` 动态查找，seed 每次重新生成 cuid |
| **模板文件夹** | ✅ 每个项目创建时自动生成 4 个标准目录 |
| **种子与实际使用冲突** | ⚠️ 新用户在 `/workspace` 创建项目后，默认文件夹可以工作（`initProjectFolders` 已 await），但**旧种子数据创建的 2 个项目不会自动获得模板文件夹**——它们是在 Phase 2 早期 seed 的，后来 seed 脚本已重写覆盖 |

### 4.6 已知 UI 问题

- **Badge / Dialog / Tabs 组件**：全部自写，不依赖 `@base-ui/react`（因 Shadcn v4 与 Next.js 14 不兼容）。升级到 Next.js 15 后可以重新安装官方 Shadcn UI。
- **移动端适配**：MV​​P 阶段未做响应式断点优化，侧边栏在 < 768px 时无折叠按钮。
- **Loading 状态**：部分页面缺少 `<Suspense>` 骨架屏，仅依赖 `Loader2` spinner。

---

## 5. 评审重点检查清单 (Reviewer's Checklist)

建议评审员重点关注以下方面：

### 5.1 架构层面
- [ ] Server Actions 的 `'use server'` 指令是否正确放置（未泄露到 Client Components）
- [ ] 是否有任何 API Route (`app/api/*`) 残留
- [ ] `Promise.all()` 并发是否存在独立失败导致整体失败的隐患
- [ ] `prisma.$transaction()` 是否覆盖了所有需要原子性的写操作

### 5.2 安全层面
- [ ] `getCurrentUser()` 是否正确抽取为独立函数（而非在 8 个 action 中重复实现）
- [ ] middleware 的 cookie 解析是否可被伪造（当前无签名校验）
- [ ] 写入 Server Action 是否全部校验了用户身份和输入合法性

### 5.3 数据完整性
- [ ] Decimal(14,2) 是否在所有 `BudgetFlow.amount` 和 `Project.totalBudget` 写路径上统一使用
- [ ] 是否存在任何地方直接使用 `parseFloat` 做金额运算（应全部使用 `Prisma.Decimal`）
- [ ] Header 的 Dynamic Rendering 是否触发了不必要的全页重渲染
- [ ] 数据库是否存在因 `onDelete: Cascade` 未配置而导致的外键约束错误

### 5.4 性能
- [ ] 是否仍存在 `findMany` 后在内存中 `filter` 的设计（Dashboard 已消除，确认其他 actions 无此问题）
- [ ] `getProjectsHealth` 中的 `taskIdToProjectId` 映射是否可优化为 SQL join（当前用内存 Map）

### 5.5 可维护性
- [ ] 9 个自写 UI 组件是否具备足够的可访问性 (ARIA labels, roles)
- [ ] `constants.ts` 中的导航映射是否与 `middleware.ts` 中的 `leaderOnly` 数组同步
- [ ] CHANGELOG.md 是否完整记录了每次重构的 `Before → After` 对比

---

### 📎 附录：种子数据快照

| 实体 | 数量 | 示例 |
|------|------|------|
| User | 3 | 陈鹏 (LEADER) / 林小夏 (MEMBER) / 赵雨桐 (MEMBER) |
| Project | 2 | 仰望一万台整合营销 ¥5,000,000 / 品牌升级年度Campaign ¥2,000,000 |
| Task | 4 | 公关传播线 [进行中] / 社交媒体线 [待启动] / 达人种草线 [进行中] / 品牌视觉升级 [进行中] |
| BudgetFlow | 8 | ALLOCATE ×2 / EXPENSE ×5 / REFUND ×1 |
| ProgressLog | 6 | 6 条汇报记录 |
| AssetFolder | 8 | 每项目 4 标准模板 (01 策略与Brief ~ 04 复盘总结) |
| AssetItem | 3 | 2 富文本 + 1 外部链接 |

### 📎 附录：运行方式

```bash
# 1. 启动 Prisma Postgres（本地开发数据库）
npx prisma dev

# 2. 灌入种子数据（幂等，可重复执行）
npx prisma db seed

# 3. 启动 Next.js 开发服务器
npm run dev
# 浏览器打开 http://localhost:3000

# 4. 选择用户登录
#    陈鹏 (LEADER)  → 自动进入 /dashboard 全局大盘
#    林小夏 (MEMBER) → 自动进入 /workspace
#    赵雨桐 (MEMBER) → 自动进入 /workspace
```

---

> 本文档随 ShadowPM V1.0 交付，共 5 部分。如需深入了解任何模块的具体实现，请参阅 `project-docs/` 下的对口文档或直接阅读 `src/actions/` 和 `src/components/` 源码。
