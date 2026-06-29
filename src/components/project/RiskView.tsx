"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { updateRiskStatus } from "@/actions/risk-actions";
import { Button } from "@/components/ui/button";

type RiskItem = {
  id: string;
  title: string | null;
  type: string;
  level: string;
  description: string;
  suggestion: string | null;
  status: string;
  source: string;
  createdAt: Date | string;
};

const LEVEL_LABEL: Record<string, string> = {
  LOW: "低",
  MEDIUM: "中",
  HIGH: "高",
  CRITICAL: "严重",
};

const STATUS_OPTIONS = [
  { value: "OPEN", label: "未处理" },
  { value: "ACKNOWLEDGED", label: "已知悉" },
  { value: "MITIGATED", label: "已缓解" },
  { value: "CLOSED", label: "已关闭" },
];

export function RiskView({ risks }: { risks: RiskItem[] }) {
  const router = useRouter();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const openCount = risks.filter((risk) => risk.status !== "CLOSED").length;
  const criticalCount = risks.filter((risk) => ["HIGH", "CRITICAL"].includes(risk.level) && risk.status !== "CLOSED").length;

  async function handleStatusChange(formData: FormData) {
    const riskId = formData.get("riskId") as string;
    setUpdatingId(riskId);
    try {
      const result = await updateRiskStatus(formData);
      if (result.success) {
        toast.success(result.message ?? "风险状态已更新");
        router.refresh();
      } else {
        toast.error(result.message ?? "更新失败");
      }
    } catch {
      toast.error("更新失败");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3">
        <div>
          <p className="text-sm font-semibold">风险/待确定项</p>
          <p className="text-xs text-muted-foreground">管理 AI 导入、AI 检测和人工记录的项目风险</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-muted px-2 py-1">未关闭 {openCount}</span>
          <span className="rounded-full bg-red-50 px-2 py-1 text-red-700">高优先 {criticalCount}</span>
        </div>
      </div>

      {risks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <ShieldCheck className="size-8 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium">暂无正式风险</p>
          <p className="mt-1 text-xs text-muted-foreground">确认导入候选或运行风险检测后，会显示在这里。</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">风险</th>
                <th className="w-24 px-3 py-2 font-medium">等级</th>
                <th className="w-28 px-3 py-2 font-medium">类型</th>
                <th className="w-36 px-3 py-2 font-medium">状态</th>
                <th className="w-28 px-3 py-2 font-medium">来源</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {risks.map((risk) => (
                <tr key={risk.id} className={risk.status === "CLOSED" ? "bg-muted/20 text-muted-foreground" : "bg-background"}>
                  <td className="px-3 py-2 align-top">
                    <div className="flex min-w-0 items-start gap-2">
                      {risk.status !== "CLOSED" && <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />}
                      <div className="min-w-0">
                        <p className="font-medium">{risk.title ?? risk.type}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{risk.description}</p>
                        {risk.suggestion && (
                          <p className="mt-1 line-clamp-1 text-xs text-emerald-700">建议：{risk.suggestion}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top">
                    <span className="rounded-full bg-muted px-2 py-1 text-xs">{LEVEL_LABEL[risk.level] ?? risk.level}</span>
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-muted-foreground">{risk.type}</td>
                  <td className="px-3 py-2 align-top">
                    <form action={handleStatusChange} className="flex items-center gap-1.5">
                      <input type="hidden" name="riskId" value={risk.id} />
                      <select
                        name="status"
                        defaultValue={risk.status}
                        className="h-8 min-w-0 rounded border bg-background px-2 text-xs outline-none"
                      >
                        {STATUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <Button type="submit" size="sm" variant="outline" className="h-8 px-2 text-xs" disabled={updatingId === risk.id}>
                        {updatingId === risk.id ? <Loader2 className="size-3 animate-spin" /> : "保存"}
                      </Button>
                    </form>
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                    <div>{risk.source}</div>
                    <div>{new Date(risk.createdAt).toLocaleDateString("zh-CN")}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
