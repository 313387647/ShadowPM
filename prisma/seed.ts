/**
 * ShadowPM — 数据库初始化种子脚本
 *
 * 运行方式：npx prisma db seed
 * 要求：Prisma Postgres 已在本地运行 (`npx prisma dev`)
 */

import { PrismaClient } from "../src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { Prisma } from "../src/generated/prisma/client"

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
})

async function main() {
  console.log("🌱 开始填充种子数据...\n")

  // ── 清理旧数据（保证幂等） ──
  await prisma.budgetFlow.deleteMany()
  await prisma.progressLog.deleteMany()
  await prisma.task.deleteMany()
  await prisma.project.deleteMany()
  await prisma.user.deleteMany()

  // ════════════════════════════════════════
  // 1. 创建用户
  // ════════════════════════════════════════
  const leader = await prisma.user.create({
    data: { name: "陈鹏", role: "LEADER" },
  })
  console.log(`👤 LEADER: ${leader.name} (${leader.id})`)

  const member1 = await prisma.user.create({
    data: { name: "林小夏", role: "MEMBER" },
  })
  console.log(`👤 MEMBER: ${member1.name} (${member1.id})`)

  const member2 = await prisma.user.create({
    data: { name: "赵雨桐", role: "MEMBER" },
  })
  console.log(`👤 MEMBER: ${member2.name} (${member2.id})`)

  // ════════════════════════════════════════
  // 2. 创建 2 个项目
  // ════════════════════════════════════════
  const project1 = await prisma.project.create({
    data: {
      name: "仰望一万台整合营销",
      ownerId: member1.id,
      totalBudget: new Prisma.Decimal("5000000.00"),
      startDate: new Date("2026-06-01T00:00:00.000Z"),
      endDate: new Date("2026-12-31T00:00:00.000Z"),
    },
  })
  console.log(`📁 项目: ${project1.name} (预算 ¥${project1.totalBudget.toNumber().toLocaleString()})`)

  const project2 = await prisma.project.create({
    data: {
      name: "品牌升级年度Campaign",
      ownerId: member1.id,
      totalBudget: new Prisma.Decimal("2000000.00"),
      startDate: new Date("2026-07-01T00:00:00.000Z"),
      endDate: new Date("2027-03-31T00:00:00.000Z"),
    },
  })
  console.log(`📁 项目: ${project2.name} (预算 ¥${project2.totalBudget.toNumber().toLocaleString()})`)

  // ════════════════════════════════════════
  // 3. 创建子任务
  // ════════════════════════════════════════
  const task1 = await prisma.task.create({
    data: {
      projectId: project1.id,
      name: "公关传播线",
      assignee: "林小夏",
      deadline: new Date("2026-08-15T00:00:00.000Z"),
      status: "IN_PROGRESS",
    },
  })
  console.log(`  ✅ 任务: ${task1.name} [进行中]`)

  const task2 = await prisma.task.create({
    data: {
      projectId: project1.id,
      name: "社交媒体线",
      assignee: "赵雨桐",
      deadline: new Date("2026-09-30T00:00:00.000Z"),
      status: "PENDING",
    },
  })
  console.log(`  ⏳ 任务: ${task2.name} [待启动]`)

  const task3 = await prisma.task.create({
    data: {
      projectId: project1.id,
      name: "达人种草线",
      assignee: "林小夏",
      deadline: new Date("2026-07-31T00:00:00.000Z"),
      status: "IN_PROGRESS",
    },
  })
  console.log(`  ✅ 任务: ${task3.name} [进行中]`)

  const task_brand = await prisma.task.create({
    data: {
      projectId: project2.id,
      name: "品牌视觉升级",
      assignee: "林小夏",
      deadline: new Date("2026-10-31T00:00:00.000Z"),
      status: "IN_PROGRESS",
    },
  })
  console.log(`  ✅ 任务: ${task_brand.name} [进行中] (品牌升级项目)`)

  // ════════════════════════════════════════
  // 4. 资金流水 (Event-Sourced Budget)
  // ════════════════════════════════════════
  // 仰望一万台
  await prisma.budgetFlow.create({
    data: { taskId: task1.id, flowType: "ALLOCATE", amount: new Prisma.Decimal("5000000.00"), description: "仰望一万台项目初始预算分配", createdBy: "陈鹏" },
  })
  await prisma.budgetFlow.create({
    data: { taskId: task1.id, flowType: "EXPENSE", amount: new Prisma.Decimal("-350000.00"), description: "新闻通稿撰写及媒体投放费用", createdBy: "林小夏" },
  })
  await prisma.budgetFlow.create({
    data: { taskId: task1.id, flowType: "EXPENSE", amount: new Prisma.Decimal("-120000.00"), description: "KOL 媒体见面会场地及茶歇", createdBy: "林小夏" },
  })
  await prisma.budgetFlow.create({
    data: { taskId: task3.id, flowType: "EXPENSE", amount: new Prisma.Decimal("-280000.00"), description: "头部达人合作费用 (小红书 x3)", createdBy: "林小夏" },
  })
  await prisma.budgetFlow.create({
    data: { taskId: task3.id, flowType: "REFUND", amount: new Prisma.Decimal("15000.00"), description: "达人档期冲突退款 — 差旅费退回", createdBy: "林小夏" },
  })
  // 品牌升级
  await prisma.budgetFlow.create({
    data: { taskId: task_brand.id, flowType: "ALLOCATE", amount: new Prisma.Decimal("2000000.00"), description: "品牌升级年度Campaign 初始预算分配", createdBy: "陈鹏" },
  })
  await prisma.budgetFlow.create({
    data: { taskId: task_brand.id, flowType: "EXPENSE", amount: new Prisma.Decimal("-450000.00"), description: "品牌视觉设计外包费 (Logo & VI 系统)", createdBy: "林小夏" },
  })
  await prisma.budgetFlow.create({
    data: { taskId: task_brand.id, flowType: "EXPENSE", amount: new Prisma.Decimal("-180000.00"), description: "品牌调研与用户访谈", createdBy: "林小夏" },
  })
  console.log(`  💰 已录入 8 条资金流水`)

  // ════════════════════════════════════════
  // 5. 进度日志 (Append-Only Timeline)
  // ════════════════════════════════════════
  await prisma.progressLog.create({
    data: { taskId: task1.id, content: "📋 公关传播线正式启动，已完成媒体名单初筛。", createdBy: "林小夏" },
  })
  await prisma.progressLog.create({
    data: { taskId: task1.id, content: "✍️ 新闻通稿 V1 已交付，等待客户反馈。预计周三前确认终稿。", createdBy: "林小夏" },
  })
  await prisma.progressLog.create({
    data: { taskId: task1.id, content: "📞 与 12 家核心媒体确认发布会档期，8 家已回复确认出席。", createdBy: "林小夏" },
  })
  await prisma.progressLog.create({
    data: { taskId: task2.id, content: "📱 社交媒体线任务已创建，待分配具体执行计划。", createdBy: "林小夏" },
  })
  await prisma.progressLog.create({
    data: { taskId: task3.id, content: "🤝 达人种草线启动，已联系 8 位小红书腰部达人。", createdBy: "林小夏" },
  })
  await prisma.progressLog.create({
    data: { taskId: task3.id, content: "📦 3 位达人已确认合作，Brief 已发出。其余 5 位仍在排期沟通中。", createdBy: "林小夏" },
  })
  console.log(`  📝 已录入 6 条进度日志`)

  // ════════════════════════════════════════
  // 汇总
  // ════════════════════════════════════════
  const userCount = await prisma.user.count()
  const projectCount = await prisma.project.count()
  const taskCount = await prisma.task.count()
  const budgetCount = await prisma.budgetFlow.count()
  const logCount = await prisma.progressLog.count()

  console.log("═══════════════════════════════════════")
  console.log("🌱 种子数据填充完成！")
  console.log(`   👤 用户: ${userCount}`)
  console.log(`   📁 项目: ${projectCount}`)
  console.log(`   ✅ 任务: ${taskCount}`)
  console.log(`   💰 流水: ${budgetCount}`)
  console.log(`   📝 日志: ${logCount}`)
  console.log("═══════════════════════════════════════\n")
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error("❌ 种子数据填充失败:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
