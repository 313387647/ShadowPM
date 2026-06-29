"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSessionCookieValue } from "@/lib/auth";

const DEMO_USERS = {
  "陈鹏": "LEADER",
  "林小夏": "MEMBER",
  "赵雨桐": "MEMBER",
} as const;

export async function login(userName: string) {
  // 按名称查找用户（seed 脚本保证这三个用户始终存在）
  const existingUser = await prisma.user.findFirst({
    where: { name: userName },
  });
  const demoRole = DEMO_USERS[userName as keyof typeof DEMO_USERS];
  if (!existingUser && !demoRole) {
    throw new Error(`用户 ${userName} 不存在`);
  }
  const user = existingUser ?? await prisma.user.create({
    data: {
      name: userName,
      role: demoRole,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set("shadowpm-session", createSessionCookieValue({
    id: user.id,
    name: user.name,
    role: user.role,
  }), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 天
  });
  // LEADER 默认进大盘，MEMBER 进工作台
  redirect(user.role === "LEADER" ? "/dashboard" : "/workspace");
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete("shadowpm-session");
  redirect("/login");
}
