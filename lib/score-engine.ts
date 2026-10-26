import type {
  Battle,
  Player,
  PlayerScoreSummary,
  ScoreConfig,
  ScoreLog,
} from "./types";
import { uid } from "./use-local-storage";

/** 计算所有玩家的分数汇总和排名 */
export function calculateRankings(
  players: Player[],
  battles: Battle[],
  config: ScoreConfig
): PlayerScoreSummary[] {
  // 按 playerId 聚合
  const map = new Map<string, PlayerScoreSummary>();

  // 初始化所有注册玩家（即使没参加城战也能展示）
  for (const p of players) {
    map.set(p.id, {
      playerId: p.id,
      playerName: p.name,
      merit: p.merit,
      totalScore: 0,
      baseScore: 0,
      headCarScore: 0,
      meritScore: 0,
      battleCount: 0,
      externalRank: p.rank,
      rank: 0,
    });
  }

  // 遍历每场城战，累加分数
  for (const battle of battles) {
    for (const part of battle.participants) {
      // 从玩家列表（总名单）找 playerId，找不到就跳过（没注册的不参与排名）
      const player = players.find((p) => p.name === part.playerName);
      if (!player) continue;

      let summary = map.get(player.id);
      if (!summary) {
        // 不在玩家列表里但在城战里 —— 自动注册
        summary = {
          playerId: player.id,
          playerName: player.name,
          merit: player.merit,
          totalScore: 0,
          baseScore: 0,
          headCarScore: 0,
          meritScore: 0,
          battleCount: 0,
          externalRank: player.rank,
          rank: 0,
        };
        map.set(player.id, summary);
      }

      // 功勋只认总名单里的值，这里不再用截图里识别到的功勋覆盖

      // 基础分：参加一场加一次
      summary.baseScore += config.baseScorePerBattle;
      summary.battleCount += 1;

      // 车头加分
      if (part.headCarTypeIds.length > 0) {
        const headCarBonuses = part.headCarTypeIds
          .map((id) => config.headCarTypes.find((t) => t.id === id)?.bonusScore ?? 0)
          .filter((s) => s > 0);

        if (headCarBonuses.length > 0) {
          const headCarScore =
            config.headCarBonusMode === "stack"
              ? headCarBonuses.reduce((a, b) => a + b, 0)
              : Math.max(...headCarBonuses);
          summary.headCarScore += headCarScore;
        }
      }
    }
  }

  // 功勋权重分（已废弃，不再计入总分）
  // if (config.meritWeight > 0) {
  //   for (const s of map.values()) {
  //     s.meritScore = Math.round(s.merit * config.meritWeight);
  //   }
  // }

  // 汇总总分（只算基础分 + 车头加分，不再算功勋权重分）
  for (const s of map.values()) {
    s.totalScore = s.baseScore + s.headCarScore;
  }

  // 排序：总分降序 → 同分按总名单功勋 → 再按全服排名 → 最后按场次
  const summaries = Array.from(map.values());
  summaries.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;

    // 同分：第一优先永远是总名单里的功勋（功勋高者靠前）
    if (b.merit !== a.merit) return b.merit - a.merit;

    // 功勋也相同，兜底：全服排名靠前 → 场次多
    const rankA = a.externalRank ?? Infinity;
    const rankB = b.externalRank ?? Infinity;
    if (rankA !== rankB) return rankA - rankB;
    if (b.battleCount !== a.battleCount) return b.battleCount - a.battleCount;
    return 0;
  });

  // 填排名
  summaries.forEach((s, i) => {
    s.rank = i + 1;
  });

  return summaries;
}

/** 为某场城战生成分数流水（不可变 delta） */export function generateScoreLogsForBattle(
  battle: Battle,
  config: ScoreConfig
): ScoreLog[] {
  const logs: ScoreLog[] = [];

  for (const part of battle.participants) {
    // 基础分
    logs.push({
      id: uid(),
      playerId: part.playerId,
      playerName: part.playerName,
      battleId: battle.id,
      battleDate: battle.date,
      delta: config.baseScorePerBattle,
      reason: "参加城战",
      ruleVersion: config.ruleVersion,
      timestamp: new Date().toISOString(),
    });

    // 车头加分
    if (part.headCarTypeIds.length > 0) {
      for (const hcId of part.headCarTypeIds) {
        const hcType = config.headCarTypes.find((t) => t.id === hcId);
        if (!hcType) continue;

        // 如果是 stack 模式，每个车头类型单独记一条流水
        // 如果是 max 模式，所有车头类型取最高只记一条
        if (config.headCarBonusMode === "stack") {
          logs.push({
            id: uid(),
            playerId: part.playerId,
            playerName: part.playerName,
            battleId: battle.id,
            battleDate: battle.date,
            delta: hcType.bonusScore,
            reason: `${hcType.name}加分`,
            headCarTypeId: hcId,
            ruleVersion: config.ruleVersion,
            timestamp: new Date().toISOString(),
          });
        } else {
          // max 模式：只取最高的那条
          const maxBonus = Math.max(
            ...part.headCarTypeIds.map(
              (id) => config.headCarTypes.find((t) => t.id === id)?.bonusScore ?? 0
            )
          );
          if (hcType.bonusScore === maxBonus) {
            logs.push({
              id: uid(),
              playerId: part.playerId,
              playerName: part.playerName,
              battleId: battle.id,
              battleDate: battle.date,
              delta: maxBonus,
              reason: `车头加分(${hcType.name})`,
              headCarTypeId: hcId,
              ruleVersion: config.ruleVersion,
              timestamp: new Date().toISOString(),
            });
            break; // 只记一条
          }
        }
      }
    }
  }

  return logs;
}
