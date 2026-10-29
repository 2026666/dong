"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRightLeft,
  Download,
  FileUp,
  ImagePlus,
  Loader2,
  RefreshCw,
  ScanLine,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocalStorage } from "@/lib/use-local-storage";
import { recognizeImage } from "@/lib/ocr-service";
import { parseOcrText } from "@/lib/ocr-parser";
import {
  OFFICIAL_LIMIT,
  SUBSTITUTE_LIMIT,
  addSubstitute,
  assignToSlot,
  buildPlan,
  parseGuanduRows,
  parseGuanduRoster,
  plannedCount,
  plannedNames,
  removeSubstitute,
  setPlanText,
  setTeamTask,
  slotCount,
  sortMembers,
  swapSlots,
  unarrangedNames,
  type GuanduMember,
  type GuanduPlan,
  type SlotPos,
} from "@/lib/guandu";
import { drawGuandu } from "./guandu-canvas";

/** OCR 常把界面上的固定文案认成名字，这里挡掉 */
const OCR_NOISE = [/^参战/, /^正式/, /^替补/, /^名单/, /^军团/, /^成员/, /^三国/, /^冰河/, /^关闭/];

const TASK_LABELS = ["21:05", "21:15", "21:25"] as const;

export default function GuanduClient() {
  const [rosterText, setRosterText] = useLocalStorage<string>("guanduRosterText", "");
  const [plan, setPlan] = useLocalStorage<GuanduPlan | null>("guanduPlan", null);
  const [present, setPresent] = useLocalStorage<string[]>("guanduPresent", []);

  const [rosterNotice, setRosterNotice] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [picked, setPicked] = useState<SlotPos | null>(null);
  const [generated, setGenerated] = useState(false);
  const [stale, setStale] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const roster = useMemo(() => parseGuanduRoster(rosterText), [rosterText]);
  const rosterNames = useMemo(() => roster.members.map((m) => m.name), [roster.members]);
  const rosterNameSet = useMemo(() => new Set(rosterNames), [rosterNames]);

  const officials = useMemo(() => (plan ? plannedNames(plan) : []), [plan]);
  const placed = useMemo(() => (plan ? plannedCount(plan) : 0), [plan]);
  const slots = useMemo(() => (plan ? slotCount(plan) : 0), [plan]);
  const bench = plan?.substitutes ?? [];
  const unarranged = useMemo(
    () => (plan ? unarrangedNames(plan, rosterNames) : []),
    [plan, rosterNames],
  );
  /** 方案里存在、但当前名单里找不到的名字（换了名单没重排） */
  const ghost = useMemo(
    () => officials.filter((name) => !rosterNameSet.has(name)),
    [officials, rosterNameSet],
  );

  const updatePlan = useCallback(
    (fn: (current: GuanduPlan) => GuanduPlan) => {
      setPlan((prev) => (prev ? fn(prev) : prev));
      setStale(true);
    },
    [setPlan],
  );

  /** 按当前名单 + 参赛名单重新生成一版方案（保留标题/备注这些手改过的文字） */
  const regenerate = useCallback(
    (rosterMembers: GuanduMember[], presentNames: string[], previous: GuanduPlan | null) => {
      const sorted = sortMembers(rosterMembers);
      const official = presentNames.length
        ? sorted.filter((m) => presentNames.includes(m.name))
        : sorted.slice(0, OFFICIAL_LIMIT);
      const officialSet = new Set(official.map((m) => m.name));
      const subs = sorted
        .filter((m) => !officialSet.has(m.name))
        .slice(0, SUBSTITUTE_LIMIT)
        .map((m) => m.name);
      return buildPlan(official, subs, previous ?? undefined);
    },
    [],
  );

  const handleRegenerate = useCallback(() => {
    if (!roster.members.length) {
      setRosterNotice("还没有名单：先把「成员名称 / 实力」这段表格贴进来。");
      return;
    }
    setPlan((prev) => regenerate(roster.members, present, prev));
    setStale(true);
    setPicked(null);
  }, [roster.members, present, regenerate, setPlan]);

  /* --------------------------- 名单输入 --------------------------- */

  const applyRows = useCallback((rows: string[][]) => {
    const parsed = parseGuanduRows(rows);
    if (!parsed.members.length) {
      setRosterNotice("没识别到名字：确认表头里有「成员名称」和「实力」，每行用 Tab 分隔。");
      return;
    }
    setRosterNotice(
      `识别到 ${parsed.members.length} 人${parsed.hasHeader ? "（已读表头）" : "（按内容猜列）"}${
        parsed.powerLabel ? ` · 实力取「${parsed.powerLabel}」列` : ""
      }`,
    );
    // 名单变了，之前的参赛名单可能失效：保留在状态里，但方案要用户点「重新生成」
  }, []);

  const handleRosterText = useCallback(
    (value: string) => {
      setRosterText(value);
      if (!value.trim()) {
        setRosterNotice(null);
        return;
      }
      const parsed = parseGuanduRoster(value);
      applyRows(parsed.members.length ? value.split(/\r?\n/).map((line) => line.split(/\t+|\s{2,}|[，,]/)) : []);
    },
    [applyRows, setRosterText],
  );

  const handleRosterFile = useCallback(
    async (file: File) => {
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
        setRosterText(
          normalized
            .filter((row) => row.some(Boolean))
            .map((row) => row.join("\t"))
            .join("\n"),
        );
        applyRows(normalized);
      } catch {
        setRosterNotice("读取表格失败，可以改成直接粘贴名单。");
      }
    },
    [applyRows, setRosterText],
  );

  /* --------------------------- OCR 识别 --------------------------- */

  const handleImages = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      if (!roster.members.length) {
        setOcrMessage("先上传盟员名单：OCR 要用它来核对名字。");
        return;
      }

      setOcrBusy(true);
      setOcrMessage("正在加载 PaddleOCR 模型（首次较慢，约 20 秒）…");
      const knownNames = roster.members.map((m) => m.name);
      const matched: string[] = [];
      const missing: string[] = [];

      try {
        for (let i = 0; i < files.length; i += 1) {
          setOcrMessage(
            files.length > 1 ? `正在识别第 ${i + 1} / ${files.length} 张…` : "正在识别截图…",
          );
          const text = await recognizeImage(files[i]);
          const participants = parseOcrText(text, { knownNames });
          for (const participant of participants) {
            const name = participant.playerName.trim();
            if (!name) continue;
            if (rosterNameSet.has(name)) {
              if (!matched.includes(name)) matched.push(name);
            } else if (
              name.length >= 2 &&
              /[\u4e00-\u9fa5]/.test(name) &&
              !OCR_NOISE.some((re) => re.test(name)) &&
              !missing.includes(name)
            ) {
              missing.push(name);
            }
          }
        }
      } catch (error) {
        setOcrMessage(
          `识别失败：${error instanceof Error ? error.message : "未知错误"}，可以换张截图再试。`,
        );
        setOcrBusy(false);
        return;
      }

      // 按名单顺序排好，后面按实力分派时更稳定
      const ordered = knownNames.filter((name) => matched.includes(name));
      setPresent(ordered);
      setRemoved(missing);
      setOcrBusy(false);
      setOcrMessage(
        ordered.length
          ? `认出名单里 ${ordered.length} 人${missing.length ? `，自动剔除 ${missing.length} 个不在名单里的名字` : ""}`
          : "一个都没对上：确认这张是「参战名单」页，且名单表格是最新的。",
      );

      if (ordered.length) {
        setPlan((prev) => regenerate(roster.members, ordered, prev));
        setStale(true);
        setPicked(null);
      }
    },
    [roster.members, rosterNameSet, present, regenerate, setPlan, setPresent],
  );

  /* --------------------------- 编辑操作 --------------------------- */

  const handleSwap = (pos: SlotPos) => {
    if (!picked) {
      setPicked(pos);
      return;
    }
    if (picked.team === pos.team && picked.row === pos.row) {
      setPicked(null);
      return;
    }
    updatePlan((current) => swapSlots(current, picked, pos));
    setPicked(null);
  };

  /* --------------------------- 出图 --------------------------- */

  const generate = () => {
    if (!plan) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawGuandu(canvas, plan);
    setGenerated(true);
    setStale(false);
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `官渡作战表-${new Date().toISOString().slice(0, 10)}.png`;
      link.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  };

  /* 名单有了但还没有方案：自动铺一版 */
  useEffect(() => {
    if (plan || !roster.members.length) return;
    setPlan(regenerate(roster.members, present, null));
  }, [plan, roster.members, present, regenerate, setPlan]);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/zhu"
            className="mb-3 inline-flex items-center gap-1.5 text-[12px] text-[var(--muted)] hover:text-[var(--ink)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回功能主页
          </Link>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em]">官渡之战安排</h1>
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--ink-2)]">
            上传盟员名单（实力排名）→ 识别参战截图，自动剔除不在名单里的人 → 按实力排出 30 人阵容 →
            点两个人互换、或下拉换人微调 → 确认后生成作战表图片。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleRegenerate}
            disabled={!roster.members.length}
          >
            <RefreshCw className="h-4 w-4" />
            按实力重排
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={generate}
            disabled={!plan}
          >
            <Download className="h-4 w-4" />
            确认并生成图片
          </button>
        </div>
      </div>

      {/* ---------------- 1. 名单 ---------------- */}
      <section className="card mb-4 p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StepBadge n={1} />
          <h2 className="text-[15px] font-semibold">盟员名单</h2>
          <span className="text-[12px] text-[var(--muted)]">
            实力越高排得越靠前；前 30 进正式，其余按实力进替补
          </span>
          <label className="btn btn-ghost ml-auto cursor-pointer px-3 py-1.5 text-[12px]">
            <FileUp className="h-3.5 w-3.5" />
            选择 xlsx / csv
            <input
              type="file"
              accept=".xlsx,.xls,.csv,text/csv"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleRosterFile(file);
                event.target.value = "";
              }}
            />
          </label>
        </div>

        <textarea
          className="input min-h-[128px] w-full font-mono text-[12px] leading-relaxed"
          value={rosterText}
          onChange={(event) => handleRosterText(event.target.value)}
          placeholder={
            "序号\t成员名称\t阶级\t火炉等级\t战力\t周功勋\t总功勋\t周捐献\t实力\n1\t超级幸运大将军\t4\t30\t181114627\t0\t13790582616\t98400\t71891358"
          }
          spellCheck={false}
        />

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--muted)]">
          <span>
            {rosterNotice ??
              (roster.members.length
                ? `名单 ${roster.members.length} 人`
                : "粘贴游戏里复制出来的名单表格（Tab 分隔），需要「成员名称」和「实力」两列")}
          </span>
          {roster.members.length > 0 && (
            <span>
              实力前三：
              {sortMembers(roster.members)
                .slice(0, 3)
                .map((m) => m.name)
                .join("、")}
            </span>
          )}
        </div>
      </section>

      {/* ---------------- 2. 参赛截图 ---------------- */}
      <section className="card mb-4 p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StepBadge n={2} />
          <h2 className="text-[15px] font-semibold">参赛名单截图</h2>
          <span className="text-[12px] text-[var(--muted)]">
            游戏里的「参战名单」页；识别后自动核对名单，对不上的直接剔除
          </span>
        </div>

        <label
          className={cn(
            "flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed border-[var(--line-strong)] px-4 py-6 text-center transition-colors",
            ocrBusy ? "cursor-not-allowed opacity-60" : "hover:bg-[var(--surface-2)]",
          )}
        >
          {ocrBusy ? (
            <Loader2 className="h-5 w-5 animate-spin text-[var(--muted)]" />
          ) : (
            <ImagePlus className="h-5 w-5 text-[var(--muted)]" />
          )}
          <span className="text-[13px] font-medium">
            {ocrBusy ? "识别中…" : "选择「参战名单」截图"}
          </span>
          <span className="text-[11.5px] text-[var(--muted)]">
            可以一次选多张（列表要往下滑就分开截）
          </span>
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={ocrBusy}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              void handleImages(files);
            }}
          />
        </label>

        {ocrMessage && (
          <p className="mt-2.5 flex items-start gap-1.5 text-[12px] text-[var(--ink-2)]">
            <ScanLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
            {ocrMessage}
          </p>
        )}

        {present.length > 0 && (
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/60 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="font-medium text-[var(--ink)]">
                已确认参赛 {present.length} 人
              </span>
              <button
                type="button"
                className="text-[11.5px] text-[var(--muted)] underline underline-offset-2 hover:text-[var(--ink)]"
                onClick={() => {
                  setPresent([]);
                  setRemoved([]);
                  setOcrMessage("已清空参赛名单，按「按实力重排」会退回名单前 30 名。");
                }}
              >
                清空
              </button>
            </div>
            <div className="mt-1.5 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
              {present.map((name) => (
                <span key={name} className="badge">
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        {removed.length > 0 && (
          <div className="mt-3 rounded-xl border border-[color-mix(in_oklab,#b45309_35%,var(--line))] bg-[color-mix(in_oklab,#b45309_6%,transparent)] px-3 py-2.5">
            <div className="text-[12px] font-medium text-[#8a4b09]">
              自动剔除 {removed.length} 个不在名单里的名字
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {removed.map((name) => (
                <span key={name} className="badge line-through decoration-[var(--muted)]">
                  {name}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] text-[var(--ink-2)]">
              如果确实是盟里的人，先补进上面的名单，再重新识别；也可以先把他放进替补，图上会有名字。
            </p>
          </div>
        )}
      </section>

      {/* ---------------- 3. 方案 ---------------- */}
      <section className="mb-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StepBadge n={3} />
          <h2 className="text-[15px] font-semibold">安排方案</h2>
          <span className="text-[12px] text-[var(--muted)]">
            正式 {placed} / {Math.max(slots, OFFICIAL_LIMIT)} 人 · 替补 {bench.length}/{SUBSTITUTE_LIMIT}
          </span>
          {ghost.length > 0 && (
            <span className="badge text-[#8a4b09]">
              方案里有 {ghost.length} 人不在当前名单
            </span>
          )}
        </div>

        {picked ? (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--gold)]/40 bg-[color-mix(in_oklab,var(--gold)_8%,transparent)] px-3 py-2 text-[12px]">
            <ArrowRightLeft className="h-3.5 w-3.5 text-[var(--gold)]" />
            已选中
            <strong className="font-semibold">
              {plan?.teams[picked.team]?.rows[picked.row]?.name || "空缺"}
            </strong>
            ，点另一个位置右边的 ⇄ 互换；再点自己取消。
          </div>
        ) : (
          <p className="mb-3 text-[12px] text-[var(--muted)]">
            点 ⇄ 选中一个位置，再点另一个 ⇄ 就互换；也可以直接在下拉里挑人（挑的人已经在别的队，会自动对调）。
          </p>
        )}

        {plan ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {plan.teams.map((team, teamIndex) => {
              const filled = team.rows.filter((row) => row.name).length;
              return (
                <div key={team.id} className="card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[14px] font-semibold">{team.name}</h3>
                    {team.target && <span className="badge">{team.target}</span>}
                    <span className="ml-auto text-[11.5px] text-[var(--muted)]">
                      {filled} / {team.rows.length} 人
                    </span>
                  </div>

                  <div className="mt-3 grid gap-2">
                    {TASK_LABELS.map((label, taskIndex) => (
                      <label key={label} className="block">
                        <span className="mb-1 block text-[11px] tabular-nums text-[var(--muted)]">
                          {label}
                        </span>
                        <textarea
                          className="input min-h-[36px] w-full resize-y py-1.5 text-[12px] leading-snug"
                          rows={2}
                          value={team.tasks[taskIndex]}
                          onChange={(event) =>
                            updatePlan((current) =>
                              setTeamTask(current, teamIndex, taskIndex as 0 | 1 | 2, event.target.value),
                            )
                          }
                        />
                      </label>
                    ))}
                  </div>

                  <ul className="mt-3 divide-y divide-[var(--line)]">
                    {team.rows.map((row, rowIndex) => {
                      const isPicked =
                        picked?.team === teamIndex && picked?.row === rowIndex;
                      return (
                        <li
                          key={`${team.id}-${rowIndex}`}
                          className={cn(
                            "-mx-2 flex items-center gap-2 rounded-lg px-2 py-1.5",
                            isPicked && "bg-[color-mix(in_oklab,var(--gold)_12%,transparent)]",
                          )}
                        >
                          <span
                            className={cn(
                              "w-[72px] shrink-0 truncate text-[11.5px]",
                              row.lead ? "font-semibold text-[var(--gold)]" : "text-[var(--muted)]",
                            )}
                            title={row.label}
                          >
                            {row.label}
                          </span>
                          <select
                            className="input h-8 flex-1 py-0 text-[12.5px]"
                            value={row.name}
                            onChange={(event) => {
                              const value = event.target.value;
                              updatePlan((current) =>
                                assignToSlot(current, { team: teamIndex, row: rowIndex }, value),
                              );
                            }}
                            aria-label={`${team.name}${row.label}`}
                          >
                            <option value="">— 空缺 —</option>
                            {officials.length > 0 && (
                              <optgroup label={`正式 ${officials.length} 人`}>
                                {officials.map((name) => (
                                  <option key={name} value={name}>
                                    {name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {bench.length > 0 && (
                              <optgroup label="替补">
                                {bench.map((name) => (
                                  <option key={name} value={name}>
                                    {name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                            {unarranged.length > 0 && (
                              <optgroup label="名单里未安排">
                                {unarranged.map((name) => (
                                  <option key={name} value={name}>
                                    {name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleSwap({ team: teamIndex, row: rowIndex })}
                            className={cn(
                              "grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition-colors",
                              isPicked
                                ? "border-[var(--gold)] bg-[var(--gold)] text-white"
                                : "border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--surface-2)]",
                            )}
                            aria-label={`选中 ${row.name || row.label} 用于互换`}
                            title="点一下选中，再点另一个位置互换"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card px-6 py-10 text-center">
            <p className="text-[13px] font-medium">还没有方案</p>
            <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-[var(--muted)]">
              先把名单贴进来，再点右上角「按实力重排」，就能得到一版 30 人的安排。
            </p>
          </div>
        )}

        {plan && (
          <div className="card mt-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-[14px] font-semibold">替补队</h3>
              <span className="badge">
                {bench.length} / {SUBSTITUTE_LIMIT}
              </span>
              <span className="text-[11.5px] text-[var(--muted)]">
                名单里没进正式的按实力取前 10，也可以手动加
              </span>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {bench.length === 0 && (
                <span className="text-[12px] text-[var(--muted)]">还没有替补</span>
              )}
              {bench.map((name) => (
                <span key={name} className="badge gap-1 pr-1">
                  {name}
                  <button
                    type="button"
                    className="grid h-4 w-4 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                    onClick={() => updatePlan((current) => removeSubstitute(current, name))}
                    aria-label={`从替补里移除 ${name}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            {unarranged.length > 0 && (
              <div className="mt-3 border-t border-[var(--line)] pt-2.5">
                <span className="text-[11.5px] text-[var(--muted)]">
                  名单里还没安排（{unarranged.length}）：
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {unarranged.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="badge hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)]"
                      onClick={() => updatePlan((current) => addSubstitute(current, name))}
                      title="加进替补队"
                    >
                      + {name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {removed.length > 0 && (
              <div className="mt-3 border-t border-[var(--line)] pt-2.5">
                <span className="text-[11.5px] text-[var(--muted)]">
                  被剔除的名字（确实要安排就点一下加进替补）：
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {removed.map((name) => (
                    <button
                      key={name}
                      type="button"
                      className="badge hover:border-[var(--line-strong)] hover:bg-[var(--surface-2)]"
                      onClick={() => updatePlan((current) => addSubstitute(current, name))}
                    >
                      + {name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---------------- 4. 图上文字 ---------------- */}
      {plan && (
        <section className="card mb-4 p-5">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StepBadge n={4} />
            <h2 className="text-[15px] font-semibold">图上的文字</h2>
            <span className="text-[12px] text-[var(--muted)]">
              标题、右侧备注、底部注意事项都能改
            </span>
          </div>

          <label className="block">
            <span className="mb-1 block text-[12px] text-[var(--ink-2)]">标题</span>
            <input
              className="input max-w-[320px]"
              value={plan.title}
              onChange={(event) =>
                updatePlan((current) => setPlanText(current, { title: event.target.value }))
              }
              placeholder="官渡作战表"
            />
          </label>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[12px] text-[var(--ink-2)]">
                右侧备注（表里那一大段规则）
              </span>
              <textarea
                className="input min-h-[220px] w-full text-[12px] leading-relaxed"
                value={plan.remark}
                onChange={(event) =>
                  updatePlan((current) => setPlanText(current, { remark: event.target.value }))
                }
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] text-[var(--ink-2)]">底部注意事项</span>
              <textarea
                className="input min-h-[220px] w-full text-[12px] leading-relaxed"
                value={plan.notes}
                onChange={(event) =>
                  updatePlan((current) => setPlanText(current, { notes: event.target.value }))
                }
              />
            </label>
          </div>
        </section>
      )}

      {/* ---------------- 5. 出图 ---------------- */}
      <section className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <StepBadge n={5} />
              <h2 className="text-[15px] font-semibold">生成作战表</h2>
            </div>
            <p className="mt-1.5 text-[12px] text-[var(--ink-2)]">
              队伍、成员号、玩家ID、三波时间、成员数与备注都会画进图里，适合直接发群里。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn btn-primary" onClick={generate} disabled={!plan}>
              <Sparkles className="h-4 w-4" />
              {generated ? "重新生成" : "确认并生成"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={download}
              disabled={!generated}
            >
              <Download className="h-4 w-4" />
              下载 PNG
            </button>
          </div>
        </div>

        {stale && generated && (
          <p className="mt-2 text-[12px] text-[var(--gold)]">
            方案改过了，上面的图是旧版，点「重新生成」更新。
          </p>
        )}

        <div className={cn("mt-4 overflow-hidden rounded-xl border border-[var(--line)]", generated ? "block" : "hidden")}>
          <canvas ref={canvasRef} className="block w-full" />
        </div>

        {!generated && (
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--line)] px-6 py-10 text-center">
            <p className="text-[13px] font-medium">还没生成图片</p>
            <p className="max-w-sm text-[12.5px] leading-relaxed text-[var(--muted)]">
              上面的方案调整好以后，点「确认并生成」，图片会出现在这里，再点「下载 PNG」保存。
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--btn-bg)] text-[11px] font-semibold text-[var(--btn-fg)]">
      {n}
    </span>
  );
}
