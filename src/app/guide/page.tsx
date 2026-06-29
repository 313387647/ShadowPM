import Link from "next/link";
import { ArrowRight, CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const sections = [
  {
    title: "0. 测试前准备",
    items: ["打开测试网站链接", "准备一份项目 Excel", "没有自己的表格时，在 Demo 页面下载案例表格"],
  },
  {
    title: "1. 打开测试入口",
    items: ["进入 Demo 页面", "点击「下载案例表格」", "点击「开始测试」进入登录页"],
  },
  {
    title: "2. 登录测试账号",
    items: ["选择「林小夏」测试项目创建", "如果想看管理者视角，之后可以退出并选择「陈鹏」"],
  },
  {
    title: "3. 新建 AI 项目",
    items: ["在 AI 工作台点击「新建项目」", "保持在「AI 生成」", "上传 Excel", "点击「开始解析」并等待 AI 完成"],
  },
  {
    title: "4. 看懂 AI 预览",
    items: ["检查项目名称和时间", "检查项目管控表", "检查预算候选", "检查执行日历候选", "检查风险/待确认项"],
  },
  {
    title: "5. 创建项目",
    items: ["预览基本可读时，点击「创建项目与管控表」", "预算为空或待确认也可以先创建", "明显错误也可以创建后在反馈里说明"],
  },
  {
    title: "6. 检查三大件",
    items: ["任务总控：是否比原 Excel 更容易理解", "资金账本：预算估算有没有被误当真实支出", "执行日历：日期、渠道、负责人、内容有没有拆清楚"],
  },
  {
    title: "7. 检查风险/待定",
    items: ["风险是否真实", "缺失字段是否被保留", "模糊信息是否清楚标记为待确认"],
  },
  {
    title: "8. 试一下 AI 助手",
    items: ["问：这个项目预算还有多少？", "问：有哪些事项缺负责人？", "问：接下来有哪些执行日历？", "看 AI 是否基于真实数据回答"],
  },
  {
    title: "9. 提交外测反馈",
    items: ["回到项目页上方的「外测反馈」", "填写评分、AI 识别质量、上传结果和使用意愿", "勾选预算/日历/负责人/缺失信息问题", "写下最卡的一步并提交"],
  },
];

const examples = [
  "AI 把「预计预算 20 万」当成了已经支出的费用。",
  "传播日历里把负责人姓名和渠道混在一起了，我不知道该怎么确认。",
  "项目管控表比原 Excel 清楚，但缺失字段没有足够醒目。",
];

export default function BeginnerGuidePage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="border-b bg-muted/30">
        <div className="mx-auto flex max-w-5xl flex-col gap-5 px-6 py-12">
          <Badge className="w-fit" variant="secondary">ShadowPM 小白测试教程</Badge>
          <div className="max-w-3xl space-y-3">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              按这份教程走完一次上传、生成、检查和反馈
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              你不需要懂项目管理系统，也不需要提前整理 Excel。测试目标是看 ShadowPM 能不能把混乱表格变成更清楚的项目管控工作区。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="gap-2">
              <Link href="/demo">
                返回 Demo 入口
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <Link href="/login">
                直接开始测试
                <ExternalLink className="size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-6 py-10 md:grid-cols-2">
        {sections.map((section) => (
          <article key={section.title} className="rounded-lg border bg-card p-5">
            <h2 className="text-base font-semibold">{section.title}</h2>
            <ul className="mt-3 space-y-2">
              {section.items.map((item) => (
                <li key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground">
                  <CheckCircle2 className="mt-1 size-4 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
          <h2 className="text-sm font-semibold">什么算好反馈？</h2>
          <div className="mt-3 grid gap-2">
            {examples.map((example) => (
              <p key={example} className="rounded-md bg-white/70 px-3 py-2 text-sm leading-6">
                {example}
              </p>
            ))}
          </div>
          <p className="mt-4 text-sm leading-6">
            如果你不知道下一步点哪里，或者某一步让你不放心，请直接写进「外测反馈」。这类反馈对产品改进非常重要。
          </p>
        </div>
      </section>
    </main>
  );
}
