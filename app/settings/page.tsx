"use client";

import { NavBar } from "@/app/components/nav-bar";
import { useApp } from "@/lib/app-context";
import { Settings, Plus, Trash2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

export default function SettingsPage() {
  const { config, updateConfig, clearAll } = useApp();
  const [newHcName, setNewHcName] = useState("");
  const [newHcBonus, setNewHcBonus] = useState(1);

  function addHeadCarType() {
    if (!newHcName.trim()) return;
    updateConfig({
      headCarTypes: [
        ...config.headCarTypes,
        {
          id: `hc-${Date.now()}`,
          name: newHcName.trim(),
          bonusScore: newHcBonus,
        },
      ],
    });
    setNewHcName("");
    setNewHcBonus(1);
  }

  function updateHeadCarBonus(id: string, bonus: number) {
    updateConfig({
      headCarTypes: config.headCarTypes.map((t) =>
        t.id === id ? { ...t, bonusScore: bonus } : t
      ),
    });
  }

  function updateHeadCarName(id: string, name: string) {
    updateConfig({
      headCarTypes: config.headCarTypes.map((t) =>
        t.id === id ? { ...t, name } : t
      ),
    });
  }

  function removeHeadCarType(id: string) {
    updateConfig({
      headCarTypes: config.headCarTypes.filter((t) => t.id !== id),
    });
  }

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-[26px] font-semibold mb-6 flex items-center gap-2">
          <Settings className="h-6 w-6" />
          规则配置
        </h1>

        <div className="space-y-6">
          {/* 基本信息 */}
          <Section title="基本信息">
            <div className="space-y-4">
              <Field label="盟名称">
                <input
                  type="text"
                  value={config.allianceName}
                  onChange={(e) => updateConfig({ allianceName: e.target.value })}
                  className="input max-w-xs"
                />
              </Field>
              <div className="text-xs text-[var(--muted)]">
                当前规则版本：<code>{config.ruleVersion}</code>（修改下方分数相关设置后自动递增）
              </div>
            </div>
          </Section>

          {/* 分数规则 */}
          <Section title="分数规则">
            <div className="space-y-4">
              <Field label="参加一次城战基础分" hint="每次参加一场城战就加这个分数">
                <input
                  type="number"
                  value={config.baseScorePerBattle}
                  onChange={(e) => updateConfig({ baseScorePerBattle: +e.target.value })}
                  className="input w-24 text-right tabular-nums"
                />
                <span className="text-sm text-[var(--ink-2)] ml-2">分 / 场</span>
              </Field>
              <Field label="功勋" hint="功勋不参与计分：上传识别只认名字，功勋取「赛季功勋分配」里导入的总名单，仅用于总分相同时的排序">
                <span className="text-sm text-[var(--ink-2)]">不参与计分（仅同分排序用）</span>
              </Field>
              <Field label="同分排序规则" hint="总分相同时：先比总名单功勋（高者靠前），功勋也相同再看全服排名，最后看参与场次">
                <span className="text-sm text-[var(--ink-2)]">总名单功勋 → 全服排名 → 参与场次</span>
              </Field>
              <Field label="多车头叠加方式">
                <div className="flex gap-2">
                  {(["stack", "max"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => updateConfig({ headCarBonusMode: mode })}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm font-medium",
                        config.headCarBonusMode === mode
                          ? "border-transparent bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-[var(--shadow-sm)]"
                          : "border-[var(--line)] text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                      )}
                    >
                      {mode === "stack" ? "叠加（每个车头加分都算）" : "取最高"}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </Section>

          {/* 车头类型 */}
          <Section title="车头类型与加分" description="可以根据需要添加/删除车头类型，每种类型可以单独设置加分">
            <div className="space-y-3">
              {config.headCarTypes.map((hc) => (
                <div
                  key={hc.id}
                  className="flex items-center gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3"
                >
                  <input
                    type="text"
                    value={hc.name}
                    onChange={(e) => updateHeadCarName(hc.id, e.target.value)}
                    className="flex-1 rounded-md bg-transparent px-2 py-1 text-sm focus:bg-[var(--surface-2)] outline-none"
                  />
                  <span className="text-sm text-[var(--ink-2)]">加分</span>
                  <input
                    type="number"
                    value={hc.bonusScore}
                    onChange={(e) => updateHeadCarBonus(hc.id, +e.target.value)}
                    className="input w-20 text-right tabular-nums"
                  />
                  <button
                    onClick={() => removeHeadCarType(hc.id)}
                    className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[color-mix(in_oklab,#dc2626_10%,transparent)] hover:text-red-600"
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}

              {/* 添加新车头类型 */}
              <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--line-strong)] p-3">
                <input
                  type="text"
                  value={newHcName}
                  onChange={(e) => setNewHcName(e.target.value)}
                  placeholder="新车头类型名"
                  className="flex-1 rounded-md bg-transparent px-2 py-1 text-sm focus:bg-[var(--surface-2)] outline-none"
                />
                <span className="text-sm text-[var(--ink-2)]">加分</span>
                <input
                  type="number"
                  value={newHcBonus}
                  onChange={(e) => setNewHcBonus(+e.target.value)}
                  className="input w-20 text-right tabular-nums"
                />
                <button
                  onClick={addHeadCarType}
                  disabled={!newHcName.trim()}
                  className="btn btn-primary disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                  添加
                </button>
              </div>
            </div>
          </Section>

          {/* 上传识别 */}
          <Section
            title="上传识别"
            description="OCR 只认名字；截图里的界面文字、水印偶尔会被认成玩家名"
          >
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={config.onlyRosterParticipants ?? false}
                  onChange={(e) =>
                    updateConfig({ onlyRosterParticipants: e.target.checked })
                  }
                  className="mt-0.5 h-4 w-4 rounded accent-[var(--btn-bg)]"
                />
                <span>
                  <span className="text-sm font-medium">
                    保存时只保留总名单里的人
                  </span>
                  <span className="mt-1 block text-xs text-[var(--muted)]">
                    打开后，识别结果里不在总名单的人会在保存时被丢掉，不用手动逐个删。
                    代价：新入盟、还没导入总名单的人也会被丢掉——先更新总名单再开这个开关。
                  </span>
                </span>
              </label>
            </div>
          </Section>

          {/* 危险区 */}
          <Section title="危险操作" description="以下操作不可恢复">
            <button
              onClick={() => {
                if (confirm("确定要清空所有数据并恢复默认配置吗？")) {
                  clearAll();
                }
              }}
              className="btn btn-danger"
            >
              <RefreshCw className="h-4 w-4" />
              清空所有数据并恢复默认配置
            </button>
          </Section>
        </div>
      </main>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-5">
      <h2 className="text-[15px] font-semibold mb-1">{title}</h2>
      {description && (
        <p className="text-xs text-[var(--muted)] mb-4">{description}</p>
      )}
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--ink-2)] mb-1.5">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-[var(--muted)] mt-1">{hint}</p>}
    </div>
  );
}
