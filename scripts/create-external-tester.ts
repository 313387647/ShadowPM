import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";

const name = process.env.EXTERNAL_TESTER_NAME?.trim() ?? "";
const email = process.env.EXTERNAL_TESTER_EMAIL?.trim().toLowerCase() ?? "";
const password = process.env.EXTERNAL_TESTER_PASSWORD ?? "";

if (!name || !email || !password) {
  throw new Error("请设置 EXTERNAL_TESTER_NAME、EXTERNAL_TESTER_EMAIL、EXTERNAL_TESTER_PASSWORD。");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, isExternalTester: true },
  });
  if (existing && !existing.isExternalTester) {
    throw new Error("该邮箱已被内部成员使用，不能转换为外部体验账号。");
  }

  const passwordHash = await hashPassword(password);
  const tester = await prisma.user.upsert({
    where: { email },
    create: { name, email, passwordHash, role: "MEMBER", isActive: true, isExternalTester: true },
    update: { name, passwordHash, role: "MEMBER", isActive: true, isExternalTester: true },
  });
  console.log(`外部体验账号已就绪：${tester.name} <${tester.email}>`);
}

main()
  .catch((error) => {
    console.error("创建外部体验账号失败：", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
