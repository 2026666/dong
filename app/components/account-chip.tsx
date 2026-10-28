"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gauge, LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-provider";

/** 导航栏右侧：账号 + 控制台入口（仅管理员）+ 退出 */
export function AccountChip() {
  const { profile, signOut } = useAuth();
  const router = useRouter();

  if (!profile) return null;

  return (
    <div className="flex shrink-0 items-center gap-1">
      {profile.role === "admin" && (
        <Link
          href="/console"
          title="控制台"
          aria-label="控制台"
          className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
        >
          <Gauge className="h-4 w-4" strokeWidth={2} />
        </Link>
      )}

      <span
        title={profile.role === "admin" ? "管理员" : "成员"}
        className="hidden max-w-[9rem] truncate rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-[12px] font-medium text-[var(--ink-2)] sm:inline-block"
      >
        {profile.username}
      </span>

      <button
        type="button"
        title="退出登录"
        aria-label="退出登录"
        onClick={async () => {
          await signOut();
          router.replace("/");
        }}
        className="grid h-8 w-8 place-items-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
      >
        <LogOut className="h-4 w-4" strokeWidth={2} />
      </button>
    </div>
  );
}
