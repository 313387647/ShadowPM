"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

type Item = {
  name: string;
  dynamicTotal: number;
  consumed: number;
};

interface Props {
  data: Item[];
}

export function BarBudgetChart({ data }: Props) {
  const chartData = data.map((d) => ({
    name: d.name.length > 8 ? d.name.slice(0, 8) + "…" : d.name,
    fullName: d.name,
    "确认预算": Math.round(d.dynamicTotal / 10000),
    "已消耗": Math.round(d.consumed / 10000),
  }));

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="text-sm font-semibold mb-4">💰 项目预算健康度（万元）</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
          <XAxis
            dataKey="name"
            tick={{ fontSize: 12 }}
            className="text-muted-foreground text-xs"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            className="text-muted-foreground text-xs"
          />
          <Tooltip
            labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName ?? ""}
            formatter={(value) => [`¥${Number(value).toLocaleString()} 万`, ""]}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              fontSize: 13,
            }}
          />
          <Legend />
          <Bar
            dataKey="确认预算"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
          <Bar
            dataKey="已消耗"
            fill="hsl(var(--destructive))"
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
