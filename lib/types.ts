// ============ 核心数据类型 ============

/** 玩家（= 总名单里的一行） */
export interface Player {
  id: string;
  name: string;
  /** 总名单里的功勋：不参与计分，只用于展示和同分排序 */
  merit: number;
  rank?: number; // 外部排名（全服排名，用于同分排序）
  createdAt: string;
}

/** 车头类型 */
export interface HeadCarType {
  id: string;
  name: string;       // 如：主车头、副车头、治疗车头
  bonusScore: number; // 该车头类型的加分
}

/** 参与者（某玩家在某场城战中的记录） */
export interface Participant {
  playerId: string;
  playerName: string;   // 冗余存一下方便展示
  /**
   * @deprecated 已废弃：上传识别只识别名字，不再记录本场功勋。
   * 旧数据里可能还有值，但计分和排名都不再读取它。
   */
  merit: number;
  headCarTypeIds: string[]; // 标记了哪些车头类型（可多选）
  notes?: string;
}

/** 城战记录 */
export interface Battle {
  id: string;
  date: string;              // YYYY-MM-DD
  cityName: string;           // 城池名
  participants: Participant[];
  screenshotDataUrl?: string; // 原始截图（base64），可选存储
  rawOcrText?: string;        // OCR 原始文本，方便后续调整解析器
  createdAt: string;
}

/** 分数流水（不可变，每次加分写一条） */
export interface ScoreLog {
  id: string;
  playerId: string;
  playerName: string;
  battleId: string;
  battleDate: string;
  delta: number;       // 本次加了几分
  reason: string;      // "参加城战" / "主车头加分" 等
  headCarTypeId?: string;
  ruleVersion: string; // 当时用的规则版本
  timestamp: string;
}

/** 规则配置 */
export interface ScoreConfig {
  baseScorePerBattle: number;                      // 参加一次城战的基础分
  meritWeight: number;                             // 功勋权重（设为 0 则功勋只做同分排序）
  headCarBonusMode: "stack" | "max";               // 多车头叠加 or 取最高
  headCarTypes: HeadCarType[];                    // 所有车头类型及对应加分
  tieBreaker: "merit" | "battleCount" | "both" | "externalRank";    // 同分后按什么排序
  allianceName: string;                            // 盟名称
  ruleVersion: string;                            // 规则版本号，改规则时自增
  configVersion?: number;                          // 本地配置结构版本，用于迁移
  onlyRosterParticipants?: boolean;                // 保存时只保留总名单里的人（过滤 OCR 误识别的界面文字/水印）
}

/** 单玩家汇总分数 */
export interface PlayerScoreSummary {
  playerId: string;
  playerName: string;
  merit: number;
  totalScore: number;       // 最终得分
  baseScore: number;        // 基础分累计
  headCarScore: number;     // 车头加分累计
  meritScore: number;       // 功勋权重分（已废弃，保留兼容）
  battleCount: number;      // 参加场数
  externalRank?: number;    // 外部排名（用于展示和同分排序）
  rank: number;             // 排名（计算时填入）
}

// ============ 默认值 ============

export const DEFAULT_CONFIG: ScoreConfig = {
  baseScorePerBattle: 1,
  meritWeight: 0,
  headCarBonusMode: "stack",
  headCarTypes: [
    { id: "main", name: "主车头", bonusScore: 3 },
    { id: "support", name: "副车头", bonusScore: 2 },
    { id: "healer", name: "治疗车头", bonusScore: 2 },
  ],
  tieBreaker: "merit",
  allianceName: "我的盟",
  ruleVersion: "v1.0",
  configVersion: 2,
  onlyRosterParticipants: false,
};
