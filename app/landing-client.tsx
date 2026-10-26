"use client";

/**
 * /xuanchuan —— 品牌宣传页（无登录）
 * ---------------------------------------------------------------------------
 * 结构：
 *   · 深蓝渐变 + 网格 + 光斑的整屏背景
 *   · 左侧：slogan、产品简介、能力清单、信任点
 *   · 右侧：一张毛玻璃卡，一个「进入系统」按钮，直接进 /zhu
 * 数据全部存在本机浏览器（localStorage），不需要账号。
 */

import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  FileSpreadsheet,
  Lock,
  ScanLine,
  Trophy,
  Unlock,
  Zap,
} from "lucide-react";

/** 左侧能力清单 */
const FEATURES = [
  { icon: ScanLine, title: "截图识别", desc: "只取名字，自动剔除盟名与水印" },
  { icon: Calculator, title: "自动计分", desc: "基础分 + 车头加分，规则可配" },
  { icon: Trophy, title: "同分排序", desc: "同分按赛季功勋、全服排名比较" },
  { icon: FileSpreadsheet, title: "一键导出", desc: "排名明细导出 Excel，随时备份" },
] as const;

const INSURANCE = [
  "数据只存在这台设备的浏览器里，刷新、换页都不会丢",
  "想换设备就用「导出 Excel」存一份榜单，再导入新设备",
  "不上传服务器，也不需要注册账号",
];

export default function LandingClient() {
  return (
    <div className="relative isolate min-h-screen w-full overflow-hidden bg-[#04091a] text-white">
      {/* ---------- 背景 ---------- */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: [
              "radial-gradient(1200px 620px at 50% -12%, rgba(37,99,235,0.55), transparent 62%)",
              "radial-gradient(900px 520px at 88% 6%, rgba(14,165,233,0.32), transparent 60%)",
              "radial-gradient(760px 460px at 4% 74%, rgba(59,130,246,0.18), transparent 62%)",
              "linear-gradient(180deg, #04091a 0%, #061027 46%, #04091a 100%)",
            ].join(","),
          }}
        />
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(148,163,184,0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.09) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(70% 60% at 50% 18%, black, transparent)",
            WebkitMaskImage:
              "radial-gradient(70% 60% at 50% 18%, black, transparent)",
          }}
        />
        <div className="lp-float absolute -left-24 top-28 h-72 w-72 rounded-full bg-[#3b82f6]/20 blur-[110px]" />
        <div className="lp-float-slow absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-[#22d3ee]/16 blur-[120px]" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-[#04091a] to-transparent" />
      </div>

      {/* ---------- 顶栏 ---------- */}
      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 sm:px-8">
        <Link href="/zhu" className="group flex items-center gap-3 rounded-xl py-1">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[linear-gradient(135deg,#2563eb,#38bdf8)] shadow-[0_12px_32px_-12px_rgba(56,189,248,0.9)] transition-transform duration-200 group-hover:rotate-[-4deg]">
            <Trophy className="h-5 w-5 text-white" strokeWidth={2.2} />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold tracking-wide">
              三国冰河
            </span>
            <span className="block text-[11px] tracking-[0.16em] text-slate-400">
              盟战统计
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-[11px] text-emerald-200 backdrop-blur sm:inline-flex">
            <Unlock className="h-3.5 w-3.5 text-emerald-300" />
            免登录使用
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-slate-300 backdrop-blur">
            规则 v1.0
          </span>
        </div>
      </header>

      {/* ---------- 主体 ---------- */}
      <main className="relative z-10 mx-auto grid w-full max-w-6xl gap-12 px-5 pb-20 pt-14 sm:px-8 lg:min-h-[calc(100vh-9.5rem)] lg:grid-cols-[1fr_440px] lg:items-center lg:gap-16 lg:pb-24 lg:pt-16">
        {/* 左：品牌主视觉 */}
        <section className="lp-fade-up flex flex-col">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#38bdf8]/25 bg-[#38bdf8]/10 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-[#7dd3fc]">
            <span className="lp-pulse h-1.5 w-1.5 rounded-full bg-[#38bdf8]" />
            Alliance Battle Intelligence
          </span>

          <h1 className="mt-6 text-[34px] font-semibold leading-[1.14] tracking-tight sm:text-[46px] lg:text-[54px]">
            让每一场城战
            <br className="hidden sm:block" />
            <span className="bg-[linear-gradient(110deg,#e2e8f0_8%,#93c5fd_55%,#38bdf8_94%)] bg-clip-text text-transparent">
              都有据可查
            </span>
          </h1>

          <p className="mt-5 max-w-xl text-[15px] leading-relaxed text-slate-300/90 sm:text-base">
            上传参战截图，OCR 自动提取成员名字；基础分、车头加分按盟内规则实时结算，
            总分相同时再按赛季功勋排序。把算分这件事，交给系统。
          </p>

          <ul className="mt-8 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <li
                key={title}
                className="group flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5 transition-colors duration-300 hover:border-white/15 hover:bg-white/[0.06]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#3b82f6]/15 text-[#93c5fd] transition-colors duration-300 group-hover:bg-[#3b82f6]/25 group-hover:text-[#bae6fd]">
                  <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-slate-100">
                    {title}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-slate-400">
                    {desc}
                  </span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5" />
              数据只存在本机浏览器
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              无需上传服务器
            </span>
          </div>
        </section>

        {/* 右：进入系统 */}
        <section className="lp-fade-up lp-delay-2 w-full">
          <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-white/[0.055] p-6 shadow-[0_30px_90px_-32px_rgba(2,6,23,0.95)] backdrop-blur-2xl sm:p-7">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-24 h-52 w-52 rounded-full bg-[#3b82f6]/25 blur-3xl"
            />

            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/10 px-2.5 py-0.5 text-[11px] text-emerald-200">
                <Unlock className="h-3 w-3" />
                免登录使用
              </span>

              <h2 className="mt-4 text-xl font-semibold tracking-tight">
                直接进入工作台
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                不用注册、不用填表单，点下面的按钮就能开始用。
              </p>

              <Link
                href="/zhu"
                className="group/cta mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#2563eb,#38bdf8)] px-4 py-3 text-[14px] font-medium text-white shadow-[0_16px_40px_-16px_rgba(56,189,248,0.95)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
              >
                进入系统
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
              </Link>

              <ul className="mt-6 space-y-2.5 text-[12px] leading-relaxed text-slate-400">
                {INSURANCE.map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300/90"
                      strokeWidth={2.2}
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-10 text-center text-[11px] tracking-wide text-slate-500 sm:px-8">
        三国冰河 · 盟战统计　|　数据保存在本机浏览器
      </footer>

      <style>{KEYFRAMES}</style>
    </div>
  );
}

const KEYFRAMES = `
@keyframes lp-fade-up {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes lp-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes lp-float {
  0%, 100% { transform: translate3d(0, 0, 0); }
  50%      { transform: translate3d(0, -18px, 0); }
}
@keyframes lp-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.45; transform: scale(0.82); }
}
@keyframes lp-shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(2px); }
  30%, 70% { transform: translateX(-3px); }
  40%, 60% { transform: translateX(3px); }
  50%      { transform: translateX(-2px); }
}
.lp-fade-up   { animation: lp-fade-up 0.72s cubic-bezier(0.22, 1, 0.36, 1) both; }
.lp-delay-2   { animation-delay: 0.18s; }
.lp-fade-in   { animation: lp-fade-in 0.6s ease-out both; }
.lp-float     { animation: lp-float 14s ease-in-out infinite; }
.lp-float-slow { animation: lp-float 20s ease-in-out infinite; }
.lp-pulse     { animation: lp-pulse 2.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .lp-fade-up, .lp-fade-in, .lp-float, .lp-float-slow, .lp-pulse { animation: none !important; }
}
`;
