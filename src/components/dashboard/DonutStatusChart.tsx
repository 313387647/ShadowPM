"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Props {
  pending: number;
  inProgress: number;
  completed: number;
}

const COLORS = ["hsl(var(--muted-foreground))", "#3b82f6", "#10b981"];
export function DonutStatusChart({ pending, inProgress, completed }: Props) {
  const data = [
    { name: "待启动", value: pending, color: COLORS[0] },
    { name: "进行中", value: inProgress, color: COLORS[1] },
    { name: "已完成", value: completed, color: COLORS[2] },
  ].filter((d) => d.value > 0);

  const total = pending + inProgress + completed;

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="text-sm font-semibold mb-4">📊 全团队任务状态分布</h3>
      {total === 0 ? (
        <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
          暂无任务数据
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => {
                const n = Number(value);
                return [
                  `${n} 个 (${total > 0 ? Math.round((n / total) * 100) : 0}%)`,
                  name,
                ];
              }}
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                fontSize: 13,
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
