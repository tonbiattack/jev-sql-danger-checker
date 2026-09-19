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

// コマンドライン引数を、実際にJevへ渡すSQL本文へ変換する。
// ファイル／標準入力では改行をそのまま残し、通常の引数だけを空白で連結する。
async function readSql(args: string[], dependencies: CliDependencies): Promise<string | undefined> {
  if (args[0] === "--file") {
    // パスの取り違えを防ぐため、ファイル入力はパス1個だけを受け付ける。
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
    // stdinと引数SQLを混ぜると入力元が曖昧になるため、単独指定に限定する。
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
  // 入力を読む段階のエラーでは、SQL本文をエラー出力へ含めない。
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
    // CLIは表示と終了コードだけを担当し、Jevとの通信はcheckSqlへ委譲する。
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
  // SDKのdebugログにはSQL本文やAPI応答が含まれ得るため、明示的に無効化する。
  return new TypeSafeClient({ apiKey, logLevel: "off" });
}

function readProcessStdin(): Promise<string> {
  // dataイベントをすべて連結し、endイベントで初めて完全な複数行SQLとして返す。
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
  // テストからimportした場合は実行せず、CLIとして直接起動したときだけmainを呼ぶ。
  main(process.argv.slice(2), process.env, defaultDependencies).then((code) => {
    process.exitCode = code;
  });
}
