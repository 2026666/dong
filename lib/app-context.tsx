"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { useLocalStorage } from "@/lib/use-local-storage";
import type {
  Battle,
  Player,
  ScoreConfig,
  ScoreLog,
} from "@/lib/types";
import { DEFAULT_CONFIG } from "@/lib/types";
import { calculateRankings } from "@/lib/score-engine";

interface AppState {
  players: Player[];
  battles: Battle[];
  config: ScoreConfig;
  logs: ScoreLog[];
  // actions
  addPlayer: (player: Omit<Player, "id" | "createdAt">) => void;
  /** 总名单里没有这个玩家时补一条（不动已有玩家的功勋/排名） */
  ensurePlayer: (name: string) => void;
  removePlayer: (id: string) => void;
  /** 一键清空总名单（城战记录保留，重新导入名单后会重新参与排名） */
  clearPlayers: () => void;
  updatePlayer: (id: string, patch: Partial<Player>) => void;
  addBattle: (battle: Omit<Battle, "id" | "createdAt">) => void;
  removeBattle: (id: string) => void;
  updateBattle: (id: string, patch: Partial<Battle>) => void;
  updateConfig: (patch: Partial<ScoreConfig>) => void;
  addLogs: (logs: ScoreLog[]) => void;
  clearAll: () => void;
  // 导入总名单（名字 + 名次 + 功勋）
  importRoster: (rows: { name: string; rank?: number; merit?: number }[]) => void;
  // 派生数据
  rankings: ReturnType<typeof calculateRankings>;
}

const AppContext = createContext<AppState | null>(null);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [players, setPlayers] = useLocalStorage<Player[]>("sgPlayers", []);
  const [battles, setBattles] = useLocalStorage<Battle[]>("sgBattles", []);
  const [config, setConfig] = useLocalStorage<ScoreConfig>(
    "sgConfig",
    DEFAULT_CONFIG
  );
  const [logs, setLogs] = useLocalStorage<ScoreLog[]>("sgLogs", []);

  const rankings = useMemo(
    () => calculateRankings(players, battles, config),
    [players, battles, config]
  );

  // 旧配置迁移（v1）：同分排序从「全服排名」改为「总名单功勋优先」
  useEffect(() => {
    if (config.configVersion === undefined) {
      setConfig((prev) => ({ ...prev, tieBreaker: "merit", configVersion: 2 }));
    }
  }, [config.configVersion, setConfig]);

  const value: AppState = {
    players,
    battles,
    config,
    logs,
    rankings,

    addPlayer: (player) => {
      setPlayers((prev) => {
        // 按名字去重：如果已存在同名玩家，更新功勋和排名，不新增
        const idx = prev.findIndex((p) => p.name === player.name);
        if (idx >= 0) {
          return prev.map((p, i) =>
            i === idx
              ? { ...p, merit: player.merit, rank: player.rank ?? p.rank }
              : p
          );
        }
        return [
          ...prev,
          { ...player, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
        ];
      });
    },
    ensurePlayer: (name) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setPlayers((prev) => {
        if (prev.some((p) => p.name === trimmed)) return prev;
        return [
          ...prev,
          {
            id: crypto.randomUUID(),
            name: trimmed,
            merit: 0,
            createdAt: new Date().toISOString(),
          },
        ];
      });
    },
    removePlayer: (id) => {
      setPlayers((prev) => prev.filter((p) => p.id !== id));
    },
    clearPlayers: () => {
      setPlayers([]);
    },
    updatePlayer: (id, patch) => {
      setPlayers((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...patch } : p))
      );
    },
    addBattle: (battle) => {
      setBattles((prev) => [
        ...prev,
        { ...battle, id: crypto.randomUUID(), createdAt: new Date().toISOString() },
      ]);
    },
    removeBattle: (id) => {
      setBattles((prev) => prev.filter((b) => b.id !== id));
    },
    updateBattle: (id, patch) => {
      setBattles((prev) =>
        prev.map((b) => (b.id === id ? { ...b, ...patch } : b))
      );
    },
    updateConfig: (patch) => {
      setConfig((prev) => {
        // 如果 headCarTypes 变了，更新 ruleVersion
        const versionBump =
          patch.headCarTypes ||
          patch.baseScorePerBattle !== undefined ||
          patch.meritWeight !== undefined ||
          patch.headCarBonusMode !== undefined;
        return {
          ...prev,
          ...patch,
          configVersion: 2,
          ruleVersion: versionBump
            ? `v${Date.now().toString().slice(-6)}`
            : prev.ruleVersion,
        };
      });
    },
    addLogs: (newLogs) => {
      setLogs((prev) => [...prev, ...newLogs]);
    },
    clearAll: () => {
      setPlayers([]);
      setBattles([]);
      setLogs([]);
      setConfig(DEFAULT_CONFIG);
    },
    importRoster: (rows) => {
      setPlayers((prev) => {
        const next = [...prev];
        for (const row of rows) {
          const name = row.name.trim();
          if (!name) continue;
          const idx = next.findIndex((p) => p.name === name);
          if (idx >= 0) {
            const cur = next[idx];
            next[idx] = {
              ...cur,
              rank: row.rank ?? cur.rank,
              merit: row.merit ?? cur.merit,
            };
          } else {
            next.push({
              id: crypto.randomUUID(),
              name,
              merit: row.merit ?? 0,
              rank: row.rank,
              createdAt: new Date().toISOString(),
            });
          }
        }
        return next;
      });
    },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp 必须在 AppProvider 内使用");
  return ctx;
}
