"use client";

/**
 * 管理控制台（仅 role = admin 可见）
 * ---------------------------------------------------------------------------
 * 数据来自 Supabase 的 `admin_stats()` 函数（security definer，函数内部再次校验
 * 调用者角色，非管理员会抛 not authorized）。
 * 普通用户即使手输 /console 也只会看到一个「页面不存在」的提示。
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Database,
  Loader2,
  RefreshCw,
  Trophy,
  UserPlus,
  Users,
  Eye,
} from "lucide-react";
import { useAuth } from "@/lib/auth-provider";
import { getSupabase } from "@/lib/supabase";

interface DayPoint {
  day: string;
  count: number;
}

interface StatUser {
  id: string;
  username: string;
  role: "member" | "admin";
  createdAt: string;
  lastSeenAt: string | null;
  players: number;
  battles: number;
  bytes: number;
}

interface AdminStats {
  today: { registrations: number; views: number; visitors: number };
  total: {
    registrations: number;
    users: number;
    views: number;
    battles: number;
    dataBytes: number;
  };
  yesterday: { registrations: number; views: number };
  registrationTrend: DayPoint[];
  viewTrend: DayPoint[];
  topPaths: { path: string; count: number }[];
  users: StatUser[];
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDay(day: string): string {
  // "2026-10-28" → "10-28"
  const parts = day.split("-");
  return parts.length === 3 ? `${parts[1]}-${parts[2]}` : day;
}

export default function ConsoleClient() {
  const { profile, isLoading: authLoading } = useAuthState();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = profile?.role === "admin";

  const load = useCallback(async () => {
    const { data, error: rpcError } = await getSupabase().rpc("admin_stats");
    if (rpcError) {
      setError(rpcError.message);
      setStats(null);
      return;
    }
    setError(null);
    setStats((data ?? null) as AdminStats | null);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) {
      // 非管理员不需要请求统计，放到微任务里避免同步 setState
      queueMicrotask(() => setFetching(false));
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      void load().finally(() => {
        if (!cancelled) setFetching(false);
      });
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, isAdmin, load]);

  const maxTrend = useMemo(() => {
    if (!stats) return 1;
    const values = [
      ...stats.registrationTrend.map((p) => p.count),
      ...stats.viewTrend.map((p) => p.count),
    ];
    return Math.max(1, ...values);
  }, [stats]);

  async function handleRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (authLoading) return <FullScreenHint text="正在校验权限…" />;

  // 非管理员：表现成「页面不存在」
  if (!isAdmin) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--surface-2)] text-[var(--muted)]">
          <BarChart3 className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-semibold">页面不存在</h1>
        <p className="max-w-sm text-sm text-[var(--ink-2)]">
          你访问的地址没有对应内容。
        </p>
        <Link href="/zhu" className="btn btn-ghost mt-2">
          <ArrowLeft className="h-4 w-4" />
          返回工作台
        </Link>
      </main>
    );
  }

  const loading = fetching;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
      {/* 顶部 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
            Admin Console
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">
            控制台
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-2)]">
            {profile.username} · 管理员
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn btn-ghost"
          >
            <RefreshCw
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            刷新
          </button>
          <Link href="/zhu" className="btn btn-primary">
            返回工作台
          </Link>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-[color-mix(in_oklab,#dc2626_28%,transparent)] bg-[color-mix(in_oklab,#dc2626_8%,transparent)] px-4 py-3 text-sm text-[#b91c1c]"
        >
          读取统计失败：{error}
        </p>
      )}

      {loading ? (
        <div className="mt-10 flex items-center gap-2 text-sm text-[var(--ink-2)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          正在读取统计数据…
        </div>
      ) : (
        stats && (
          <>
            {/* KPI */}
            <section className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Kpi
                icon={<UserPlus className="h-4 w-4" />}
                label="今日注册"
                value={stats.today.registrations}
                hint={`累计 ${stats.total.registrations} 人`}
              />
              <Kpi
                icon={<Users className="h-4 w-4" />}
                label="账号总数"
                value={stats.total.users}
                hint={`管理员 ${stats.users.filter((u) => u.role === "admin").length} 人`}
              />
              <Kpi
                icon={<Eye className="h-4 w-4" />}
                label="今日访问"
                value={stats.today.views}
                hint={`访客 ${stats.today.visitors} 人 · 累计 ${stats.total.views}`}
              />
              <Kpi
                icon={<Database className="h-4 w-4" />}
                label="云端数据量"
                value={formatBytes(stats.total.dataBytes)}
                hint={`累计战报 ${stats.total.battles} 场`}
                raw
              />
            </section>

            {/* 趋势 */}
            <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <TrendCard
                title="近 7 日注册"
                icon={<UserPlus className="h-4 w-4" />}
                points={stats.registrationTrend}
                max={maxTrend}
                accent="gold"
              />
              <TrendCard
                title="近 7 日访问"
                icon={<BarChart3 className="h-4 w-4" />}
                points={stats.viewTrend}
                max={maxTrend}
                accent="ink"
              />
            </section>

            {/* 页面热度 + 概览 */}
            <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
              <div className="card overflow-hidden">
                <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
                  <h2 className="text-sm font-medium">页面热度（近 7 日）</h2>
                  <span className="text-[11px] text-[var(--muted)]">PV</span>
                </div>
                {stats.topPaths.length === 0 ? (
                  <Empty text="还没有访问记录" />
                ) : (
                  <ul className="divide-y divide-[var(--line)]">
                    {stats.topPaths.map((item) => {
                      const max = Math.max(
                        1,
                        ...stats.topPaths.map((p) => p.count)
                      );
                      return (
                        <li
                          key={item.path}
                          className="flex items-center gap-3 px-5 py-2.5"
                        >
                          <span className="w-40 shrink-0 truncate font-mono text-[13px]">
                            {item.path}
                          </span>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
                            <span
                              className="block h-full rounded-full bg-[var(--gold)]"
                              style={{
                                width: `${Math.max(4, (item.count / max) * 100)}%`,
                              }}
                            />
                          </span>
                          <span className="w-10 shrink-0 text-right text-[13px] tabular-nums text-[var(--ink-2)]">
                            {item.count}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="card p-5">
                <h2 className="text-sm font-medium">今日概览</h2>
                <dl className="mt-4 space-y-3 text-sm">
                  <SummaryRow
                    label="今日注册"
                    value={stats.today.registrations}
                    prev={stats.yesterday.registrations}
                  />
                  <SummaryRow
                    label="今日访问"
                    value={stats.today.views}
                    prev={stats.yesterday.views}
                  />
                  <SummaryRow
                    label="今日访客（去重）"
                    value={stats.today.visitors}
                  />
                  <SummaryRow
                    label="累计战报"
                    value={stats.total.battles}
                  />
                </dl>
                <p className="mt-5 flex items-start gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-[11px] leading-relaxed text-[var(--ink-2)]">
                  <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  统计按服务器时间（UTC）的自然日归集，北京时间早上 8 点切换。
                </p>
              </div>
            </section>

            {/* 用户列表 */}
            <section className="card mt-4 overflow-hidden">
              <div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-3.5">
                <h2 className="text-sm font-medium">账号列表</h2>
                <span className="text-[11px] text-[var(--muted)]">
                  共 {stats.users.length} 个
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] border-collapse text-sm">
                  <thead className="thead">
                    <tr>
                      <th className="px-5 py-2.5 text-left font-medium">账号</th>
                      <th className="px-3 py-2.5 text-left font-medium">角色</th>
                      <th className="px-3 py-2.5 text-left font-medium">注册时间</th>
                      <th className="px-3 py-2.5 text-left font-medium">最后活跃</th>
                      <th className="px-3 py-2.5 text-right font-medium">名单</th>
                      <th className="px-3 py-2.5 text-right font-medium">战报</th>
                      <th className="px-5 py-2.5 text-right font-medium">数据量</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.users.map((u) => (
                      <tr
                        key={u.id}
                        className="border-b border-[var(--line)] transition-colors last:border-0 hover:bg-[var(--surface-2)]"
                      >
                        <td className="px-5 py-3 font-medium">
                          <span className="inline-flex items-center gap-1.5">
                            {u.role === "admin" && (
                              <Trophy
                                className="h-3.5 w-3.5 text-[var(--gold)]"
                                strokeWidth={2.2}
                              />
                            )}
                            {u.username}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="badge">
                            {u.role === "admin" ? "管理员" : "成员"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[13px] text-[var(--ink-2)]">
                          {formatDate(u.createdAt)}
                        </td>
                        <td className="px-3 py-3 text-[13px] text-[var(--ink-2)]">
                          {formatDate(u.lastSeenAt)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {u.players}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">
                          {u.battles}
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums text-[var(--ink-2)]">
                          {formatBytes(u.bytes)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <p className="mt-6 text-[11px] leading-relaxed text-[var(--muted)]">
              提示：重置密码、禁用账号需要服务端的 service_role 权限，下一步可以加一个
              `/api/admin/*` 路由来做（当前版本先只读统计）。
            </p>
          </>
        )
      )}
    </main>
  );
}

/** 包一层，避免与页面里其它 hooks 混乱 */
function useAuthState() {
  const { profile, loading } = useAuth();
  return { profile, isLoading: loading };
}

function FullScreenHint({ text }: { text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center gap-2 text-sm text-[var(--ink-2)]">
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </main>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
  raw,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  hint?: string;
  raw?: boolean;
}) {
  return (
    <div className="card card-lift p-4">
      <div className="flex items-center gap-2 text-[var(--ink-2)]">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--surface-2)]">
          {icon}
        </span>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--muted)]">
          {label}
        </span>
      </div>
      <p
        className={`mt-3 tabular-nums ${raw ? "text-[22px]" : "text-[26px]"}`}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-[11px] text-[var(--muted)]">{hint}</p>
      )}
    </div>
  );
}

function TrendCard({
  title,
  icon,
  points,
  max,
  accent,
}: {
  title: string;
  icon: React.ReactNode;
  points: DayPoint[];
  max: number;
  accent: "gold" | "ink";
}) {
  const total = points.reduce((sum, p) => sum + p.count, 0);
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <span className="text-[var(--ink-2)]">{icon}</span>
          {title}
        </h2>
        <span className="text-[11px] text-[var(--muted)]">
          合计 {total}
        </span>
      </div>
      <div className="mt-5 flex h-28 items-end gap-2">
        {points.map((p) => {
          const height = Math.max(2, Math.round((p.count / max) * 100));
          return (
            <div
              key={p.day}
              className="flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              <span className="text-[10px] tabular-nums text-[var(--muted)]">
                {p.count || ""}
              </span>
              <div
                className="w-full rounded-t-[4px] transition-[height] duration-500"
                style={{
                  height: `${height}%`,
                  backgroundColor:
                    accent === "gold" ? "var(--gold)" : "var(--ink)",
                  opacity: p.count ? 0.9 : 0.15,
                }}
                title={`${p.day}：${p.count}`}
              />
              <span className="text-[10px] text-[var(--muted)]">
                {formatDay(p.day)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  prev,
}: {
  label: string;
  value: number;
  prev?: number;
}) {
  const diff = typeof prev === "number" ? value - prev : null;
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--ink-2)]">{label}</dt>
      <dd className="flex items-center gap-2 tabular-nums">
        <span className="font-medium">{value}</span>
        {diff !== null && (
          <span
            className="inline-flex items-center gap-0.5 text-[11px]"
            style={{
              color:
                diff > 0 ? "#15803d" : diff < 0 ? "#b91c1c" : "var(--muted)",
            }}
          >
            <ChevronRight
              className={`h-3 w-3 ${diff > 0 ? "-rotate-90" : diff < 0 ? "rotate-90" : ""}`}
            />
            {diff === 0 ? "持平" : Math.abs(diff)}
          </span>
        )}
      </dd>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="px-5 py-10 text-center text-sm text-[var(--muted)]">
      {text}
    </div>
  );
}
