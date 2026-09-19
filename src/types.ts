export type DangerLevel = "SAFE" | "CAUTION" | "DANGEROUS" | "CRITICAL";

export interface SqlRiskAssessment {
  semanticFullScanRisk: number;
  destructiveRisk: number;
  reviewRequired: number;
  dangerLevel: DangerLevel;
}

export interface SystemOneClient {
  systemOne(request: unknown): Promise<unknown>;
}
