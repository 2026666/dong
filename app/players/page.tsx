"use client";

import { useMemo, useState } from "react";
import { NavBar } from "@/app/components/nav-bar";
import { useApp } from "@/lib/app-context";
import { Users, Plus, Trash2, Edit2, Check, X, Upload, Download } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  buildRosterRows,
  parseRosterTable,
  type RosterColumnMap,
  type RosterTable,
} from "@/lib/roster-parse";

export default function PlayersPage() {
  const { players, addPlayer, removePlayer, updatePlayer, importRoster, clearPlayers } = useApp();
  const [newName, setNewName] = useState("");
  const [newMerit, setNewMerit] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editMerit, setEditMerit] = useState(0);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [mappingOverride, setMappingOverride] = useState<RosterColumnMap | null>(null);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const rosterTable = useMemo(() => parseRosterTable(importText), [importText]);
  const mapping = mappingOverride ?? rosterTable.mapping;
  const previewRows = useMemo(
    () => buildRosterRows(rosterTable, mapping),
    [rosterTable, mapping]
  );

  function handleAdd() {
    if (!newName.trim()) return;
    addPlayer({ name: newName.trim(), merit: newMerit });
    setNewName("");
    setNewMerit(0);
  }

  function startEdit(id: string, name: string, merit: number) {
    setEditingId(id);
    setEditName(name);
    setEditMerit(merit);
  }

  function saveEdit() {
    if (!editingId || !editName.trim()) return;
    updatePlayer(editingId, { name: editName.trim(), merit: editMerit });
    setEditingId(null);
  }

  function handleClearPlayers() {
    if (players.length === 0) return;
    const ok = window.confirm(
      `确定清空全部 ${players.length} 名玩家？\n\n` +
        `· 总名单（名字 / 全服排名 / 功勋）会被删除，不可恢复\n` +
        `· 城战记录会保留；之后重新导入总名单，这些记录会重新参与排名`
    );
    if (!ok) return;
    clearPlayers();
    setImportMsg(null);
    setEditingId(null);
  }

  function handleImport() {
    if (previewRows.length === 0) return;
    importRoster(previewRows);
    const withMerit = previewRows.filter((r) => r.merit !== undefined).length;
    setImportMsg(
      `已导入 ${previewRows.length} 人，其中 ${withMerit} 人带功勋；同分时将按这份功勋排序。`
    );
    setShowImport(false);
    setImportText("");
  }

  function exportTemplate() {
    const template = players
      .map((p) => `${p.rank ?? ""}\t${p.name}\t${p.merit}`)
      .join("\n");
    navigator.clipboard.writeText(template);
  }

  // 按外部排名排序显示
  const sortedPlayers = [...players].sort((a, b) => {
    const rankA = a.rank ?? Infinity;
    const rankB = b.rank ?? Infinity;
    return rankA - rankB;
  });

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[26px] font-semibold flex items-center gap-2">
              <Users className="h-6 w-6" />
              赛季功勋分配
              <span className="text-[15px] font-normal text-[var(--muted)]">
                ({players.length})
              </span>
            </h1>
            <p className="mt-1.5 text-[13px] text-[var(--ink-2)]">
              维护总名单的全服排名与总功勋：功勋不参与计分，只用于总分相同的排序。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowImport(!showImport)}
              className="btn btn-ghost"
            >
              <Upload className="h-4 w-4" />
              导入总名单
            </button>
            <button
              onClick={exportTemplate}
              className="btn btn-ghost"
            >
              <Download className="h-4 w-4" />
              导出模板
            </button>
            <button
              onClick={handleClearPlayers}
              disabled={players.length === 0}
              className="btn btn-danger"
            >
              <Trash2 className="h-4 w-4" />
              一键清除
            </button>
          </div>
        </div>

        {/* 导入总名单 */}
        {showImport && (
          <div className="card p-4 mb-6">
            <h3 className="font-medium mb-2">粘贴总名单</h3>
            <p className="text-xs text-[var(--muted)] mb-3">
              直接从表格里整块复制粘贴（Tab 分隔，带不带表头都行）。会自动认「成员名称 / 总功勋」这类表头列；
              认错了就在下面的下拉框里手动指定。功勋只用于「总分相同时」的排序，不计分。
            </p>
            <textarea
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                // 内容变了就回到自动识别
                setMappingOverride(null);
                setImportMsg(null);
              }}
              placeholder={
                "成员名称\t阶级\t火炉等级\t战力\t周功勋\t总功勋\t周捐献\t实力\n" +
                "1\t超级幸运大将军\t4\t30\t177710018\t598857580\t13083883592\t106040\t70000632"
              }
              rows={6}
              className="input font-mono"
            />

            {importText.trim() && (
              <div className="mt-3">
                <div className="flex flex-wrap items-end gap-3">
                  <ColumnPicker
                    label="名字列"
                    value={mapping.name}
                    table={rosterTable}
                    onChange={(name) => setMappingOverride({ ...mapping, name })}
                  />
                  <ColumnPicker
                    label="名次列"
                    value={mapping.rank}
                    table={rosterTable}
                    onChange={(rank) => setMappingOverride({ ...mapping, rank })}
                  />
                  <ColumnPicker
                    label="功勋列"
                    value={mapping.merit}
                    table={rosterTable}
                    onChange={(merit) => setMappingOverride({ ...mapping, merit })}
                  />
                  <span className="text-xs text-[var(--muted)] mb-1.5">
                    共 {rosterTable.rows.length} 行 · 识别出 {previewRows.length} 人
                    {rosterTable.hasHeader ? "（已跳过表头）" : ""}
                  </span>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">
                  榜单里同时有「周功勋」和「总功勋」时，默认取「总功勋」；需要别的列可以在上面改。
                </p>

                {mapping.name < 0 ? (
                  <p className="mt-3 text-sm text-red-600 dark:text-red-400">
                    没找到名字列，请在上面的「名字列」里手动指定。
                  </p>
                ) : (
                  <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-[var(--line)]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-[var(--surface-2)]">
                        <tr>
                          <th className="px-3 py-1.5 text-left font-medium w-16">名次</th>
                          <th className="px-3 py-1.5 text-left font-medium">玩家名</th>
                          <th className="px-3 py-1.5 text-right font-medium w-32">功勋</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 8).map((r, i) => (
                          <tr key={i} className="border-t border-[var(--line)]">
                            <td className="px-3 py-1.5 text-[var(--muted)]">{r.rank ?? "-"}</td>
                            <td className="px-3 py-1.5">{r.name}</td>
                            <td className="px-3 py-1.5 text-right tabular-nums">
                              {r.merit !== undefined ? r.merit.toLocaleString() : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {previewRows.length > 8 && (
                  <p className="mt-1 text-xs text-[var(--muted)]">仅预览前 8 行，导入时全部生效。</p>
                )}
              </div>
            )}

            <div className="flex gap-2 mt-3">
              <button
                onClick={handleImport}
                disabled={previewRows.length === 0}
                className="btn btn-primary"
              >
                <Check className="h-4 w-4" />
                确认导入 {previewRows.length > 0 ? `（${previewRows.length} 人）` : ""}
              </button>
              <button
                onClick={() => {
                  setShowImport(false);
                  setImportText("");
                }}
                className="btn btn-primary disabled:opacity-40"
              >
                <X className="h-4 w-4" />
                取消
              </button>
            </div>
            {importMsg && (
              <p className="mt-2 text-xs text-green-600 dark:text-green-400">{importMsg}</p>
            )}
          </div>
        )}
        {!showImport && importMsg && (
          <div className="mb-6 rounded-xl border border-[color-mix(in_oklab,#16a34a_30%,transparent)] bg-[color-mix(in_oklab,#16a34a_8%,var(--surface))] px-3 py-2 text-xs text-[color-mix(in_oklab,#15803d_85%,var(--ink))]">
            {importMsg}
          </div>
        )}

        {/* 添加新玩家 */}
        <div className="card p-4 mb-6">
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs text-[var(--muted)] mb-1">玩家名</label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="输入玩家名"
                className="input"
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              />
            </div>
            <div className="w-40">
              <label className="block text-xs text-[var(--muted)] mb-1">总名单功勋</label>
              <input
                type="number"
                value={newMerit}
                onChange={(e) => setNewMerit(+e.target.value)}
                className="input"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4" />
              添加
            </button>
          </div>
        </div>

        {/* 玩家列表 */}
        {players.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--surface)]/50 p-12 text-center text-[var(--muted)]">
            还没有玩家，先添加你的盟成员吧
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="thead border-b border-[var(--line)]">
                  <th className="px-4 py-3 text-left font-medium w-16">#</th>
                  <th className="px-4 py-3 text-left font-medium">玩家名</th>
                  <th className="px-4 py-3 text-right font-medium w-32">外部排名</th>
                  <th className="px-4 py-3 text-right font-medium w-40">总名单功勋</th>
                  <th className="px-4 py-3 w-24"></th>
                </tr>
              </thead>
              <tbody>
                {sortedPlayers.map((p, idx) => (
                  <tr key={p.id} className="border-b border-[var(--line)] transition-colors last:border-0 hover:bg-[var(--surface-2)]">
                    <td className="px-4 py-3 text-[var(--muted)]">{idx + 1}</td>
                    <td className="px-4 py-3">
                      {editingId === p.id ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="input h-8 w-40"
                        />
                      ) : (
                        p.name
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.rank ? (
                        <span className={cn(
                          "inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full text-xs font-medium",
                          p.rank <= 10
                            ? "bg-[color-mix(in_oklab,#a9761c_16%,transparent)] text-[var(--gold)]"
                            : p.rank <= 50
                              ? "bg-[var(--surface-2)] text-[var(--ink)]"
                              : "bg-transparent text-[var(--muted)]"
                        )}>
                          {p.rank}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--muted)]">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === p.id ? (
                        <input
                          type="number"
                          value={editMerit}
                          onChange={(e) => setEditMerit(+e.target.value)}
                          className="input h-8 w-28 text-right tabular-nums"
                        />
                      ) : (
                        <span className="tabular-nums">{p.merit.toLocaleString()}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === p.id ? (
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={saveEdit}
                            className="rounded-lg p-1.5 text-[var(--ink)] hover:bg-[var(--surface-2)]"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <button
                            onClick={() => startEdit(p.id, p.name, p.merit)}
                            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => removePlayer(p.id)}
                            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[color-mix(in_oklab,#dc2626_10%,transparent)] hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-4 text-xs text-[var(--muted)]">
          提示：上传识别只认名字，保存城战记录时会自动把新名字补到这里，但不会改动已有玩家的功勋和排名。
          功勋不参与计分，只用于「总分相同」时的排序。
        </p>
      </main>
    </div>
  );
}

/** 选择「第几列」是名字/名次/功勋 */
function ColumnPicker({
  label,
  value,
  table,
  onChange,
}: {
  label: string;
  value: number;
  table: RosterTable;
  onChange: (next: number) => void;
}) {
  const sampleRow = table.rows[0] ?? [];
  // 表头通常比数据行少一个「行首序号」列，这里换算回表头下标
  const offset = table.hasHeader
    ? Math.max(0, table.columnCount - table.header.length)
    : 0;
  return (
    <label className="flex items-center gap-1.5 text-xs text-[var(--ink-2)]">
      <span className="text-[var(--muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="input w-auto px-2 py-1 text-xs"
      >
        <option value={-1}>不使用</option>
        {Array.from({ length: table.columnCount }, (_, i) => {
          const head = table.header[i - offset];
          const sample = head || sampleRow[i];
          return (
            <option key={i} value={i}>
              第 {i + 1} 列{sample ? `（${sample}）` : ""}
            </option>
          );
        })}
      </select>
    </label>
  );
}
