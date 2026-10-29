import type { GuanduPlan } from "@/lib/guandu";

/**
 * 官渡作战表出图：把方案画成一张和示例表格一样的 PNG
 * （队伍 / 成员号 / 玩家ID / 三波时间 / 成员数 / 备注 + 底部注意事项）
 */

const FONT = '"Microsoft YaHei", "PingFang SC", "Noto Sans SC", sans-serif';
const SCALE = 2;

const W = 1600;
const PAD = 26;
const TITLE_H = 46;
const HEAD_H = 40;
const ROW_H = 32;
const FOOT_H = 76;

/** 8 列宽度，合计 1548 = 1600 - 2 * PAD */
const COL_W = [134, 116, 282, 148, 218, 292, 55, 303];
const HEADERS = ["队伍", "成员号", "玩家ID", "21:05", "21.15", "21.25", "成员数", "备注"];

const INK = "#1b1b1d";
const INK2 = "#4a4a52";
const MUTED = "#8e8e93";
const LINE = "#d8d2c6";
const LINE_STRONG = "#b6ad9c";
const HEAD_BG = "#f6e9d4";
const HEAD_INK = "#7a5410";
const TITLE_BG = "#fbf1de";
const LEAD_BG = "#eaf1fb";
const STRONG_CELL = "#eef3fa";
const WEAK_CELL = "#f8f3e9";
const MOBILE_CELL = "#f3f3f1";
const GROUP_BG = "#f8f3e9";
const NAME_COL_BG = "#fffdf9";

type Cell = {
  /** 列区间 / 行区间，含端点 */
  c0: number;
  c1: number;
  r0: number;
  r1: number;
  text: string;
  font: number;
  weight?: number;
  color?: string;
  align?: "center" | "left";
  bg?: string;
  pad?: number;
  /** 顶部对齐（长文本），默认垂直居中 */
  top?: boolean;
  /** 指定高度（底部注意事项那一行不按标准行高），不传就按行数算 */
  h?: number;
};

export function drawGuandu(canvas: HTMLCanvasElement, plan: GuanduPlan): { width: number; height: number } {
  /** 只画 30 个正式位置（没有替补这一块） */
  const teamRows = plan.teams.reduce((total, team) => total + team.rows.length, 0);
  const bodyRows = teamRows;

  const x0 = PAD;
  const y0 = PAD;
  const tableW = COL_W.reduce((sum, w) => sum + w, 0);

  const canvas2d = canvas.getContext("2d");
  const ctx = canvas2d;

  // 注意事项占表格底下单独一块，高度按文字量算（先量再定画布尺寸）
  const notesText = plan.notes.trim();
  const notesFont = 10.5;
  const notesWidth = COL_W.slice(2, 7).reduce((sum, w) => sum + w, 0) - 20;
  const notesLines =
    notesText && ctx ? wrapText(ctx, notesText, notesWidth, notesFont, 400) : [];
  const footH = notesText && ctx
    ? Math.max(ROW_H * 2, Math.round(notesLines.length * notesFont * 1.36 + 22))
    : 0;

  const H = PAD * 2 + TITLE_H + HEAD_H + bodyRows * ROW_H + footH;
  if (!ctx) return { width: W, height: H };

  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

  // 纸底
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const xs: number[] = [];
  let cursor = x0;
  COL_W.forEach((w) => {
    xs.push(cursor);
    cursor += w;
  });

  const bodyTop = y0 + TITLE_H + HEAD_H;

  const cells: Cell[] = [];

  /* ------------------------------ 表头 ------------------------------ */
  HEADERS.forEach((text, c) => {
    cells.push({
      c0: c,
      c1: c,
      r0: -1,
      r1: -1,
      text,
      font: c === 6 ? 10.5 : 11.5,
      weight: 600,
      color: HEAD_INK,
      bg: HEAD_BG,
    });
  });

  /* ------------------------------ 表格主体 ------------------------------ */
  let rowCursor = 0;
  plan.teams.forEach((team, teamIndex) => {
    const start = rowCursor;
    const count = team.rows.length;
    rowCursor += count;

    const tint =
      teamIndex <= 2 ? STRONG_CELL : teamIndex <= 4 ? WEAK_CELL : MOBILE_CELL;

    // 队伍列：整队一块（五队也是「五队」，组名放到成员号列）
    cells.push({
      c0: 0,
      c1: 0,
      r0: start,
      r1: start + count - 1,
      text: team.name,
      font: 13,
      weight: 600,
      color: INK,
      bg: tint,
    });

    // 成员号列：五队按三路小粮仓合并组名，其它队逐行写「队长车头 / 队员N」
    if (team.grouped) {
      let runStart = start;
      for (let i = 1; i <= count; i += 1) {
        const current = i < count ? team.rows[i].group : undefined;
        const previous = team.rows[i - 1].group;
        if (i === count || current !== previous) {
          cells.push({
            c0: 1,
            c1: 1,
            r0: runStart,
            r1: start + i - 1,
            text: previous ?? "",
            font: 10.5,
            weight: 600,
            color: INK2,
            bg: GROUP_BG,
          });
          runStart = start + i;
        }
      }
    } else {
      team.rows.forEach((row, i) => {
        cells.push({
          c0: 1,
          c1: 1,
          r0: start + i,
          r1: start + i,
          text: row.label,
          font: 10.5,
          color: row.lead ? HEAD_INK : MUTED,
          bg: row.lead ? LEAD_BG : undefined,
          weight: row.lead ? 600 : 400,
        });
      });
    }

    // 21:05：五队三组各写各的，其余队整队一块
    const hasStart = team.rows.some((row) => (row.startTask ?? "").trim());
    if (hasStart) {
      let runStart = start;
      for (let i = 1; i <= count; i += 1) {
        const current = i < count ? team.rows[i].startTask ?? team.tasks[0] : undefined;
        const previous = team.rows[i - 1].startTask ?? team.tasks[0];
        if (i === count || current !== previous) {
          cells.push({
            c0: 3,
            c1: 3,
            r0: runStart,
            r1: start + i - 1,
            text: previous,
            font: 10.5,
            color: INK2,
            align: "left",
            pad: 8,
            top: true,
          });
          runStart = start + i;
        }
      }
    } else {
      cells.push({
        c0: 3,
        c1: 3,
        r0: start,
        r1: start + count - 1,
        text: team.tasks[0],
        font: 10.5,
        color: INK2,
        align: "left",
        pad: 8,
        top: true,
      });
    }

    // 21.15 / 21.25：整队一块
    [1, 2].forEach((i) => {
      cells.push({
        c0: 3 + i,
        c1: 3 + i,
        r0: start,
        r1: start + count - 1,
        text: team.tasks[i],
        font: 10.5,
        color: INK2,
        align: "left",
        pad: 8,
        top: true,
      });
    });

    // 每行：玩家ID / 成员数
    team.rows.forEach((row, i) => {
      const r = start + i;
      cells.push({
        c0: 2,
        c1: 2,
        r0: r,
        r1: r,
        text: row.name || "—",
        font: 13,
        weight: row.lead ? 600 : 500,
        color: row.name ? INK : "#c4beb4",
        bg: row.lead ? LEAD_BG : NAME_COL_BG,
      });
      cells.push({
        c0: 6,
        c1: 6,
        r0: r,
        r1: r,
        text: String(r + 1),
        font: 10.5,
        color: MUTED,
      });
    });
  });

  // 备注：整张表从表头下一行到底部（含注意事项那一块的高度）
  cells.push({
    c0: 7,
    c1: 7,
    r0: 0,
    r1: bodyRows - 1,
    h: bodyRows * ROW_H + footH,
    text: plan.remark,
    font: 10.6,
    color: INK2,
    align: "left",
    pad: 9,
    top: true,
  });

  // 注意事项
  if (notesText) {
    const footerRow = bodyRows;
    cells.push({
      c0: 0,
      c1: 1,
      r0: footerRow,
      r1: footerRow,
      h: footH,
      text: "注意事项",
      font: 11.5,
      weight: 600,
      color: HEAD_INK,
      bg: "#faf5ea",
    });
    cells.push({
      c0: 2,
      c1: 6,
      r0: footerRow,
      r1: footerRow,
      h: footH,
      text: notesText,
      font: notesFont,
      color: INK2,
      align: "left",
      pad: 10,
      top: true,
    });
  }

  /* ------------------------------ 画 ------------------------------ */
  const rectOf = (cell: Cell) => {
    const left = xs[cell.c0];
    const width = COL_W.slice(cell.c0, cell.c1 + 1).reduce((sum, w) => sum + w, 0);
    const top = cell.r0 < 0 ? bodyTop - HEAD_H : bodyTop + cell.r0 * ROW_H;
    const height =
      cell.r0 < 0 ? HEAD_H : cell.h ?? (cell.r1 - cell.r0 + 1) * ROW_H;
    return { left, top, width, height };
  };

  // 先铺底色
  cells.forEach((cell) => {
    if (!cell.bg) return;
    const box = rectOf(cell);
    ctx.fillStyle = cell.bg;
    ctx.fillRect(box.left, box.top, box.width, box.height);
  });

  // 标题条
  ctx.fillStyle = TITLE_BG;
  ctx.fillRect(x0, y0, tableW, TITLE_H);
  ctx.fillStyle = INK;
  ctx.font = `600 17px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(plan.title.trim() || "官渡作战表", x0 + tableW / 2, y0 + TITLE_H / 2);

  const placed = plan.teams.reduce(
    (total, team) => total + team.rows.filter((row) => row.name).length,
    0,
  );
  ctx.fillStyle = MUTED;
  ctx.font = `10.5px ${FONT}`;
  ctx.textAlign = "right";
  ctx.fillText(
    `正式 ${placed} 人 · 21:05 / 21:15 / 21:25`,
    x0 + tableW - 12,
    y0 + TITLE_H / 2,
  );
  ctx.textAlign = "left";

  // 文字
  cells.forEach((cell) => {
    const box = rectOf(cell);
    const pad = cell.pad ?? 6;
    const maxW = box.width - pad * 2;
    const maxH = box.height - pad;
    const weight = cell.weight ?? 400;

    let size = cell.font;
    let lines = wrapText(ctx, cell.text, maxW, size, weight);
    if (cell.top) {
      while (lines.length * size * 1.36 > maxH && size > 7) {
        size -= 0.3;
        lines = wrapText(ctx, cell.text, maxW, size, weight);
      }
    } else if (lines.length > 1) {
      size = Math.max(7, size - 0.5);
      lines = wrapText(ctx, cell.text, maxW, size, weight);
    }

    ctx.fillStyle = cell.color ?? INK;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = cell.align === "left" ? "left" : "center";
    ctx.textBaseline = "middle";

    const lineH = size * 1.36;
    const startX = cell.align === "left" ? box.left + pad : box.left + box.width / 2;
    const totalH = lines.length * lineH;
    const firstY = cell.top
      ? box.top + pad + lineH / 2 - 1
      : box.top + box.height / 2 - totalH / 2 + lineH / 2;

    lines.forEach((line, i) => {
      ctx.fillText(line, startX, firstY + i * lineH);
    });
    ctx.textAlign = "left";
  });

  // 网格线：每个单元格描边（合并格内部天然没有线）
  cells.forEach((cell) => {
    const box = rectOf(cell);
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1;
    ctx.strokeRect(box.left + 0.5, box.top + 0.5, box.width - 1, box.height - 1);
  });

  // 外框 + 标题与表头的分隔
  ctx.strokeStyle = LINE_STRONG;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x0 + 0.75, y0 + 0.75, tableW - 1.5, H - PAD * 2 - 1.5);
  ctx.beginPath();
  ctx.moveTo(x0, y0 + TITLE_H);
  ctx.lineTo(x0 + tableW, y0 + TITLE_H);
  ctx.stroke();

  return { width: W, height: H };
}

/* ------------------------------ 小工具 ------------------------------ */

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  size: number,
  weight: number,
): string[] {
  ctx.font = `${weight} ${size}px ${FONT}`;
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const ch of paragraph) {
      const next = line + ch;
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line);
        line = ch;
      } else {
        line = next;
      }
    }
    lines.push(line);
  }
  return lines.length ? lines : [""];
}
