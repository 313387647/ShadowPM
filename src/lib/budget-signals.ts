export type BudgetSignal = {
  level: "HIGH" | "MEDIUM" | "OK";
  title: string;
  description: string;
  badges: string[];
};

type BudgetSignalInput = {
  plannedBudget: number;
  allocatedBudget: number;
  balance: number;
  used: number;
  usagePercent: number;
  flowCount: number;
};

export function getBudgetSignal({
  plannedBudget,
  allocatedBudget,
  balance,
  used,
  usagePercent,
  flowCount,
}: BudgetSignalInput): BudgetSignal {
  if (allocatedBudget === 0 && used > 0) {
    return {
      level: "HIGH",
      title: "存在支出但缺少确认预算",
      description: `已记录 ¥${used.toLocaleString("zh-CN")} 支出，但资金账本没有确认预算。请补录预算确定或预算增补。`,
      badges: ["先支出", "需核对"],
    };
  }

  if (balance < 0) {
    return {
      level: "HIGH",
      title: "预算已超支",
      description: `超支 ¥${Math.abs(balance).toLocaleString("zh-CN")}。请核对支出、退款或追加确认预算。`,
      badges: ["已超支", `${usagePercent}%`],
    };
  }

  if (allocatedBudget > 0 && usagePercent >= 90) {
    return {
      level: "HIGH",
      title: "预算消耗接近上限",
      description: `已使用确认预算的 ${usagePercent}%，请确认后续支出是否仍在计划内。`,
      badges: ["高消耗", `${usagePercent}%`],
    };
  }

  if (plannedBudget > 0 && allocatedBudget === 0) {
    return {
      level: "MEDIUM",
      title: "计划预算尚未确认",
      description: `计划预算为 ¥${plannedBudget.toLocaleString("zh-CN")}；在录入预算确定或预算增补前，它不计入可用余额。`,
      badges: ["待确认", "无确认预算"],
    };
  }

  if (flowCount === 0) {
    return {
      level: "MEDIUM",
      title: "资金账本尚未开始",
      description: "当前没有预算流水。若项目已经有预算或支出，请先记录预算确定或实际支出。",
      badges: ["无流水"],
    };
  }

  return {
    level: "OK",
    title: "预算状态正常",
    description: "确认预算、已使用和可用结余之间没有明显异常。",
    badges: ["正常"],
  };
}
