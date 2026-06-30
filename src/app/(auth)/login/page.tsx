import { loginWithForm } from "@/actions/auth-actions";

const SEED_USERS = [
  {
    name: "陈鹏",
    role: "LEADER",
    desc: "团队管理者 · 全局大盘视角",
  },
  {
    name: "林小夏",
    role: "MEMBER",
    desc: "项目负责人 · 仰望一万台 & 品牌升级",
  },
  {
    name: "赵雨桐",
    role: "MEMBER",
    desc: "项目协作者 · 社交媒体线",
  },
];

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        {/* 标题 */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-gray-900">
            <span className="text-xl font-bold text-white">S</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            ShadowPM
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            轻量级智能项目管控系统 · 请选择身份进入
          </p>
        </div>

        {/* 用户卡片列表 */}
        <div className="space-y-3">
          {SEED_USERS.map((user) => (
            <form key={user.name} action={loginWithForm}>
              <input type="hidden" name="userName" value={user.name} />
              <button
                type="submit"
                className="flex w-full items-center gap-4 rounded-xl border bg-white p-4 text-left shadow-sm transition-all hover:border-gray-400 hover:shadow-md"
              >
                <div className="flex size-10 items-center justify-center rounded-full bg-gray-900 text-sm font-bold text-white">
                  {user.name[0]}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
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
                  <p className="text-sm text-gray-500">{user.desc}</p>
                </div>
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
