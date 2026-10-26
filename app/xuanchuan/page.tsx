import { redirect } from "next/navigation";

/**
 * /xuanchuan 兼容旧链接：宣传页已经搬到站点根路径 `/`，
 * 之前分享出去的 /xuanchuan 链接会被重定向到首页。
 */
export default function XuanchuanLegacyPage() {
  redirect("/");
}