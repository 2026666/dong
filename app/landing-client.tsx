"use client";

/**
 * 首页 —— 品牌宣传 + 账号登录 / 注册
 * ---------------------------------------------------------------------------
 * 结构：
 *   · 深蓝渐变 + 网格 + 光斑的整屏背景
 *   · 左侧：slogan、产品简介、能力清单、信任点
 *   · 右侧：毛玻璃卡片，登录 / 注册两个 tab
 * 登录成功后由 AuthGate 跳转到 /zhu（或 ?next= 指定的页面）
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Calculator,
  CheckCircle2,
  Cloud,
  FileSpreadsheet,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  ScanLine,
  ShieldCheck,
  Trophy,
  User,
} from "lucide-react";
import { useAuth } from "@/lib/auth-provider";
import {
  validateConfirm,
  validateEmail,
  validatePassword,
} from "@/lib/account";

/** 左侧能力清单 */
const FEATURES = [
  { icon: ScanLine, title: "截图识别", desc: "只取名字，自动剔除盟名与水印" },
  { icon: Calculator, title: "自动计分", desc: "基础分 + 车头加分，规则可配" },
  { icon: Trophy, title: "同分排序", desc: "同分按赛季功勋、全服排名比较" },
  { icon: FileSpreadsheet, title: "一键导出", desc: "排名明细导出 Excel，随时备份" },
] as const;

const INSURANCE = [
  { icon: Cloud, text: "名单和战报自动同步到云端，换电脑、换手机都能接着用" },
  { icon: ShieldCheck, text: "每个账号一份数据，别人看不到、也改不了" },
  { icon: CheckCircle2, text: "邮箱 + 密码登录，不收验证邮件" },
];

type Mode = "login" | "register";

export default function LandingClient() {
  const router = useRouter();
  const { signIn, signUp, configured } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const isRegister = mode === "register";

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setConfirm("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError(null);

    const emailError = validateEmail(email);
    if (emailError) return setError(emailError);

    const passwordError = validatePassword(password);
    if (passwordError) return setError(passwordError);

    if (isRegister) {
      const confirmError = validateConfirm(password, confirm);
      if (confirmError) return setError(confirmError);
    }

    setBusy(true);
    const result = isRegister
      ? await signUp(email, password)
      : await signIn(email, password);
    setBusy(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace("/zhu");
  }

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
        <div className="flex items-center gap-3 py-1">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[linear-gradient(135deg,#2563eb,#38bdf8)] shadow-[0_12px_32px_-12px_rgba(56,189,248,0.9)]">
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
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-[#38bdf8]/25 bg-[#38bdf8]/10 px-3 py-1 text-[11px] text-[#7dd3fc] backdrop-blur sm:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            数据云端同步
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
            总分相同时再按赛季功勋排序。名单自动存云端，换设备也不丢。
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
              每个账号独立存储
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Cloud className="h-3.5 w-3.5" />
              登录后自动同步
            </span>
          </div>
        </section>

        {/* 右：登录 / 注册 */}
        <section className="lp-fade-up lp-delay-2 w-full">
          <div className="relative overflow-hidden rounded-3xl border border-white/12 bg-white/[0.055] p-6 shadow-[0_30px_90px_-32px_rgba(2,6,23,0.95)] backdrop-blur-2xl sm:p-7">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-24 h-52 w-52 rounded-full bg-[#3b82f6]/25 blur-3xl"
            />

            <div className="relative">
              <h2 className="text-xl font-semibold tracking-tight">
                {isRegister ? "创建账号" : "欢迎回来"}
              </h2>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-400">
                {isRegister
                  ? "第一个注册的账号会自动成为管理员。"
                  : "登录后即可继续你的盟战统计。"}
              </p>

              {/* tab */}
              <div className="relative mt-5 grid grid-cols-2 rounded-xl border border-white/10 bg-white/[0.04] p-1">
                <span
                  aria-hidden
                  className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-[linear-gradient(135deg,#2563eb,#38bdf8)] shadow-[0_8px_20px_-8px_rgba(56,189,248,0.9)] transition-transform duration-300"
                  style={{
                    transform: isRegister
                      ? "translateX(calc(100% + 0.5rem))"
                      : "translateX(0)",
                  }}
                />
                {(
                  [
                    ["login", "登录"],
                    ["register", "注册"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => switchMode(value)}
                    className={`relative z-10 rounded-lg py-2 text-[13px] font-medium transition-colors ${
                      mode === value
                        ? "text-white"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {!configured && (
                <p className="mt-4 rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-2 text-[12px] leading-relaxed text-amber-100">
                  还没配置 Supabase：请在 `dong/.env.local` 填入
                  `NEXT_PUBLIC_SUPABASE_URL` 与 `NEXT_PUBLIC_SUPABASE_ANON_KEY`，
                  重新构建后即可注册登录。
                </p>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
                <Field
                  id="account"
                  label="邮箱"
                  icon={<User className="h-4 w-4" />}
                >
                  <input
                    id="account"
                    type="email"
                    inputMode="email"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="12345678@qq.com"
                    autoComplete="email"
                    className="w-full bg-transparent text-[14px] text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </Field>

                <Field
                  id="password"
                  label="密码"
                  icon={<Lock className="h-4 w-4" />}
                  trailing={
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "隐藏密码" : "显示密码"}
                      className="text-slate-500 transition-colors hover:text-slate-300"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  }
                >
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isRegister ? "至少 6 位" : "请输入密码"}
                    autoComplete={isRegister ? "new-password" : "current-password"}
                    className="w-full bg-transparent text-[14px] text-white placeholder:text-slate-500 focus:outline-none"
                  />
                </Field>

                {isRegister && (
                  <Field
                    id="confirm"
                    label="确认密码"
                    icon={<Lock className="h-4 w-4" />}
                  >
                    <input
                      id="confirm"
                      type={showPassword ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="再输入一次密码"
                      autoComplete="new-password"
                      className="w-full bg-transparent text-[14px] text-white placeholder:text-slate-500 focus:outline-none"
                    />
                  </Field>
                )}

                {error && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-[12px] leading-relaxed text-red-200"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="group/cta relative mt-1 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-[linear-gradient(135deg,#2563eb,#38bdf8)] px-4 py-3 text-[14px] font-medium text-white shadow-[0_16px_40px_-16px_rgba(56,189,248,0.95)] transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-[linear-gradient(135deg,#3b82f6,#67e8f9)] opacity-0 transition-opacity duration-300 group-hover/cta:opacity-100"
                  />
                  <span className="relative inline-flex items-center gap-2">
                    {busy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
                    )}
                    {busy
                      ? "请稍候…"
                      : isRegister
                        ? "注册并进入"
                        : "登录并进入"}
                  </span>
                </button>
              </form>

              <ul className="mt-5 space-y-2 text-[12px] leading-relaxed text-slate-400">
                {INSURANCE.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-2">
                    <Icon
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300/90"
                      strokeWidth={2.2}
                    />
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-10 text-center text-[11px] tracking-wide text-slate-500 sm:px-8">
        三国冰河 · 盟战统计　|　数据同步至云端，仅本人可见
      </footer>

      <style>{KEYFRAMES}</style>
    </div>
  );
}

/** 带图标与标签的输入框外壳 */
function Field({
  id,
  label,
  icon,
  trailing,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-[12px] font-medium text-slate-300"
      >
        {label}
      </label>
      <div className="flex items-center gap-2.5 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 transition-colors focus-within:border-[#38bdf8]/60 focus-within:bg-white/[0.07]">
        <span className="text-slate-500">{icon}</span>
        {children}
        {trailing}
      </div>
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
