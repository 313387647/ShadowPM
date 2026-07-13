import Link from "next/link";
import { ArrowRight, CheckCircle2, Download, FileSpreadsheet, LogIn, MessageSquareText, Sparkles, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

const steps = [
  {
    icon: LogIn,
    title: "1. 登录测试账号",
    detail: "选择任意项目成员测试创建和编辑；选择管理者查看全局大盘。",
  },
  {
    icon: Download,
    title: "2. 先看完整说明书",
    detail: "说明书覆盖每个页面、卡片、字段、状态和反馈重点，第一次测试建议先看。",
  },
  {
    icon: Upload,
    title: "3. 下载案例并 AI 生成项目",
    detail: "进入工作台，点击「新建项目」→「AI 生成」→ 上传 Excel。",
  },
  {
    icon: CheckCircle2,
    title: "4. 检查并创建",
    detail: "检查项目管控表、将生成的预算流水和执行日历，再创建项目。",
  },
  {
    icon: MessageSquareText,
    title: "5. 记录反馈",
    detail: "创建项目后，项目数据和反馈都会沉淀下来，便于产品团队复盘。",
  },
];

const checklist = [
  "AI 有没有把预算估算误当成支出？",
  "AI 有没有混淆渠道、负责人和内容？",
  "项目管控表是否比原 Excel 更容易理解？",
  "缺失字段能不能直接在表里补齐，而不是进入额外队列？",
  "手动创建项目后，能不能顺手新增和维护管控事项？",
  "哪些操作让你犹豫、不放心或点击太多？",
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
              上传一份项目表格，测试 AI 是否能生成可编辑的项目管控工作区
            </h1>
            <p className="text-base leading-7 text-muted-foreground">
              这个测试站用于收集 ShadowPM Alpha 反馈。请重点测试 AI 上传后是否直接生成三件套：
              项目管控总表、资金账本、执行日历。缺失字段应该能在表里直接补齐，不应该变成额外流程。
              也请测试手动创建项目、修改管控事项、记录预算流转和维护执行日历是否足够顺手。
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
            <Button asChild variant="outline" className="gap-2">
              <Link href="/guide">查看完整说明书</Link>
            </Button>
          </div>
          <div className="grid gap-3 rounded-lg border bg-background p-4 text-sm text-muted-foreground sm:grid-cols-3">
            <div>
              <p className="font-medium text-foreground">测试账号</p>
              <p className="mt-1">选择任意成员上传和创建项目；选择管理者查看全局大盘与反馈后台。</p>
            </div>
            <div>
              <p className="font-medium text-foreground">数据会保留</p>
              <p className="mt-1">你创建的项目、表格解析结果和反馈会被产品团队用于复盘。</p>
            </div>
            <div>
              <p className="font-medium text-foreground">建议用电脑</p>
              <p className="mt-1">Excel 上传、表格检查和字段编辑在桌面浏览器里最稳定。</p>
            </div>
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
            <Button asChild className="mt-2 w-full gap-2">
              <Link href="/guide">
                查看完整小白说明书
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <h2 className="text-sm font-semibold">请重点反馈</h2>
            <ul className="mt-3 space-y-2 text-sm leading-6">
              {checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
