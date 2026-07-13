import { loginWithForm } from "@/actions/auth-actions";
import { prisma } from "@/lib/prisma";

// Test accounts come from the live demo database and must not be frozen at build time.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      role: true,
      _count: { select: { projects: true, projectMemberships: true } },
    },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  return (
    <div className="surface-grid flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
      <div className="w-full max-w-lg space-y-7 rounded-lg border bg-background/95 p-5 shadow-[0_18px_60px_rgba(15,23,18,0.08)] backdrop-blur sm:p-7">
        {/* 标题 */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-lg bg-gray-950">
            <span className="text-xl font-bold text-white">S</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            ShadowPM
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            AI Native 项目管控工作区 · 请选择身份进入
          </p>
        </div>

        {/* 用户卡片列表 */}
        <div className="grid gap-2.5">
          {users.map((user) => (
            <form key={user.id} action={loginWithForm}>
              <input type="hidden" name="userId" value={user.id} />
              <button
                type="submit"
                className="group flex w-full items-center gap-3 rounded-lg border bg-card p-3.5 text-left transition-colors hover:border-primary/35 hover:bg-muted/25 focus-visible:ring-2 focus-visible:ring-primary"
              >
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-gray-950 text-sm font-semibold text-white">
                  {user.name[0]}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">
                    {user.name}
                    <span
                      className={`ml-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        user.role === "LEADER"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {user.role === "LEADER" ? "管理者" : "成员"}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {user.role === "LEADER"
                      ? "团队管理者 · 全局大盘视角"
                      : `项目负责人 · ${user._count.projects} 个自有项目 · ${user._count.projectMemberships} 个协作项目`}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">进入</span>
              </button>
            </form>
          ))}
        </div>

        <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
          <a href="/demo" className="hover:text-gray-600 underline underline-offset-2">
            ← 返回 Demo 入口
          </a>
          <span>·</span>
          <a href="/guide" className="hover:text-gray-600 underline underline-offset-2">
            查看小白教程
          </a>
        </div>
        <p className="text-center text-xs text-gray-400">
          演示环境 · 点击任意用户直接登录
        </p>
      </div>
    </div>
  );
}
