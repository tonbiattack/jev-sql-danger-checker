import { choice, noul } from "@typesafe-ai/sdk";

import type { DangerLevel, SqlRiskAssessment, SystemOneClient } from "./types.js";

const dangerLevels = ["SAFE", "CAUTION", "DANGEROUS", "CRITICAL"] as const;

function invalidResponse(): never {
  // SDKやAPIの応答形式が変わっても、未検証の値を危険度として表示しない。
  throw new Error("Jev returned an invalid response.");
}

function readProbability(value: unknown): number {
  // 外部APIの値はunknownとして受け、0から1までの有限数値だけを採用する。
  if (
    typeof value !== "object" ||
    value === null ||
    !("noul" in value) ||
    typeof value.noul !== "number" ||
    !Number.isFinite(value.noul) ||
    value.noul < 0 ||
    value.noul > 1
  ) {
    return invalidResponse();
  }

  return value.noul;
}

function readDangerLevel(value: unknown): DangerLevel {
  // Choiceの結果は、CLIが表示できる4段階のラベルだけに限定する。
  if (
    typeof value !== "object" ||
    value === null ||
    !("choice" in value) ||
    typeof value.choice !== "string" ||
    !dangerLevels.includes(value.choice as DangerLevel)
  ) {
    return invalidResponse();
  }

  return value.choice as DangerLevel;
}

export async function checkSql(sql: string, client: SystemOneClient): Promise<SqlRiskAssessment> {
  // 1回のSystem One呼び出しで、互いに独立した4つの判断を同時に依頼する。
  const response = await client.systemOne({
    state: { sql },
    questions: {
      // 実行計画ではなく、SQL文面から推測できる「多数行に及ぶ可能性」を問う。
      semanticFullScanRisk: noul(
        "Could this SQL potentially scan or affect most or all rows of a table?",
      ),
      destructiveRisk: noul(
        "Could executing this SQL cause destructive or difficult-to-recover data changes?",
      ),
      reviewRequired: noul(
        "Should this SQL require human review before execution in a production database?",
      ),
      dangerLevel: choice("Classify the operational risk of executing this SQL in production.", {
        // 自由文ではなく固定ラベルを使うため、出力の分岐を安全に扱える。
        SAFE: "Low operational risk.",
        CAUTION: "Some operational risk; review context before execution.",
        DANGEROUS: "High operational risk; human review is strongly advised.",
        CRITICAL: "Extremely high operational risk; execution is likely unsafe.",
      }),
    },
  });

  if (typeof response !== "object" || response === null || !("answers" in response)) {
    return invalidResponse();
  }

  const { answers } = response;
  if (typeof answers !== "object" || answers === null) {
    return invalidResponse();
  }

  const answerMap = answers as Record<string, unknown>;

  // SDK固有の応答を、CLIが扱う小さく安定したドメイン型へ変換する。
  return {
    semanticFullScanRisk: readProbability(answerMap.semanticFullScanRisk),
    destructiveRisk: readProbability(answerMap.destructiveRisk),
    reviewRequired: readProbability(answerMap.reviewRequired),
    dangerLevel: readDangerLevel(answerMap.dangerLevel),
  };
}
