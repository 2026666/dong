/** 账号（用户名）与 Supabase 内部邮箱之间的转换、校验、错误文案 */

/** 内部邮箱域名：用户只看到「账号」，背后用 账号@dong.local 存 */
export const EMAIL_DOMAIN = "dong.local";

/** 账号规则：2~16 位，中文 / 字母 / 数字 / 下划线 */
export const USERNAME_RE = /^[A-Za-z0-9_\u4e00-\u9fa5]{2,16}$/;

export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 64;

/** 账号 → 内部邮箱（统一小写，避免大小写重复注册） */
export function accountToEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${EMAIL_DOMAIN}`;
}

/** 内部邮箱 → 账号 */
export function emailToAccount(email?: string | null): string {
  if (!email) return "";
  const [name] = email.split("@");
  return name ?? "";
}

export function validateUsername(value: string): string | null {
  const v = value.trim();
  if (!v) return "请输入账号";
  if (!USERNAME_RE.test(v)) return "账号为 2~16 位中文、字母、数字或下划线";
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
  [/invalid login credentials/i, "账号或密码不正确"],
  [/invalid_credentials/i, "账号或密码不正确"],
  [/email not confirmed/i, "账号还没激活：请在 Supabase 关闭 Confirm email，或让管理员手动确认"],
  [/user already registered|already been registered/i, "这个账号已经被注册了，直接登录吧"],
  [/duplicate key value.*profiles_username/i, "这个账号已经被注册了，直接登录吧"],
  [/password should be at least/i, `密码至少 ${PASSWORD_MIN} 位`],
  [/unable to validate email address/i, "账号格式不对，请用中文、字母、数字或下划线"],
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
