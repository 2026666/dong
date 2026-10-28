"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Download,
  FileUp,
  Image as ImageIcon,
  Users,
} from "lucide-react";
import {
  assignPlayers,
  buildCells,
  gridSizeOf,
  LEVEL_OPTIONS,
  MAX_VISIBLE_NAMES,
  parseRosterRows,
  parseRosterText,
  RING_COLORS,
  sortPlayers,
  statsOf,
  type HeituLevel,
  type HeituPlayer,
} from "@/lib/heitu";

const CENTER_GAP = 5;
const DARK = "#1b1b1d";

type PanelSection = { ring: number; names: string[]; cells: number };

export default function HeituClient() {
  const [level, setLevel] = useState<HeituLevel>(4);
  const [cityName, setCityName] = useState("城");
  const [rawText, setRawText] = useState("");
  const [players, setPlayers] = useState<HeituPlayer[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const cells = useMemo(() => buildCells(level), [level]);
  const ordered = useMemo(() => sortPlayers(players), [players]);
  const slots = useMemo(() => assignPlayers(ordered, cells.length), [ordered, cells.length]);
  const stats = useMemo(
    () => statsOf(ordered.length, cells.length),
    [ordered.length, cells.length],
  );

  const sections = useMemo<PanelSection[]>(() => {
    const map = new Map<number, { names: string[]; cells: number }>();
    cells.forEach((cell, index) => {
      const entry = map.get(cell.ring) ?? { names: [], cells: 0 };
      entry.cells += 1;
      entry.names.push(...slots[index]);
      map.set(cell.ring, entry);
    });
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([ring, value]) => ({ ring, ...value }));
  }, [cells, slots]);

  const applyRows = useCallback((rows: string[][]) => {
    const parsed = parseRosterRows(rows);
    setPlayers(parsed.players);
    setNotice(
      parsed.players.length
        ? `识别到 ${parsed.players.length} 人${parsed.hasHeader ? "（已读取表头）" : "（按内容猜列）"}`
        : "没有从这份名单里识别到名字",
    );
  }, []);

  const handleTextChange = (value: string) => {
    setRawText(value);
    if (!value.trim()) {
      setPlayers([]);
      setNotice(null);
      return;
    }
    const parsed = parseRosterText(value);
    setPlayers(parsed.players);
    setNotice(
      parsed.players.length
        ? `识别到 ${parsed.players.length} 人${parsed.hasHeader ? "（已读取表头）" : ""}`
        : "没有识别到名字，检查一下是不是用 Tab 分隔的表格",
    );
  };

  const handleFile = async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        raw: false,
        defval: "",
      }) as unknown[][];
      const normalized = rows.map((row) => row.map((cell) => String(cell ?? "").trim()));
      setRawText(
        normalized
          .filter((row) => row.some(Boolean))
          .map((row) => row.join("\t"))
          .join("\n"),
      );
      applyRows(normalized);
    } catch {
      setNotice("读取 xlsx 失败，可以改成直接粘贴表格内容");
    }
  };

  /* ------------------------------ 画布渲染 ------------------------------ */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const size = gridSizeOf(level);
    const center = (size - 1) / 2;
    const gap = CENTER_GAP;
    const pad = 18;
    const left = 32;
    const titleTop = 44;
    const panelW = 272;
    const panelLeft = 1600 - 32 - panelW;
    const cardW = panelLeft - 24 - left;
    const gridW = cardW - pad * 2;
    const cellSize = Math.floor((gridW - (size - 1) * gap) / size);
    const gridH = size * cellSize + (size - 1) * gap;
    const cardH = gridH + pad * 2 + 34;

    // 量一下右侧名单需要多高
    const measure = document.createElement("canvas").getContext("2d");
    if (!measure) return;
    measure.font = '12px "Microsoft YaHei", "PingFang SC", sans-serif';
    const padPanel = 20;
    const nameSize = 12;
    const lineH = 19;
    const sectionLines: Array<{ ring: number; names: string[]; cells: number; lines: string[] }> = [];
    sections.forEach((section) => {
      const lines: string[] = [];
      let line = "";
      section.names.forEach((name) => {
        const candidate = line ? `${line}、${name}` : name;
        if (measure.measureText(candidate).width > panelW - padPanel * 2 && line) {
          lines.push(line);
          line = name;
        } else {
          line = candidate;
        }
      });
      if (line) lines.push(line);
      sectionLines.push({ ...section, lines });
    });

    const W = 1600;
    const H = 1600;
    const boxH = cardH;
    const contentTop = 150;
    const scale = 2;

    canvas.width = W * scale;
    canvas.height = H * scale;
    canvas.style.width = "100%";
    canvas.style.height = "auto";

    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = "#fafaf9";
    ctx.fillRect(0, 0, W, H);

    // 顶部文字
    ctx.fillStyle = "#a9761c";
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.textBaseline = "alphabetic";
    ctx.fillText("BLACK SOIL ARRANGEMENT", left, titleTop + 10);

    ctx.fillStyle = DARK;
    ctx.font = '600 30px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText(`黑土安排表 · ${level} 级城`, left, titleTop + 48);

    ctx.fillStyle = "#71717a";
    ctx.font = '12.5px "Microsoft YaHei", "PingFang SC", sans-serif';
    const sub = `名单 ${ordered.length} 人 · 共 ${cells.length} 格 · 按实力从高到低${
      stats.rounds > 1 ? ` · 第 ${stats.rounds} 轮起有叠层` : ""
    }`;
    ctx.fillText(sub, left, titleTop + 74);

    // 网格卡片
    roundRect(ctx, left, contentTop, cardW, boxH, 18);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#e8e8e5";
    ctx.lineWidth = 1;
    ctx.stroke();

    const gridX = left + pad;
    const gridY = contentTop + pad;

    // 格子
    for (let row = 0; row < size; row += 1) {
      for (let col = 0; col < size; col += 1) {
        const dr = row - center;
        const dc = col - center;
        const ringOffset = Math.max(Math.abs(dr), Math.abs(dc));
        if (ringOffset <= 1) continue;

        const x = gridX + col * (cellSize + gap);
        const y = gridY + row * (cellSize + gap);
        const isGap = level !== 4 && dr === -center;

        if (isGap) {
          roundRect(ctx, x, y, cellSize, cellSize, 9);
          ctx.fillStyle = "#ffffff";
          ctx.fill();
          ctx.setLineDash([4, 4]);
          ctx.strokeStyle = "#d7d2c9";
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = "#b8b2a8";
          ctx.font = '11px "Microsoft YaHei", sans-serif';
          ctx.textAlign = "center";
          ctx.fillText("缺一层", x + cellSize / 2, y + cellSize / 2 + 4);
          ctx.textAlign = "left";
          continue;
        }

        const ring = ringOffset - 1;
        const style = RING_COLORS[ring] ?? RING_COLORS[3];
        const index = cells.findIndex((cell) => cell.row === row && cell.col === col);
        const names = index >= 0 ? slots[index] : [];

        roundRect(ctx, x, y, cellSize, cellSize, 9);
        ctx.fillStyle = style.bg;
        ctx.fill();
        ctx.strokeStyle = style.border;
        ctx.stroke();

        if (!names.length) {
          ctx.fillStyle = "#c4beb6";
          ctx.font = '13px "Microsoft YaHei", sans-serif';
          ctx.textAlign = "center";
          ctx.fillText("—", x + cellSize / 2, y + cellSize / 2 + 5);
          ctx.textAlign = "left";
          continue;
        }

        const visible = names.slice(0, MAX_VISIBLE_NAMES);
        const overflow = names.length - visible.length;
        const fonts =
          visible.length >= 3 ? [12, 11, 10] : visible.length === 2 ? [13.5, 12] : [16];
        const lineH = Math.round(fonts[0] * 1.42);
        const totalH = visible.length * lineH + (overflow > 0 ? 13 : 0);
        let cursorY = y + cellSize / 2 - totalH / 2 + Math.round(fonts[0] * 0.78);

        visible.forEach((name, layer) => {
          const base = fonts[layer] ?? 10;
          const font = fitFont(ctx, name, cellSize - 14, base);
          ctx.font = `${layer === 0 ? 600 : 400} ${font}px "Microsoft YaHei", "PingFang SC", sans-serif`;
          ctx.fillStyle = layer === 0 ? style.ink : "#6b6b73";
          ctx.textAlign = "center";
          ctx.fillText(name, x + cellSize / 2, cursorY);
          cursorY += lineH;
        });

        if (overflow > 0) {
          ctx.font = '10px "Microsoft YaHei", sans-serif';
          ctx.fillStyle = "#8e8e93";
          ctx.textAlign = "center";
          ctx.fillText(`+${overflow} 人`, x + cellSize / 2, cursorY + 2);
        }
        ctx.textAlign = "left";
      }
    }

    // 城池（中心 3×3）
    const cityCol = center - 1;
    const cityRow = center - 1;
    const cityX = gridX + cityCol * (cellSize + gap);
    const cityY = gridY + cityRow * (cellSize + gap);
    const cityW = cellSize * 3 + gap * 2;
    roundRect(ctx, cityX, cityY, cityW, cityW, 14);
    ctx.fillStyle = DARK;
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = '600 26px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(cityName || "城", cityX + cityW / 2, cityY + cityW / 2 + 4);
    ctx.fillStyle = "#c9c9c4";
    ctx.font = '12px "Microsoft YaHei", sans-serif';
    ctx.fillText(`${level} 级城 · 3×3`, cityX + cityW / 2, cityY + cityW / 2 + 26);
    ctx.textAlign = "left";

    // 图例
    const legendY = contentTop + boxH - 24;
    const legendItems = [
      { color: RING_COLORS[1].bg, border: RING_COLORS[1].border, text: "第 1 环（紧贴城）" },
      { color: RING_COLORS[2].bg, border: RING_COLORS[2].border, text: "第 2 环" },
      ...(level === 4
        ? []
        : [{ color: RING_COLORS[3].bg, border: RING_COLORS[3].border, text: "第 3 环" }]),
    ];
    let legendX = gridX;
    ctx.font = '11.5px "Microsoft YaHei", sans-serif';
    legendItems.forEach((item) => {
      roundRect(ctx, legendX, legendY - 9, 10, 10, 3);
      ctx.fillStyle = item.color;
      ctx.fill();
      ctx.strokeStyle = item.border;
      ctx.stroke();
      ctx.fillStyle = "#5c5c63";
      ctx.fillText(item.text, legendX + 15, legendY);
      legendX += ctx.measureText(item.text).width + 44;
    });

    // 右侧名单
    roundRect(ctx, panelLeft, contentTop, panelW, boxH, 18);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#e8e8e5";
    ctx.stroke();

    ctx.fillStyle = DARK;
    ctx.font = '600 14px "Microsoft YaHei", "PingFang SC", sans-serif';
    ctx.fillText("各环人员", panelLeft + padPanel, contentTop + 34);

    let cursor = contentTop + 64;
    sectionLines.forEach((section) => {
      const style = RING_COLORS[section.ring] ?? RING_COLORS[3];
      roundRect(ctx, panelLeft + padPanel, cursor - 9, 10, 10, 3);
      ctx.fillStyle = style.bg;
      ctx.fill();
      ctx.strokeStyle = style.border;
      ctx.stroke();

      ctx.fillStyle = DARK;
      ctx.font = '600 12.5px "Microsoft YaHei", "PingFang SC", sans-serif';
      ctx.fillText(
        `${style.name} · ${section.cells} 格 · ${section.names.length} 人`,
        panelLeft + padPanel + 16,
        cursor,
      );
      cursor += 21;

      ctx.fillStyle = "#3f3f46";
      ctx.font = `${nameSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
      section.lines.forEach((line) => {
        ctx.fillText(line, panelLeft + padPanel, cursor);
        cursor += lineH;
      });
      cursor += 14;
    });

    // 面板底部合计
    ctx.strokeStyle = "#ececea";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(panelLeft + padPanel, contentTop + boxH - 46);
    ctx.lineTo(panelLeft + panelW - padPanel, contentTop + boxH - 46);
    ctx.stroke();

    ctx.fillStyle = "#8e8e93";
    ctx.font = '11.5px "Microsoft YaHei", sans-serif';
    ctx.fillText(
      `共 ${ordered.length} 人 · ${cells.length} 格 · ${stats.rounds} 层`,
      panelLeft + padPanel,
      contentTop + boxH - 24,
    );

    ctx.fillStyle = "#8e8e93";
    ctx.font = '11.5px "Microsoft YaHei", sans-serif';
    ctx.fillText(
      "填写顺序：从这一环的左上角起，顺时针绕一圈；一环排满再进下一环。",
      left,
      H - 62,
    );
    ctx.fillText(
      "实力高的靠城；全部格子排满后，回到第 1 格叠第 2 层。",
      left,
      H - 42,
    );
    ctx.fillStyle = "#b8b2a8";
    ctx.font = '11px "Microsoft YaHei", sans-serif';
    ctx.fillText("三国冰河 · 盟战统计", left, H - 16);
  }, [level, cityName, ordered, cells, slots, sections, stats.rounds]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `黑土安排表-${level}级城-${cityName || "城"}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/zhu"
            className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回工作台
          </Link>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">黑土安排表</h1>
          <p className="mt-1.5 text-[13px] text-[var(--ink-2)]">
            上传名单，按实力从高到低把人排到城池周围，生成可以直接发到群里的图片。
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={download} disabled={!players.length}>
          <Download className="h-4 w-4" />
          下载图片
        </button>
      </div>

      <div className="card mb-6 p-5">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <label className="mb-1.5 block text-[12px] text-[var(--ink-2)]" htmlFor="city-name">
              城池名（默认「城」）
            </label>
            <input
              id="city-name"
              className="input max-w-[220px]"
              value={cityName}
              onChange={(event) => setCityName(event.target.value)}
              placeholder="城"
              maxLength={8}
            />
          </div>

          <div>
            <span className="mb-1.5 block text-[12px] text-[var(--ink-2)]">城池等级</span>
            <div className="flex flex-wrap gap-2">
              {LEVEL_OPTIONS.map((option) => {
                const active = option.level === level;
                return (
                  <button
                    key={option.level}
                    type="button"
                    onClick={() => setLevel(option.level)}
                    title={option.note}
                    className={`rounded-lg border px-3 py-1.5 text-[12.5px] transition-colors ${
                      active
                        ? "border-transparent bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-sm"
                        : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
                    }`}
                  >
                    {option.label}
                    <span className={`ml-1.5 text-[11px] ${active ? "opacity-70" : "text-[var(--muted)]"}`}>
                      {option.note}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-5">
          <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
            <label className="block text-[12px] text-[var(--ink-2)]" htmlFor="roster">
              名单（粘贴表格，或上传 xlsx / csv）
            </label>
            <label className="btn btn-ghost cursor-pointer px-3 py-1.5 text-[12px]">
              <FileUp className="h-3.5 w-3.5" />
              选择文件
              <input
                type="file"
                accept=".xlsx,.xls,.csv,text/csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
          <textarea
            id="roster"
            className="input min-h-[132px] w-full font-mono text-[12px] leading-relaxed"
            value={rawText}
            onChange={(event) => handleTextChange(event.target.value)}
            placeholder={"序号\t成员名称\t阶级\t火炉等级\t战力\t周功勋\t总功勋\t周捐献\t实力\n1\t超级幸运大将军\t4\t30\t180020889\t0\t13790582616\t79440\t71640037"}
            spellCheck={false}
          />
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--muted)]">
            <span>{notice ?? "需要「成员名称」和「实力」两列；实力越高排得越靠城。"}</span>
            <span>
              {cells.length} 格 · {ordered.length} 人
              {stats.rounds > 1 ? ` · 已排到第 ${stats.rounds} 轮` : ""}
            </span>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        {players.length ? (
          <canvas ref={canvasRef} className="block w-full" />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--surface-2)] text-[var(--muted)]">
              <ImageIcon className="h-5 w-5" />
            </span>
            <p className="text-[13px] font-medium">还没有名单</p>
            <p className="max-w-sm text-[12.5px] leading-relaxed text-[var(--muted)]">
              把「序号 / 成员名称 / … / 实力」这样的表格粘贴到上面，或者直接选 xlsx 文件，排布图会自动生成。
            </p>
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--muted)]">
              <Users className="h-3.5 w-3.5" />
              名单留在你自己的浏览器里，不会上传
            </span>
          </div>
        )}
      </div>
    </main>
  );
}

/* ------------------------------ 画布小工具 ------------------------------ */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  start: number,
): number {
  let size = start;
  while (size > 8) {
    ctx.font = `${size}px "Microsoft YaHei", "PingFang SC", sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 1;
  }
  return 8;
}
