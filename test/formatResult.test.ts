import { describe, expect, it } from "vitest";

import { formatProbability, formatResult } from "../src/formatResult.js";

describe("formatResult", () => {
  it("renders a critical assessment as an ASCII report", () => {
    expect(
      formatResult("DELETE FROM users;", {
        semanticFullScanRisk: 0.98,
        destructiveRisk: 0.99,
        reviewRequired: 0.99,
        dangerLevel: "CRITICAL",
      }),
    ).toBe(
      "SQL:\nDELETE FROM users;\n\n" +
        "Semantic full scan risk  [##########] 98%\n" +
        "Destructive risk         [##########] 99%\n" +
        "Review required          [##########] 99%\n\n" +
        "Danger level: CRITICAL\n\n" +
        "YOU PROBABLY DON'T WANT TO RUN THIS.\n",
    );
  });

  it.each([
    [0, "[----------] 0%"],
    [0.5, "[#####-----] 50%"],
  ])("renders probability %s as %s", (probability, expected) => {
    expect(formatProbability(probability)).toBe(expected);
  });

  it("omits the critical warning for a safe assessment", () => {
    expect(
      formatResult("SELECT 1;", {
        semanticFullScanRisk: 0,
        destructiveRisk: 0,
        reviewRequired: 0,
        dangerLevel: "SAFE",
      }),
    ).not.toContain("YOU PROBABLY DON'T WANT TO RUN THIS.");
  });
});
