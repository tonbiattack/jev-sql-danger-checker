import type { SqlRiskAssessment } from "./types.js";

export function formatProbability(probability: number): string {
  const percent = Math.round(probability * 100);
  const filled = Math.round(probability * 10);
  return `[${"#".repeat(filled)}${"-".repeat(10 - filled)}] ${percent}%`;
}

export function formatResult(sql: string, assessment: SqlRiskAssessment): string {
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
    lines.push("", "YOU PROBABLY DON'T WANT TO RUN THIS.");
  }

  return `${lines.join("\n")}\n`;
}
