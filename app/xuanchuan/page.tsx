import type { Metadata } from "next";
import LandingClient from "./landing-client";

export const metadata: Metadata = {
  title: "三国冰河 · 盟战统计",
  description:
    "截图识别参战名单、自动计分、同分按赛季功勋排序、一键导出。免登录直接使用，数据只保存在本机浏览器。",
};

export default function XuanchuanPage() {
  return <LandingClient />;
}
