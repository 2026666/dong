"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth-provider";

/** 未登录也能看的页面 */
const PUBLIC_PATHS = ["/"];

/** 10 秒内最多跳几次，超了就当「登录状态异常」处理，避免反复来回跳 */
const LOOP_WINDOW_MS = 10_000;
const LOOP_LIMIT = 5;

/** 模块级计数：同一次浏览会话内共享，路由切换不重置 */
let hops = 0;
let hopStart = 0;

/** 清掉本机残留的登录态（Supabase 的 session 存在 localStorage 里） */
function clearLocalAuth() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && (key.startsWith("sb-") || key.includes("supabase"))) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
    sessionStorage.clear();
    localStorage.removeItem("guanduPlan");
  } catch {
    /* 忽略：清不掉也让用户手动重试 */
  }
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [stuck, setStuck] = useState(false);

  const isPublic = PUBLIC_PATHS.includes(pathname ?? "/");

  useEffect(() => {
    if (loading || stuck) return;

    const now = Date.now();
    if (now - hopStart > LOOP_WINDOW_MS) {
      hops = 0;
      hopStart = now;
    }

    const needRedirect =
      (!user && !isPublic) || Boolean(user && isPublic);
    if (!needRedirect) return;

    if (hops >= LOOP_LIMIT) {
      setStuck(true);
      return;
    }
    hops += 1;

    if (!user && !isPublic) {
      const target = pathname && pathname !== "/" ? pathname : "/zhu";
      router.replace(`/?next=${encodeURIComponent(target)}`);
      return;
    }

    if (user && isPublic) {
      const params = new URLSearchParams(window.location.search);
      const raw = params.get("next");
      const safe =
        raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/zhu";
      router.replace(safe);
    }
  }, [user, loading, isPublic, pathname, router, stuck]);

  if (stuck) {
    return (
      <Recovery
        onClear={async () => {
          clearLocalAuth();
          try {
            await signOut();
          } catch {
            /* 服务端 signOut 失败也无所谓，本地已经清了 */
          }
          hops = 0;
          hopStart = 0;
          setStuck(false);
          window.location.replace("/");
        }}
      />
    );
  }

  if (loading) return <Splash text="正在恢复登录状态…" />;
  if (!user && !isPublic) return <Splash text="未登录，正在跳到登录页…" />;
  if (user && isPublic) return <Splash text="正在进入工作台…" />;

  return <>{children}</>;
}

function Recovery({ onClear }: { onClear: () => void }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-6">
      <div className="card w-full max-w-sm p-6 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[var(--btn-bg)] text-[var(--btn-fg)]">
          <Trophy className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-[15px] font-semibold">登录状态有点乱</h1>
        <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--ink-2)]">
          本机存的登录信息可能已经过期，页面在登录页和工作台之间来回跳。
          清除之后重新登录一次就好，云端的名单和战报不会丢。
        </p>
        <button type="button" className="btn btn-primary mt-5 w-full" onClick={onClear}>
          清除登录状态并重新登录
        </button>
        <a className="mt-3 block text-[12px] text-[var(--muted)] underline" href="/">
          返回首页
        </a>
      </div>
    </div>
  );
}

export function Splash({ text = "加载中…" }: { text?: string }) {
  return (
    <div className="grid min-h-screen place-items-center bg-[var(--bg)] px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--btn-bg)] text-[var(--btn-fg)]">
          <Trophy className="h-5 w-5" />
        </span>
        <p className="text-sm text-[var(--ink-2)]">{text}</p>
        <span className="h-1 w-32 overflow-hidden rounded-full bg-[var(--surface-2)]">
          <span className="block h-full w-1/2 animate-pulse rounded-full bg-[var(--btn-bg)]" />
        </span>
      </div>
    </div>
  );
}
