import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { TypeSafeClient } from "@typesafe-ai/sdk";

import { checkSql } from "./checkSql.js";
import { formatResult } from "./formatResult.js";
import type { SqlRiskAssessment, SystemOneClient } from "./types.js";

export interface CliDependencies {
  createClient(apiKey: string): SystemOneClient;
  checkSql(sql: string, client: SystemOneClient): Promise<SqlRiskAssessment>;
  writeStdout(message: string): void;
  writeStderr(message: string): void;
}

export type CliEnvironment = Record<string, string | undefined>;

export async function main(
  args: string[],
  environment: CliEnvironment,
  dependencies: CliDependencies,
): Promise<number> {
  const sql = args.join(" ");
  if (!sql.trim()) {
    dependencies.writeStderr("Error: SQL must not be empty.\n");
    return 1;
  }

  const apiKey = environment.TYPESAFE_API_KEY?.trim();
  if (!apiKey) {
    dependencies.writeStderr("Error: TYPESAFE_API_KEY is not set.\n");
    return 1;
  }

  try {
    const assessment = await dependencies.checkSql(sql, dependencies.createClient(apiKey));
    dependencies.writeStdout(formatResult(sql, assessment));
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    dependencies.writeStderr(
      message === "Jev returned an invalid response."
        ? "Error: Jev returned an invalid response.\n"
        : "Error: Jev request failed.\n",
    );
    return 1;
  }
}

export function createDefaultClient(apiKey: string): TypeSafeClient {
  return new TypeSafeClient({ apiKey, logLevel: "off" });
}

const defaultDependencies: CliDependencies = {
  createClient: createDefaultClient,
  checkSql,
  writeStdout: (message) => process.stdout.write(message),
  writeStderr: (message) => process.stderr.write(message),
};

const executedFile = process.argv[1];
if (executedFile && fileURLToPath(import.meta.url) === resolve(executedFile)) {
  main(process.argv.slice(2), process.env, defaultDependencies).then((code) => {
    process.exitCode = code;
  });
}
