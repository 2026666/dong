"use client";

import Link from "next/link";
import { NavBar } from "@/app/components/nav-bar";
import { useApp } from "@/lib/app-context";
import { Swords, Trash2, Eye } from "lucide-react";

export default function BattlesPage() {
  const { battles, removeBattle } = useApp();

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <h1 className="text-[26px] font-semibold mb-6 flex items-center gap-2">
          <Swords className="h-6 w-6" />
          城战记录 ({battles.length})
        </h1>

        {battles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--line-strong)] bg-[var(--surface)]/50 p-12 text-center text-[var(--muted)]">
            还没有城战记录，去「上传识别」导入第一张截图吧
          </div>
        ) : (
          <div className="space-y-3">
            {[...battles]
              .sort((a, b) => (a.date < b.date ? 1 : -1))
              .map((b) => (
                <div
                  key={b.id}
                  className="card card-lift flex items-center justify-between p-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="grid h-11 w-11 place-items-center rounded-xl bg-[color-mix(in_oklab,var(--gold)_10%,var(--surface-2))] text-[var(--gold)]">
                      <Swords className="h-4 w-4" strokeWidth={1.9} />
                    </div>
                    <div>
                      <div className="font-medium">{b.cityName}</div>
                      <div className="mt-0.5 flex gap-3 text-xs text-[var(--muted)]">
                        <span>{b.date}</span>
                        <span>{b.participants.length} 人参战</span>
                        {b.participants.filter((p) => p.headCarTypeIds.length > 0).length > 0 && (
                          <span className="text-[var(--gold)]">
                            {b.participants.filter((p) => p.headCarTypeIds.length > 0).length} 个车头
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/battles/${b.id}`}
                      className="btn btn-ghost"
                    >
                      <Eye className="h-4 w-4" />
                      查看
                    </Link>
                    <button
                      onClick={() => {
                        if (confirm(`确定删除「${b.cityName}」这场城战？`)) {
                          removeBattle(b.id);
                        }
                      }}
                      className="rounded-lg p-2 text-[var(--muted)] hover:bg-[color-mix(in_oklab,#dc2626_10%,transparent)] hover:text-red-600"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
