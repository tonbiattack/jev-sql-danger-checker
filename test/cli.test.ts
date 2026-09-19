import { describe, expect, it, vi } from "vitest";

import { createDefaultClient, main } from "../src/cli.js";

const assessment = {
  semanticFullScanRisk: 0.2,
  destructiveRisk: 0.1,
  reviewRequired: 0.3,
  dangerLevel: "CAUTION" as const,
};

function createDependencies(
  check = vi.fn().mockResolvedValue(assessment),
  readSqlFile = vi.fn().mockResolvedValue(""),
  readStdin = vi.fn().mockResolvedValue(""),
) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    check,
    stdout,
    stderr,
    dependencies: {
      createClient: vi.fn().mockReturnValue({}),
      checkSql: check,
      readSqlFile,
      readStdin,
      writeStdout: (message: string) => stdout.push(message),
      writeStderr: (message: string) => stderr.push(message),
    },
  };
}

describe("main", () => {
  it("disables SDK logging so SQL is never logged by the client", () => {
    expect(createDefaultClient("test-key").logLevel).toBe("off");
  });

  it("rejects missing SQL before creating a client", async () => {
    const { dependencies, stderr } = createDependencies();

    await expect(main([], { TYPESAFE_API_KEY: "key" }, dependencies)).resolves.toBe(1);
    expect(stderr).toEqual(["Error: SQL must not be empty.\n"]);
    expect(dependencies.createClient).not.toHaveBeenCalled();
  });

  it.each([undefined, "   "])("rejects a missing API key of %p", async (apiKey) => {
    const { dependencies, stderr } = createDependencies();

    await expect(main(["SELECT 1;"], { TYPESAFE_API_KEY: apiKey }, dependencies)).resolves.toBe(1);
    expect(stderr).toEqual(["Error: TYPESAFE_API_KEY is not set.\n"]);
  });

  it("writes an assessment to standard output", async () => {
    const { dependencies, stdout } = createDependencies();

    await expect(main(["SELECT", "1;"], { TYPESAFE_API_KEY: "key" }, dependencies)).resolves.toBe(0);
    expect(stdout.join("")).toContain("Danger level: CAUTION");
  });

  it("preserves line breaks when reading SQL from a file", async () => {
    const sql = "SELECT id, email\nFROM users\nWHERE id = 123;\n";
    const readSqlFile = vi.fn().mockResolvedValue(sql);
    const { check, dependencies, stdout } = createDependencies(undefined, readSqlFile);

    await expect(main(["--file", "query.sql"], { TYPESAFE_API_KEY: "key" }, dependencies)).resolves.toBe(0);
    expect(readSqlFile).toHaveBeenCalledWith("query.sql");
    expect(check).toHaveBeenCalledWith(sql, expect.anything());
    expect(stdout.join("")).toContain(sql);
  });

  it("preserves line breaks when reading SQL from standard input", async () => {
    const sql = "DELETE FROM users\nWHERE id = 123;\n";
    const readStdin = vi.fn().mockResolvedValue(sql);
    const { check, dependencies } = createDependencies(undefined, undefined, readStdin);

    await expect(main(["--stdin"], { TYPESAFE_API_KEY: "key" }, dependencies)).resolves.toBe(0);
    expect(readStdin).toHaveBeenCalledOnce();
    expect(check).toHaveBeenCalledWith(sql, expect.anything());
  });

  it("does not expose SQL when reading a file fails", async () => {
    const { dependencies, stderr } = createDependencies(
      undefined,
      vi.fn().mockRejectedValue(new Error("cannot read SELECT secret FROM users;")),
    );

    await expect(main(["--file", "query.sql"], { TYPESAFE_API_KEY: "key" }, dependencies)).resolves.toBe(1);
    expect(stderr).toEqual(["Error: Could not read SQL file.\n"]);
  });

  it("hides transport failures and sensitive values", async () => {
    const { dependencies, stderr } = createDependencies(
      vi.fn().mockRejectedValue(new Error("network unavailable: test-key SELECT secret FROM customers;")),
    );

    await expect(
      main(["SELECT secret FROM customers;"], { TYPESAFE_API_KEY: "test-key" }, dependencies),
    ).resolves.toBe(1);
    expect(stderr).toEqual(["Error: Jev request failed.\n"]);
    expect(stderr.join("")).not.toContain("test-key");
    expect(stderr.join("")).not.toContain("SELECT secret FROM customers;");
  });

  it("preserves the invalid-response message", async () => {
    const { dependencies, stderr } = createDependencies(
      vi.fn().mockRejectedValue(new Error("Jev returned an invalid response.")),
    );

    await expect(main(["SELECT 1;"], { TYPESAFE_API_KEY: "key" }, dependencies)).resolves.toBe(1);
    expect(stderr).toEqual(["Error: Jev returned an invalid response.\n"]);
  });
});
