"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavBar } from "@/app/components/nav-bar";
import { useApp } from "@/lib/app-context";
import { useDropzone } from "react-dropzone";
import { Upload, Loader2, FileText, AlertTriangle, Save, Plus, X, RotateCcw } from "lucide-react";
import type { Participant } from "@/lib/types";
import { parseOcrText } from "@/lib/ocr-parser";
import { recognizeImage, type OcrProgress } from "@/lib/ocr-service";
import { cn } from "@/lib/cn";

export default function UploadPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <UploadView />
      </main>
    </div>
  );
}

/** 合并多张截图的解析结果：同名玩家只保留一条（识别只认名字，不认功勋） */
function mergeParsed(list: Participant[]): Participant[] {
  const map = new Map<string, Participant>();
  for (const p of list) {
    if (!map.has(p.playerName)) map.set(p.playerName, { ...p });
  }
  return Array.from(map.values());
}

function UploadView() {
  const { addBattle, config, ensurePlayer, players } = useApp();
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [images, setImages] = useState<{ url: string; text: string }[]>([]);
  const [ocrText, setOcrText] = useState("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const [date, setDate] = useState("");
  const [cityName, setCityName] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** 本次识别里被当成盟名/表头剔除掉的片段 */
  const [strippedAnchors, setStrippedAnchors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 总名单里的名字，用来标出「不在名单里」的可疑识别结果（多半是 UI 文字误识别） */
  const rosterNames = useMemo(
    () => new Set(players.map((p) => p.name.trim())),
    [players]
  );
  const offRoster = useMemo(
    () =>
      participants.filter((p) => {
        const name = p.playerName.trim();
        return name.length > 0 && !rosterNames.has(name);
      }),
    [participants, rosterNames]
  );
  const offRosterNames = new Set(offRoster.map((p) => p.playerName.trim()));

  useEffect(() => {
    setDate(new Date().toISOString().slice(0, 10));
  }, []);

  // 组件卸载时统一清理 blob URL（避免预览图在累加过程中被提前回收）
  const imagesRef = useRef(images);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);
  useEffect(() => {
    return () => {
      imagesRef.current.forEach((img) => {
        if (img.url.startsWith("blob:")) URL.revokeObjectURL(img.url);
      });
    };
  }, []);

  /** 把解析结果填进参与者列表；解析不到时按行兜底（只保留像名字的行） */
  const fillParticipants = useCallback((parsed: Participant[], text: string) => {
    console.log("[Upload] 解析结果:", parsed.length, "个玩家", parsed);
    if (parsed.length > 0) {
      setParticipants(parsed);
      return;
    }
    // 解析不到时，退化为按行填充，方便手动修正
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 1)
      // 纯数字行（排名/功勋）、以及只有数字和符号的行不可能是名字
      .filter((l) => !/^[\d\s.,，+%]+$/.test(l))
      // 去掉开头的名次数字和 [盟名] 前缀
      .map((l) => l.replace(/^\s*\d+\s*/, "").replace(/^\[[^\]]*\]\s*/, "").trim())
      .filter((l) => l.length > 1);
    setParticipants(
      lines.map((line) => ({
        playerId: line,
        playerName: line,
        merit: 0,
        headCarTypeIds: [],
      }))
    );
  }, []);

  const processAndRecognize = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
    console.log("[Upload] 收到文件:", files.map((f) => f.name));
    setError(null);

    // 清理旧的 blob URL
    images.forEach((img) => {
      if (img.url.startsWith("blob:")) URL.revokeObjectURL(img.url);
    });
    setImages([]);
    setIsRecognizing(true);
    setProgress(0);

    const done: { url: string; text: string }[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const prefix = files.length > 1 ? `第 ${i + 1}/${files.length} 张 · ` : "";
        setProgressStage(`${prefix}正在加载 PaddleOCR 模型（首次较慢）...`);

        const text = await recognizeImage(file, (p: OcrProgress) => {
          setProgress(Math.round(((i + p.percent / 100) / files.length) * 100));
          if (p.stage === "downloading") setProgressStage(`${prefix}下载模型文件（首次较慢）...`);
          else if (p.stage === "initializing") setProgressStage(`${prefix}初始化引擎...`);
          else if (p.stage === "recognizing") setProgressStage(`${prefix}识别中...`);
        });

        console.log(`[Upload] 第 ${i + 1} 张识别完成，文本长度:`, text.length);
        done.push({ url: URL.createObjectURL(file), text });
        setImages([...done]);
      }

      const combined = done.map((d) => d.text).join("\n");
      console.log("[Upload] 全部 OCR 原始文本:", JSON.stringify(combined.slice(0, 500)));

      setOcrText(combined);
      // 每张图单独解析后合并，避免跨图重复；识别只认名字，功勋不计
      // 传入总名单：能纠正 OCR 错字，并让反复出现的盟名被识别出来剥掉
      const knownNames = players.map((p) => p.name);
      const found = new Set<string>();
      const merged = mergeParsed(
        done.flatMap((d) =>
          parseOcrText(d.text, {
            knownNames,
            allianceName: config.allianceName,
            onAnchors: (as) => as.forEach((a) => found.add(a)),
          })
        )
      );
      setStrippedAnchors([...found]);
      fillParticipants(merged, combined);
      setIsRecognizing(false);
      setStep("review");
    } catch (e) {
      console.error("[Upload] OCR 失败:", e);
      setError("OCR 识别失败，请重试或手动输入。详情看浏览器控制台 F12");
      setIsRecognizing(false);
    }
  }, [images, fillParticipants, players, config.allianceName]);

  const onDropAccepted = useCallback(
    (files: File[]) => {
      if (files.length > 0) processAndRecognize(files);
    },
    [processAndRecognize]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDropAccepted,
    accept: { "image/*": [] },
    multiple: true,
    disabled: isRecognizing,
    onDropRejected: (rejections) => {
      console.warn("[Upload] 文件被拒绝:", rejections);
      setError("文件格式不支持，请选择 PNG 或 JPG 图片");
    },
  });

  function onNativeFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) processAndRecognize(files);
    e.target.value = "";
  }

  function resetToUpload() {
    images.forEach((img) => {
      if (img.url.startsWith("blob:")) URL.revokeObjectURL(img.url);
    });
    setStep("upload");
    setImages([]);
    setOcrText("");
    setParticipants([]);
    setCityName("");
    setDate(new Date().toISOString().slice(0, 10));
    setError(null);
    setProgress(0);
    setProgressStage("");
    setStrippedAnchors([]);
  }

  function applyParsedText(text: string) {
    const found = new Set<string>();
    fillParticipants(
      mergeParsed(
        parseOcrText(text, {
          knownNames: players.map((p) => p.name),
          allianceName: config.allianceName,
          onAnchors: (as) => as.forEach((a) => found.add(a)),
        })
      ),
      text
    );
    setStrippedAnchors([...found]);
  }

  function parseText() {
    applyParsedText(ocrText);
  }

  function addManualRow() {
    setParticipants((prev) => [
      ...prev,
      {
        playerId: `manual-${Date.now()}`,
        playerName: "",
        merit: 0,
        headCarTypeIds: [],
      },
    ]);
  }

  function updateParticipant(idx: number, patch: Partial<Participant>) {
    setParticipants((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, ...patch } : p))
    );
  }

  function removeParticipant(idx: number) {
    setParticipants((prev) => prev.filter((_, i) => i !== idx));
  }

  /** 一键清掉「不在总名单」的行：它们几乎都是界面文字被误识别出来的 */
  function removeOffRoster() {
    setParticipants((prev) =>
      prev.filter((p) => rosterNames.has(p.playerName.trim()))
    );
  }

  function toggleHeadCar(idx: number, hcId: string) {
    setParticipants((prev) =>
      prev.map((p, i) => {
        if (i !== idx) return p;
        const has = p.headCarTypeIds.includes(hcId);
        return {
          ...p,
          headCarTypeIds: has
            ? p.headCarTypeIds.filter((x) => x !== hcId)
            : [...p.headCarTypeIds, hcId],
        };
      })
    );
  }

  function handleSave() {
    const named = participants.filter((p) => p.playerName.trim());
    // 开启「只保留总名单里的人」时，把不在总名单的行（多为界面文字误识别）丢掉
    const valid = config.onlyRosterParticipants
      ? named.filter((p) => rosterNames.has(p.playerName.trim()))
      : named;

    if (valid.length === 0) {
      window.alert(
        named.length === 0
          ? "还没有任何玩家，先识别或手动添加。"
          : `已开启「只保留总名单里的人」，但这 ${named.length} 个人都不在总名单里，没有可保存的参战者。`
      );
      return;
    }

    const dropped = named.length - valid.length;
    if (
      dropped > 0 &&
      !window.confirm(
        `有 ${dropped} 人不在总名单，保存时会被丢弃；本次保存 ${valid.length} 人。继续吗？`
      )
    ) {
      return;
    }

    // 只在总名单里缺这个玩家时补一条；已有玩家保留总名单里的功勋/排名不动
    for (const part of valid) {
      ensurePlayer(part.playerName.trim());
    }
    addBattle({
      date,
      cityName: cityName || "未命名城池",
      participants: valid.map((p) => ({ ...p, playerName: p.playerName.trim() })),
      screenshotDataUrl: images[0]?.url,
      rawOcrText: ocrText,
    });
    resetToUpload();
  }

  // ============ Step 1: 上传 ============
  if (step === "upload") {
    return (
      <div>
        <h1 className="text-[26px] font-semibold mb-2 flex items-center gap-2">
          <Upload className="h-6 w-6" />
          上传城战截图
        </h1>
                <p className="text-sm text-[var(--ink-2)] mb-6">
          支持 PNG / JPG，OCR 在浏览器本地运行，不上传服务器
        </p>

        {/* 拖拽上传区 */}
        <div
          {...getRootProps()}
          className={cn(
            "rounded-2xl border border-dashed p-12 text-center cursor-pointer bg-[var(--surface)] mb-4 transition-colors",
            isRecognizing && "pointer-events-none opacity-60",
            isDragActive
              ? "border-[var(--ink-2)] bg-[var(--surface-2)]"
              : "border-[var(--line-strong)] hover:border-[var(--ink-2)] hover:bg-[var(--surface-2)]"
          )}
        >
          <input {...getInputProps()} />
          {isRecognizing ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-9 w-9 text-[var(--ink-2)] animate-spin" />
              <p className="font-medium">{progressStage || "OCR 识别中..."} {progress}%</p>
              <div className="w-64 h-1.5 bg-[var(--surface-2)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--btn-bg)] transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-[var(--muted)]">PaddleOCR 在浏览器本地运行，首次加载模型较慢</p>
            </div>
          ) : (
            <>
              <Upload className="mx-auto h-11 w-11 text-[var(--muted)] mb-4" />
              <p className="text-lg font-medium mb-1">
                {isDragActive ? "松开上传" : "点击或拖拽多张截图到这里"}
              </p>
              <p className="text-sm text-[var(--muted)]">
                支持参战名单 / 功勋榜截图，只识别玩家名字（功勋走总名单，不读截图）
              </p>
            </>
          )}
        </div>

        {/* 备份：原生文件选择按钮 + 选项 */}
        <div className="flex items-center justify-center gap-3 flex-wrap">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isRecognizing}
            className="btn btn-primary"
          >
            <Upload className="h-4 w-4" />
            选择本地图片（可多选）
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={onNativeFileChange}
          />
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mt-4 rounded-md border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-3">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============ Step 2: 审核 ============
  return (
    <div>
      <h1 className="text-[26px] font-semibold mb-6">审核识别结果</h1>

      {strippedAnchors.length > 0 && (
        <p className="mb-4 rounded-md bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
          已自动剔除疑似盟名/表头：{strippedAnchors.join("、")}（这些片段在大部分行里重复出现，不是玩家名）
        </p>
      )}

      {/* 基本信息 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--ink-2)]">城池名</label>
          <input
            type="text"
            value={cityName}
            onChange={(e) => setCityName(e.target.value)}
            placeholder="如：虎牢关"
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--ink-2)]">日期</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={parseText}
            disabled={!ocrText.trim()}
            className="btn btn-primary"
          >
            <FileText className="h-4 w-4" />
            从 OCR 文本解析
          </button>
          <button
            onClick={resetToUpload}
            className="btn btn-ghost"
          >
            <RotateCcw className="h-4 w-4" />
            重新上传
          </button>
        </div>
      </div>

      {/* 截图预览 */}
      {images.length > 0 && (
        <div className="mb-4 flex gap-3 overflow-x-auto pb-2">
          {images.map((img, i) => (
            <div key={i} className="shrink-0 relative">
              <img
                src={img.url}
                alt={`截图 ${i + 1}`}
                className="max-h-56 rounded-xl border border-[var(--line)]"
              />
              <span className="absolute top-1 left-1 rounded bg-black/60 text-white text-xs px-1.5 py-0.5">
                {i + 1}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 参与者编辑表 */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">参与者列表 ({participants.length})</h2>
          <p className="text-xs text-[var(--muted)]">
            识别结果只有名字；功勋不计分、也不从截图读取，同分排序用的是「赛季功勋分配」里导入的总名单功勋
          </p>
        </div>
        <div className="flex items-center gap-2">
          {config.onlyRosterParticipants && (
            <span className="badge bg-[var(--surface-2)]">
              保存时只留总名单里的人
            </span>
          )}
          {offRoster.length > 0 && (
            <button
              onClick={removeOffRoster}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[color-mix(in_oklab,#a9761c_35%,transparent)] px-3 py-1.5 text-sm text-[var(--gold)] hover:bg-[color-mix(in_oklab,#a9761c_10%,transparent)]"
            >
              <AlertTriangle className="h-4 w-4" />
              移除不在总名单的 {offRoster.length} 人
            </button>
          )}
          <button
            onClick={addManualRow}
            className="btn btn-ghost"
          >
            <Plus className="h-4 w-4" />
            手动添加
          </button>
        </div>
      </div>

      <div className="card overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="thead border-b border-[var(--line)]">
                <th className="px-3 py-2 text-left font-medium">玩家名</th>
                <th className="px-3 py-2 text-left font-medium">车头标记</th>
                <th className="px-3 py-2 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p, idx) => (
                <tr key={idx} className="border-b border-[var(--line)] transition-colors last:border-0 hover:bg-[var(--surface-2)]">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={p.playerName}
                        onChange={(e) => updateParticipant(idx, { playerName: e.target.value })}
                        className="w-full rounded-md bg-transparent px-2 py-1 focus:bg-[var(--surface-2)] outline-none"
                      />
                      {offRosterNames.has(p.playerName.trim()) && (
                        <span className="shrink-0 rounded-full border border-[color-mix(in_oklab,#a9761c_35%,transparent)] px-1.5 py-0.5 text-[11px] text-[var(--gold)]">
                          不在总名单
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {config.headCarTypes.map((hc) => {
                        const active = p.headCarTypeIds.includes(hc.id);
                        return (
                          <button
                            key={hc.id}
                            onClick={() => toggleHeadCar(idx, hc.id)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                              active
                                ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-[var(--shadow-sm)]"
                                : "bg-[var(--surface-2)] text-[var(--ink-2)] hover:bg-[var(--line)] hover:text-[var(--ink)]"
                            )}
                            title={`${hc.name} +${hc.bonusScore}分`}
                          >
                            {hc.name}
                            <span className="opacity-70">+{hc.bonusScore}</span>
                          </button>
                        );
                      })}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => removeParticipant(idx)}
                      className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[color-mix(in_oklab,#dc2626_10%,transparent)] hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {participants.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-10 text-center text-[var(--muted)]">
                    暂无参与者，点「从 OCR 文本解析」或「手动添加」
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 保存按钮 */}
      <div className="flex justify-end gap-3">
        <button
          onClick={resetToUpload}
          className="btn btn-ghost"
        >
          取消
        </button>
        <button
          onClick={handleSave}
          disabled={participants.length === 0}
          className="btn btn-primary"
        >
          <Save className="h-4 w-4" />
          保存城战记录
        </button>
      </div>
    </div>
  );
}
