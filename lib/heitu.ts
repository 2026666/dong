/**
 * 黑土安排表：纯逻辑（不含 DOM / Canvas）
 * ---------------------------------------------------------------------------
 * 规则（已与用户确认）：
 *   · 4 级城：7×7 去掉中心 3×3 = 40 格，围 2 圈
 *   · 5/6 级城：9×9 去掉中心 3×3 = 72 格，再挖掉最外圈「上边」一整排 = 63 格
 *   · 环号：紧贴城池的一圈是第 1 环，往外交替 +1
 *   · 填格顺序：按环由内向外；每一环从「该环左上角」起顺时针绕一圈
 *   · 名单按「实力」从高到低排，实力高的人优先占靠城的格
 *   · 一格一人；所有格填满后回到第 1 格开始叠第 2 层
 */

export type HeituLevel = 4 | 5 | 6;

export type HeituCell = {
  row: number;
  col: number;
  ring: number;
  /** 该格在「环内」的序号，0 起 */
  order: number;
};

export type HeituPlayer = {
  name: string;
  /** 实力，用于排序（缺失为 0） */
  power: number;
  /** 总功勋，力量相同的时候当第二排序键 */
  merit: number;
  /** 原始序号，最后兜底 */
  seq: number;
};

export type HeituStats = {
  total: number;
  cells: number;
  rounds: number;
  lastRound: number;
};

export const LEVEL_OPTIONS: ReadonlyArray<{
  level: HeituLevel;
  label: string;
  note: string;
}> = [
  { level: 4, label: "4 级城", note: "围 2 圈 · 40 格" },
  { level: 5, label: "5 级城", note: "围 3 圈 · 上边缺一层 · 63 格" },
  { level: 6, label: "6 级城", note: "围 3 圈 · 上边缺一层 · 63 格" },
];

/** 每一环的配色（画布与网页共用） */
export const RING_COLORS: Record<number, { bg: string; border: string; ink: string; name: string }> = {
  1: { bg: "#fdf3dd", border: "#d8a94a", ink: "#6b4a06", name: "第 1 环" },
  2: { bg: "#eef3fb", border: "#9db8dd", ink: "#28456e", name: "第 2 环" },
  3: { bg: "#f3f1ee", border: "#c9c4bc", ink: "#4a453d", name: "第 3 环" },
};

export function gridSizeOf(level: HeituLevel): number {
  return level === 4 ? 7 : 9;
}

export function cellCountOf(level: HeituLevel): number {
  return buildCells(level).length;
}

/**
 * 生成所有可站人的格子，已按「由内向外 + 环内顺时针」排好
 */
export function buildCells(level: HeituLevel): HeituCell[] {
  const size = gridSizeOf(level);
  const center = (size - 1) / 2;
  const hasTopGap = level !== 4;

  const raw: Array<HeituCell & { dr: number; dc: number }> = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const dr = row - center;
      const dc = col - center;
      const ringOffset = Math.max(Math.abs(dr), Math.abs(dc));
      if (ringOffset <= 1) continue; // 中心 3×3 是城池
      if (hasTopGap && dr === -center) continue; // 最外圈上边缺一层
      raw.push({ row, col, ring: ringOffset - 1, order: 0, dr, dc });
    }
  }

  // 环内：从该环的左上角开始，顺时针（上 → 右 → 下 → 左）
  const angleOf = (cell: { dr: number; dc: number }) => {
    const deg = (Math.atan2(cell.dr, cell.dc) * 180) / Math.PI;
    return (deg + 135 + 360) % 360;
  };

  raw.sort((a, b) => {
    if (a.ring !== b.ring) return a.ring - b.ring;
    return angleOf(a) - angleOf(b);
  });

  return raw.map(({ row, col, ring }, index) => ({ row, col, ring, order: index }));
}

/** 实力高的靠城；实力相同看总功勋；再相同看原序号 */
export function sortPlayers(players: HeituPlayer[]): HeituPlayer[] {
  return [...players].sort(
    (a, b) =>
      b.power - a.power ||
      b.merit - a.merit ||
      a.seq - b.seq ||
      a.name.localeCompare(b.name, "zh"),
  );
}

/**
 * 把玩家依次塞进格子：先每格 1 人，填满后从第 1 格开始叠第 2 层
 */
export function assignPlayers(
  players: HeituPlayer[],
  cellCount: number,
): string[][] {
  const slots: string[][] = Array.from({ length: cellCount }, () => []);
  players.forEach((player, index) => {
    const cellIndex = index % cellCount;
    const layer = Math.floor(index / cellCount);
    if (layer < 4) slots[cellIndex].push(player.name);
  });
  return slots;
}

export function statsOf(total: number, cells: number): HeituStats {
  const rounds = total === 0 ? 0 : Math.ceil(total / cells);
  return {
    total,
    cells,
    rounds,
    lastRound: total === 0 ? 0 : total - (rounds - 1) * cells,
  };
}

/* ------------------------------ 名单解析 ------------------------------ */

const NAME_KEYS = ["成员名称", "成员", "名字", "名称", "玩家", "昵称", "姓名"];
const POWER_KEYS = ["实力"];
const MERIT_KEYS = ["总功勋", "累计功勋", "功勋"];
const SEQ_KEYS = ["序号", "排名", "名次"];

function toNumber(input: string): number {
  const cleaned = String(input ?? "").replace(/[,\s，]/g, "");
  if (!cleaned) return 0;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function isNumericCell(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}

function numericRatioOf(rows: string[][], col: number): number {
  if (col < 0) return 0;
  const values = rows.map((row) => (row[col] ?? "").trim()).filter(Boolean);
  if (!values.length) return 0;
  return values.filter(isNumericCell).length / values.length;
}

/** 挑「名字列」：非数字内容占比最高的那一列 */
function pickNameColumn(rows: string[][], cols: number): number {
  let best = 0;
  let bestScore = -1;
  for (let col = 0; col < cols; col += 1) {
    const values = rows.map((row) => (row[col] ?? "").trim()).filter(Boolean);
    if (values.length < Math.max(1, Math.floor(rows.length * 0.5))) continue;
    const score = values.filter((v) => !isNumericCell(v)).length / values.length;
    if (score > bestScore) {
      bestScore = score;
      best = col;
    }
  }
  return bestScore > 0 ? best : 0;
}

/** 挑「数值列」：数值占比高、且总和最大的那一列（跳过名字列） */
function pickNumberColumn(rows: string[][], cols: number, skip: number): number {
  let best = -1;
  let bestSum = -1;
  for (let col = cols - 1; col >= 0; col -= 1) {
    if (col === skip) continue;
    const values = rows.map((row) => (row[col] ?? "").trim()).filter(Boolean);
    if (!values.length) continue;
    if (values.filter(isNumericCell).length / values.length < 0.9) continue;
    const sum = values.reduce((acc, v) => acc + (Number(v) || 0), 0);
    if (sum > bestSum) {
      bestSum = sum;
      best = col;
    }
  }
  return best;
}

function findColumn(header: string[], keys: string[]): number {
  for (const key of keys) {
    const index = header.findIndex((cell) => cell.replace(/\s/g, "") === key);
    if (index >= 0) return index;
  }
  for (const key of keys) {
    const index = header.findIndex((cell) => cell.includes(key));
    if (index >= 0) return index;
  }
  return -1;
}

export type RosterParseResult = {
  players: HeituPlayer[];
  /** 有表头时的列名，便于提示 */
  columns: { name: number; power: number; merit: number; seq: number };
  hasHeader: boolean;
};

/**
 * 解析粘贴的表格（Tab / 2+ 空格 / 全角逗号分隔）或 xlsx 的二维数组
 */
export function parseRosterText(text: string): RosterParseResult {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t+|\s{2,}|[，,]/).map((cell) => cell.trim()));

  return parseRosterRows(rows);
}

export function parseRosterRows(rows: string[][]): RosterParseResult {
  const cleaned = rows.filter((row) => row.some((cell) => cell.trim()));
  const header = cleaned[0] ?? [];
  const hasHeader = findColumn(header, NAME_KEYS) >= 0;
  const body = hasHeader ? cleaned.slice(1) : cleaned;

  const bodyCols = body.reduce((max, row) => Math.max(max, row.length), 0);

  // 表头常比数据行少一列（数据行行首多一个序号），按数据行列数对齐
  const offset = hasHeader ? Math.max(0, bodyCols - header.length) : 0;
  const align = (index: number) =>
    index < 0 ? -1 : Math.min(index + offset, Math.max(0, bodyCols - 1));

  let nameIndex = align(findColumn(header, NAME_KEYS));
  let powerIndex = align(findColumn(header, POWER_KEYS));
  let meritIndex = align(findColumn(header, MERIT_KEYS));
  let seqIndex = align(findColumn(header, SEQ_KEYS));

  // 兜底：按表头定位到的列明显不是名字 / 不是数字，就按内容重新猜
  if (nameIndex < 0 || numericRatioOf(body, nameIndex) > 0.5) {
    nameIndex = pickNameColumn(body, bodyCols);
  }
  if (
    powerIndex < 0 ||
    powerIndex === nameIndex ||
    numericRatioOf(body, powerIndex) < 0.5
  ) {
    powerIndex = pickNumberColumn(body, bodyCols, nameIndex);
  }
  if (meritIndex >= 0 && (numericRatioOf(body, meritIndex) < 0.5 || meritIndex === nameIndex)) {
    meritIndex = -1;
  }
  if (seqIndex >= 0 && numericRatioOf(body, seqIndex) < 0.5) {
    seqIndex = -1;
  }

  const players: HeituPlayer[] = [];
  body.forEach((row, index) => {
    const name = (row[nameIndex] ?? "").trim();
    if (!name || /^[\d.,，]+$/.test(name)) return;
    players.push({
      name,
      power: powerIndex >= 0 ? toNumber(row[powerIndex]) : 0,
      merit: meritIndex >= 0 ? toNumber(row[meritIndex]) : 0,
      seq: seqIndex >= 0 ? toNumber(row[seqIndex]) || index + 1 : index + 1,
    });
  });

  return {
    players,
    columns: { name: nameIndex, power: powerIndex, merit: meritIndex, seq: seqIndex },
    hasHeader,
  };
}

/** 一格最多显示几个名字，超出显示 +N */
export const MAX_VISIBLE_NAMES = 3;

export function overflowOf(names: string[]): number {
  return Math.max(0, names.length - MAX_VISIBLE_NAMES);
}
