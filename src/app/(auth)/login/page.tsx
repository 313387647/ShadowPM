import { SiteRegistration } from "@/components/layout/SiteRegistration";

export default function LoginPage({ searchParams }: { searchParams?: { error?: string } }) {
  const hasError = searchParams?.error === "invalid-credentials";

  return (
    <div className="surface-grid flex min-h-screen flex-col px-4 py-10 sm:px-6">
      <div className="flex flex-1 items-center justify-center">
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
            AI Native 项目管控工作区
          </p>
        </div>

        <form action="/api/login" method="post" className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium text-foreground">工作邮箱</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="name@company.com" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium text-foreground">密码</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="w-full rounded-lg border bg-background px-3 py-2.5 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/15" placeholder="输入密码" />
          </div>
          {hasError && <p className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive">邮箱或密码不正确，或账号已停用。</p>}
          <button type="submit" className="w-full rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">登录 ShadowPM</button>
        </form>

        <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
          <a href="/guide" className="hover:text-gray-600 underline underline-offset-2">
            查看使用说明
          </a>
        </div>
        <p className="text-center text-xs text-gray-400">
          团队内部系统 · 请使用管理员创建的账号登录
        </p>
        </div>
      </div>
      <SiteRegistration className="pt-8" />
    </div>
  );
}
