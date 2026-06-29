import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, CalendarDays, Coins, FileQuestion, MessageSquareText, UserRoundCheck } from "lucide-react";
import { getAlphaFeedback } from "@/actions/feedback-actions";
import { getCurrentUser } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const AI_ACCURACY_LABEL: Record<string, string> = {
  GOOD: "识别基本准确",
  PARTIAL: "部分可用",
  POOR: "误判较多",
  NOT_TESTED: "未完整测试",
};

const OUTCOME_LABEL: Record<string, string> = {
  CREATED: "顺利创建",
  CREATED_WITH_EDITS: "修改后创建",
  FAILED: "创建失败",
  BLOCKED: "流程卡住",
};

const WOULD_USE_LABEL: Record<string, string> = {
  YES: "愿意继续用",
  MAYBE: "观望",
  NO: "暂不使用",
};

export default async function FeedbackPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "LEADER") redirect("/workspace");

  const feedbacks = await getAlphaFeedback();
  const avgRating = feedbacks.length
    ? feedbacks.reduce((sum, item) => sum + item.rating, 0) / feedbacks.length
    : 0;
  const issueStats = [
    { label: "预算误判", count: feedbacks.filter((item) => item.budgetIssue).length, icon: Coins },
    { label: "日历误判", count: feedbacks.filter((item) => item.calendarIssue).length, icon: CalendarDays },
    { label: "负责人混淆", count: feedbacks.filter((item) => item.ownerIssue).length, icon: UserRoundCheck },
    { label: "缺失信息", count: feedbacks.filter((item) => item.missingInfo).length, icon: FileQuestion },
  ];
  const blockedCount = feedbacks.filter((item) => item.uploadOutcome === "FAILED" || item.uploadOutcome === "BLOCKED").length;

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">外测反馈</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            收集测试者上传案例、AI 识别、项目创建和后续使用意愿。
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/demo">打开 Demo 入口</Link>
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="反馈总数" value={String(feedbacks.length)} detail="最近 100 条" />
        <MetricCard label="平均评分" value={feedbacks.length ? avgRating.toFixed(1) : "-"} detail="1-5 分" />
        <MetricCard label="失败/卡住" value={String(blockedCount)} detail="创建失败或流程阻塞" tone={blockedCount > 0 ? "warning" : "default"} />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {issueStats.map((item) => (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-xl font-semibold">{item.count}</p>
              </div>
              <item.icon className="size-5 text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="rounded-lg border bg-card">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          <MessageSquareText className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">反馈流</h2>
        </div>
        {feedbacks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
            <AlertTriangle className="size-6 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">还没有收到反馈</p>
              <p className="mt-1 text-sm text-muted-foreground">分享 `/demo` 给测试者，创建项目后即可提交。</p>
            </div>
          </div>
        ) : (
          <div className="divide-y">
            {feedbacks.map((item) => (
              <article key={item.id} className="grid gap-3 px-4 py-4 lg:grid-cols-[1.2fr_1fr]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/projects/${item.projectId}`} className="font-medium hover:underline">
                      {item.projectName}
                    </Link>
                    <Badge variant="outline">{item.rating}/5</Badge>
                    <Badge variant={item.wouldUse === "YES" ? "default" : "secondary"}>
                      {WOULD_USE_LABEL[item.wouldUse]}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.testerName} · {new Date(item.createdAt).toLocaleString("zh-CN")}
                  </p>
                  {(item.friction || item.notes) && (
                    <div className="mt-3 space-y-2 text-sm leading-6">
                      {item.friction && <p><span className="font-medium">卡点：</span>{item.friction}</p>}
                      {item.notes && <p><span className="font-medium">补充：</span>{item.notes}</p>}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-start gap-2 text-xs">
                  <Badge variant="secondary">{AI_ACCURACY_LABEL[item.aiAccuracy]}</Badge>
                  <Badge variant="secondary">{OUTCOME_LABEL[item.uploadOutcome]}</Badge>
                  {item.budgetIssue && <Badge variant="destructive">预算问题</Badge>}
                  {item.calendarIssue && <Badge variant="destructive">日历问题</Badge>}
                  {item.ownerIssue && <Badge variant="destructive">负责人/渠道</Badge>}
                  {item.missingInfo && <Badge variant="destructive">缺失信息</Badge>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "warning";
}) {
  return (
    <Card className={tone === "warning" ? "border-amber-200 bg-amber-50" : undefined}>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}
