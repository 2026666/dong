"use client";

import Link from "next/link";
import { useApp } from "@/lib/app-context";
import { ArrowRight, Check, Trophy, Users } from "lucide-react";

export default function WorkspacePage() {
  const { players, config } = useApp();

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden">
      {/* 背景光晕 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_oklab,var(--gold)_10%,transparent),transparent_70%)]"
      />

      {/* 独立头部：不共用主导航 */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 pt-8 sm:px-6 lg:px-8">
        <Link
          href="/zhu"
          className="group flex items-center gap-2.5 rounded-xl py-1 pr-2"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-[var(--shadow-sm)] transition-transform duration-200 group-hover:rotate-[-4deg]">
            <Trophy className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-[-0.01em]">
              三国冰河
            </span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              盟战统计
            </span>
          </span>
        </Link>

        <span className="text-[12px] text-[var(--muted)]">
          规则 {config.ruleVersion}
        </span>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        {/* Hero */}
        <div className="mx-auto max-w-2xl text-center">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted)]">
            {config.allianceName} · Workspace
          </p>
          <h1 className="text-[30px] font-semibold leading-tight tracking-[-0.02em] sm:text-[38px]">
            功能主页
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[13px] leading-relaxed text-[var(--ink-2)]">
            目前只开放一个功能：赛季功勋分配。
          </p>
        </div>

        {/* 唯一功能入口 */}
        <div className="mt-10 sm:mt-12">
          <Link
            href="/players"
            className="group card card-lift mx-auto flex max-w-2xl flex-col p-6 focus-visible:outline-none sm:p-8"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--gold)_14%,transparent)] text-[var(--gold)]">
                <Users className="h-[19px] w-[19px]" strokeWidth={1.9} />
              </span>
            </div>

            <h2 className="mt-4 text-[17px] font-semibold leading-snug">
              赛季功勋分配
            </h2>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--ink-2)]">
              维护总名单里的全服排名与总功勋，作为计分基准，也是总分相同时的排序依据。
            </p>

            <ul className="mt-5 space-y-2 text-[13px] text-[var(--ink-2)]">
              {[
                "粘贴或上传榜单，自动识别名字、排名与总功勋",
                "手改、增删玩家，保存时不会被截图覆盖",
                "功勋不计分，只在总分相同时决定先后",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--gold)]"
                    strokeWidth={2.4}
                  />
                  {item}
                </li>
              ))}
            </ul>

            <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--line)] pt-4">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-[var(--muted)]">
                <span className="h-1 w-1 rounded-full bg-[var(--line-strong)]" />
                当前 {players.length} 名玩家
              </span>
              <span className="btn btn-primary">
                进入
                <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        </div>

        <p className="mt-10 text-center text-[12px] leading-relaxed text-[var(--muted)]">
          后续功能会陆续加到这里。
        </p>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-8 text-center text-[11px] text-[var(--muted)] sm:px-6 lg:px-8">
        三国冰河 · 盟战统计
      </footer>
    </div>
  );
}
