# 数据库设计 (Prisma Schema Blueprint)
// 提示 AI：请以此为基础生成 prisma schema，切勿擅自修改核心逻辑。

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  LEADER
  MEMBER
}

enum TaskStatus {
  PENDING    // 待启动
  IN_PROGRESS// 进行中
  COMPLETED  // 已完成
}

enum FlowType {
  ALLOCATE   // 初始/追加预算 (正数)
  EXPENSE    // 支出走账 (负数)
  REFUND     // 费用退回 (正数)
}

enum AssetType {
  DOCUMENT   // 富文本
  LINK       // 外部链接
  FILE       // 附件
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
  totalBudget Float    // 规划的总预算池
  startDate   DateTime?
  endDate     DateTime?
  createdAt   DateTime @default(now())
  
  owner       User     @relation(fields: [ownerId], references: [id])
  tasks       Task[]
  folders     AssetFolder[]
}

model Task {
  id          String     @id @default(cuid())
  projectId   String
  name        String
  assignee    String?    // 执行人姓名
  deadline    DateTime?
  status      TaskStatus @default(PENDING)
  
  project     Project    @relation(fields: [projectId], references: [id])
  logs        ProgressLog[]
  budgets     BudgetFlow[]
}

model ProgressLog {
  id        String   @id @default(cuid())
  taskId    String
  content   String   // 支持 Markdown
  createdBy String   // 操作人
  createdAt DateTime @default(now())
  
  task      Task     @relation(fields: [taskId], references: [id])
}

model BudgetFlow {
  id          String   @id @default(cuid())
  taskId      String
  flowType    FlowType
  amount      Float    // 支出为负数，分配为正数
  description String   // 事由
  createdBy   String
  createdAt   DateTime @default(now())
  
  task        Task     @relation(fields: [taskId], references: [id])
}

model AssetFolder {
  id        String   @id @default(cuid())
  projectId String
  name      String
  parentId  String?  // 支持树状层级
  
  project   Project  @relation(fields: [projectId], references: [id])
  assets    AssetItem[]
}

model AssetItem {
  id        String    @id @default(cuid())
  folderId  String
  title     String
  type      AssetType
  content   String?   // 富文本或外部链接
  fileUrl   String?
  version   Int       @default(1)
  
  folder    AssetFolder @relation(fields: [folderId], references: [id])
}
