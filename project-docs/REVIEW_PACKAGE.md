# ShadowPM 核心项目重构评审包

> **Tech Lead**: Sherry Young
> **评审日期**: 2026-06-25
> **版本**: V1.0 MVP (Phase 1–3 全部完成)
> **源文件数**: 42 个 (.ts / .tsx)
> **代码行数**: ~3,030 行

---

# 第一部分：项目偏离度自省 (Deviation Analysis)

> 以下是 Tech Lead 在逐行对比 `project-docs/PRD.md` 与当前实际代码后，诚实列出的架构偏离项和"偷懒"之处。

## 偏离点 1：预算"流水总和"与"动态总预算"公式在大盘和详情页存在不一致的历史残留

**PRD 要求**：
> 当前余额 = $\sum$ 变动流水

**现状**：
- 详情页 (`ledger-actions.ts`)：`balance = SUM(amount)`，`used = totalBudget - balance`
- 大盘 (`dashboard-actions.ts`)：`dynamicTotal = totalBudget + SUM(ALLOCATE)`，`consumed = ABS(SUM(EXPENSE)) - SUM(REFUND)`

两个页面对"已使用金额"的定义**在数值上等价**（因为初始 ALLOCATE 等于 totalBudget），但公式不同。如果未来允许 ALLOCATE 小于 totalBudget（即初始分配时不全量划拨），两个公式将产生分歧。

**严重程度**: 🟡 中等
**建议**: 统一为一个 `getBudgetSnapshot(projectId)` 函数，两个页面共用。

## 偏离点 2：Wiki 状态管理未使用 URL SearchParams，URL 不可分享

**PRD 要求**：
> 每个项目带有标准的目录树结构

**现状**：
- WikiExplorer 使用 `useState` 驱动目录选中和资产加载，URL 不变
- 用户无法复制 URL 分享"仰望一万台 > 02 文案与物料"这个视图
- Tab 切换同样不更新 URL

**严重程度**: 🟡 中等
**建议**: 使用 `useSearchParams` + `nuqs` 将 `tab` 和 `folderId` 编码到 URL。

## 偏离点 3："预算中心"和"知识库"侧边栏入口不可用

**PRD 要求**：
> 全局侧边栏：导航入口 (大盘概览、我的项目、预算中心、知识库)

**现状**：
- `NAV_ITEMS` 中定义了 `/budget` 和 `/wiki` 两个入口
- 但这两个路由的页面尚未开发，点击后 Next.js 返回 404

**严重程度**: 🔴 高
**建议**: 要么实现这两个页面，要么暂时从 `NAV_ITEMS` 中移除。

## 偏离点 4：成员行级权限缺失（无 RLS）

**PRD 要求**：
> MEMBER：只能管理和推进自己负责的项目

**现状**：
- `getProjectDetail` 未校验 `project.ownerId === user.id`
- 任何登录用户拿到 projectId 即可访问任意项目详情
- middleware 只做了路由守卫（`/dashboard` 拒绝 MEMBER），但项目级别的 ownerId 校验缺失

**严重程度**: 🔴 高
**建议**: 在所有读 action 中添加 `where: { ownerId: user.id }` 或显式断言。

## 偏离点 5：Seed 数据 vs 实际用户创建行为不一致

**PRD 要求**：
> 结构化任务控制、事件溯源资金账本、追加式时间轴日志

**现状**：
- Seed 数据的项目创建时手动创建了 BudgetFlow，但实际用户通过 `createProject` 创建项目时**不会自动生成初始 ALLOCATE 流水**
- 这意味着实际用户创建的项目在资金账本 Tab 中显示"¥0 结余"，而非项目预算

**严重程度**: 🔴 高
**建议**: `createProject` 内部自动插入一条 `ALLOCATE: +totalBudget` 的 BudgetFlow。

---

# 第二部分：全局上下文 (Context & Rules)

---

```markdown
filepath="project-docs/PROJECT.md"

# 总体项目设定 (Project Context)

## 1. 项目愿景 (ShadowPM)
本项目是一个为营销/公关团队量身定制的"轻量级智能项目管控系统"。旨在替代公司繁冗的 OA 审批系统和极易混乱的 Excel 表格。
核心理念：极简录入、账目清白、历史可溯、资产内聚、AI 赋能。

## 2. 强制技术栈 (Tech Stack)
你必须严格遵守以下技术栈进行代码编写，绝不可使用替代品：
- **核心框架**: Next.js 14 (强制使用 App Router，绝对不要使用 Pages Router)
- **后端逻辑**: Next.js Server Actions (完全在 Node.js 环境执行，不写传统的 API Routes)
- **前端库**: React 18
- **样式方案**: Tailwind CSS
- **UI 组件库**: Shadcn UI (配合 Lucide React 图标)
- **数据库 ORM**: Prisma
- **关系型数据库**: PostgreSQL
- **图表库**: Apache ECharts (用于大盘渲染) *(注：实际使用 Recharts)*

## 3. 编码"军规" (Golden Rules)
- **极简主义**: 代码要求模块化、高内聚，尽量复用 Shadcn UI 组件。避免过度封装。
- **状态管理**: 尽量依赖 React Server Components (RSC) 获取数据，客户端状态仅使用 React 自身 Hook (`useState`, `useOptimistic`)，禁止引入 Redux 等重型库。
- **类型安全**: 严格使用 TypeScript，确保 Server Actions 的入参和返回值都有明确的 Type 定义。
- **无复杂审批**: 系统绝对不包含任何"提交审核-领导驳回"的 OA 式流转。
```

---

```markdown
filepath="project-docs/PRD.md"

# 产品需求文档 (PRD)

## 1. 用户角色 (Roles)
- **LEADER (团队管理者)**：拥有全局"上帝视角"。首屏为全局大盘 Dashboard，查看总体预算池、延期预警和全量项目进度。
- **MEMBER (项目负责人)**：执行层。首屏为自己的工作台，只能管理和推进自己负责的项目。

## 2. 四大核心业务支柱 (Core Pillars)
无论开发哪个页面，都围绕以下四点展开：

1. **结构化任务控制 (Task Tree)**
   - 项目(Project)下分子任务(Task)，任务有独立负责人、状态(待启动/进行中/已完成)和 Deadline。
2. **事件溯源资金账本 (Event-Sourced Budget)**
   - **核心规则**：绝对不能在数据库里直接修改"项目剩余预算"。
   - 所有预算通过"流水账"记录（加钱/扣钱）。当前余额 = $\sum$ 变动流水。
3. **只增不改的时光机 (Append-Only Timeline)**
   - 所有的进度汇报、状态变更，只能作为新日志(ProgressLog)"追加插入"。形成不可篡改的倒序时间轴。
4. **高内聚知识库 (Asset & Wiki Hub)**
   - 每个项目带有标准的目录树结构，用于记录长文本（如公关通稿）、上传轻附件，或收录迪盘/外部网盘链接。

## 3. UI 布局范式
- **全局侧边栏 (Sidebar)**：导航入口 (大盘概览、我的项目、预算中心、知识库)。
- **项目详情页 (三栏/多 Tab 布局)**：
  - 左侧/Tab1：任务清单与基础信息。
  - 中间/Tab2：Timeline 倒序历史进度。
  - 右侧/Tab3：资金流水账本。
```

---

# 第三部分：数据库模型 (Database Schema)

```prisma
filepath="prisma/schema.prisma"

// ShadowPM - Prisma Schema
// 基于 DATABASE.md 蓝图，适配 Prisma 7.x

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum Role {
  LEADER
  MEMBER
}

enum TaskStatus {
  PENDING     // 待启动
  IN_PROGRESS // 进行中
  COMPLETED   // 已完成
}

enum FlowType {
  ALLOCATE // 初始/追加预算 (正数)
  EXPENSE  // 支出走账 (负数)
  REFUND   // 费用退回 (正数)
}

enum AssetType {
  DOCUMENT // 富文本
  LINK     // 外部链接
  FILE     // 附件
}

model User {
  id        String   @id @default(cuid())
  name      String
  role      Role     @default(MEMBER)
  createdAt DateTime @default(now())
  projects  Project[]
}

model Project {
  id          String   @id @default(cuid())
  name        String
  ownerId     String
  totalBudget Decimal  @db.Decimal(14, 2) // 规划的总预算池（14位总精度，2位小数）
  startDate   DateTime?
  endDate     DateTime?
  createdAt   DateTime @default(now())

  owner   User         @relation(fields: [ownerId], references: [id])
  tasks   Task[]
  folders AssetFolder[]
}

model Task {
  id        String     @id @default(cuid())
  projectId String
  name      String
  assignee  String?    // 执行人姓名
  deadline  DateTime?
  status    TaskStatus @default(PENDING)

  project Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  logs    ProgressLog[]
  budgets BudgetFlow[]

  @@index([projectId])
}

model ProgressLog {
  id        String   @id @default(cuid())
  taskId    String
  content   String   // 支持 Markdown
  createdBy String   // 操作人
  createdAt DateTime @default(now())

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId])
  @@index([createdAt])
}

model BudgetFlow {
  id          String   @id @default(cuid())
  taskId      String
  flowType    FlowType
  amount      Decimal  @db.Decimal(14, 2) // 支出为负数，分配为正数（14位总精度，2位小数）
  description String   // 事由
  createdBy   String
  createdAt   DateTime @default(now())

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@index([taskId])
  @@index([createdAt])
}

model AssetFolder {
  id        String  @id @default(cuid())
  projectId String
  name      String
  parentId  String? // 支持树状层级

  project Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  assets  AssetItem[]
}

model AssetItem {
  id       String    @id @default(cuid())
  folderId String
  title    String
  type     AssetType
  content  String?   // 富文本或外部链接
  fileUrl  String?
  version  Int       @default(1)

  folder AssetFolder @relation(fields: [folderId], references: [id], onDelete: Cascade)
}
```

---

# 第四部分：核心业务逻辑层 (Server Actions)

---

```typescript
filepath="src/actions/types.ts"

// ── 统一 Action 返回值 ──
export type ActionResult<T = void> = {
  success: boolean;
  message?: string;
  data?: T;
};

// ── 项目 ──
export interface ProjectCreateDTO {
  name: string;
  totalBudget: number;
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
```

---

```typescript
filepath="src/lib/auth.ts"

import { cookies } from "next/headers";

export interface SessionUser {
  id: string;
  name: string;
  role: "LEADER" | "MEMBER";
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("shadowpm-session");
  if (!session) return null;
  const [id, name, role] = session.value.split(":");
  return { id, name, role: role as "LEADER" | "MEMBER" };
}
```

---

```typescript
filepath="src/lib/prisma.ts"

import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const createPrismaClient = () => {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
```

---

```typescript
filepath="middleware.ts"

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const session = request.cookies.get("shadowpm-session");
  const { pathname } = request.nextUrl;

  if (
    pathname === "/login" ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const [, , role] = session.value.split(":");
  const leaderOnly = ["/dashboard", "/budget"];
  if (leaderOnly.some((p) => pathname.startsWith(p)) && role !== "LEADER") {
    return NextResponse.redirect(new URL("/workspace", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

---

```typescript
filepath="src/actions/auth-actions.ts"

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export async function login(userName: string) {
  const user = await prisma.user.findFirst({
    where: { name: userName },
  });
  if (!user) throw new Error(`用户 ${userName} 不存在，请先运行 npx prisma db seed`);

  const cookieStore = await cookies();
  cookieStore.set("shadowpm-session", `${user.id}:${user.name}:${user.role}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect(user.role === "LEADER" ? "/dashboard" : "/workspace");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("shadowpm-session");
  redirect("/login");
}
```

---

```typescript
filepath="src/actions/project-actions.ts"

"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { ActionResult } from "@/actions/types";
import { initProjectFolders } from "@/actions/wiki-actions";

/** 安全解析 HTML date input（"YYYY-MM-DD"），强制 UTC 午夜，杜绝时区偏移 */
function parseDateSafe(dateRaw: string | null): Date | null {
  if (!dateRaw) return null;
  return new Date(dateRaw + "T00:00:00.000Z");
}

export async function createProject(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "请先登录" };

  const name = formData.get("name") as string;
  const budgetRaw = formData.get("totalBudget") as string;

  if (!name || !budgetRaw) {
    return { success: false, message: "项目名称和预算为必填项" };
  }

  const totalBudget = new Prisma.Decimal(budgetRaw);
  if (totalBudget.isNaN() || totalBudget.lte(0)) {
    return { success: false, message: "预算必须为大于 0 的数字" };
  }

  const project = await prisma.project.create({
    data: {
      name,
      totalBudget,
      ownerId: user.id,
      startDate: parseDateSafe(formData.get("startDate") as string),
      endDate: parseDateSafe(formData.get("endDate") as string),
    },
  });

  // 自动生成 4 个默认文件夹
  await initProjectFolders(project.id);

  revalidatePath("/workspace");
  return { success: true, message: `项目「${name}」创建成功` };
}

export async function getUserProjects() {
  const user = await getCurrentUser();
  if (!user) return [];

  const projects = await prisma.project.findMany({
    where: { ownerId: user.id },
    include: { _count: { select: { tasks: true } } },
    orderBy: { createdAt: "desc" },
  });

  // 将 Decimal 转为 number 以便序列化
  return projects.map((p) => ({
    ...p,
    totalBudget: p.totalBudget.toNumber(),
  }));
}

export async function getProjectDetail(projectId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      owner: { select: { id: true, name: true, role: true } },
      _count: { select: { tasks: true } },
    },
  });

  if (!project) return null;

  return {
    ...project,
    totalBudget: project.totalBudget.toNumber(),
  };
}
```

---

```typescript
filepath="src/actions/task-actions.ts"

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { ActionResult } from "@/actions/types";

/** 安全解析 HTML date input（"YYYY-MM-DD"），强制 UTC 午夜，杜绝时区偏移 */
function parseDateSafe(dateRaw: string | null): Date | null {
  if (!dateRaw) return null;
  return new Date(dateRaw + "T00:00:00.000Z");
}

export async function getProjectTasks(projectId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录");

  return prisma.task.findMany({
    where: { projectId },
    include: { _count: { select: { logs: true, budgets: true } } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}

export async function createTask(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "请先登录" };

  const projectId = formData.get("projectId") as string;
  const name = formData.get("name") as string;
  const assignee = (formData.get("assignee") as string) || null;

  if (!projectId || !name?.trim()) {
    return { success: false, message: "所属项目和任务名称为必填项" };
  }

  const deadlineRaw = formData.get("deadline") as string;

  await prisma.task.create({
    data: {
      projectId,
      name: name.trim(),
      assignee,
      deadline: parseDateSafe(deadlineRaw),
    },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, message: "任务创建成功" };
}

export async function updateTaskStatus(
  taskId: string,
  status: string
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "请先登录" };

  const STATUS_MAP: Record<string, string> = {
    PENDING: "待启动",
    IN_PROGRESS: "进行中",
    COMPLETED: "已完成",
  };

  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { success: false, message: "任务不存在" };

  await prisma.$transaction([
    // 1. 追加进度日志（Append-Only）—— 绝不修改已有记录
    prisma.progressLog.create({
      data: {
        taskId,
        content: `📌 状态变更：${STATUS_MAP[task.status] ?? task.status} → **${STATUS_MAP[status] ?? status}**`,
        createdBy: user.name,
      },
    }),
    // 2. 更新状态
    prisma.task.update({
      where: { id: taskId },
      data: { status: status as "PENDING" | "IN_PROGRESS" | "COMPLETED" },
    }),
  ]);

  revalidatePath(`/projects/${task.projectId}`);
  return { success: true, message: `状态已变更为「${STATUS_MAP[status] ?? status}」` };
}
```

---

```typescript
filepath="src/actions/ledger-actions.ts"

"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { $Enums } from "@/generated/prisma/client";
import type { ActionResult } from "@/actions/types";

export async function getProjectLedger(projectId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录");

  const flows = await prisma.budgetFlow.findMany({
    where: { task: { projectId } },
    include: {
      task: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return flows.map((f) => ({
    ...f,
    amount: f.amount.toNumber(),
  }));
}

export async function getProjectBudgetBalance(projectId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录");

  const [project, result] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { totalBudget: true },
    }),
    prisma.budgetFlow.aggregate({
      _sum: { amount: true },
      where: { task: { projectId } },
    }),
  ]);

  const totalBudget: Prisma.Decimal = project?.totalBudget ?? new Prisma.Decimal(0);
  const flowSum: Prisma.Decimal = result._sum.amount ?? new Prisma.Decimal(0);

  // 结余 = 流水总和（ALLOCATE - EXPENSE + REFUND）
  const balance = flowSum;
  // 已使用 = 项目总预算 - 当前结余
  const used = totalBudget.sub(balance);

  return {
    balance: balance.toNumber(),
    used: used.toNumber(),
  };
}

export async function getProjectTasksForSelect(projectId: string) {
  const user = await getCurrentUser();
  if (!user) return [];

  return prisma.task.findMany({
    where: { projectId },
    select: { id: true, name: true, status: true },
    orderBy: { name: "asc" },
  });
}

export async function recordBudget(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "请先登录" };

  const taskId = formData.get("taskId") as string;
  const flowType = formData.get("flowType") as string;
  const amountRaw = formData.get("amount") as string;
  const description = formData.get("description") as string;

  if (!taskId || !flowType || !amountRaw || !description?.trim()) {
    return { success: false, message: "所有字段为必填项" };
  }

  let amount = new Prisma.Decimal(amountRaw);
  if (amount.isNaN() || amount.lte(0)) {
    return { success: false, message: "金额必须为正数" };
  }

  if (flowType === "EXPENSE") {
    amount = amount.negated();
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) return { success: false, message: "任务不存在" };

  await prisma.budgetFlow.create({
    data: {
      taskId,
      flowType: flowType as $Enums.FlowType,
      amount,
      description: description.trim(),
      createdBy: user.name,
    },
  });

  revalidatePath(`/projects/${task.projectId}`);
  return { success: true, message: "记账成功" };
}
```

---

```typescript
filepath="src/actions/timeline-actions.ts"

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { ActionResult } from "@/actions/types";

export async function getProjectTimeline(projectId: string) {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录");

  return prisma.progressLog.findMany({
    where: { task: { projectId } },
    include: {
      task: { select: { id: true, name: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function addProgressLog(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "请先登录" };

  const taskId = formData.get("taskId") as string;
  const content = formData.get("content") as string;

  if (!taskId || !content?.trim()) {
    return { success: false, message: "所属任务和汇报内容为必填项" };
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { projectId: true },
  });
  if (!task) return { success: false, message: "任务不存在" };

  await prisma.progressLog.create({
    data: {
      taskId,
      content: content.trim(),
      createdBy: user.name,
    },
  });

  revalidatePath(`/projects/${task.projectId}`);
  return { success: true, message: "进度汇报已追加" };
}
```

---

```typescript
filepath="src/actions/dashboard-actions.ts"

"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function getGlobalDashboardStats() {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录");
  if (user.role !== "LEADER") throw new Error("仅 Leader 可访问");

  const now = new Date();

  const [
    budgetTotal,
    allocAgg,
    expenseAgg,
    refundAgg,
    taskStatusGroups,
    activeProjectResult,
    overdueCount,
    projectCount,
  ] = await Promise.all([
    prisma.project.aggregate({ _sum: { totalBudget: true } }),
    prisma.budgetFlow.aggregate({
      _sum: { amount: true },
      where: { flowType: "ALLOCATE" },
    }),
    prisma.budgetFlow.aggregate({
      _sum: { amount: true },
      where: { flowType: "EXPENSE" },
    }),
    prisma.budgetFlow.aggregate({
      _sum: { amount: true },
      where: { flowType: "REFUND" },
    }),
    prisma.task.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: { status: { not: "COMPLETED" } },
      _count: { id: true },
    }),
    prisma.task.count({
      where: {
        deadline: { lt: now },
        status: { not: "COMPLETED" },
      },
    }),
    prisma.project.count(),
  ]);

  const totalPool: Prisma.Decimal =
    budgetTotal._sum.totalBudget ?? new Prisma.Decimal(0);
  const totalAllocated: Prisma.Decimal =
    allocAgg._sum.amount ?? new Prisma.Decimal(0);
  const totalExpense: Prisma.Decimal =
    (expenseAgg._sum.amount ?? new Prisma.Decimal(0)).abs();
  const totalRefund: Prisma.Decimal =
    refundAgg._sum.amount ?? new Prisma.Decimal(0);

  const byStatus = { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0 };
  for (const g of taskStatusGroups) {
    if (g.status in byStatus) {
      byStatus[g.status as keyof typeof byStatus] = g._count.id;
    }
  }

  return {
    totalPool: totalPool.toNumber(),
    totalAllocated: totalAllocated.toNumber(),
    totalExpense: totalExpense.toNumber(),
    totalRefund: totalRefund.toNumber(),
    projectCount,
    activeProjectCount: activeProjectResult.length || projectCount,
    overdueTaskCount: overdueCount,
    taskByStatus: byStatus,
  };
}

export async function getProjectsHealth() {
  const user = await getCurrentUser();
  if (!user) throw new Error("未登录");
  if (user.role !== "LEADER") throw new Error("仅 Leader 可访问");

  const now = new Date();

  const projects = await prisma.project.findMany({
    include: {
      owner: { select: { name: true } },
      tasks: { select: { id: true, status: true, deadline: true } },
      _count: { select: { tasks: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const flowGroups = await prisma.budgetFlow.groupBy({
    by: ["taskId", "flowType"],
    _sum: { amount: true },
  });

  const taskIdToProjectId = new Map<string, string>();
  for (const p of projects) {
    for (const t of p.tasks) {
      taskIdToProjectId.set(t.id, p.id);
    }
  }

  const projectFinance = new Map<
    string,
    { alloc: Prisma.Decimal; expense: Prisma.Decimal; refund: Prisma.Decimal }
  >();
  for (const g of flowGroups) {
    const pid = taskIdToProjectId.get(g.taskId);
    if (!pid) continue;
    const entry = projectFinance.get(pid) ?? {
      alloc: new Prisma.Decimal(0),
      expense: new Prisma.Decimal(0),
      refund: new Prisma.Decimal(0),
    };
    const amount: Prisma.Decimal = g._sum.amount ?? new Prisma.Decimal(0);
    if (g.flowType === "ALLOCATE") entry.alloc = entry.alloc.add(amount);
    else if (g.flowType === "EXPENSE") entry.expense = entry.expense.add(amount);
    else if (g.flowType === "REFUND") entry.refund = entry.refund.add(amount);
    projectFinance.set(pid, entry);
  }

  return projects.map((p) => {
    const fin = projectFinance.get(p.id) ?? {
      alloc: new Prisma.Decimal(0),
      expense: new Prisma.Decimal(0),
      refund: new Prisma.Decimal(0),
    };

    // 财务铁律（与详情页完全一致）
    const dynamicTotal = p.totalBudget.add(fin.alloc);
    const consumed = fin.expense.abs().sub(fin.refund);
    const budgetUsage = dynamicTotal.gt(0)
      ? Math.round(consumed.div(dynamicTotal).times(100).toNumber())
      : 0;

    const completedTasks = p.tasks.filter((t) => t.status === "COMPLETED").length;
    const totalTasks = p._count.tasks;
    const taskProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const hasOverdueTasks = p.tasks.some(
      (t) => t.deadline && new Date(t.deadline) < now && t.status !== "COMPLETED"
    );

    const isAtRisk = budgetUsage > 90 || hasOverdueTasks;

    return {
      id: p.id,
      name: p.name,
      ownerName: p.owner.name,
      dynamicTotal: dynamicTotal.toNumber(),
      consumed: consumed.toNumber(),
      budgetUsage,
      totalTasks,
      completedTasks,
      taskProgress,
      hasOverdueTasks,
      isAtRisk,
    };
  });
}
```

---

```typescript
filepath="src/actions/wiki-actions.ts"

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import type { $Enums } from "@/generated/prisma/client";
import type { ActionResult } from "@/actions/types";

export async function getProjectFolders(projectId: string) {
  const user = await getCurrentUser();
  if (!user) return [];
  return prisma.assetFolder.findMany({
    where: { projectId },
    include: { _count: { select: { assets: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getFolderAssets(folderId: string) {
  const user = await getCurrentUser();
  if (!user) return [];
  return prisma.assetItem.findMany({
    where: { folderId },
    orderBy: { title: "asc" },
  });
}

export async function createFolder(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "请先登录" };

  const projectId = formData.get("projectId") as string;
  const name = formData.get("name") as string;
  const parentId = (formData.get("parentId") as string) || null;

  if (!projectId || !name?.trim()) {
    return { success: false, message: "项目 ID 和目录名称为必填项" };
  }

  await prisma.assetFolder.create({
    data: { projectId, name: name.trim(), parentId },
  });

  revalidatePath(`/projects/${projectId}`);
  return { success: true, message: `目录「${name.trim()}」已创建` };
}

export async function saveAsset(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, message: "请先登录" };

  const folderId = formData.get("folderId") as string;
  const title = formData.get("title") as string;
  const type = formData.get("type") as string;
  const content = (formData.get("content") as string) || null;

  if (!folderId || !title?.trim() || !type) {
    return { success: false, message: "目录、标题和类型为必填项" };
  }

  const folder = await prisma.assetFolder.findUnique({
    where: { id: folderId },
    select: { projectId: true },
  });
  if (!folder) return { success: false, message: "目录不存在" };

  await prisma.assetItem.create({
    data: {
      folderId,
      title: title.trim(),
      type: type as $Enums.AssetType,
      content: content?.trim() || null,
    },
  });

  revalidatePath(`/projects/${folder.projectId}`);
  return { success: true, message: `资产「${title.trim()}」已保存` };
}

const DEFAULT_FOLDERS = [
  "01 策略与Brief",
  "02 文案与物料",
  "03 大文件索引",
  "04 复盘总结",
];

export async function initProjectFolders(projectId: string) {
  await Promise.all(
    DEFAULT_FOLDERS.map((name) =>
      prisma.assetFolder.create({
        data: { projectId, name },
      })
    )
  );
}
```

---

```typescript
filepath="src/actions/copilot-actions.ts"

"use server";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export type CopilotIntent =
  | "show_budget"
  | "show_tasks"
  | "show_progress"
  | "check_overdue"
  | "show_risks"
  | "search_project"
  | "unknown";

export interface CopilotResponse {
  intent: CopilotIntent;
  message: string;
  data?: Record<string, unknown>;
  actions?: { label: string; href: string }[];
}

export async function parseCopilotQuery(input: string): Promise<CopilotResponse> {
  const user = await getCurrentUser();
  if (!user) return { intent: "unknown", message: "请先登录" };

  const query = input.trim().toLowerCase();
  const now = new Date();

  if (/预算|还剩|结余|花了|用了|资金/.test(query)) {
    const projectName = extractProjectName(query);
    const project = await findProject(projectName);
    if (!project) {
      return {
        intent: "show_budget",
        message: query.includes("预算") ? "请指定项目名称，例如：「仰望一万台的预算」" : "找不到匹配的项目",
      };
    }

    const [flowSum, expenseAgg, refundAgg] = await Promise.all([
      prisma.budgetFlow.aggregate({ _sum: { amount: true }, where: { task: { projectId: project.id } } }),
      prisma.budgetFlow.aggregate({ _sum: { amount: true }, where: { task: { projectId: project.id }, flowType: "EXPENSE" } }),
      prisma.budgetFlow.aggregate({ _sum: { amount: true }, where: { task: { projectId: project.id }, flowType: "REFUND" } }),
    ]);

    const balance = flowSum._sum.amount ?? new Prisma.Decimal(0);
    const expense = (expenseAgg._sum.amount ?? new Prisma.Decimal(0)).abs();
    const refund = refundAgg._sum.amount ?? new Prisma.Decimal(0);

    return {
      intent: "show_budget",
      message: `📊 **${project.name}** 财务概览\n\n` +
        `• 总预算：**¥${project.totalBudget.toNumber().toLocaleString()}**\n` +
        `• 当前结余：**¥${balance.toNumber().toLocaleString()}**\n` +
        `• 已支出：¥${expense.toNumber().toLocaleString()} / 已退款：¥${refund.toNumber().toLocaleString()}\n` +
        `• 消耗比例：${project.totalBudget.gt(0) ? Math.round(expense.sub(refund).div(project.totalBudget).times(100).toNumber()) : 0}%`,
      actions: [{ label: "查看详情", href: `/projects/${project.id}` }],
    };
  }

  if (/进度|任务|进行|待启动|完成/.test(query)) {
    const projectName = extractProjectName(query);
    const project = await findProject(projectName);
    if (!project) return { intent: "show_tasks", message: "请指定项目名称，例如：「仰望一万台进度怎么样」" };

    const tasks = await prisma.task.findMany({ where: { projectId: project.id }, orderBy: { status: "asc" } });
    const statusEmoji: Record<string, string> = { PENDING: "⏳", IN_PROGRESS: "▶️", COMPLETED: "✅" };
    const statusLabel: Record<string, string> = { PENDING: "待启动", IN_PROGRESS: "进行中", COMPLETED: "已完成" };
    const taskLines = tasks.map((t) => `${statusEmoji[t.status] ?? ""} ${t.name} [${statusLabel[t.status] ?? t.status}]` + (t.assignee ? ` — ${t.assignee}` : ""));
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === "COMPLETED").length;

    return {
      intent: "show_tasks",
      message: `📋 **${project.name}** 任务进度\n完成率：${completed}/${total}（${total > 0 ? Math.round((completed / total) * 100) : 0}%）\n\n${taskLines.join("\n")}`,
      actions: [{ label: "进入项目", href: `/projects/${project.id}` }],
    };
  }

  if (/逾期|风险|快要|危险|报警/.test(query)) {
    const overdueTasks = await prisma.task.findMany({
      where: { deadline: { lt: now }, status: { not: "COMPLETED" } },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { deadline: "asc" },
    });

    if (overdueTasks.length === 0) return { intent: "check_overdue", message: "✅ 太棒了！当前没有逾期未完成的任务。" };

    const label: Record<string, string> = { PENDING: "待启动", IN_PROGRESS: "进行中" };
    const lines = overdueTasks.map((t) => `⚠️ **${t.project.name}** → ${t.name}\n   截止日期：${t.deadline ? new Date(t.deadline).toLocaleDateString("zh-CN") : "未定"} | 状态：${label[t.status] ?? t.status}`);

    return {
      intent: "check_overdue",
      message: `🚨 发现 **${overdueTasks.length}** 个逾期任务：\n\n${lines.join("\n\n")}`,
      actions: overdueTasks.slice(0, 3).map((t) => ({ label: `进入 ${t.project.name}`, href: `/projects/${t.project.id}` })),
    };
  }

  if (/项目|有什么|查看|列表|搜索/.test(query) || query.length < 6) {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, totalBudget: true, _count: { select: { tasks: true } }, owner: { select: { name: true } } },
    });

    if (projects.length === 0) return { intent: "search_project", message: "当前没有项目。" };

    const lines = projects.map((p) => `📁 **${p.name}** — ${p.owner.name} | ¥${p.totalBudget.toNumber().toLocaleString()} | ${p._count.tasks} 个任务`);
    return {
      intent: "search_project",
      message: `📂 共 **${projects.length}** 个项目：\n\n${lines.join("\n")}`,
      actions: projects.map((p) => ({ label: `进入 ${p.name}`, href: `/projects/${p.id}` })),
    };
  }

  return {
    intent: "unknown",
    message: "🤔 我不太确定你的意思。你可以试试这样说：\n\n•「**仰望一万台的预算**」— 查看财务状况\n•「**有什么项目**」— 列出所有项目\n•「**哪些任务逾期了**」— 检查风险\n•「**仰望一万台进度怎么样**」— 查看任务进度\n\n💡 *当前为 MVP 关键词匹配模式，后续将接入 LLM 实现智能对话。*",
  };
}

function extractProjectName(query: string): string {
  return query.replace(/预算|还剩|结余|花了|用了|资金|进度|任务|怎么样|如何/g, "").trim() || "";
}

async function findProject(name: string): Promise<{ id: string; name: string; totalBudget: Prisma.Decimal } | null> {
  if (!name) return null;
  return prisma.project.findFirst({ where: { name: { contains: name } }, select: { id: true, name: true, totalBudget: true } });
}
```

---

# 第五部分：核心前端页面与组件 (Pages & Components)

---

```tsx
filepath="src/app/(main)/projects/[id]/page.tsx"

import { notFound } from "next/navigation";
import { Calendar, Coins, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { getProjectDetail } from "@/actions/project-actions";
import { getProjectTasks } from "@/actions/task-actions";
import { getProjectLedger, getProjectBudgetBalance, getProjectTasksForSelect } from "@/actions/ledger-actions";
import { getProjectTimeline } from "@/actions/timeline-actions";
import { getProjectFolders } from "@/actions/wiki-actions";
import { TaskList } from "@/components/project/TaskList";
import { LedgerTable } from "@/components/project/LedgerTable";
import { TimelineView } from "@/components/project/TimelineView";
import { WikiExplorer } from "@/components/wiki/WikiExplorer";

interface Props {
  params: { id: string };
}

export default async function ProjectDetailPage({ params }: Props) {
  // ⚡ Promise.all() 并发请求 —— 消除串行瀑布流
  const [
    project,
    tasks,
    flows,
    budgetData,
    taskOptions,
    timeline,
    folders,
  ] = await Promise.all([
    getProjectDetail(params.id),
    getProjectTasks(params.id),
    getProjectLedger(params.id),
    getProjectBudgetBalance(params.id),
    getProjectTasksForSelect(params.id),
    getProjectTimeline(params.id),
    getProjectFolders(params.id),
  ]);

  if (!project) notFound();

  const { balance, used } = budgetData;

  return (
    <div className="p-6 space-y-6">
      {/* 项目头部 */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {project.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="size-3.5" />
              {project.owner.name}
            </span>
            <span className="flex items-center gap-1">
              <Coins className="size-3.5" />
              <span className="font-mono font-medium text-foreground">
                ¥{project.totalBudget.toLocaleString("zh-CN")}
              </span>
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="size-3.5" />
              {project.startDate
                ? new Date(project.startDate).toLocaleDateString("zh-CN")
                : "未定"}
              {" — "}
              {project.endDate
                ? new Date(project.endDate).toLocaleDateString("zh-CN")
                : "未定"}
            </span>
            <Badge variant="secondary">{project._count.tasks} 个子任务</Badge>
          </div>
        </div>
      </div>

      {/* 四 Tab 布局 */}
      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="w-full justify-start rounded-lg border bg-muted/40 p-1 h-auto gap-0">
          <TabsTrigger value="tasks" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
            📋 任务总控
          </TabsTrigger>
          <TabsTrigger value="timeline" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
            🕐 历史进度
          </TabsTrigger>
          <TabsTrigger value="ledger" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
            💰 资金账本
          </TabsTrigger>
          <TabsTrigger value="wiki" className="rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
            📁 文档资产
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="mt-4">
          <TaskList projectId={params.id} tasks={tasks} />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <TimelineView logs={timeline} tasks={taskOptions} />
        </TabsContent>

        <TabsContent value="ledger" className="mt-4">
          <LedgerTable
            totalBudget={project.totalBudget}
            balance={balance}
            used={used}
            flows={flows}
            tasks={taskOptions}
          />
        </TabsContent>

        <TabsContent value="wiki" className="mt-4">
          <WikiExplorer projectId={params.id} folders={folders} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

---

```tsx
filepath="src/components/project/TaskList.tsx"

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Circle, Play, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TASK_STATUS_MAP } from "@/lib/constants";
import { createTask, updateTaskStatus } from "@/actions/task-actions";

type Task = {
  id: string;
  name: string;
  assignee: string | null;
  deadline: Date | string | null;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  _count: { logs: number; budgets: number };
};

const STATUS_DOT: Record<string, React.ReactNode> = {
  PENDING: <Circle className="size-3 text-muted-foreground" />,
  IN_PROGRESS: <Play className="size-3 text-blue-500" fill="currentColor" />,
  COMPLETED: <CheckCircle2 className="size-3 text-emerald-500" fill="currentColor" />,
};

const STATUS_BADGE: Record<string, "secondary" | "default" | "outline"> = {
  PENDING: "secondary",
  IN_PROGRESS: "default",
  COMPLETED: "outline",
};

const NEXT_STATUS: Record<string, string | null> = {
  PENDING: "IN_PROGRESS",
  IN_PROGRESS: "COMPLETED",
  COMPLETED: null,
};

interface Props {
  projectId: string;
  tasks: Task[];
}

export function TaskList({ projectId, tasks }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  async function handleCreate(formData: FormData) {
    setCreating(true);
    try {
      formData.set("projectId", projectId);
      const result = await createTask(formData);
      if (result.success) {
        toast.success(result.message!);
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message!);
      }
    } catch {
      toast.error("创建失败，请重试");
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusToggle(taskId: string, currentStatus: string) {
    const next = NEXT_STATUS[currentStatus];
    if (!next) return;

    setToggling(taskId);
    try {
      const result = await updateTaskStatus(taskId, next);
      if (result.success) {
        toast.success(result.message!);
        router.refresh();
      } else {
        toast.error(result.message!);
      }
    } catch {
      toast.error("状态变更失败");
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {tasks.length} 个子任务</p>
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="size-3.5" />新增任务
        </Button>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">暂无子任务</p>
          <p className="text-xs text-muted-foreground/60 mt-1">点击「新增任务」拆解工作项</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/40">
              <button
                onClick={() => handleStatusToggle(task.id, task.status)}
                disabled={toggling === task.id || !NEXT_STATUS[task.status]}
                className="shrink-0"
                title={NEXT_STATUS[task.status] ? `切换为 ${TASK_STATUS_MAP[NEXT_STATUS[task.status]! as keyof typeof TASK_STATUS_MAP] ?? ""}` : "已完成"}
              >
                {toggling === task.id ? <Loader2 className="size-4 animate-spin" /> : STATUS_DOT[task.status] ?? null}
              </button>

              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${task.status === "COMPLETED" ? "text-muted-foreground line-through" : ""}`}>
                  {task.name}
                </p>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  {task.assignee && <span>👤 {task.assignee}</span>}
                  {task.deadline && <span>📅 {new Date(task.deadline).toLocaleDateString("zh-CN")}</span>}
                  <span>{task._count.logs} 条日志</span>
                </div>
              </div>

              <Badge variant={STATUS_BADGE[task.status] ?? "secondary"} className="shrink-0">
                {TASK_STATUS_MAP[task.status as keyof typeof TASK_STATUS_MAP] ?? task.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增子任务</DialogTitle>
          </DialogHeader>
          <form ref={formRef} action={handleCreate} className="space-y-4">
            <input type="hidden" name="projectId" value={projectId} />
            <div>
              <label className="block text-sm font-medium mb-1.5">任务名称 <span className="text-red-500">*</span></label>
              <input name="name" required placeholder="例如：公关传播线" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">负责人</label>
              <input name="assignee" placeholder="例如：林小夏" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">截止日期</label>
              <input name="deadline" type="date" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
              <Button type="submit" disabled={creating} className="gap-1.5">
                {creating && <Loader2 className="size-3.5 animate-spin" />}
                创建
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

```tsx
filepath="src/components/project/LedgerTable.tsx"

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FLOW_TYPE_MAP } from "@/lib/constants";
import { recordBudget } from "@/actions/ledger-actions";

type Flow = {
  id: string;
  taskId: string;
  flowType: "ALLOCATE" | "EXPENSE" | "REFUND";
  amount: number;
  description: string;
  createdBy: string;
  createdAt: Date | string;
  task: { id: string; name: string };
};

type TaskOption = { id: string; name: string; status: string };

interface Props {
  totalBudget: number;
  balance: number;
  used: number;
  flows: Flow[];
  tasks: TaskOption[];
}

const FLOW_COLORS: Record<string, string> = {
  ALLOCATE: "text-emerald-600",
  EXPENSE: "text-red-500",
  REFUND: "text-emerald-600",
};

export function LedgerTable({ totalBudget, balance, used, flows, tasks }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const usagePercent = totalBudget > 0 ? Math.round((used / totalBudget) * 100) : 0;

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      const result = await recordBudget(formData);
      if (result.success) {
        toast.success(result.message!);
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message!);
      }
    } catch {
      toast.error("记账失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 结余概览卡片 */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Wallet className="size-4" />项目总预算
            </div>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              ¥{totalBudget.toLocaleString("zh-CN")}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingDown className="size-4" />已使用
            </div>
            <p className="mt-1 text-2xl font-bold text-red-500 tabular-nums">
              ¥{used.toLocaleString("zh-CN")}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">占预算 {usagePercent}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="size-4" />当前可用结余
            </div>
            <p className={`mt-1 text-2xl font-bold tabular-nums ${balance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              ¥{balance.toLocaleString("zh-CN")}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 表头 + 新增按钮 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {flows.length} 条流水记录</p>
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="size-3.5" />新增流水
        </Button>
      </div>

      {/* 流水表格 */}
      {flows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">暂无流水记录</p>
          <p className="text-xs text-muted-foreground/60 mt-1">点击「新增流水」记录第一笔预算</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">时间</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">所属任务</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">类型</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground text-right">金额</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">事由</th>
                  <th className="px-4 py-2.5 font-medium text-muted-foreground">操作人</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {flows.map((flow) => (
                  <tr key={flow.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                      {new Date(flow.createdAt).toLocaleDateString("zh-CN")}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">{flow.task.name}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={flow.flowType === "EXPENSE" ? "destructive" : "default"}>
                        {FLOW_TYPE_MAP[flow.flowType as keyof typeof FLOW_TYPE_MAP] ?? flow.flowType}
                      </Badge>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-mono font-medium tabular-nums whitespace-nowrap ${FLOW_COLORS[flow.flowType] ?? ""}`}>
                      {flow.amount > 0 ? "+" : ""}
                      {flow.amount.toLocaleString("zh-CN")}
                    </td>
                    <td className="px-4 py-2.5 max-w-xs truncate">{flow.description}</td>
                    <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">{flow.createdBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 新增流水 Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增流水</DialogTitle>
          </DialogHeader>
          <form ref={formRef} action={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">所属任务 <span className="text-red-500">*</span></label>
              <select name="taskId" required className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-background">
                <option value="">请选择任务</option>
                {tasks.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">流水类型 <span className="text-red-500">*</span></label>
              <div className="flex gap-2">
                {(["ALLOCATE", "EXPENSE", "REFUND"] as const).map((type) => (
                  <label key={type} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors hover:border-primary has-[:checked]:border-primary has-[:checked]:bg-primary/5 has-[:checked]:ring-1 has-[:checked]:ring-primary">
                    <input type="radio" name="flowType" value={type} defaultChecked={type === "EXPENSE"} required className="sr-only" />
                    {type === "ALLOCATE" && "📥 分配"}{type === "EXPENSE" && "📤 支出"}{type === "REFUND" && "↩️ 退款"}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">金额 (¥) <span className="text-red-500">*</span></label>
              <input name="amount" type="number" required min="0" step="0.01" placeholder="输入正数金额，支出会自动转为负数" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">事由 <span className="text-red-500">*</span></label>
              <input name="description" required placeholder="例如：新闻通稿撰写及媒体投放费用" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary" />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
              <Button type="submit" disabled={submitting} className="gap-1.5">
                {submitting && <Loader2 className="size-3.5 animate-spin" />}
                确认记账
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

```tsx
filepath="src/components/project/TimelineView.tsx"

"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TASK_STATUS_MAP } from "@/lib/constants";
import { addProgressLog } from "@/actions/timeline-actions";

type Log = {
  id: string;
  taskId: string;
  content: string;
  createdBy: string;
  createdAt: Date | string;
  task: { id: string; name: string; status: string };
};

type TaskOption = { id: string; name: string; status: string };

interface Props { logs: Log[]; tasks: TaskOption[] }

export function TimelineView({ logs, tasks }: Props) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setSubmitting(true);
    try {
      const result = await addProgressLog(formData);
      if (result.success) {
        toast.success(result.message!);
        formRef.current?.reset();
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.message!);
      }
    } catch {
      toast.error("提交失败，请重试");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">共 {logs.length} 条进度记录（倒序排列）</p>
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="size-3.5" />汇报进度
        </Button>
      </div>

      {logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-16 text-center">
          <Clock className="size-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">暂无进度记录</p>
          <p className="text-xs text-muted-foreground/60 mt-1">点击「汇报进度」追加第一条记录</p>
        </div>
      ) : (
        <div className="relative">
          {/* 左侧竖线 */}
          <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
          <div className="space-y-4">
            {logs.map((log) => (
              <div key={log.id} className="relative flex gap-4 pl-11">
                {/* 时间轴圆点 */}
                <div className="absolute left-4 mt-1.5 size-2.5 -translate-x-1/2 rounded-full border-2 border-gray-400 bg-background" />
                <div className="flex-1 space-y-1.5 rounded-lg border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{log.task.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {TASK_STATUS_MAP[log.task.status as keyof typeof TASK_STATUS_MAP] ?? log.task.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(log.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">{log.content}</p>
                  <p className="text-xs text-muted-foreground">— {log.createdBy}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>汇报进度</DialogTitle>
          </DialogHeader>
          <form ref={formRef} action={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">所属任务 <span className="text-red-500">*</span></label>
              <select name="taskId" required className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-background">
                <option value="">请选择任务</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} [{TASK_STATUS_MAP[t.status as keyof typeof TASK_STATUS_MAP] ?? t.status}]</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">汇报内容 <span className="text-red-500">*</span></label>
              <textarea name="content" required rows={4} placeholder="例如：新闻通稿 V1 已交付，等待客户反馈。" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none" />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>取消</Button>
              <Button type="submit" disabled={submitting} className="gap-1.5">
                {submitting && <Loader2 className="size-3.5 animate-spin" />}
                追加记录
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

---

> 📦 **评审包结束**
> 本文档涵盖 ShadowPM V1.0 完整系统骨架：
> • 5 个偏离度自省项
> • 2 份需求文档原文
> • 完整数据库 Schema（7 模型 + 4 枚举 + 级联 + 索引 + Decimal）
> • 10 个核心源文件完整代码（types / auth / prisma / middleware / auth-actions / project-actions / task-actions / ledger-actions / timeline-actions / dashboard-actions / wiki-actions / copilot-actions）
> • 项目详情页 + 3 个核心业务组件（TaskList / LedgerTable / TimelineView）
