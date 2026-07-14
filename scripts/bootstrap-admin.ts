import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";

const name = process.env.TEAM_ADMIN_NAME?.trim() ?? "";
const email = process.env.TEAM_ADMIN_EMAIL?.trim().toLowerCase() ?? "";
const password = process.env.TEAM_ADMIN_PASSWORD ?? "";

if (!name || !email || !password) {
  throw new Error("请设置 TEAM_ADMIN_NAME、TEAM_ADMIN_EMAIL、TEAM_ADMIN_PASSWORD 后再执行。");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const passwordHash = await hashPassword(password);
  const admin = await prisma.user.upsert({
    where: { email },
    create: { name, email, passwordHash, role: "LEADER", isActive: true },
    update: { name, passwordHash, role: "LEADER", isActive: true },
  });
  console.log(`团队管理员已就绪：${admin.name} <${admin.email}>`);
}

main()
  .catch((error) => {
    console.error("创建团队管理员失败：", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
