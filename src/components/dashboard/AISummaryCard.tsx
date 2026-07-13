import { Activity } from "lucide-react";

export function AISummaryCard({ summary }: { summary: string | null }) {
  if (!summary) return null;

  return (
    <div className="rounded-lg border bg-gray-950 p-5 text-gray-50">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex size-6 items-center justify-center rounded-md bg-gray-50/20">
          <Activity className="size-3.5" />
        </div>
        <h3 className="text-sm font-semibold">本周项目健康摘要</h3>
      </div>
      <p className="text-sm leading-relaxed text-gray-200 whitespace-pre-wrap">
        {summary}
      </p>
    </div>
  );
}
