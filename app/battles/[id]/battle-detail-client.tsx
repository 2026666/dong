"use client";

import { useRouter } from "next/navigation";
import { NavBar } from "@/app/components/nav-bar";
import { useApp } from "@/lib/app-context";
import { ArrowLeft, Swords } from "lucide-react";

export default function BattleDetailClient({ battleId }: { battleId: string }) {
  const router = useRouter();
  const { battles, config } = useApp();
  const battle = battles.find((b) => b.id === battleId);

  if (!battle) {
    return (
      <div className="flex flex-col min-h-screen">
        <NavBar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
          <p>找不到这场城战记录。</p>
          <button
            onClick={() => router.push("/battles")}
            className="btn btn-ghost mt-4"
          >
            返回城战列表
          </button>
        </main>
      </div>
    );
  }

  const headCarNames = (ids: string[]) =>
    ids
      .map((id) => config.headCarTypes.find((t) => t.id === id)?.name)
      .filter(Boolean)
      .join("、");

  return (
    <div className="flex flex-col min-h-screen">
      <NavBar />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-10 sm:px-6 lg:px-8">
        <button
          onClick={() => router.push("/battles")}
          className="mb-4 inline-flex items-center gap-1 text-sm text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
        >
          <ArrowLeft className="h-4 w-4" />
          返回城战列表
        </button>

        <div className="mb-6 flex items-center gap-3">
          <Swords className="h-6 w-6 text-[var(--ink-2)]" />
          <div>
            <h1 className="text-[26px] font-semibold">{battle.cityName}</h1>
            <p className="text-sm text-[var(--muted)]">{battle.date} · {battle.participants.length} 人参战</p>
          </div>
        </div>

        {battle.screenshotDataUrl && (
          <div className="mb-6">
            <img
              src={battle.screenshotDataUrl}
              alt="screenshot"
              className="max-h-96 rounded-xl border border-[var(--line)]"
            />
          </div>
        )}

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="thead border-b border-[var(--line)]">
                <th className="px-4 py-3 text-left font-medium">#</th>
                <th className="px-4 py-3 text-left font-medium">玩家</th>
                <th className="px-4 py-3 text-left font-medium">车头标记</th>
              </tr>
            </thead>
            <tbody>
              {battle.participants.map((p, idx) => (
                <tr
                  key={idx}
                  className="border-b border-[var(--line)] transition-colors last:border-0 hover:bg-[var(--surface-2)]"
                >
                  <td className="px-4 py-3 text-[var(--muted)]">{idx + 1}</td>
                  <td className="px-4 py-3 font-medium">{p.playerName}</td>
                  <td className="px-4 py-3">
                    {p.headCarTypeIds.length > 0 ? (
                      <span className="inline-flex items-center rounded-full border border-[var(--line-strong)] bg-[var(--surface-2)] px-2.5 py-0.5 text-xs font-medium text-[var(--ink)]">
                        {headCarNames(p.headCarTypeIds)}
                      </span>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
