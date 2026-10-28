/** 账号（邮箱 + 密码）校验与错误文案翻译 */

export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 64;

/**
 * 邮箱格式校验：够用即可。
 * 用真实邮箱（如 QQ 邮箱）当账号，Supabase 侧不会有「域名非法」的问题。
 */
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

/** 统一小写，避免大小写重复注册 */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** 邮箱前缀当展示昵称 */
export function displayName(email: string): string {
  const name = normalizeEmail(email).split("@")[0] ?? "";
  return name || "盟成员";
}

export function validateEmail(value: string): string | null {
  const v = normalizeEmail(value);
  if (!v) return "请输入邮箱";
  if (v.length > 120) return "邮箱太长了";
  if (!EMAIL_RE.test(v)) return "邮箱格式不对，例如 12345678@qq.com";
  return null;
}

export function validatePassword(value: string): string | null {
  if (!value) return "请输入密码";
  if (value.length < PASSWORD_MIN) return `密码至少 ${PASSWORD_MIN} 位`;
  if (value.length > PASSWORD_MAX) return `密码最多 ${PASSWORD_MAX} 位`;
  return null;
}

export function validateConfirm(password: string, confirm: string): string | null {
  if (!confirm) return "请再输入一次密码";
  if (password !== confirm) return "两次输入的密码不一致";
  return null;
}

const ERROR_MAP: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "邮箱或密码不正确"],
  [/invalid_credentials/i, "邮箱或密码不正确"],
  [/email not confirmed/i, "这个账号还没激活：请在 Supabase 关闭 Confirm email 后再注册"],
  [/email_address_invalid/i, "邮箱格式不对，例如 12345678@qq.com"],
  [/user already registered|already been registered/i, "这个邮箱已经注册过了，直接登录吧"],
  [/password should be at least/i, `密码至少 ${PASSWORD_MIN} 位`],
  [/unable to validate email address/i, "邮箱格式不对，例如 12345678@qq.com"],
  [/signups not allowed/i, "当前项目已关闭注册，请联系管理员"],
  [/email rate limit exceeded/i, "发送过于频繁，请稍后再试"],
  [/over_email_send_rate_limit/i, "发送过于频繁，请稍后再试"],
  [/database error saving new user/i, "注册失败：请确认已执行过 supabase/schema.sql"],
  [/relation .* does not exist/i, "数据库还没建表：请先在 Supabase 执行 supabase/schema.sql"],
  [/failed to fetch|networkerror|network request failed/i, "网络连接失败：当前网络可能访问不了 supabase.co"],
];

/** 把 Supabase 的英文报错翻译成中文提示 */
export function translateAuthError(message: string): string {
  const raw = (message ?? "").trim();
  for (const [pattern, text] of ERROR_MAP) {
    if (pattern.test(raw)) return text;
  }
  return raw || "操作失败，请稍后重试";
}
