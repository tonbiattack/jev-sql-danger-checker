import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("npm check command", () => {
  it("does not echo SQL when validation fails", () => {
    const secretSql = "SELECT reviewer_secret FROM customers;";
    const environment = { ...process.env };
    delete environment.TYPESAFE_API_KEY;

    const result = spawnSync(
      process.platform === "win32" ? "powershell.exe" : "npm",
      process.platform === "win32"
        ? ["-NoProfile", "-Command", `& npm run check -- '${secretSql}'`]
        : ["run", "check", "--", secretSql],
      { cwd: process.cwd(), encoding: "utf8", env: environment },
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain("Error: TYPESAFE_API_KEY is not set.");
    expect(output).not.toContain(secretSql);
  });

  it("forwards a file path to the dedicated file-input command", () => {
    const result = spawnSync(
      process.platform === "win32" ? "powershell.exe" : "npm",
      process.platform === "win32"
        ? ["-NoProfile", "-Command", "& npm run check:file -- missing-query.sql"]
        : ["run", "check:file", "--", "missing-query.sql"],
      { cwd: process.cwd(), encoding: "utf8", env: process.env },
    );
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain("Error: Could not read SQL file.");
  });
});
