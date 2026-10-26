/** 「总名单」粘贴文本的解析：切成表格 → 猜列 → 生成玩家行 */

export interface RosterColumnMap {
  /** 名次列下标，-1 表示不导入 */
  rank: number;
  /** 名字列下标，-1 表示没找到（此时不生成任何行） */
  name: number;
  /** 功勋列下标，-1 表示不导入 */
  merit: number;
}

export interface RosterTable {
  /** 每行切好的单元格 */
  rows: string[][];
  /** 最大列数 */
  columnCount: number;
  /** 第一行是否被识别为表头 */
  hasHeader: boolean;
  /** 表头文字（没有表头时为空数组），用于下拉框展示列名 */
  header: string[];
  /** 猜测的列映射 */
  mapping: RosterColumnMap;
}

export interface RosterRow {
  name: string;
  rank?: number;
  merit?: number;
}

const RANK_HEADERS = ["名次", "排名", "序号", "排行", "顺位", "#"];
const NAME_HEADERS = ["成员名称", "玩家名称", "名字", "姓名", "玩家", "昵称", "成员", "名称", "id", "ID"];
/** 按优先级排列：名单里同时有「周功勋」「总功勋」时，永远取总功勋 */
const MERIT_PREFERENCE = ["总功勋", "累计功勋", "功勋", "贡献", "战功", "军功", "周功勋"];

/** 1,234,567 → 1234567（保留其它内容） */
function stripThousandSeparators(text: string): string {
  let out = text;
  for (let i = 0; i < 4; i++) {
    const next = out.replace(/(\d),(?=\d{3}(?:\D|$))/g, "$1");
    if (next === out) break;
    out = next;
  }
  return out;
}

/** 把一行切成单元格 */
function tokenizeLine(line: string): string[] {
  const raw = stripThousandSeparators(line.replace(/\u00a0/g, " ")).trim();
  if (!raw) return [];

  let cells: string[];
  if (raw.includes("\t")) {
    cells = raw.split("\t");
  } else {
    // 全角逗号/顿号/竖线都可以当分隔符
    const normalised = raw.replace(/[，、|]/g, " ");
    cells = /\s{2,}/.test(normalised)
      ? normalised.split(/\s{2,}/)
      : normalised.split(/\s+/);
    if (cells.length === 1 && raw.includes(",")) {
      cells = raw.split(",");
    }
  }
  return cells.map((c) => c.trim()).filter((c) => c.length > 0);
}

/** 单元格看起来是数字（允许 +、%、万 结尾） */
function isNumericCell(cell: string): boolean {
  return /^[+\-]?\d+(?:\.\d+)?\s*(?:万|w|%)?$/i.test(cell.trim());
}

function toNumber(cell: string): number | null {
  const cleaned = cell.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return /万|w/i.test(cell) ? Math.round(value * 10000) : Math.round(value);
}

/** 单元格看起来是玩家名 */
function isNameCell(cell: string): boolean {
  const v = cell.trim();
  if (v.length < 2 || v.length > 16) return false;
  if (/^[\d\s.,%+\-]+$/.test(v)) return false;
  return /[\u4e00-\u9fa5A-Za-z]/.test(v);
}

/** 找功勋列：按 MERIT_PREFERENCE 顺序精确匹配，避免误选「周功勋」 */
function meritHeaderIndex(row: string[]): number {
  const cells = row.map((c) => c.replace(/\s+/g, "").toLowerCase());
  for (const key of MERIT_PREFERENCE) {
    const exact = cells.findIndex((c) => c === key.toLowerCase());
    if (exact >= 0) return exact;
  }
  let best = -1;
  let bestLen = 0;
  cells.forEach((cell, i) => {
    for (const key of MERIT_PREFERENCE) {
      if (key.length > bestLen && cell.includes(key)) {
        bestLen = key.length;
        best = i;
      }
    }
  });
  return best;
}

/** 找表头里某类列的下标：先找完全相等的，再退回「包含关键字且关键字最长」的列 */
function headerIndex(row: string[], words: string[]): number {
  const cells = row.map((c) => c.trim().toLowerCase());
  const keys = words.map((w) => w.toLowerCase());

  // 1) 完全相等优先（比如同时有「周功勋」「总功勋」时必须认准「总功勋」）
  const exact = cells.findIndex((c) => c.length > 0 && keys.includes(c));
  if (exact >= 0) return exact;

  // 2) 包含匹配，取关键字最长的那列
  let best = -1;
  let bestLen = 0;
  cells.forEach((cell, i) => {
    for (const key of keys) {
      if (key.length > bestLen && cell.includes(key)) {
        bestLen = key.length;
        best = i;
      }
    }
  });
  return best;
}

/**
 * 解析粘贴的总名单：
 *   1. 切成单元格
 *   2. 若首行像表头（含「名次/玩家/功勋」等字样），按表头定位列
 *   3. 否则按数值分布猜列：小整数列 → 名次，最大数字列 → 功勋，文字列 → 名字
 */
export function parseRosterTable(text: string): RosterTable {
  const rows = text
    .split(/\r?\n/)
    .map((line) => tokenizeLine(line))
    .filter((cells) => cells.length > 0);

  const columnCount = rows.reduce((max, r) => Math.max(max, r.length), 0);
  const empty: RosterTable = {
    rows: [],
    columnCount: 0,
    hasHeader: false,
    header: [],
    mapping: { rank: -1, name: -1, merit: -1 },
  };
  if (rows.length === 0) return empty;

  // ---- 表头优先 ----
  const head = rows[0];
  const headRank = headerIndex(head, RANK_HEADERS);
  const headName = headerIndex(head, NAME_HEADERS);
  const headMerit = meritHeaderIndex(head);
  if (headName >= 0) {
    const body = rows.slice(1);
    const bodyCols = body.reduce((max, r) => Math.max(max, r.length), 0) || head.length;
    // 数据行常比表头多一个行首序号列（如「1 张三 ...」），按右侧对齐算偏移
    const offset = Math.max(0, bodyCols - head.length);
    return {
      rows: body,
      columnCount: bodyCols,
      hasHeader: true,
      header: head,
      mapping: {
        rank: headRank >= 0 ? headRank + offset : offset > 0 ? 0 : -1,
        name: headName + offset,
        merit: headMerit >= 0 ? headMerit + offset : -1,
      },
    };
  }

  // ---- 无表头：按列统计猜 ----
  let nameCol = -1;
  let nameScore = 0;
  let rankCol = -1;
  let meritCol = -1;
  let meritMax = -1;

  for (let col = 0; col < columnCount; col++) {
    const cells = rows.map((r) => r[col]).filter((c): c is string => !!c);
    if (cells.length === 0) continue;

    const numeric = cells.filter(isNumericCell);
    const numericRatio = numeric.length / cells.length;
    const nameLike = cells.filter(isNameCell).length;

    if (numericRatio < 0.6) {
      if (nameLike > nameScore) {
        nameScore = nameLike;
        nameCol = col;
      }
      continue;
    }

    // 数值列：最大值给功勋候选，小整数给名次候选
    const max = Math.max(...numeric.map((c) => toNumber(c) ?? 0));
    if (max > meritMax) {
      meritMax = max;
      meritCol = col;
    }
    if (rankCol < 0 && max <= 20000 && numeric.every((c) => (toNumber(c) ?? 0) <= 20000)) {
      rankCol = col;
    }
  }

  // 名次和功勋撞到同一列时，把名次让出来
  if (rankCol === meritCol) rankCol = -1;

  return {
    rows,
    columnCount,
    hasHeader: false,
    header: [],
    mapping: { rank: rankCol, name: nameCol, merit: meritCol },
  };
}

/** 按列映射生成玩家行（会清洗名字） */
export function buildRosterRows(
  table: RosterTable,
  mapping: RosterColumnMap = table.mapping
): RosterRow[] {
  if (mapping.name < 0) return [];

  const out: RosterRow[] = [];
  const seen = new Set<string>();

  for (const cells of table.rows) {
    const rawName = (cells[mapping.name] ?? "").trim();
    const name = cleanName(rawName);
    if (!name || seen.has(name)) continue;

    const rank = mapping.rank >= 0 ? toNumber(cells[mapping.rank] ?? "") : null;
    const merit = mapping.merit >= 0 ? toNumber(cells[mapping.merit] ?? "") : null;

    seen.add(name);
    out.push({
      name,
      rank: rank && rank > 0 ? rank : undefined,
      merit: merit ?? undefined,
    });
  }

  return out;
}

/** 去掉 [盟名] 前缀、行首「序号.」和多余空白，只留昵称（名字里的数字要保留，如「啸遥1110」） */
function cleanName(raw: string): string {
  const name = raw
    .replace(/^\[[^\]]*\]\s*/, "")
    .replace(/^\d+\s*[.、:：)）]\s*/, "")
    .trim();
  if (name.length < 1 || name.length > 16) return "";
  if (/^[\d\s.,%+\-]+$/.test(name)) return "";
  return name;
}
