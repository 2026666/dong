import type { Metadata } from "next";
import HeituClient from "./heitu-client";

export const metadata: Metadata = {
  title: "黑土安排表 · 三国冰河时代",
  description:
    "按实力把盟成员排到城池周围，自动分环，生成可以直接发到群里的黑土排布图。",
};

export default function HeituPage() {
  return <HeituClient />;
}
