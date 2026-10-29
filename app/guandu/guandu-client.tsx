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
} from "lucide-react";
import { cn } from "@/lib/cn";
import { useLocalStorage } from "@/lib/use-local-storage";
import { recognizeImage } from "@/lib/ocr-service";
import { parseOcrText } from "@/lib/ocr-parser";
import { preprocessImage } from "@/lib/image-preprocess";
import {
  OFFICIAL_LIMIT,
  SUBSTITUTE_LIMIT,
  assignToSlot,
  buildPlan,
  normalizeSubstitutes,
  parseGuanduRows,
  parseGuanduRoster,
  plannedCount,
  plannedNames,
  setPlanText,
  setGroupStartTask,
  setSubstitutes,
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
  /** 替补（单独一张「替补成员」截图识别出来的，最多 10 人，不传就空着） */
  const [subs, setSubs] = useLocalStorage<string[]>("guanduSubs", []);

  const [rosterNotice, setRosterNotice] = useState<string | null>(null);
  const [removed, setRemoved] = useState<string[]>([]);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  /** 预期参战人数（页签「正式成员(26/30)」里的 26），OCR 读到就自动填，读不到可以手改 */
  const [expected, setExpected] = useLocalStorage<string>("guanduExpected", "");
  /** 补识别之后还差几个人、可能是谁 */
  const [shortfall, setShortfall] = useState(0);
  const [candidates, setCandidates] = useState<string[]>([]);
  /** 从总名单里手动挑人：展开状态 + 搜索词 + 手输名字 + 提示 */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [manualName, setManualName] = useState("");
  const [pickerNote, setPickerNote] = useState<string | null>(null);
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
  /** 想安排但排不下的（超过 30 个） */
  const overflow = useMemo(() => {
    const pool = present.length ? present.length : rosterNames.length;
    return Math.max(0, pool - OFFICIAL_LIMIT);
  }, [present.length, rosterNames.length]);

  /** 预期参战人数（手填优先，没填就是 30） */
  const targetCount = useMemo(() => {
    const value = Number(expected);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : OFFICIAL_LIMIT;
  }, [expected]);

  /** 从总名单里挑人用的列表：全部名单按实力从高到低 */
  const rosterSorted = useMemo(() => sortMembers(roster.members), [roster.members]);
  const pickerList = useMemo(() => {
    const keyword = pickerQuery.trim().toLowerCase();
    if (!keyword) return rosterSorted;
    return rosterSorted.filter((member) => member.name.toLowerCase().includes(keyword));
  }, [pickerQuery, rosterSorted]);
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
    (
      rosterMembers: GuanduMember[],
      presentNames: string[],
      previous: GuanduPlan | null,
      substituteNames?: string[],
    ) => {
      const sorted = sortMembers(rosterMembers);
      const official = presentNames.length
        ? sorted.filter((m) => presentNames.includes(m.name))
        : sorted.slice(0, OFFICIAL_LIMIT);
      return buildPlan(official, substituteNames ?? previous?.substitutes ?? [], previous ?? undefined);
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

  /**
   * 识别「参战名单」截图：
   * 1. 先用原图识别一轮，顺便读页签里的「正式成员(28/30)」拿到预期人数；
   * 2. 人数对不上就换预处理参数再补识别（最多 3 轮）；
   * 3. 还差人的话，按名单实力列出最可能漏掉的候选人让用户勾选。
   */
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
      const matched = new Set<string>();
      const missing: string[] = [];
      let detected: number | null = null;

      const collect = (text: string) => {
        const hit = text.match(/正式成员\s*[（(]?\s*(\d+)\s*\/\s*(\d+)/);
        if (hit) {
          const value = Number(hit[1]);
          if (Number.isFinite(value) && value > 0) detected = value;
        }
        for (const participant of parseOcrText(text, { knownNames })) {
          const name = participant.playerName.trim();
          if (!name) continue;
          if (rosterNameSet.has(name)) {
            matched.add(name);
          } else if (
            name.length >= 2 &&
            /[\u4e00-\u9fa5]/.test(name) &&
            !OCR_NOISE.some((re) => re.test(name)) &&
            !missing.includes(name)
          ) {
            missing.push(name);
          }
        }
      };

      try {
        for (let i = 0; i < files.length; i += 1) {
          setOcrMessage(
            files.length > 1 ? `正在识别第 ${i + 1} / ${files.length} 张…` : "正在识别截图…",
          );
          collect(await recognizeImage(files[i]));
        }

        // 页签里的「正式成员(28/30)」就是预期人数；用户手填过就以手填为准
        const manual = Number(expected);
        const target = Number.isFinite(manual) && manual > 0 ? manual : detected ?? 0;
        if (!(Number.isFinite(manual) && manual > 0) && detected) setExpected(String(detected));

        // 人没齐就换参数补识别（最多 3 轮）
        for (let round = 2; round <= 3 && target > matched.size; round += 1) {
          setOcrMessage(
            `第 1 轮认出 ${matched.size} / ${target} 人，换参数补识别（第 ${round} 轮）…`,
          );
          const options =
            round === 2
              ? { scale: 2.5, contrast: 1.9, binarize: false }
              : { scale: 3, contrast: 2.2, threshold: 0, binarize: true };
          for (let i = 0; i < files.length; i += 1) {
            const blob = await preprocessImage(files[i], options);
            collect(await recognizeImage(blob));
          }
        }

        // 按名单顺序排好，后面按实力分派时更稳定
        const ordered = knownNames.filter((name) => matched.has(name));
        setPresent(ordered);
        setRemoved(missing);

        const gap = target > ordered.length ? target - ordered.length : 0;
        setShortfall(gap);
        setCandidates(
          gap > 0
            ? sortMembers(roster.members)
                .filter((m) => !ordered.includes(m.name))
                .slice(0, Math.min(10, gap + 4))
                .map((m) => m.name)
            : [],
        );

        setOcrBusy(false);
        // 3 轮还没认全：自动展开「从总名单里挑人」，和候选人一起给用户兜底
        if (gap > 0) setPickerOpen(true);
        setOcrMessage(
          ordered.length
            ? `认出名单里 ${ordered.length} / ${target || ordered.length} 人${
                missing.length ? `，自动剔除 ${missing.length} 个不在名单里的名字` : ""
              }${gap > 0 ? `，还差 ${gap} 人（下面的候选人或「从总名单里挑人」都行）` : ""}`
            : "一个都没对上：确认这张是「参战名单」页，且名单表格是最新的。",
        );

        if (ordered.length) {
          setPlan((prev) => regenerate(roster.members, ordered, prev));
          setStale(true);
          setPicked(null);
        }
      } catch (error) {
        setOcrMessage(
          `识别失败：${error instanceof Error ? error.message : "未知错误"}，可以换张截图再试。`,
        );
        setOcrBusy(false);
      }
    },
    [expected, roster.members, rosterNameSet, regenerate, setExpected, setPlan, setPresent],
  );

  /**
   * 识别「替补成员」页签的截图：最多 10 人，只画在图上、不参与换人。
   * 已经在前 30 正式名单里的名字会被剔掉；认不全就换参数再补一轮。
   */
  const handleSubImages = useCallback(
    async (files: File[]) => {
      if (!files.length) return;
      if (!roster.members.length) {
        setOcrMessage("先上传盟员名单：OCR 要用它来核对名字。");
        return;
      }

      setOcrBusy(true);
      setOcrMessage("正在识别替补名单（首次加载模型较慢）…");
      const knownNames = roster.members.map((m) => m.name);
      const matched = new Set<string>();
      const ignored: string[] = [];
      let detected: number | null = null;

      const collect = (text: string) => {
        const hit = text.match(/替补成员\s*[（(]?\s*(\d+)\s*\/\s*(\d+)/);
        if (hit) {
          const value = Number(hit[1]);
          if (Number.isFinite(value) && value > 0) detected = value;
        }
        for (const participant of parseOcrText(text, { knownNames })) {
          const name = participant.playerName.trim();
          if (!name) continue;
          if (!rosterNameSet.has(name)) {
            if (name.length >= 2 && /[\u4e00-\u9fa5]/.test(name) && !ignored.includes(name)) {
              ignored.push(name);
            }
            continue;
          }
          if (present.includes(name)) continue;
          matched.add(name);
        }
      };

      try {
        for (let i = 0; i < files.length; i += 1) {
          setOcrMessage(
            files.length > 1 ? `正在识别替补第 ${i + 1} / ${files.length} 张…` : "正在识别替补截图…",
          );
          collect(await recognizeImage(files[i]));
        }

        const goal = Math.min(detected ?? SUBSTITUTE_LIMIT, SUBSTITUTE_LIMIT);
        for (let round = 2; round <= 3 && matched.size < goal; round += 1) {
          setOcrMessage(`替补认出 ${matched.size} 人，换参数再识别一次（第 ${round} 轮）…`);
          const options =
            round === 2
              ? { scale: 2.5, contrast: 1.9, binarize: false }
              : { scale: 3, contrast: 2.2, threshold: 0, binarize: true };
          for (let i = 0; i < files.length; i += 1) {
            const blob = await preprocessImage(files[i], options);
            collect(await recognizeImage(blob));
          }
        }

        const ordered = knownNames.filter((name) => matched.has(name));
        const next = normalizeSubstitutes(ordered, present);
        setSubs(next);
        setPlan((current) => (current ? setSubstitutes(current, next) : current));
        setStale(true);
        setOcrBusy(false);
        setOcrMessage(
          next.length
            ? `替补认出 ${next.length} 人${
                ordered.length > SUBSTITUTE_LIMIT ? `（超过 ${SUBSTITUTE_LIMIT} 人的只保留前 ${SUBSTITUTE_LIMIT} 个）` : ""
              }${ignored.length ? `，另有 ${ignored.length} 个名字不在盟员名单里已忽略` : ""}`
            : "替补一个都没对上：确认这张是「替补成员」页签，且名单表格是最新的（也可以先不填替补）。",
        );
      } catch (error) {
        setOcrMessage(
          `替补识别失败：${error instanceof Error ? error.message : "未知错误"}，可以换张截图再试。`,
        );
        setOcrBusy(false);
      }
    },
    [present, roster.members, rosterNameSet, setPlan, setSubs],
  );

  /** 从候选 / 名单里补一个人进参赛名单（补到预期人数就停） */
  const addPresent = useCallback(
    (name: string) => {
      if (!rosterNameSet.has(name)) {
        setPickerNote(`「${name}」不在盟员名单里，不能加进参赛名单。先用第 1 步把名单补全。`);
        return;
      }
      if (present.includes(name)) {
        setPickerNote(`「${name}」已经在参赛名单里了。`);
        return;
      }
      if (present.length >= targetCount) {
        setPickerNote(
          `已经够 ${targetCount} 人了（预期参战人数），再加就超了；要换人请先在上面点掉一个。`,
        );
        return;
      }
      setPickerNote(null);
      setPresent((prev) => {
        if (prev.includes(name)) return prev;
        const next = [...prev, name];
        setPlan((current) => regenerate(roster.members, next, current));
        setStale(true);
        return next;
      });
      setCandidates((prev) => prev.filter((item) => item !== name));
      setShortfall((prev) => Math.max(0, prev - 1));
    },
    [
      present,
      regenerate,
      roster.members,
      rosterNameSet,
      setPlan,
      setPresent,
      targetCount,
    ],
  );

  /** 手输名字补人：只认名单里的人（先精确，再按包含匹配纠错） */
  const addManualPresent = useCallback(
    (raw: string) => {
      const input = raw.trim();
      if (!input) return;
      const norm = (value: string) => value.replace(/\s+/g, "").toLowerCase();
      const target = norm(input);
      const exact = rosterNames.find((name) => norm(name) === target);
      const fuzzy =
        exact ??
        rosterNames.find(
          (name) => norm(name).includes(target) || target.includes(norm(name)),
        );
      if (!fuzzy) {
        setPickerNote(`「${input}」不在盟员名单里。只能从名单里选人，先把名单补全再试。`);
        return;
      }
      addPresent(fuzzy);
      setManualName("");
    },
    [addPresent, rosterNames],
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
            盟员名单只用来核对 OCR 认出的名字、并给出实力排名；真正上场的人来自「参战名单」截图。
            识别完按实力排出 30 人阵容 → 点两个人互换、或下拉换人微调 → 确认后生成作战表图片。
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
            实力越高排得越靠前；只安排前 30 个位置，多出来的人不排
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

        <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px] text-[var(--ink-2)]">
          <label className="flex items-center gap-1.5">
            预期参战人数
            <input
              className="input h-7 w-16 px-2 py-0 text-center text-[12px] tabular-nums"
              inputMode="numeric"
              value={expected}
              onChange={(event) => setExpected(event.target.value.replace(/[^\d]/g, ""))}
              placeholder="30"
            />
          </label>
          <span className="text-[11.5px] text-[var(--muted)]">
            自动读「正式成员（28/30）」里的数字；读不到就手填。人没齐会自动换参数再识别 2 轮，
            还差就按实力列出可能是谁。
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

        {shortfall > 0 && candidates.length > 0 && (
          <div className="mt-3 rounded-xl border border-[var(--gold)]/35 bg-[color-mix(in_oklab,var(--gold)_7%,transparent)] px-3 py-2.5">
            <div className="text-[12px] font-medium text-[var(--ink)]">
              还差 {shortfall} 人：按名单实力，最可能是这些人，点一下就补进参赛名单
            </div>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {candidates.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="badge cursor-pointer hover:border-[var(--gold)]"
                  onClick={() => addPresent(name)}
                >
                  + {name}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] text-[var(--ink-2)]">
              都不是的话，把截图截全一点（列表要下滑就多截几张）重新识别。
            </p>
          </div>
        )}

        {rosterSorted.length > 0 && (
          <div className="mt-3 rounded-xl border border-[var(--line)] bg-[var(--surface-2)]/50 px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <button
                type="button"
                className="font-medium text-[var(--ink)] underline decoration-[var(--line-strong)] underline-offset-2 hover:decoration-[var(--gold)]"
                onClick={() => {
                  setPickerOpen((open) => !open);
                  setPickerNote(null);
                }}
              >
                {pickerOpen ? "收起" : "从总名单里挑人"}
              </button>
              <span className="text-[11.5px] text-[var(--muted)]">
                当前 {present.length} / 预期 {targetCount} 人
                {shortfall > 0 ? `，还差 ${shortfall} 人` : ""}
              </span>
            </div>

            {pickerOpen && (
              <div className="mt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="input h-7 w-40 px-2 py-0 text-[12px]"
                    placeholder="搜名字"
                    value={pickerQuery}
                    onChange={(event) => setPickerQuery(event.target.value)}
                  />
                  <input
                    className="input h-7 w-44 px-2 py-0 text-[12px]"
                    placeholder="手输名字（必须在名单里）"
                    value={manualName}
                    onChange={(event) => setManualName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addManualPresent(manualName);
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-quiet h-7 px-2.5 py-0 text-[12px]"
                    onClick={() => addManualPresent(manualName)}
                  >
                    加入
                  </button>
                </div>

                <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--surface)]">
                  {pickerList.length === 0 && (
                    <p className="px-3 py-2 text-[12px] text-[var(--muted)]">名单里没有匹配的名字</p>
                  )}
                  {pickerList.map((member) => {
                    const added = present.includes(member.name);
                    return (
                      <button
                        key={member.name}
                        type="button"
                        disabled={added}
                        onClick={() => addPresent(member.name)}
                        className={cn(
                          "flex w-full items-center gap-2 border-b border-[var(--line)] px-3 py-1.5 text-left text-[12px] last:border-b-0",
                          added
                            ? "cursor-default text-[var(--muted)]"
                            : "hover:bg-[var(--surface-2)]",
                        )}
                      >
                        <span className="flex-1 truncate">{member.name}</span>
                        <span className="tabular-nums text-[11px] text-[var(--muted)]">
                          {member.power ? member.power.toLocaleString("zh-CN") : "—"}
                        </span>
                        <span className="w-12 shrink-0 text-right text-[11px]">
                          {added ? "已参赛" : <span className="text-[var(--gold)]">加入</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {pickerNote && (
                  <p className="mt-1.5 text-[11.5px] text-[#8a4b09]">{pickerNote}</p>
                )}
              </div>
            )}
          </div>
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
                  setShortfall(0);
                  setCandidates([]);
                  setPickerNote(null);
                  setOcrMessage("已清空参赛名单，按「按实力重排」会退回名单前 30 名。");
                }}
              >
                清空
              </button>
              <span className="text-[11.5px] text-[var(--muted)]">点名字可以移出</span>
            </div>
            <div className="mt-1.5 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
              {present.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="badge hover:border-[var(--line-strong)] hover:bg-[var(--surface)]"
                  title="点一下移出参赛名单"
                  onClick={() => {
                    setPresent((prev) => {
                      const next = prev.filter((item) => item !== name);
                      setPlan((current) => regenerate(roster.members, next, current ?? null));
                      setStale(true);
                      return next;
                    });
                    setPickerNote(null);
                  }}
                >
                  {name} ×
                </button>
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
              如果确实是盟里的人，先补进上面的名单，再重新识别；补好之后可以从下拉里直接换进队伍。
            </p>
          </div>
        )}

        {/* 替补：单独一张截图，最多 10 人，只画在图上、不参与换人 */}
        <div className="mt-4 rounded-xl border border-[var(--line)] px-3 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12.5px] font-medium">替补名单（可选，最多 {SUBSTITUTE_LIMIT} 人）</span>
            <span className="text-[11.5px] text-[var(--muted)]">
              传「替补成员」页签那张截图；不传就空着，图上替补队留白
            </span>
            {subs.length > 0 && (
              <button
                type="button"
                className="ml-auto text-[11.5px] text-[var(--muted)] underline underline-offset-2 hover:text-[var(--ink)]"
                onClick={() => {
                  setSubs([]);
                  setPlan((current) =>
                    current ? setSubstitutes(current, []) : current,
                  );
                  setStale(true);
                }}
              >
                清空替补
              </button>
            )}
          </div>

          <label
            className={cn(
              "mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--line-strong)] px-3 py-2.5 text-center transition-colors",
              ocrBusy ? "cursor-not-allowed opacity-60" : "hover:bg-[var(--surface-2)]",
            )}
          >
            <ImagePlus className="h-4 w-4 text-[var(--muted)]" />
            <span className="text-[12px]">选择「替补成员」截图</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={ocrBusy}
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                void handleSubImages(files);
              }}
            />
          </label>

          {subs.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {subs.map((name) => (
                <button
                  key={name}
                  type="button"
                  className="badge hover:border-[var(--line-strong)]"
                  title="点一下从替补里移除"
                  onClick={() => {
                    const next = subs.filter((item) => item !== name);
                    setSubs(next);
                    setPlan((current) =>
                      current ? setSubstitutes(current, next) : current,
                    );
                    setStale(true);
                  }}
                >
                  {name} ×
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[11.5px] text-[var(--muted)]">
              还没有替补：图上「替补队」会留 5 行空白，不会自动拿名单里的人凑。
            </p>
          )}
        </div>
      </section>

      {/* ---------------- 3. 方案 ---------------- */}
      <section className="mb-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <StepBadge n={3} />
          <h2 className="text-[15px] font-semibold">安排方案</h2>
          <span className="text-[12px] text-[var(--muted)]">
            正式 {placed} / {Math.max(slots, OFFICIAL_LIMIT)} 人
            {overflow > 0 ? ` · 还有 ${overflow} 人没排上` : ""}
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
                    {team.grouped &&
                      Array.from(new Set(team.rows.map((row) => row.group ?? ""))).map((group) => (
                        <label key={group} className="block">
                          <span className="mb-1 block text-[11px] text-[var(--muted)]">
                            21:05 · {group}
                          </span>
                          <textarea
                            className="input min-h-[36px] w-full resize-y py-1.5 text-[12px] leading-snug"
                            rows={2}
                            value={team.rows.find((row) => (row.group ?? "") === group)?.startTask ?? ""}
                            onChange={(event) =>
                              updatePlan((current) =>
                                setGroupStartTask(current, teamIndex, group, event.target.value),
                              )
                            }
                          />
                        </label>
                      ))}
                    {(team.grouped ? TASK_LABELS.slice(1) : TASK_LABELS).map((label, offset) => {
                      const taskIndex = (team.grouped ? offset + 1 : offset) as 0 | 1 | 2;
                      return (
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
                                setTeamTask(current, teamIndex, taskIndex, event.target.value),
                              )
                            }
                          />
                        </label>
                      );
                    })}
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
                              "w-[92px] shrink-0 truncate text-[11.5px]",
                              row.lead ? "font-semibold text-[var(--gold)]" : "text-[var(--muted)]",
                            )}
                            title={row.group ? `${row.group} · ${row.label}` : row.label}
                          >
                            {row.group
                              ? `${row.group.replace(/^我方/, "").replace("小粮仓", "")}路 ${row.label}`
                              : row.label}
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
                {plan.substitutes.length} / {SUBSTITUTE_LIMIT}
              </span>
              <span className="text-[11.5px] text-[var(--muted)]">
                只出现在图上（一行两个名字），不参与换人；没传就留白
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {plan.substitutes.length === 0 ? (
                <span className="text-[12px] text-[var(--muted)]">
                  还没有替补：图上替补队会留 5 行空白
                </span>
              ) : (
                plan.substitutes.map((name) => (
                  <span key={name} className="badge">
                    {name}
                  </span>
                ))
              )}
            </div>
          </div>
        )}

        {plan && (unarranged.length > 0 || removed.length > 0) && (
          <div className="card mt-4 p-4">
            {unarranged.length > 0 && (
              <div>
                <span className="text-[11.5px] text-[var(--muted)]">
                  名单里还没排上的（{unarranged.length}
                  {overflow > 0 ? `，其中 ${overflow} 个是超过 30 人名额的` : ""}
                  ）：想安排就从上面对应的下拉里直接选他
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {unarranged.map((name) => (
                    <span key={name} className="badge">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {removed.length > 0 && (
              <div className={unarranged.length > 0 ? "mt-3 border-t border-[var(--line)] pt-2.5" : ""}>
                <span className="text-[11.5px] text-[var(--muted)]">
                  被剔除的名字（不在名单里，不会进方案）：
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {removed.map((name) => (
                    <span key={name} className="badge line-through decoration-[var(--muted)]">
                      {name}
                    </span>
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
