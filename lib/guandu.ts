/**
 * 官渡之战安排：纯逻辑（不含 DOM / Canvas）
 * ---------------------------------------------------------------------------
 * 规则（已与用户确认）：
 *   · 只安排 30 个正式人员；名单超过 30 人时取实力前 30，多的人不排（页面只提示数量）
 *   · 实力前五命名为队长：第 1 → 一队（兵器坊），第 2 → 三队（工匠坊），第 3 → 二队，第 4 → 四队，第 5 → 机动队
 *   · 点两个位置互换、每个位置下拉选人，都在 UI 层调用这里的纯函数
 */

export type GuanduMember = {
  name: string;
  /** 实力，排序主键 */
  power: number;
  /** 总功勋，实力相同时的第二排序键 */
  merit: number;
  /** 名单里的原始序号，最后兜底 */
  seq: number;
};

export type GuanduRow = {
  /** 成员号列文案：队长车头 / 队员1 / 车头 … */
  label: string;
  /** 位置上的人名，空串表示空缺 */
  name: string;
  /** 队伍列的分组标签（五队的三路小粮仓）；相邻同组会合并成一个单元格 */
  group?: string;
  /** 队长 / 车头位，出图时高亮 */
  lead?: boolean;
  /** 这一行自己的 21:05 任务（五队三组各不相同），有就覆盖队级任务 */
  startTask?: string;
};

export type GuanduTeam = {
  id: string;
  name: string;
  /** 主要目标建筑，界面上做成小标签 */
  target?: string;
  /** 21:05 / 21:15 / 21:25 三波任务 */
  tasks: [string, string, string];
  rows: GuanduRow[];
  /** 队伍列显示分组名而不是队名（五队） */
  grouped?: boolean;
};

export type GuanduPlan = {
  title: string;
  teams: GuanduTeam[];
  /** 替补（图上「替补队」一行两个名字，最多 10 人；不传就空着） */
  substitutes: string[];
  /** 右侧备注（长规则） */
  remark: string;
  /** 底部注意事项 */
  notes: string;
  updatedAt: string;
};

export type SlotPos = { team: number; row: number };

export const OFFICIAL_LIMIT = 30;
/** 替补最多 10 人 */
export const SUBSTITUTE_LIMIT = 10;
/** 图上替补队固定画 5 行（一行两个名字） */
export const SUBSTITUTE_ROWS = 5;
/** 实力前几名叫队长 */
export const LEADER_COUNT = 5;

export const DEFAULT_TITLE = "官渡作战表";

export const DEFAULT_REMARK = [
  "1、准备时间：青囊术8分/次，每次20万兵，免费高迁5分钟一次，车头注意看情况吃药；",
  "2、建筑物没有驻防时不需要集结，有敌方驻防时车头开集结，大家上车，单兵卡车头时间如同攻城战：都上自己所在区域车头的车，别上其他区。21点5分之前必须要进地图，替补也需要提前进来，21点6分主力还没进的话，替补即可登场；",
  "3、记住几个重要的时间点，21点15分鸟巢开放，21点25分霹雳车、官渡、大粮仓开放，辎重车21点12分、21点18分、21点25分；",
  "4、安排成员可以满编进驻守，其他地方蹭分成员派少量兵即可；",
  "5、分数等级奖：个人50W分（满分），20W分（低保），鸟巢、官渡、兵器坊、大粮仓、霹雳车是全战重点目标，小粮仓与工匠坊兵力不够的情况下，可以适时放弃，确保战略目标在手，辎重车回来以后才会有加分，要记得快点结束的时候收兵；",
  "6、若稳赢的局面尽量让所有人拿满50W分，同盟达到150W分则会提前结束（这里跟个人拿分多少无关，只与占领建筑数量有关）。分数达标者可用高迁把所有兵召回，去支援其他地方；",
  "7、若官渡拿不下来，则尽可能多地去挖辎重车（把地图缩小的地上的胶囊）；蓝色代表我方占领，红色代表敌方占领。",
  "8、（安排表仅作参照，初始人员分布尽量按照此表进行，后续实战灵活安排，例如小粮仓可以留人其他人支援工匠坊兵器坊）",
].join("\n");

export const DEFAULT_NOTES = [
  "①兵配比6.1.3或5.2.3；",
  "②尽量多派几队兵驻防建筑，打人分加的不多；",
  "③所有任务如有变动具体听从现场指挥；",
  "④队长在战场上都可以机动，随机应变；",
  "⑤官渡打不下来，就去找人少的任何建筑占领；",
  "⑥占领建筑后，其他人去大粮仓或游走驻防；",
  "⑦所有替补进来的优先抢我方没人或者人少的小粮仓；",
  "⑧如果自己驻防的位置没有对方人员，那么高迁至需要的地方进行驻防。",
].join("\n");

/* ------------------------------ 名单解析 ------------------------------ */

const NAME_KEYS = ["成员名称", "成员名", "成员", "名字", "名称", "玩家名", "玩家", "昵称", "姓名"];
/** 「实力」一定是首选；没有表头时才退到「战力」 */
const POWER_KEYS = ["实力", "总战力", "战力", "战斗力"];
const MERIT_KEYS = ["总功勋", "累计功勋", "功勋"];
const SEQ_KEYS = ["序号", "排名", "名次"];

export type GuanduParseResult = {
  members: GuanduMember[];
  /** 命中的列下标（-1 表示没这一列），便于界面提示 */
  columns: { name: number; power: number; merit: number; seq: number };
  /** 实力列的表头文案，比如「实力」 */
  powerLabel: string;
  hasHeader: boolean;
};

function toNumber(input: string): number {
  const cleaned = String(input ?? "").replace(/[,\s，]/g, "");
  if (!cleaned) return 0;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : 0;
}

function isNumericCell(value: string): boolean {
  return /^-?\d+(\.\d+)?$/.test(value.trim());
}

function numericRatioOf(rows: string[][], col: number): number {
  if (col < 0) return 0;
  const values = rows.map((row) => (row[col] ?? "").trim()).filter(Boolean);
  if (!values.length) return 0;
  return values.filter(isNumericCell).length / values.length;
}

function findColumn(header: string[], keys: string[]): number {
  for (const key of keys) {
    const index = header.findIndex((cell) => cell.replace(/\s/g, "") === key);
    if (index >= 0) return index;
  }
  for (const key of keys) {
    const index = header.findIndex((cell) => cell.includes(key));
    if (index >= 0) return index;
  }
  return -1;
}

/** 名字列：非数字占比最高的那一列 */
function pickNameColumn(rows: string[][], cols: number): number {
  let best = 0;
  let bestScore = -1;
  for (let col = 0; col < cols; col += 1) {
    const values = rows.map((row) => (row[col] ?? "").trim()).filter(Boolean);
    if (!values.length) continue;
    const score = values.filter((v) => !isNumericCell(v)).length / values.length;
    if (score > bestScore) {
      bestScore = score;
      best = col;
    }
  }
  return bestScore > 0 ? best : 0;
}

/** 没有表头时的实力列：取最后一个纯数字列（名单里「实力」一般收在末尾） */
function pickPowerColumn(rows: string[][], cols: number, skip: number): number {
  let best = -1;
  for (let col = cols - 1; col >= 0; col -= 1) {
    if (col === skip) continue;
    const values = rows.map((row) => (row[col] ?? "").trim()).filter(Boolean);
    if (!values.length) continue;
    if (values.filter(isNumericCell).length / values.length < 0.9) continue;
    best = col;
    break;
  }
  return best;
}

export function splitTableText(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(/\t+|\s{2,}|[，,]/).map((cell) => cell.trim()));
}

export function parseGuanduRoster(text: string): GuanduParseResult {
  return parseGuanduRows(splitTableText(text));
}

export function parseGuanduRows(rows: string[][]): GuanduParseResult {
  const empty: GuanduParseResult = {
    members: [],
    columns: { name: -1, power: -1, merit: -1, seq: -1 },
    powerLabel: "",
    hasHeader: false,
  };

  const cleaned = rows
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.some((cell) => cell.trim()));
  if (!cleaned.length) return empty;

  const header = cleaned[0];
  const hasHeader = findColumn(header, NAME_KEYS) >= 0;
  const body = hasHeader ? cleaned.slice(1) : cleaned;
  if (!body.length) return { ...empty, hasHeader };

  const bodyCols = body.reduce((max, row) => Math.max(max, row.length), 0);
  // 表头常比数据行少一列（数据行行首多一个序号），按数据行列数对齐
  const offset = hasHeader ? Math.max(0, bodyCols - header.length) : 0;
  const align = (index: number) =>
    index < 0 ? -1 : Math.min(index + offset, Math.max(0, bodyCols - 1));

  let nameIndex = align(findColumn(header, NAME_KEYS));
  let powerIndex = align(findColumn(header, POWER_KEYS));
  let meritIndex = align(findColumn(header, MERIT_KEYS));
  let seqIndex = align(findColumn(header, SEQ_KEYS));

  if (nameIndex < 0 || numericRatioOf(body, nameIndex) > 0.5) {
    nameIndex = pickNameColumn(body, bodyCols);
  }
  if (powerIndex < 0 || powerIndex === nameIndex || numericRatioOf(body, powerIndex) < 0.5) {
    powerIndex = pickPowerColumn(body, bodyCols, nameIndex);
  }
  if (meritIndex >= 0 && (numericRatioOf(body, meritIndex) < 0.5 || meritIndex === nameIndex)) {
    meritIndex = -1;
  }
  if (seqIndex >= 0 && numericRatioOf(body, seqIndex) < 0.5) {
    seqIndex = -1;
  }

  const members: GuanduMember[] = [];
  const seen = new Set<string>();
  body.forEach((row, index) => {
    const name = (row[nameIndex] ?? "").trim();
    if (!name || /^[\d.,，]+$/.test(name)) return;
    if (seen.has(name)) return;
    seen.add(name);
    members.push({
      name,
      power: powerIndex >= 0 ? toNumber(row[powerIndex]) : 0,
      merit: meritIndex >= 0 ? toNumber(row[meritIndex]) : 0,
      seq: (seqIndex >= 0 ? toNumber(row[seqIndex]) : 0) || index + 1,
    });
  });

  return {
    members,
    columns: { name: nameIndex, power: powerIndex, merit: meritIndex, seq: seqIndex },
    powerLabel: hasHeader && powerIndex >= 0 ? header[powerIndex - offset] ?? "" : "",
    hasHeader,
  };
}

/** 实力高的在前；实力相同看总功勋；再相同看原序号 */
export function sortMembers(members: GuanduMember[]): GuanduMember[] {
  return [...members].sort(
    (a, b) =>
      b.power - a.power ||
      b.merit - a.merit ||
      a.seq - b.seq ||
      a.name.localeCompare(b.name, "zh"),
  );
}

/* ------------------------------ 蛇形分配 ------------------------------ */

/**
 * 把 people 依次发到各队：每轮每队一个人，轮次之间方向来回翻转（蛇形），
 * 队满就跳过，保证各队实力尽量接近。
 */
export function snakeDeal(people: string[], caps: number[]): string[][] {
  const out: string[][] = caps.map(() => []);
  let index = 0;
  let forward = true;
  while (index < people.length) {
    const order = caps.map((_, i) => i);
    if (!forward) order.reverse();
    let placed = false;
    for (const teamIndex of order) {
      if (index >= people.length) break;
      if (out[teamIndex].length >= caps[teamIndex]) continue;
      out[teamIndex].push(people[index]);
      index += 1;
      placed = true;
    }
    if (!placed) break; // 所有队都满了
    forward = !forward;
  }
  return out;
}

/* ------------------------------ 生成方案 ------------------------------ */

/** 一~四队：队长车头 + 队员1-4；机动队：队长车头 + 队员2/3/4（照原表编号） */
const TEAM_LABELS: Record<string, string[]> = {
  t1: ["队长车头", "队员1", "队员2", "队员3", "队员4"],
  t2: ["队长车头", "队员1", "队员2", "队员3", "队员4"],
  t3: ["队长车头", "队员1", "队员2", "队员3", "队员4"],
  t4: ["队长车头", "队员1", "队员2", "队员3", "队员4"],
  t6: ["队长车头", "队员2", "队员3", "队员4"],
};

/** 五队：我方上 / 中 / 下路小粮仓，每组两人，成员号列合并显示组名 */
const WU_DUI_GROUPS = [
  { group: "我方上路小粮仓", start: "开局飞我方上路小粮仓（阳武\\封丘）" },
  { group: "我方中路小粮仓", start: "开局飞我方中路小粮仓（延津\\白马）" },
  { group: "我方下路小粮仓", start: "开局飞我方下路小粮仓（原武\\燕县）" },
];

function fillRows(labels: string[], names: string[]): GuanduRow[] {
  return labels.map((label, i) => {
    const row: GuanduRow = { label, name: names[i] ?? "" };
    if (i === 0) row.lead = true;
    return row;
  });
}

/** 替补清洗：去空、去重、剔除已在正式 30 人里的、最多留 10 个（顺序保持传入顺序） */
export function normalizeSubstitutes(names: string[], officialNames: string[]): string[] {
  const official = new Set(officialNames);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of names) {
    const name = (raw ?? "").trim();
    if (!name || official.has(name) || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
    if (result.length >= SUBSTITUTE_LIMIT) break;
  }
  return result;
}

/**
 * 按名单生成初始方案（默认样式照用户的官渡作战表）。
 * official：已确认参赛的成员（顺序无所谓，这里会按实力重排，只取前 30）。
 *
 * 队长（前五名）：第 1 → 一队，第 2 → 三队，第 3 → 二队，第 4 → 四队，第 5 → 机动队。
 * 强组 = 一 / 二 / 三 / 四队（各 5 人：队长车头 + 队员1-4），剩下的高实力者在这四队之间蛇形；
 * 弱组 = 五队（三路小粮仓各 2 人）+ 机动队（队员2/3/4），剩下的人在这两处蛇形。
 * 替补：只画在图上「替补队」一块，不参与换人；没传就空着。
 */
export function buildPlan(
  official: GuanduMember[],
  substitutes: string[] = [],
  base?: Partial<Pick<GuanduPlan, "title" | "remark" | "notes" | "substitutes">>,
): GuanduPlan {
  const sorted = sortMembers(official).slice(0, OFFICIAL_LIMIT);
  const leaders = sorted.slice(0, LEADER_COUNT).map((m) => m.name);
  const rest = sorted.slice(LEADER_COUNT).map((m) => m.name);
  const subs = normalizeSubstitutes(
    base?.substitutes ?? substitutes,
    sorted.map((m) => m.name),
  );

  // 强组：一 / 二 / 三 / 四队，各 4 个队员（蛇形均衡）
  const strong = snakeDeal(rest.slice(0, 16), [4, 4, 4, 4]);
  // 弱组：五队 6 人（三路小粮仓各 2 人）、机动队 3 人
  const weak = snakeDeal(rest.slice(16), [6, 3]);

  const leader = (i: number) => leaders[i] ?? "";

  // 五队：weak[0] 按 2 人一组落到三路小粮仓
  const wuRows: GuanduRow[] = [];
  WU_DUI_GROUPS.forEach((item, g) => {
    for (let k = 0; k < 2; k += 1) {
      wuRows.push({
        label: k === 0 ? "车头" : "队员1",
        name: weak[0][g * 2 + k] ?? "",
        group: item.group,
        startTask: item.start,
      });
    }
  });

  const teams: GuanduTeam[] = [
    {
      id: "t1",
      name: "一队",
      target: "兵器坊",
      tasks: ["开局飞兵器坊", "乌巢", "官渡"],
      rows: fillRows(TEAM_LABELS.t1, [leader(0), ...strong[0]]),
    },
    {
      id: "t2",
      name: "二队",
      target: "兵器坊",
      tasks: [
        "开局飞兵器坊",
        "队长不动，其他人看情况支援乌巢",
        "抢左大粮仓（敖昌），没抢到接手兵器坊驻防",
      ],
      rows: fillRows(TEAM_LABELS.t2, [leader(2), ...strong[1]]),
    },
    {
      id: "t3",
      name: "三队",
      target: "工匠坊",
      tasks: [
        "开局飞工匠坊（对方下路小粮仓）",
        "乌巢",
        "官渡（抢最后一波乌巢）",
      ],
      rows: fillRows(TEAM_LABELS.t3, [leader(1), ...strong[2]]),
    },
    {
      id: "t4",
      name: "四队",
      target: "工匠坊",
      tasks: [
        "开局飞工匠坊（对方上路小粮仓）",
        "工匠坊守不住就去打对方中路小粮仓",
        "霹雳车",
      ],
      rows: fillRows(TEAM_LABELS.t4, [leader(3), ...strong[3]]),
    },
    {
      id: "t5",
      name: "五队",
      target: "三路小粮仓",
      grouped: true,
      tasks: [
        "",
        "开局没抢到小粮仓就机动支援其他建筑",
        "1、2、3 协助抢左大粮仓（敖昌）\n4、5、6 协助抢右大粮仓（黎阳）",
      ],
      rows: wuRows,
    },
    {
      id: "t6",
      name: "机动队",
      target: "补位",
      tasks: [
        "开局看情况帮工匠或者兵器（没抢下来的）",
        "补位",
        "看官渡情况（官渡没抢到接手工匠坊驻防）官渡赢抢右大粮仓（黎阳）",
      ],
      rows: fillRows(TEAM_LABELS.t6, [leader(4), ...weak[1]]),
    },
  ];

  return {
    title: base?.title ?? DEFAULT_TITLE,
    teams,
    substitutes: subs,
    remark: base?.remark ?? DEFAULT_REMARK,
    notes: base?.notes ?? DEFAULT_NOTES,
    updatedAt: new Date().toISOString(),
  };
}


/* ------------------------------ 编辑操作 ------------------------------ */

export function clonePlan(plan: GuanduPlan): GuanduPlan {
  return {
    ...plan,
    substitutes: [...(plan.substitutes ?? [])],
    teams: plan.teams.map((team) => ({
      ...team,
      tasks: [...team.tasks] as [string, string, string],
      rows: team.rows.map((row) => ({ ...row })),
    })),
  };
}

/** 直接设置替补名单（会做清洗与封顶 10 人） */
export function setSubstitutes(plan: GuanduPlan, names: string[]): GuanduPlan {
  const next = clonePlan(plan);
  next.substitutes = normalizeSubstitutes(names, plannedNames(plan));
  next.updatedAt = new Date().toISOString();
  return next;
}

export function locateName(plan: GuanduPlan, name: string): SlotPos | null {
  if (!name) return null;
  for (let team = 0; team < plan.teams.length; team += 1) {
    const rows = plan.teams[team].rows;
    for (let row = 0; row < rows.length; row += 1) {
      if (rows[row].name === name) return { team, row };
    }
  }
  return null;
}

/** 两个位置互换（队长位不动，只换人） */
export function swapSlots(plan: GuanduPlan, a: SlotPos, b: SlotPos): GuanduPlan {
  const next = clonePlan(plan);
  const nameA = next.teams[a.team].rows[a.row].name;
  const nameB = next.teams[b.team].rows[b.row].name;
  next.teams[a.team].rows[a.row].name = nameB;
  next.teams[b.team].rows[b.row].name = nameA;
  return touch(next);
}

/**
 * 把人放到某个位置：
 * · 他已经在别的队里 → 两边互换
 * · 其它情况（名单里还没安排的人）→ 直接占位，原本的人变成未安排
 */
export function assignToSlot(plan: GuanduPlan, pos: SlotPos, name: string): GuanduPlan {
  const next = clonePlan(plan);
  const slot = next.teams[pos.team].rows[pos.row];
  const previous = slot.name;
  const target = name.trim();

  if (!target) {
    slot.name = "";
    return touch(next);
  }
  if (previous === target) return plan;

  const existing = locateName(next, target);
  if (existing) {
    next.teams[existing.team].rows[existing.row].name = previous;
    slot.name = target;
    return touch(next);
  }

  slot.name = target;
  return touch(next);
}

export function setTeamTask(
  plan: GuanduPlan,
  teamIndex: number,
  slot: 0 | 1 | 2,
  value: string,
): GuanduPlan {
  const next = clonePlan(plan);
  const team = next.teams[teamIndex];
  if (!team) return plan;
  team.tasks[slot] = value;
  return touch(next);
}

/** 改「某个小组」的 21:05 任务（五队三路小粮仓各写各的） */
export function setGroupStartTask(
  plan: GuanduPlan,
  teamIndex: number,
  group: string,
  value: string,
): GuanduPlan {
  const next = clonePlan(plan);
  const team = next.teams[teamIndex];
  if (!team) return plan;
  team.rows = team.rows.map((row) =>
    row.group === group ? { ...row, startTask: value } : row,
  );
  return touch(next);
}

export function setTeamName(plan: GuanduPlan, teamIndex: number, value: string): GuanduPlan {
  const next = clonePlan(plan);
  const team = next.teams[teamIndex];
  if (!team) return plan;
  team.name = value;
  return touch(next);
}

export function setPlanText(
  plan: GuanduPlan,
  patch: Partial<Pick<GuanduPlan, "title" | "remark" | "notes">>,
): GuanduPlan {
  return touch({ ...clonePlan(plan), ...patch });
}

function touch(plan: GuanduPlan): GuanduPlan {
  plan.updatedAt = new Date().toISOString();
  return plan;
}

/* ------------------------------ 派生信息 ------------------------------ */

export function plannedNames(plan: GuanduPlan): string[] {
  const names: string[] = [];
  for (const team of plan.teams) {
    for (const row of team.rows) {
      if (row.name && !names.includes(row.name)) names.push(row.name);
    }
  }
  return names;
}

export function plannedCount(plan: GuanduPlan): number {
  return plan.teams.reduce(
    (total, team) => total + team.rows.filter((row) => row.name).length,
    0,
  );
}

export function slotCount(plan: GuanduPlan): number {
  return plan.teams.reduce((total, team) => total + team.rows.length, 0);
}

/** 名单里还没安排进任何一个位置的人 */
export function unarrangedNames(plan: GuanduPlan, rosterNames: string[]): string[] {
  const placed = new Set(plannedNames(plan));
  return rosterNames.filter((name) => !placed.has(name));
}
