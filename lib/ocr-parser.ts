import type { Participant } from "./types";

/** 游戏界面固定文案，识别后会混进玩家名里 */
const UI_NOISE = [
  "功勋不见了",
  "获得功勋",
  "本场功勋",
  "累计功勋",
  "功勋榜",
  "功勋",
  "排行榜",
  "排名",
  "本场",
  "累计",
  "玩家名",
  "玩家",
  "成员名称",
  "参战名单",
  "名单",
  "城战",
  "攻城",
  "战报",
  "战况",
];

/** 纯数字/名次类片段，不能当玩家名 */
const NOT_A_NAME = [/^\d+$/, /^\d+\+?$/, /^第?\d+[名位次]?$/, /^\d+%$/];

const NAME_CHARS = "\\u4e00-\\u9fa5A-Za-z0-9_·";
const NAME_RUN = new RegExp(`^[${NAME_CHARS}]{1,14}`);
const NAME_RUN_END = new RegExp(`[${NAME_CHARS}]{1,14}$`);
/** OCR 可能把名字和括号、标点粘在一起 */
const EDGE_PUNCT = /^[：:、,，.。·\-—_#*\s]+|[：:、,，.。·\-—_#*\s]+$/g;

export interface ParseOptions {
  /** 已导入的总名单里的玩家名：用来纠正 OCR 错字，并把盟名排除掉 */
  knownNames?: string[];
  /** 设置里的盟名，会强制当成盟名排除 */
  allianceName?: string;
  /** 判定「反复出现 = 盟名」的最少次数，默认按行数自动算 */
  minRepeat?: number;
  /** 回调：本次被当成盟名/表头剔除掉的片段，用于界面提示 */
  onAnchors?: (anchors: string[]) => void;
}

/** 各种括号：OCR 常把 ] 认成 】］]、甚至 1 —— 统一成 ASCII 方括号再处理 */
const OPEN_BRACKETS = /[［【〔(（]/g;
const CLOSE_BRACKETS = /[］】〕)）]/g;
/** 名字里绝不该出现的括号类字符（含 OCR 残留） */
const BRACKET_JUNK = /[\[\]［］【】〔〕()（）]/g;

/** OCR 残留在名字两端的杂字符，比如把 ] 认成了 1/l/_ */
const EDGE_JUNK = /^[1lI|_\-·.。,，:：;；'"`~]+|[1lI|_\-·.。,，:：;；'"`~]+$/g;

function stripNoise(rawText: string): string {
  let cleaned = rawText
    .replace(/\u00a0/g, " ")
    .replace(OPEN_BRACKETS, "[")
    .replace(CLOSE_BRACKETS, "]");
  for (const noise of UI_NOISE) {
    cleaned = cleaned.split(noise).join(" ");
  }
  return cleaned;
}

function cleanToken(token: string): string {
  // 括号类字符无论出现在哪都直接删掉，避免「桃园]张三」这种残留
  return token.replace(BRACKET_JUNK, "").replace(EDGE_PUNCT, "").trim();
}

function isNameLike(token: string): boolean {
  if (token.length < 2 || token.length > 14) return false;
  if (!new RegExp(`[${NAME_CHARS}]`).test(token)) return false;
  return !NOT_A_NAME.some((re) => re.test(token));
}

function toParticipant(name: string): Participant {
  return {
    playerId: name,
    playerName: name,
    // 上传识别只认名字，功勋一律不计（功勋只来自导入的总名单）
    merit: 0,
    headCarTypeIds: [],
  };
}

/** OCR 常见的单字符误认：把易混字符归一化后再比，能救回一部分错字 */
function normalizeForMatch(text: string): string {
  return text
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[lI|]/g, "1")
    .replace(/[Oo]/g, "0")
    .replace(/\s+/g, "")
    .toLowerCase();
}

/** 两个字符串是否只差一个字符（含增、删、改） */
function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  let j = 0;
  let diff = 0;
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    diff++;
    if (diff > 1) return false;
    if (la === lb) {
      i++;
      j++;
    } else if (la > lb) {
      i++;
    } else {
      j++;
    }
  }
  return true;
}

interface LineScan {
  /** 行内可能的名字，越靠前越可信（括号紧跟的排最前） */
  names: string[];
  /** 行内 [..] 里的内容，多半是盟名 */
  brackets: string[];
}

/** 把一行拆成「候选名字 + 括号里的盟名」 */
function scanLine(rawLine: string): LineScan {
  let text = stripNoise(rawLine).replace(/[，,、|]+/g, " ");
  // 只剩 ] 没有 [（开括号常被漏识别）：把 ] 前面那段补回成 [盟名]
  if (!text.includes("[") && text.includes("]")) {
    text = text.replace(new RegExp(`([${NAME_CHARS}]{1,12})\\]`, "g"), "[$1]");
  }
  // 只剩 [ 没有 ]（闭括号被漏识别/认成数字）：中间那段杂字符当分隔
  if (text.includes("[") && !text.includes("]")) {
    text = text.replace(
      new RegExp(`\\[([${NAME_CHARS}]{1,12})[^${NAME_CHARS}]{0,3}([${NAME_CHARS}]{2,14})`),
      "[$1]$2"
    );
  }
  // 括号里的盟名单独收集，正文里先剔掉，避免「[桃园]张三」被当成一个名字
  const brackets: string[] = [];
  const strong: string[] = [];

  const bracketRe = /\[([^\]]{1,12})\]/g;
  let match: RegExpExecArray | null;
  while ((match = bracketRe.exec(text)) !== null) {
    const tag = cleanToken(match[1]);
    if (tag && !NOT_A_NAME.some((re) => re.test(tag))) brackets.push(tag);

    // [盟名]昵称 —— 括号后面紧跟的那一段最可能是名字
    const after = text.slice(match.index + match[0].length).match(NAME_RUN);
    if (after && isNameLike(after[0])) strong.push(after[0]);
    // 昵称[盟名] —— 括号前面那一段
    const before = text.slice(0, match.index).match(NAME_RUN_END);
    if (before && isNameLike(before[0])) strong.push(before[0]);
  }

  const body = text.replace(/\[[^\]]{1,12}\]/g, " ");

  const tokens = body
    .split(/\s+/)
    .map(cleanToken)
    .filter((t) => t && isNameLike(t));

  const names: string[] = [];
  for (const t of [...strong, ...tokens]) {
    if (!names.includes(t)) names.push(t);
  }
  return { names, brackets };
}

/** 在总名单里找最接近的名字：精确 → 包含 → 一个字符的误差 */
function matchRoster(token: string, roster: string[]): string | null {
  if (roster.length === 0) return null;
  const key = normalizeForMatch(token);

  for (const name of roster) {
    if (normalizeForMatch(name) === key) return name;
  }
  // 名字被粘上了盟名/多余字符
  for (const name of roster) {
    const rk = normalizeForMatch(name);
    if (rk.length >= 3 && key.includes(rk)) return name;
    // 剩下来的只是括号残渣/数字（比如「1张三」「张3」），也认
    if (rk.length >= 2) {
      const at = key.indexOf(rk);
      if (at >= 0) {
        const left = key.slice(0, at);
        const right = key.slice(at + rk.length);
        const junk = (s: string) => s.length <= 3 && !/[\u4e00-\u9fa5]/.test(s);
        if (junk(left) && junk(right)) return name;
      }
    }
  }
  // OCR 少认了字
  for (const name of roster) {
    const rk = normalizeForMatch(name);
    if (key.length >= 3 && rk.includes(key) && rk.length - key.length <= 1) return name;
  }
  // 认错了一个字
  for (const name of roster) {
    const rk = normalizeForMatch(name);
    if (rk.length >= 4 && key.length >= 4 && withinOneEdit(key, rk)) return name;
  }
  return null;
}

function bestOf(candidates: string[]): string | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, t) => {
    if (t.length !== best.length) return t.length > best.length ? t : best;
    // 同长度优先带汉字的（数字串更像名次/功勋）
    const tCjk = /[\u4e00-\u9fa5]/.test(t);
    const bCjk = /[\u4e00-\u9fa5]/.test(best);
    return tCjk && !bCjk ? t : best;
  }, candidates[0]);
}

/**
 * 从 OCR 原始文本解析出参战玩家名单。
 *
 * 只识别「名字」，不识别功勋：功勋统一从导入的总名单里取。
 *
 * 三道防线（按可靠程度）：
 *   1. 总名单比对：识别结果和已导入的名字对得上就采用总名单里的写法（自动纠错字）
 *   2. 重复盟名剥离：同一段文字在大部分行里都出现 → 那是盟名/表头，从名字里剥掉
 *      （支持 `[盟名]昵称`、`盟名 昵称`、以及和昵称粘在一起的 `盟名昵称`）
 *   3. 兜底：行内剩下的最长合法片段
 */
export function parseOcrText(rawText: string, options: ParseOptions = {}): Participant[] {
  if (!rawText.trim()) return [];

  const roster = (options.knownNames ?? [])
    .map((n) => n.trim())
    .filter((n) => n.length > 0);

  const scans = rawText.split(/\r?\n/).map(scanLine);

  // ---- 统计反复出现的片段，作为「盟名」候选 ----
  const counts = new Map<string, number>();
  const bump = (token: string) => {
    counts.set(token, (counts.get(token) ?? 0) + 1);
  };
  for (const scan of scans) {
    for (const t of scan.brackets) bump(t);
    for (const t of scan.names) bump(t);
  }
  const nonEmptyLines = scans.filter(
    (s) => s.names.length + s.brackets.length > 0
  ).length;
  const threshold =
    options.minRepeat ??
    Math.max(2, Math.ceil(Math.max(1, nonEmptyLines) * 0.5));

  const rosterKeys = new Set(roster.map(normalizeForMatch));
  const forcedAlliance = (options.allianceName ?? "")
    .split(/[\s,，、]+/)
    .map(cleanToken)
    .filter((n) => n.length >= 2);

  const anchors = Array.from(counts.entries())
    .filter(([token, count]) => {
      if (count < threshold) return false;
      // 总名单里真有这个名字，说明是玩家，不能当盟名剥掉
      if (rosterKeys.has(normalizeForMatch(token))) return false;
      return true;
    })
    .map(([token]) => token)
    .concat(forcedAlliance)
    .sort((a, b) => b.length - a.length);

  // ---- 第二道：若盟名和昵称句句粘在一起（从没单独出现），
  //      就借总名单反推：把「总名单名字」从片段里剜掉，剩下的若反复出现，那就是盟名 ----
  if (roster.length > 0) {
    const leftovers = new Map<string, number>();
    for (const scan of scans) {
      for (const token of scan.names) {
        for (const name of roster) {
          if (token.length <= name.length) continue;
          if (token.endsWith(name)) {
            const prefix = token.slice(0, token.length - name.length);
            if (isNameLike(prefix)) leftovers.set(prefix, (leftovers.get(prefix) ?? 0) + 1);
          } else if (token.startsWith(name)) {
            const suffix = token.slice(name.length);
            if (isNameLike(suffix)) leftovers.set(suffix, (leftovers.get(suffix) ?? 0) + 1);
          }
        }
      }
    }
    for (const [token, count] of leftovers) {
      if (count >= threshold && !anchors.includes(token)) anchors.push(token);
    }
    anchors.sort((a, b) => b.length - a.length);
  }

  // ---- 第三道：连总名单都没有、盟名又句句粘连时，
  //      把所有名字的共同前缀（2~6 字、多数行都有）当作盟名 ----
  if (anchors.length === 0) {
    const shared = new Map<string, number>();
    const add = (piece: string) => {
      if (!piece || piece.length < 2 || piece.length > 6 || !isNameLike(piece)) return;
      shared.set(piece, (shared.get(piece) ?? 0) + 1);
    };
    for (const scan of scans) {
      const token = scan.names[0];
      if (!token || token.length < 4) continue;
      for (let len = 2; len <= Math.min(6, token.length - 2); len++) {
        add(token.slice(0, len));
      }
    }
    const needed = Math.max(3, Math.ceil(scans.length * 0.6));
    for (const [piece, count] of shared) {
      if (count >= needed) anchors.push(piece);
    }
    anchors.sort((a, b) => b.length - a.length);
  }

  const stripAnchor = (token: string): string | null => {
    let next = token;
    let stripped = false;
    for (const anchor of anchors) {
      if (next.length > anchor.length + 1 && next.startsWith(anchor)) {
        next = next.slice(anchor.length);
        stripped = true;
        break;
      }
    }
    for (const anchor of anchors) {
      if (next.length > anchor.length + 1 && next.endsWith(anchor)) {
        next = next.slice(0, -anchor.length);
        stripped = true;
        break;
      }
    }
    next = next.replace(BRACKET_JUNK, "").trim();
    // 剥掉盟名后经常残留半截括号（比如 ] 被认成 1），这时才清两端的杂字符，
    // 否则会把「啸遥1110」这种名字里的数字也削掉
    if (stripped) next = next.replace(EDGE_JUNK, "").trim();
    return isNameLike(next) ? next : null;
  };

  const pickFromScan = (scan: LineScan): string | null => {
    const candidates: string[] = [];
    for (const raw of scan.names) {
      const stripped = stripAnchor(raw);
      if (stripped && !candidates.includes(stripped)) candidates.push(stripped);
    }

    // 1) 总名单优先
    for (const candidate of candidates) {
      const hit = matchRoster(candidate, roster);
      if (hit) return hit;
    }
    // 2) 剩下不是盟名的里面挑
    const rest = candidates.filter((c) => !anchors.includes(c));
    return bestOf(rest);
  };

  const names: string[] = [];
  for (const scan of scans) {
    const name = pickFromScan(scan);
    if (name && !names.includes(name)) names.push(name);
  }

  if (anchors.length > 0) options.onAnchors?.(anchors);

  // 全部落空（比如被误判成盟名全剥光了）→ 退回最朴素的「行内最长片段」
  if (names.length === 0) {
    for (const scan of scans) {
      const name = bestOf(scan.names);
      if (name && !names.includes(name)) names.push(name);
    }
  }

  return names.map(toParticipant);
}