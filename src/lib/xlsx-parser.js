/* eslint-disable @typescript-eslint/no-require-imports */
// xlsx 纯 CJS 模块，Next.js 14 Webpack 编译不支持 ESM default import
// 通过 .js 文件 + require 规避 TypeScript/Webpack 兼容问题
module.exports = function parseXLSXBuffer(buffer) {
  const XLSX = require("xlsx");
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheets = [];
  wb.SheetNames.forEach((name) => {
    const ws = wb.Sheets[name];
    const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
    const merges = (ws["!merges"] || []).map((merge) => XLSX.utils.encode_range(merge));
    const data = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: "",
      raw: false,
    });

    const nonEmptyRows = data
      .map((row, index) => ({ index: index + 1, row }))
      .filter(({ row }) => row.some((cell) => normalizeCell(cell)));

    if (nonEmptyRows.length === 0) return;

    const headerCandidate = findHeaderCandidate(nonEmptyRows);
    const headers = headerCandidate
      ? headerCandidate.row.map((cell, index) => normalizeCell(cell) || `列${index + 1}`)
      : [];

    const bodyRows = nonEmptyRows
      .filter(({ index }) => !headerCandidate || index > headerCandidate.index)
      .slice(0, 140);

    const fillDownColumns = detectFillDownColumns(headers);
    const context = {};
    const lines = [];

    lines.push(`=== Sheet: ${name} ===`);
    lines.push(`Range: ${XLSX.utils.encode_range(range)} (${range.e.r - range.s.r + 1} rows x ${range.e.c - range.s.c + 1} cols)`);
    if (merges.length > 0) {
      lines.push(`Merged ranges: ${merges.slice(0, 30).join(", ")}${merges.length > 30 ? ` ... (+${merges.length - 30})` : ""}`);
    }

    if (headerCandidate) {
      lines.push(`Header row ${headerCandidate.index}: ${headers.join(" | ")}`);
    } else {
      lines.push("Header row: not confidently detected");
    }

    lines.push("Rows:");
    bodyRows.forEach(({ index, row }) => {
      const cells = row.map((cell) => normalizeCell(cell));
      fillDownColumns.forEach((colIndex) => {
        if (cells[colIndex]) context[colIndex] = cells[colIndex];
      });

      const parts = cells
        .map((value, colIndex) => {
          const header = headers[colIndex] || XLSX.utils.encode_col(colIndex);
          const filled = value || (fillDownColumns.includes(colIndex) ? context[colIndex] || "" : "");
          if (!filled) return "";
          const marker = !value && filled ? " (filled)" : "";
          return `${header}${marker}: ${filled}`;
        })
        .filter(Boolean);

      if (parts.length > 0) lines.push(`R${index}: ${parts.join(" | ")}`);
    });

    if (lines.length > 0) {
      sheets.push(lines.join("\n"));
    }
  });
  return sheets.join("\n");
};

function normalizeCell(value) {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findHeaderCandidate(rows) {
  const keywords = [
    "项目",
    "内容",
    "deadline",
    "dealline",
    "发布时间",
    "详细描述",
    "进度",
    "结论",
    "负责部门",
    "负责人",
    "日期",
    "时间",
    "渠道",
  ];

  let best = null;
  for (const candidate of rows.slice(0, 20)) {
    const text = candidate.row.map(normalizeCell).join(" ").toLowerCase();
    const score = keywords.reduce(
      (sum, keyword) => sum + (text.includes(keyword.toLowerCase()) ? 1 : 0),
      0
    );
    const filled = candidate.row.filter((cell) => normalizeCell(cell)).length;
    if (!best || score > best.score || (score === best.score && filled > best.filled)) {
      best = { ...candidate, score, filled };
    }
  }

  return best && best.score >= 2 ? best : null;
}

function detectFillDownColumns(headers) {
  const names = ["项目", "负责部门", "负责人", "模块", "工作流", "传播线", "渠道"];
  return headers
    .map((header, index) => ({ header: header.toLowerCase(), index }))
    .filter(({ header }) => names.some((name) => header.includes(name.toLowerCase())))
    .map(({ index }) => index);
}
