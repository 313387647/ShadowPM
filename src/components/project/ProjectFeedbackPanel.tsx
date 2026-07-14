"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { ChevronDown, MessageSquareText, Star } from "lucide-react";
import { submitProjectFeedback, type ProjectFeedbackDTO } from "@/actions/feedback-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const AI_ACCURACY_LABEL: Record<string, string> = {
  GOOD: "识别基本准确",
  PARTIAL: "部分可用，需要人工修",
  POOR: "误判较多",
  NOT_TESTED: "还没完整测试",
};

const OUTCOME_LABEL: Record<string, string> = {
  CREATED: "顺利创建项目",
  CREATED_WITH_EDITS: "修改后创建",
  FAILED: "创建失败",
  BLOCKED: "卡在流程中",
};

const WOULD_USE_LABEL: Record<string, string> = {
  YES: "愿意继续用",
  MAYBE: "看改进后再说",
  NO: "暂时不会用",
};

type Props = {
  projectId: string;
  feedbacks: ProjectFeedbackDTO[];
};

export function ProjectFeedbackPanel({ projectId, feedbacks }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const avgRating = useMemo(() => {
    if (feedbacks.length === 0) return null;
    return feedbacks.reduce((sum, item) => sum + item.rating, 0) / feedbacks.length;
  }, [feedbacks]);

  function handleSubmit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await submitProjectFeedback(formData);
      setMessage(result.message);
      if (result.success) formRef.current?.reset();
    });
  }

  return (
    <section className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/30"
        aria-expanded={expanded}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <MessageSquareText className="size-4 text-primary" />
            <h2 className="text-sm font-semibold">使用反馈</h2>
            {feedbacks.length > 0 && (
              <Badge variant="secondary">{feedbacks.length} 条</Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {expanded ? "收起反馈表单" : "测试完成后点击展开，30 秒记录体验反馈。"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {avgRating !== null && (
            <div className="flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-sm">
              <Star className="size-3.5 fill-amber-400 text-amber-500" />
              <span className="font-medium">{avgRating.toFixed(1)}</span>
            </div>
          )}
          <div className="flex size-8 items-center justify-center rounded-md border bg-background">
            <ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t p-4">
          <form ref={formRef} action={handleSubmit} className="grid gap-3 lg:grid-cols-3">
            <input type="hidden" name="projectId" value={projectId} />
            <label className="space-y-1.5 text-xs font-medium">
              综合评分
              <Select name="rating" defaultValue="4">
                <option value="5">5 - 可以推荐</option>
                <option value="4">4 - 明显有价值</option>
                <option value="3">3 - 有用但不稳定</option>
                <option value="2">2 - 需要大量修正</option>
                <option value="1">1 - 当前不可用</option>
              </Select>
            </label>
            <label className="space-y-1.5 text-xs font-medium">
              AI 识别质量
              <Select name="aiAccuracy" defaultValue="PARTIAL">
                <option value="GOOD">识别基本准确</option>
                <option value="PARTIAL">部分可用，需要人工修</option>
                <option value="POOR">误判较多</option>
                <option value="NOT_TESTED">还没完整测试</option>
              </Select>
            </label>
            <label className="space-y-1.5 text-xs font-medium">
              上传结果
              <Select name="uploadOutcome" defaultValue="CREATED_WITH_EDITS">
                <option value="CREATED">顺利创建项目</option>
                <option value="CREATED_WITH_EDITS">修改后创建</option>
                <option value="FAILED">创建失败</option>
                <option value="BLOCKED">卡在流程中</option>
              </Select>
            </label>
            <label className="space-y-1.5 text-xs font-medium">
              后续意愿
              <Select name="wouldUse" defaultValue="MAYBE">
                <option value="YES">愿意继续用</option>
                <option value="MAYBE">看改进后再说</option>
                <option value="NO">暂时不会用</option>
              </Select>
            </label>
            <div className="grid gap-2 rounded-md border bg-muted/20 p-3 text-xs lg:col-span-2">
              <p className="font-medium">主要问题</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="flex items-center gap-2"><input name="budgetIssue" type="checkbox" />预算识别/流转不对</label>
                <label className="flex items-center gap-2"><input name="calendarIssue" type="checkbox" />执行日历不对</label>
                <label className="flex items-center gap-2"><input name="ownerIssue" type="checkbox" />负责人/渠道混淆</label>
                <label className="flex items-center gap-2"><input name="missingInfo" type="checkbox" />缺失信息没有被保留</label>
              </div>
            </div>
            <label className="space-y-1.5 text-xs font-medium lg:col-span-3">
              哪一步最卡？
              <Textarea name="friction" rows={2} placeholder="例如：不知道该先确认预算还是日历；AI 结果里某些字段不敢信。" />
            </label>
            <label className="space-y-1.5 text-xs font-medium lg:col-span-3">
              其他反馈
              <Textarea name="notes" rows={3} placeholder="请写下最影响判断的错误、缺失或惊喜点。" />
            </label>
            <div className="flex items-center gap-3 lg:col-span-3">
              <Button type="submit" disabled={isPending}>
                {isPending ? "记录中..." : "提交反馈"}
              </Button>
              {message && <span className="text-sm text-muted-foreground">{message}</span>}
            </div>
          </form>

          {feedbacks.length > 0 && (
            <div className="mt-5 border-t pt-4">
              <p className="text-xs font-medium text-muted-foreground">最近反馈</p>
              <div className="mt-2 grid gap-2">
                {feedbacks.slice(0, 3).map((item) => (
                  <div key={item.id} className="rounded-md border bg-muted/20 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.testerName}</span>
                      <Badge variant="outline">{item.rating}/5</Badge>
                      <span className="text-xs text-muted-foreground">{AI_ACCURACY_LABEL[item.aiAccuracy]}</span>
                      <span className="text-xs text-muted-foreground">{OUTCOME_LABEL[item.uploadOutcome]}</span>
                      <span className="text-xs text-muted-foreground">{WOULD_USE_LABEL[item.wouldUse]}</span>
                    </div>
                    {(item.friction || item.notes) && (
                      <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {item.friction || item.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
