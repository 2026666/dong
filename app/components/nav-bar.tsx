"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Upload, Settings, List, Users, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/cn";

const navItems = [
  { href: "/zhu", label: "主页", icon: LayoutGrid },
  { href: "/", label: "总排名", icon: Trophy },
  { href: "/battles", label: "城战记录", icon: List },
  { href: "/upload", label: "上传识别", icon: Upload },
  { href: "/players", label: "赛季功勋", icon: Users },
  { href: "/settings", label: "规则配置", icon: Settings },
];

export function NavBar() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--line)] bg-[color-mix(in_oklab,var(--bg)_82%,transparent)] backdrop-blur-xl backdrop-saturate-150">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/zhu"
          className="group flex shrink-0 items-center gap-2.5 rounded-xl py-1 pr-2"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-[var(--shadow-sm)] transition-transform duration-200 group-hover:rotate-[-4deg] group-active:scale-95">
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

        <nav className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname?.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium",
                  active
                    ? "bg-[var(--btn-bg)] text-[var(--btn-fg)] shadow-[var(--shadow-sm)]"
                    : "text-[var(--ink-2)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
                )}
              >
                <Icon className="h-[15px] w-[15px]" strokeWidth={2} />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
