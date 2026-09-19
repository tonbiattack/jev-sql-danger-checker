import { describe, expect, it, vi } from "vitest";

import { checkSql } from "../src/checkSql.js";

const validResponse = {
  answers: {
    semanticFullScanRisk: { noul: 0.98 },
    destructiveRisk: { noul: 0.99 },
    reviewRequired: { noul: 0.99 },
    dangerLevel: { choice: "CRITICAL" },
  },
};

describe("checkSql", () => {
  it("maps four Jev answers into a SQL risk assessment", async () => {
    const client = { systemOne: vi.fn().mockResolvedValue(validResponse) };

    await expect(checkSql("DELETE FROM users;", client)).resolves.toEqual({
      semanticFullScanRisk: 0.98,
      destructiveRisk: 0.99,
      reviewRequired: 0.99,
      dangerLevel: "CRITICAL",
    });

    expect(client.systemOne).toHaveBeenCalledWith(
      expect.objectContaining({
        state: { sql: "DELETE FROM users;" },
        questions: expect.objectContaining({
          semanticFullScanRisk: expect.anything(),
          destructiveRisk: expect.anything(),
          reviewRequired: expect.anything(),
          dangerLevel: expect.anything(),
        }),
      }),
    );
  });

  it.each([Number.NaN, 1.01, -0.01])("rejects an invalid probability of %p", async (noul) => {
    const client = {
      systemOne: vi.fn().mockResolvedValue({
        ...validResponse,
        answers: { ...validResponse.answers, semanticFullScanRisk: { noul } },
      }),
    };

    await expect(checkSql("SELECT * FROM users;", client)).rejects.toThrow(
      "Jev returned an invalid response.",
    );
  });

  it("rejects a missing answer", async () => {
    const client = { systemOne: vi.fn().mockResolvedValue({ answers: {} }) };

    await expect(checkSql("SELECT 1;", client)).rejects.toThrow("Jev returned an invalid response.");
  });

  it("rejects an unknown danger level", async () => {
    const client = {
      systemOne: vi.fn().mockResolvedValue({
        ...validResponse,
        answers: { ...validResponse.answers, dangerLevel: { choice: "UNKNOWN" } },
      }),
    };

    await expect(checkSql("SELECT 1;", client)).rejects.toThrow("Jev returned an invalid response.");
  });
});
