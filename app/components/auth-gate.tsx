"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import { useAuth } from "@/lib/auth-provider";

/** 未登录也能看的页面 */
const PUBLIC_PATHS = ["/"];

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.includes(pathname ?? "/");

  useEffect(() => {
    if (loading) return;

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
  }, [user, loading, isPublic, pathname, router]);

  if (loading) return <Splash text="正在恢复登录状态…" />;
  if (!user && !isPublic) return <Splash text="未登录，正在跳到登录页…" />;
  if (user && isPublic) return <Splash text="正在进入工作台…" />;

  return <>{children}</>;
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
