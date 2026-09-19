import { describe, expect, it, vi } from "vitest";

import { createDefaultClient, main } from "../src/cli.js";

const assessment = {
  semanticFullScanRisk: 0.2,
  destructiveRisk: 0.1,
  reviewRequired: 0.3,
  dangerLevel: "CAUTION" as const,
};

function createDependencies(check = vi.fn().mockResolvedValue(assessment)) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    check,
    stdout,
    stderr,
    dependencies: {
      createClient: vi.fn().mockReturnValue({}),
      checkSql: check,
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
