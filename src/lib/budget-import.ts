export type ParsedBudgetItem = {
  title: string;
  plannedAmount: number;
  category?: string | null;
  description?: string | null;
};

export type BudgetPasteParseResult = {
  items: ParsedBudgetItem[];
  invalidLines: number[];
};

function parseAmount(raw: string) {
  const normalized = raw.replace(/[¥￥,，\s]/g, "").trim();
  if (!normalized) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

/**
 * Supports the intentionally low-friction format "名称    金额". Tabs are
 * preferred, while two or more spaces keep pasted plain text readable.
 */
export function parseBudgetPaste(text: string): BudgetPasteParseResult {
  const items: ParsedBudgetItem[] = [];
  const invalidLines: number[] = [];

  text.split(/\r?\n/).forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) return;
    const columns = line.split(/\t+|\s{2,}/).map((column) => column.trim()).filter(Boolean);
    if (columns.length < 2) {
      invalidLines.push(index + 1);
      return;
    }
    const amount = parseAmount(columns[columns.length - 1]);
    const title = columns[0];
    if (!title || amount === null) {
      invalidLines.push(index + 1);
      return;
    }
    items.push({
      title,
      plannedAmount: amount,
      category: columns.length > 2 ? columns[1] : null,
    });
  });

  return { items, invalidLines };
}

export function parseBudgetSheetRows(rows: unknown[][]): BudgetPasteParseResult {
  const text = rows
    .filter((row) => Array.isArray(row) && row.some((cell) => cell !== null && cell !== undefined && String(cell).trim()))
    .map((row) => row.map((cell) => String(cell ?? "").trim()).join("\t"))
    .join("\n");
  return parseBudgetPaste(text);
}
