import * as XLSX from "xlsx";
import type { PlayerScoreSummary } from "./types";

/** 导出排名到 Excel */
export function exportRankingsToExcel(
  rankings: PlayerScoreSummary[],
  allianceName: string
): void {
  const rows = rankings.map((r) => ({
    排名: r.rank,
    玩家: r.playerName,
    全服排名: r.externalRank ?? "",
    总名单功勋: r.merit,
    参加场次: r.battleCount,
    基础分: r.baseScore,
    车头加分: r.headCarScore,
    总分: r.totalScore,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${allianceName}排名`);

  // 自动列宽
  const colWidths = [
    { wch: 6 },  // 排名
    { wch: 16 }, // 玩家
    { wch: 10 }, // 全服排名
    { wch: 14 }, // 总名单功勋
    { wch: 10 }, // 参加场次
    { wch: 8 },  // 基础分
    { wch: 10 }, // 车头加分
    { wch: 8 },  // 总分
  ];
  ws["!cols"] = colWidths;

  const filename = `${allianceName}_排名_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
