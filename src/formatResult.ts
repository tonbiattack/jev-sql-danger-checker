import type { SqlRiskAssessment } from "./types.js";

export function formatProbability(probability: number): string {
  // 0〜1の確率を、10文字のバーと百分率へ同じ丸め規則で変換する。
  const percent = Math.round(probability * 100);
  const filled = Math.round(probability * 10);
  return `[${"#".repeat(filled)}${"-".repeat(10 - filled)}] ${percent}%`;
}

export function formatResult(sql: string, assessment: SqlRiskAssessment): string {
  // 出力を配列で組み立てることで、改行と各項目の順番を一定に保つ。
  const lines = [
    "SQL:",
    sql,
    "",
    `Semantic full scan risk  ${formatProbability(assessment.semanticFullScanRisk)}`,
    `Destructive risk         ${formatProbability(assessment.destructiveRisk)}`,
    `Review required          ${formatProbability(assessment.reviewRequired)}`,
    "",
    `Danger level: ${assessment.dangerLevel}`,
  ];

  if (assessment.dangerLevel === "CRITICAL") {
    // 最も危険な分類だけは、数値とは別に見逃しにくい警告を追加する。
    lines.push("", "YOU PROBABLY DON'T WANT TO RUN THIS.");
  }

  return `${lines.join("\n")}\n`;
}
