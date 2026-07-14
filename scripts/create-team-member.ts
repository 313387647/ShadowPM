import { PrismaClient, Role } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "../src/lib/password";

const name = process.env.TEAM_MEMBER_NAME?.trim() ?? "";
const email = process.env.TEAM_MEMBER_EMAIL?.trim().toLowerCase() ?? "";
const password = process.env.TEAM_MEMBER_PASSWORD ?? "";
const requestedRole = process.env.TEAM_MEMBER_ROLE ?? "MEMBER";

if (!name || !email || !password) {
  throw new Error("请设置 TEAM_MEMBER_NAME、TEAM_MEMBER_EMAIL、TEAM_MEMBER_PASSWORD 后再执行。");
}

if (requestedRole !== "LEADER" && requestedRole !== "MEMBER") {
  throw new Error("TEAM_MEMBER_ROLE 只能是 LEADER 或 MEMBER。");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  const passwordHash = await hashPassword(password);
  const role = requestedRole as Role;
  const member = await prisma.user.upsert({
    where: { email },
    create: { name, email, passwordHash, role, isActive: true },
    update: { name, passwordHash, role, isActive: true },
  });
  console.log(`团队成员已就绪：${member.name} <${member.email}> (${member.role})`);
}

main()
  .catch((error) => {
    console.error("创建团队成员失败：", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
