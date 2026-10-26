"use client";

import Link from "next/link";
import { NavBar } from "@/app/components/nav-bar";
import { useApp } from "@/lib/app-context";
import {
  Trophy,
  Swords,
  Users,
  Download,
  Medal,
  Crown,
  Upload,
} from "lucide-react";
import { exportRankingsToExcel } from "@/lib/export-excel";
import { cn } from "@/lib/cn";

export default function RankPage() {
  const { rankings, battles, players, config } = useApp();
  const scored = rankings.filter((r) => r.totalScore > 0).length;

  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--muted)]">
              Alliance Ranking
            </p>
            <h1 className="text-[26px] font-semibold leading-tight sm:text-[30px]">
              {config.allianceName}
              <span className="ml-2 text-[var(--muted)] font-normal">
                · 城战积分排名
              </span>
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-[12px] text-[var(--ink-2)]">
              <span className="badge">规则 {config.ruleVersion}</span>
              <span className="badge">基础分 {config.baseScorePerBattle}/场</span>
              <span className="badge">同分按总名单功勋</span>
            </div>
          </div>
        </div>

        {/* 统计 */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="盟成员"
            value={players.length}
          />
          <StatCard
            icon={<Swords className="h-4 w-4" />}
            label="城战场次"
            value={battles.length}
          />
          <StatCard
            icon={<Medal className="h-4 w-4" />}
            label="有分数玩家"
            value={scored}
          />
          <StatCard
            icon={<Crown className="h-4 w-4" />}
            label="当前第一"
            value={rankings[0]?.playerName ?? "—"}
            highlight
          />
        </div>

        <div className="mb-4 flex items-end justify-between gap-4">
          <h2 className="text-base font-semibold">总排行榜</h2>
          {rankings.length > 0 && (
            <button
              onClick={() => exportRankingsToExcel(rankings, config.allianceName)}
              className="btn btn-ghost"
            >
              <Download className="h-4 w-4" />
              导出 Excel
            </button>
          )}
        </div>

        {rankings.length === 0 ? <EmptyState /> : <RankTable />}
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="card card-lift p-4 sm:p-5">
      <div className="flex items-center gap-2 text-[var(--muted)]">
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-md",
            highlight
              ? "bg-[color-mix(in_oklab,var(--gold)_14%,transparent)] text-[var(--gold)]"
              : "bg-[var(--surface-2)]"
          )}
        >
          {icon}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em]">
          {label}
        </span>
      </div>
      <div
        className={cn(
          "mt-3 truncate text-[26px] font-semibold leading-none tracking-tight tabular-nums",
          highlight && "text-[var(--gold)] text-[20px] sm:text-[22px]"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function RankTable() {
  const { rankings } = useApp();

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead className="thead">
            <tr className="border-b border-[var(--line)]">
              <th className="w-16 px-4 py-3 text-left font-medium">排名</th>
              <th className="px-4 py-3 text-left font-medium">玩家</th>
              <th className="w-24 px-4 py-3 text-right font-medium">全服排名</th>
              <th className="px-4 py-3 text-right font-medium">总名单功勋</th>
              <th className="w-20 px-4 py-3 text-right font-medium">场次</th>
              <th className="w-20 px-4 py-3 text-right font-medium">基础分</th>
              <th className="w-24 px-4 py-3 text-right font-medium">车头加分</th>
              <th className="w-24 px-4 py-3 text-right font-medium">总分</th>
            </tr>
          </thead>
          <tbody>
            {rankings.map((r) => (
              <tr
                key={r.playerId}
                className="group border-b border-[var(--line)] transition-colors last:border-0 hover:bg-[var(--surface-2)]"
              >
                <td className="px-4 py-3">
                  <RankBadge rank={r.rank} />
                </td>
                <td className="px-4 py-3">
                  <span className="font-medium">{r.playerName}</span>
                  {r.headCarScore > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-full border border-[color-mix(in_oklab,var(--gold)_38%,transparent)] px-1.5 py-0.5 align-middle text-[10px] font-medium leading-none tracking-[0.08em] text-[var(--gold)]">
                      车头
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {r.externalRank ? (
                    <span
                      className={cn(
                        "text-[13px]",
                        r.externalRank <= 10
                          ? "font-medium text-[var(--gold)]"
                          : "text-[var(--ink-2)]"
                      )}
                    >
                      {r.externalRank}
                    </span>
                  ) : (
                    <span className="text-[var(--muted)]">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--ink-2)]">
                  {r.merit.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--ink-2)]">
                  {r.battleCount}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--muted)]">
                  {r.baseScore}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right tabular-nums",
                    r.headCarScore > 0
                      ? "text-[var(--gold)]"
                      : "text-[var(--muted)]"
                  )}
                >
                  {r.headCarScore > 0 ? `+${r.headCarScore}` : "—"}
                </td>
                <td className="px-4 py-3 text-right text-[15px] font-semibold tabular-nums">
                  {r.totalScore}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const medal =
    rank === 1
      ? "bg-[color-mix(in_oklab,var(--gold)_16%,transparent)] text-[var(--gold)] ring-[color-mix(in_oklab,var(--gold)_45%,transparent)]"
      : rank === 2
        ? "bg-[var(--surface-2)] text-[var(--ink-2)] ring-[var(--line-strong)]"
        : rank === 3
          ? "bg-[color-mix(in_oklab,#b87333_14%,transparent)] text-[#a05f28] ring-[color-mix(in_oklab,#b87333_40%,transparent)]"
          : "bg-transparent text-[var(--muted)] ring-transparent";

  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-full text-[12px] font-semibold tabular-nums ring-1 ring-inset",
        medal
      )}
    >
      {rank}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--surface)]/50 px-6 py-16 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--muted)]">
        <Trophy className="h-6 w-6" strokeWidth={1.6} />
      </span>
      <h3 className="text-base font-semibold">还没有数据</h3>
      <p className="mt-1.5 max-w-sm text-[13px] text-[var(--ink-2)]">
        先导入总名单，再上传城战截图识别参战成员，排名会实时计算。
      </p>
      <div className="mt-5 flex flex-wrap justify-center gap-2">
        <Link href="/players" className="btn btn-primary">
          <Users className="h-4 w-4" />
          导入总名单
        </Link>
        <Link href="/upload" className="btn btn-ghost">
          <Upload className="h-4 w-4" />
          上传截图
        </Link>
      </div>
    </div>
  );
}
