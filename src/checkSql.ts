import { choice, noul } from "@typesafe-ai/sdk";

import type { DangerLevel, SqlRiskAssessment, SystemOneClient } from "./types.js";

const dangerLevels = ["SAFE", "CAUTION", "DANGEROUS", "CRITICAL"] as const;

function invalidResponse(): never {
  throw new Error("Jev returned an invalid response.");
}

function readProbability(value: unknown): number {
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
  const response = await client.systemOne({
    state: { sql },
    questions: {
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

  return {
    semanticFullScanRisk: readProbability(answerMap.semanticFullScanRisk),
    destructiveRisk: readProbability(answerMap.destructiveRisk),
    reviewRequired: readProbability(answerMap.reviewRequired),
    dangerLevel: readDangerLevel(answerMap.dangerLevel),
  };
}
