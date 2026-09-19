# jev-sql-danger-checker

[English README](README.md)

[実行結果と評価用SQL例](docs/EXECUTION_EXAMPLES.ja.md)

[実装解説](docs/IMPLEMENTATION_GUIDE.ja.md)

`jev-sql-danger-checker` は、Jev を使ってSQL文の意味的な運用リスクを分類する実験的なCLIです。

このツールはSQLを実行したり、データベースへ接続したり、実行計画を調べたり、SQLを完全に構文解析したりしません。入力されたSQL本文をJevへ送信し、次の4つの独立したシグナルを返します。

- Semantic full scan risk（意味的な全件走査リスク）
- Destructive risk（破壊的変更リスク）
- Production review required（本番実行前レビューの必要性）
- Danger level（`SAFE`、`CAUTION`、`DANGEROUS`、`CRITICAL`）

## 必要条件

- Node.js 20以降
- `TYPESAFE_API_KEY` に設定した TypeSafe APIキー

## セットアップ

```sh
npm install
```

シェルでAPIキーを設定します。

```sh
export TYPESAFE_API_KEY="your-api-key"
```

PowerShellの場合:

```powershell
$env:TYPESAFE_API_KEY = "your-api-key"
```

ローカル用の参照として `.env.example` を `.env` にコピーすることもできます。ただし、CLIが読み取るのはプロセス環境変数の `TYPESAFE_API_KEY` です。

## 使い方

```sh
npm run check -- "DELETE FROM users;"
```

複数行のSQLは、改行を保つためにファイル入力を使います。

```sh
npm run check -- --file query.sql
```

標準入力から渡すこともできます。

```sh
cat query.sql | npm run check -- --stdin
```

PowerShellの場合:

```powershell
Get-Content query.sql -Raw | npx --no-install tsx src/cli.ts --stdin
```

Windowsでは `npm run` が標準入力を子プロセスへ確実に渡せないため、パイプ入力には直接 `npx --no-install tsx` を使います。`--file` と `--stdin` は同時に指定できません。読み取れないファイルや空の入力はエラーになります。

判定が `CRITICAL` の場合は、レポートに `YOU PROBABLY DON'T WANT TO RUN THIS.` という警告が表示されます。

## SQLの例

```sql
-- 絞り込み付きSELECT
SELECT * FROM users WHERE id = 123;

-- 全件SELECT
SELECT * FROM users;

-- 条件付きUPDATE
UPDATE users SET name = 'Alice' WHERE id = 123;

-- 全件UPDATE
UPDATE users SET is_admin = true;

-- 条件付きDELETE
DELETE FROM users WHERE id = 123;

-- 全件DELETE
DELETE FROM users;

-- 常に真となる条件
UPDATE accounts SET balance = 0 WHERE 1 = 1;

-- TRUNCATE
TRUNCATE TABLE transactions;

-- DROP
DROP TABLE users;
```

## 安全上の注意と制限

実運用のSQLや機密データを送信すると、それらが外部APIへ送信されることを許容することになります。送信しないでください。

これはSQLの静的解析ツールではありません。

このツールは実行計画、インデックス、データベース統計情報、または実際のデータベース内容を検査しません。

結果はJevによる意味的なリスク分類であり、SQLの安全性を保証するものとして扱ってはいけません。

本番環境でSQLを実行してよいかどうかを、このツールだけで判断しないでください。
