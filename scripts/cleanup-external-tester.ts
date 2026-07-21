import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const email = process.env.EXTERNAL_TESTER_EMAIL?.trim().toLowerCase() ?? "";
if (!email) throw new Error("请设置 EXTERNAL_TESTER_EMAIL。");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const tester = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, isExternalTester: true, _count: { select: { projects: true } } },
  });
  if (!tester) {
    console.log("未找到体验账号，无需清理。");
    return;
  }
  if (!tester.isExternalTester) throw new Error("拒绝清理内部成员账号。");

  const externalProjectCount = await prisma.project.count({
    where: { ownerId: tester.id, isExternalProject: true },
  });
  if (externalProjectCount !== tester._count.projects) {
    throw new Error("该账号存在非隔离项目，拒绝自动删除。");
  }

  await prisma.$transaction(async (tx) => {
    await tx.project.deleteMany({ where: { ownerId: tester.id, isExternalProject: true } });
    await tx.user.delete({ where: { id: tester.id } });
  });
  console.log(`已清理外部体验账号 ${tester.name} 及 ${externalProjectCount} 个体验项目。`);
}

main()
  .catch((error) => {
    console.error("清理外部体验账号失败：", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
