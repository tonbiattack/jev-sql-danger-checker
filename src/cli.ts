import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";

import { TypeSafeClient } from "@typesafe-ai/sdk";

import { checkSql } from "./checkSql.js";
import { formatResult } from "./formatResult.js";
import type { SqlRiskAssessment, SystemOneClient } from "./types.js";

export interface CliDependencies {
  createClient(apiKey: string): SystemOneClient;
  checkSql(sql: string, client: SystemOneClient): Promise<SqlRiskAssessment>;
  readSqlFile(path: string): Promise<string>;
  readStdin(): Promise<string>;
  writeStdout(message: string): void;
  writeStderr(message: string): void;
}

export type CliEnvironment = Record<string, string | undefined>;

async function readSql(args: string[], dependencies: CliDependencies): Promise<string | undefined> {
  if (args[0] === "--file") {
    if (args.length !== 2) {
      dependencies.writeStderr("Error: --file requires exactly one path.\n");
      return undefined;
    }

    try {
      return await dependencies.readSqlFile(args[1]);
    } catch {
      dependencies.writeStderr("Error: Could not read SQL file.\n");
      return undefined;
    }
  }

  if (args[0] === "--stdin") {
    if (args.length !== 1) {
      dependencies.writeStderr("Error: --stdin cannot be combined with SQL arguments.\n");
      return undefined;
    }

    try {
      return await dependencies.readStdin();
    } catch {
      dependencies.writeStderr("Error: Could not read SQL from standard input.\n");
      return undefined;
    }
  }

  if (args.includes("--file") || args.includes("--stdin")) {
    dependencies.writeStderr("Error: Input options must be specified first.\n");
    return undefined;
  }

  return args.join(" ");
}

export async function main(
  args: string[],
  environment: CliEnvironment,
  dependencies: CliDependencies,
): Promise<number> {
  const sql = await readSql(args, dependencies);
  if (sql === undefined) {
    return 1;
  }

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

function readProcessStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let input = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk: string) => {
      input += chunk;
    });
    process.stdin.once("end", () => resolve(input));
    process.stdin.once("error", reject);
  });
}

const defaultDependencies: CliDependencies = {
  createClient: createDefaultClient,
  checkSql,
  readSqlFile: (path) => readFile(path, "utf8"),
  readStdin: readProcessStdin,
  writeStdout: (message) => process.stdout.write(message),
  writeStderr: (message) => process.stderr.write(message),
};

const executedFile = process.argv[1];
if (executedFile && fileURLToPath(import.meta.url) === resolve(executedFile)) {
  main(process.argv.slice(2), process.env, defaultDependencies).then((code) => {
    process.exitCode = code;
  });
}
