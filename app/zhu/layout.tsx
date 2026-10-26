import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "功能主页 · 三国冰河时代",
  description: "赛季功勋分配、城战截图识别、总排行榜与规则配置，统一的功能入口",
};

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
