import type { Metadata } from "next";
import GuanduClient from "./guandu-client";

export const metadata: Metadata = {
  title: "官渡之战安排 · 三国冰河时代",
  description:
    "上传盟员名单与参战截图，按实力排出官渡之战 30 人阵容，可互换微调并生成作战表图片。",
};

export default function GuanduPage() {
  return <GuanduClient />;
}
