import Link from "next/link";
import { ArrowRight, CheckCircle2, Download, FileSpreadsheet, LogIn, MessageSquareText, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: LogIn,
    title: "1. 登录测试账号",
    detail: "推荐选择「林小夏」测试项目创建；选择「陈鹏」查看全局大盘。",
  },
  {
    icon: Download,
    title: "2. 下载案例表格",
    detail: "使用页面下方的案例文件，也可以上传你自己的项目管控表。",
  },
  {
    icon: Upload,
    title: "3. AI 生成项目",
    detail: "进入工作台，点击「新建项目」→「AI 生成」→ 上传 Excel。",
  },
  {
    icon: CheckCircle2,
    title: "4. 审核并创建",
    detail: "检查项目管控表、预算候选、执行日历和风险候选，再创建项目。",
  },
  {
    icon: MessageSquareText,
    title: "5. 记录反馈",
    detail: "重点反馈 AI 是否误判预算、日历、负责人、风险和缺失字段。",
  },
];

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-background">
      <section className="border-b bg-muted/30">
        <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-14">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            ShadowPM Alpha Demo
          </div>
          <div className="max-w-3xl space-y-4">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              上传一份混乱项目表格，测试 AI 是否能生成可用的项目管控系统
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              这个测试站用于收集 ShadowPM Alpha 反馈。请重点看 AI 是否正确拆分项目管控总表、预算候选、执行日历和风险/待定项，而不是只评价页面是否好看。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="gap-2">
              <Link href="/login">
                开始测试
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="gap-2">
              <a href="/demo-assets/one-million-project-control-sample.xlsx" download>
                <Download className="size-4" />
                下载案例表格
              </a>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-6 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">测试流程</h2>
          <div className="grid gap-3">
            {steps.map((step) => (
              <div key={step.title} className="flex gap-3 rounded-lg border bg-card p-4">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <step.icon className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-5">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="size-5 text-emerald-600" />
              <h2 className="text-lg font-semibold">推荐案例</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              案例表格是一个不完全准确、结构混乱的项目管控表。它适合测试 AI 是否会把预算误写进总控表、是否能拆分传播日历、是否能保留待确认信息。
            </p>
            <Button asChild variant="outline" className="mt-4 w-full gap-2">
              <a href="/demo-assets/one-million-project-control-sample.xlsx" download>
                <Download className="size-4" />
                下载 one-million-project-control-sample.xlsx
              </a>
            </Button>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <h2 className="text-sm font-semibold">请重点反馈</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6">
              <li>AI 有没有把预算估算误当成支出？</li>
              <li>AI 有没有混淆渠道、负责人和内容？</li>
              <li>项目管控表是否比原 Excel 更容易理解？</li>
              <li>哪些缺失信息应该直接进入表格补齐？</li>
              <li>哪些操作让你犹豫、不放心或点击太多？</li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
