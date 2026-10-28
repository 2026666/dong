import type { Metadata } from "next";
import ConsoleClient from "./console-client";

export const metadata: Metadata = {
  title: "控制台 · 三国冰河",
  description: "注册、访问与数据量统计",
  robots: { index: false, follow: false },
};

export default function ConsolePage() {
  return <ConsoleClient />;
}
