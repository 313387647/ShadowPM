"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarSync, Copy, Download, FileText, Link2, Loader2, RefreshCw, Share2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  createProjectShareLink,
  generateProjectReport,
  revokeProjectShareLink,
  type ProjectReportPeriod,
} from "@/actions/project-output-actions";

type OutputData = {
  reports: Array<{
    id: string;
    periodType: string;
    periodStart: Date;
    periodEnd: Date;
    content: string;
    generatedBy: string;
    createdAt: Date;
  }>;
  sources: Array<{
    id: string;
    fileName: string;
    mediaType: string;
    uploadedBy: string;
    createdAt: Date;
  }>;
  shareLinks: Array<{
    id: string;
    label: string;
    expiresAt: Date | null;
    revokedAt: Date | null;
    createdBy: string;
    createdAt: Date;
  }>;
};

export function ProjectOutputsPanel({
  projectId,
  canEdit,
  data,
}: {
  projectId: string;
  canEdit: boolean;
  data: OutputData;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<ProjectReportPeriod | "share" | string | null>(null);
  const [reportContent, setReportContent] = useState(data.reports[0]?.content ?? "");
  const [createdLinks, setCreatedLinks] = useState<{ shareUrl: string; calendarUrl: string } | null>(null);

  async function handleGenerate(period: ProjectReportPeriod) {
    setBusy(period);
    try {
      const result = await generateProjectReport(projectId, period);
      if (!result.success || !result.data) return toast.error(result.message ?? "报告生成失败");
      setReportContent(result.data.content);
      toast.success(result.message);
      router.refresh();
    } catch {
      toast.error("报告生成失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleCreateShare() {
    setBusy("share");
    try {
      const result = await createProjectShareLink(projectId, 30);
      if (!result.success || !result.data) return toast.error(result.message ?? "创建分享链接失败");
      setCreatedLinks(result.data);
      toast.success(result.message);
      router.refresh();
    } catch {
      toast.error("创建分享链接失败");
    } finally {
      setBusy(null);
    }
  }

  async function handleRevoke(linkId: string) {
    setBusy(linkId);
    try {
      const result = await revokeProjectShareLink(linkId);
      if (result.success) toast.success(result.message);
      else toast.error(result.message);
      router.refresh();
    } catch {
      toast.error("撤销失败");
    } finally {
      setBusy(null);
    }
  }

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    toast.success(`${label}已复制`);
  }

  const activeLinks = data.shareLinks.filter((link) => !link.revokedAt && (!link.expiresAt || new Date(link.expiresAt) > new Date()));

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Share2 className="size-3.5" />
        分享
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto p-0">
          <DialogHeader className="border-b px-5 py-4 pr-12">
            <DialogTitle>输出与分享</DialogTitle>
            <DialogDescription>导出标准工作簿、生成有来源依据的报告，或创建可撤销的只读链接。</DialogDescription>
          </DialogHeader>

          <div className="grid gap-0 md:grid-cols-[210px_minmax(0,1fr)]">
            <div className="space-y-5 border-b bg-muted/20 p-4 md:border-b-0 md:border-r">
              <section>
                <p className="mb-2 text-xs font-medium text-muted-foreground">标准输出</p>
                <Button asChild variant="outline" className="w-full justify-start gap-2 bg-background">
                  <a href={`/api/projects/${projectId}/export`} download>
                    <Download className="size-4" />项目管控工作簿
                  </a>
                </Button>
              </section>

              <section>
                <p className="mb-2 text-xs font-medium text-muted-foreground">报告周期</p>
                <div className="grid gap-2">
                  <Button variant="outline" className="justify-start gap-2 bg-background" disabled={!canEdit || busy !== null} onClick={() => handleGenerate("WEEKLY")}>
                    {busy === "WEEKLY" ? <Loader2 className="animate-spin" /> : <FileText />}
                    生成周报
                  </Button>
                  <Button variant="outline" className="justify-start gap-2 bg-background" disabled={!canEdit || busy !== null} onClick={() => handleGenerate("MONTHLY")}>
                    {busy === "MONTHLY" ? <Loader2 className="animate-spin" /> : <FileText />}
                    生成月报
                  </Button>
                </div>
                {!canEdit && <p className="mt-2 text-[11px] leading-4 text-muted-foreground">只读成员可以查看已有报告，不能生成新记录。</p>}
              </section>

              <section>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground">来源证据</p>
                  <span className="text-xs tabular-nums text-muted-foreground">{data.sources.length}</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {data.sources.length === 0 ? (
                    <p className="text-[11px] leading-4 text-muted-foreground">当前项目没有留存的上传来源，报告只引用正式项目数据。</p>
                  ) : data.sources.map((source) => (
                    <div key={source.id} className="rounded border bg-background px-2.5 py-2">
                      <p className="truncate text-xs font-medium" title={source.fileName}>{source.fileName}</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">{new Date(source.createdAt).toLocaleDateString("zh-CN")}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="space-y-5 p-5">
              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">最新项目报告</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">依据正式数据和已留存来源生成</p>
                  </div>
                  {reportContent && <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => copy(reportToPlainText(reportContent), "报告")}><Copy className="size-3.5" />复制</Button>}
                </div>
                {reportContent ? (
                  <ReportContent content={reportContent} />
                ) : (
                  <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">尚未生成报告</div>
                )}
              </section>

              <section className="border-t pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4" />外部只读协作</h3>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">链接包含管控表、资金流水和执行日历，30 天后自动失效。</p>
                  </div>
                  {canEdit && <Button size="sm" className="gap-1.5" disabled={busy !== null} onClick={handleCreateShare}>{busy === "share" ? <Loader2 className="animate-spin" /> : <Link2 />}创建链接</Button>}
                </div>

                {createdLinks && (
                  <div className="mt-3 space-y-2 rounded-lg border border-primary/20 bg-primary/[0.035] p-3">
                    <LinkRow icon={<Link2 />} label="只读项目链接" value={createdLinks.shareUrl} onCopy={() => copy(createdLinks.shareUrl, "项目链接")} />
                    <LinkRow icon={<CalendarSync />} label="日历订阅地址" value={createdLinks.calendarUrl} onCopy={() => copy(createdLinks.calendarUrl, "日历订阅地址")} />
                  </div>
                )}

                {activeLinks.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {activeLinks.map((link) => (
                      <div key={link.id} className="flex items-center justify-between gap-3 rounded border px-3 py-2 text-xs">
                        <div><p className="font-medium">{link.label}</p><p className="mt-0.5 text-muted-foreground">有效至 {link.expiresAt ? new Date(link.expiresAt).toLocaleString("zh-CN") : "长期"}</p></div>
                        {canEdit && <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={busy === link.id} onClick={() => handleRevoke(link.id)}>{busy === link.id ? <Loader2 className="animate-spin" /> : <RefreshCw />}撤销</Button>}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function LinkRow({ icon, label, value, onCopy }: { icon: React.ReactNode; label: string; value: string; onCopy: () => void }) {
  return <div className="flex items-center gap-2 text-xs"><span className="text-primary [&_svg]:size-3.5">{icon}</span><div className="min-w-0 flex-1"><p className="font-medium">{label}</p><p className="truncate text-muted-foreground">{value}</p></div><Button variant="ghost" size="icon" className="size-7" onClick={onCopy} title={`复制${label}`}><Copy className="size-3.5" /></Button></div>;
}

function ReportContent({ content }: { content: string }) {
  const blocks = parseReportMarkdown(content);

  return (
    <div className="max-h-[420px] overflow-y-auto rounded-lg border bg-muted/15 p-4 text-sm leading-6">
      <div className="space-y-4">
        {blocks.map((block, index) => {
          if (block.type === "title") return <h3 key={index} className="text-base font-semibold tracking-tight text-foreground">{block.content}</h3>;
          if (block.type === "heading") return <h4 key={index} className="border-t border-border pt-3 text-sm font-semibold text-foreground first:border-t-0 first:pt-0">{block.content}</h4>;
          if (block.type === "list") return <ul key={index} className="space-y-1.5 text-secondary-foreground">{block.items.map((item, itemIndex) => <li key={itemIndex} className="grid grid-cols-[6px_minmax(0,1fr)] gap-2"><span className="mt-2 size-1.5 rounded-full bg-primary/70" aria-hidden="true" />{item}</li>)}</ul>;
          if (block.type === "table") return <div key={index} className="overflow-x-auto rounded-md border border-border bg-background"><table className="min-w-full text-left text-xs leading-5"><thead className="bg-muted/45 text-muted-foreground"><tr>{block.headers.map((header, headerIndex) => <th key={headerIndex} className="whitespace-nowrap px-3 py-2 font-medium">{header}</th>)}</tr></thead><tbody className="divide-y divide-border">{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="align-top px-3 py-2 text-secondary-foreground">{cell}</td>)}</tr>)}</tbody></table></div>;
          return <p key={index} className="text-secondary-foreground">{block.content}</p>;
        })}
      </div>
    </div>
  );
}

type ReportBlock =
  | { type: "title" | "heading" | "paragraph"; content: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

function parseReportMarkdown(content: string): ReportBlock[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReportBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      blocks.push({ type: heading[1].length === 1 ? "title" : "heading", content: stripMarkdown(heading[2]) });
      index += 1;
      continue;
    }

    if (isTableLine(line) && index + 1 < lines.length && isTableDivider(lines[index + 1].trim())) {
      const headers = parseTableLine(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && isTableLine(lines[index].trim())) {
        rows.push(parseTableLine(lines[index].trim()));
        index += 1;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const listMatch = line.match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
    if (listMatch) {
      const items: string[] = [];
      while (index < lines.length) {
        const item = lines[index].trim().match(/^(?:[-*+]\s+|\d+[.)]\s+)(.+)$/);
        if (!item) break;
        items.push(stripMarkdown(item[1]));
        index += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    blocks.push({ type: "paragraph", content: stripMarkdown(line) });
    index += 1;
  }

  return blocks;
}

function isTableLine(line: string) {
  return line.startsWith("|") && line.endsWith("|");
}

function isTableDivider(line: string) {
  return isTableLine(line) && /^\|[\s:|-]+\|$/.test(line);
}

function parseTableLine(line: string) {
  return line.slice(1, -1).split("|").map((cell) => stripMarkdown(cell.trim()));
}

function stripMarkdown(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(`{1,3}|\*{1,3}|_{1,3}|~{2})/g, "")
    .trim();
}

function reportToPlainText(content: string) {
  return parseReportMarkdown(content).map((block) => {
    if (block.type === "list") return block.items.map((item) => `• ${item}`).join("\n");
    if (block.type === "table") return [block.headers.join("｜"), ...block.rows.map((row) => row.join("｜"))].join("\n");
    return block.content;
  }).join("\n\n");
}
