"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocalStorage } from "@/lib/use-local-storage";
import { useAuth } from "@/lib/auth-provider";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
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
  // 云同步状态
  syncStatus: SyncStatus;
}

export type SyncStatus = "local" | "loading" | "syncing" | "synced" | "error";

interface CloudPayload {
  players?: Player[];
  battles?: Battle[];
  config?: ScoreConfig;
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

  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("local");
  const hydratedRef = useRef(false);
  const applyingRef = useRef(false);

  // 把当前数据推到云端
  const pushToCloud = useCallback(async () => {
    if (!user || !isSupabaseConfigured) return;
    const payload: CloudPayload = { players, battles, config };
    const { error } = await getSupabase()
      .from("user_data")
      .upsert(
        { user_id: user.id, payload, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    if (error) {
      console.warn("[sync] 保存失败:", error.message);
      setSyncStatus("error");
    } else {
      setSyncStatus("synced");
    }
  }, [user, players, battles, config]);

  // 登录后：拉取云端数据；云端为空就把本机数据传上去（首次迁移）
  useEffect(() => {
    if (!isSupabaseConfigured || !user) {
      hydratedRef.current = false;
      queueMicrotask(() => setSyncStatus("local"));
      return;
    }

    let cancelled = false;
    hydratedRef.current = false;
    queueMicrotask(() => setSyncStatus("loading"));

    void (async () => {
      const { data, error } = await getSupabase()
        .from("user_data")
        .select("payload")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.warn("[sync] 读取失败:", error.message);
        hydratedRef.current = true;
        setSyncStatus("error");
        return;
      }

      const payload = (data?.payload ?? null) as CloudPayload | null;
      const hasCloud =
        !!payload &&
        ((payload.players?.length ?? 0) > 0 ||
          (payload.battles?.length ?? 0) > 0);

      if (hasCloud) {
        applyingRef.current = true;
        if (Array.isArray(payload!.players)) setPlayers(payload!.players);
        if (Array.isArray(payload!.battles)) setBattles(payload!.battles);
        if (payload!.config) setConfig({ ...DEFAULT_CONFIG, ...payload!.config });
        setTimeout(() => {
          applyingRef.current = false;
        }, 0);
        hydratedRef.current = true;
        setSyncStatus("synced");
        return;
      }

      // 云端还没有数据：把本机的名单/战报传上去
      hydratedRef.current = true;
      if (players.length > 0 || battles.length > 0) {
        void pushToCloud();
      } else {
        setSyncStatus("synced");
      }
    })();

    return () => {
      cancelled = true;
    };
    // 只在登录账号变化时重新装载云端数据
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, setPlayers, setBattles, setConfig]);

  // 数据变化后自动保存（防抖 900ms）
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;
    if (!hydratedRef.current || applyingRef.current) return;

    queueMicrotask(() => setSyncStatus("syncing"));
    const timer = setTimeout(() => {
      void pushToCloud();
    }, 900);

    return () => clearTimeout(timer);
  }, [user, players, battles, config, pushToCloud]);

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
    syncStatus,

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
