# jev-sql-danger-checker 仕様書

## 1. 概要

`jev-sql-danger-checker` は、SQL文を入力すると Jev を利用して「そのSQLが意味的にどの程度危険そうか」を判定する実験用CLIツールである。

代表的な用途は、以下のようなSQLを入力して危険度の違いを確認すること。

```sql
DELETE FROM users;
```

```sql
DELETE FROM users
WHERE id = 123;
```

このツールはSQLの構文解析器、クエリオプティマイザ、実行計画解析ツールではない。
Jevによる自然言語的・意味的なリスク判定を試すことを目的とする。

---

## 2. 目的

- Jevをプロダクトロジックへ組み込む最小構成を試す
- SQLの意味から危険性を分類する
- Jevの確率出力・分類結果をCLI上で視覚的に確認する
- 「AIによる判定」と「従来の静的解析」の違いを体験できるサンプルにする
- GitHub上で簡単に試せる小規模なデモプロジェクトにする

---

## 3. 非目的

本ツールは以下を行わない。

- SQLを実際に実行する
- データベースへ接続する
- EXPLAINを実行する
- インデックス情報を取得する
- テーブル統計を参照する
- SQLの完全な構文検証をする
- SQLインジェクション検知ツールとして利用する
- 本番環境での安全性を保証する

特に「フルスキャンするか」はDBMS、インデックス、統計情報、実行計画に依存するため、本ツールでは厳密には判定できない。

そのため、本仕様では「実際にフルスキャンするか」ではなく、SQL文面から見た **semantic full scan risk** を判定対象とする。

---

## 4. 想定技術構成

- Node.js 20+
- TypeScript
- Jev / TypeSafe AI SDK
- CLI
- npm

Jev APIキーは環境変数から取得する。

例:

```bash
export TYPESAFE_API_KEY=xxxxxxxx
```

APIキーをソースコードへ直接記述しない。

---

## 5. CLI仕様

### 5.1 基本実行

```bash
npm run check -- "DELETE FROM users;"
```

または将来的にbin登録した場合:

```bash
jev-sql-danger-checker "DELETE FROM users;"
```

### 5.2 ファイル入力

将来的な拡張としてSQLファイル入力を許可する。

```bash
jev-sql-danger-checker --file query.sql
```

初期バージョンでは文字列入力のみでもよい。

---

## 6. 入力

入力は1つのSQL文を基本とする。

例:

```sql
SELECT * FROM users WHERE id = 123;
```

複数SQL文が渡された場合の挙動は初期バージョンでは保証しない。

---

## 7. 判定項目

JevにはSQL全文をstateとして渡し、複数の独立した質問として評価する。

### 7.1 Semantic Full Scan Risk

SQL文面から見て、多数または全行を走査・対象にする可能性が高そうかを判定する。

例:

```sql
SELECT * FROM users;
```

高リスクになりやすい。

一方:

```sql
SELECT *
FROM users
WHERE id = 123;
```

低リスクになりやすい。

ただし、実際の実行計画は判定しない。

出力:

- probability: 0.0 - 1.0

---

### 7.2 Destructive Risk

SQL実行によってデータの破壊、大量変更、復旧困難な変更が発生する可能性を評価する。

高リスク例:

```sql
DELETE FROM users;
```

```sql
TRUNCATE TABLE transactions;
```

```sql
DROP TABLE users;
```

```sql
UPDATE accounts
SET balance = 0;
```

低リスク例:

```sql
SELECT *
FROM users
WHERE id = 123;
```

出力:

- probability: 0.0 - 1.0

---

### 7.3 Production Review Required

このSQLを本番DBで実行する前に、人間によるレビューを要求すべきかを評価する。

レビュー必須になりやすい例:

```sql
DELETE FROM users;
```

```sql
UPDATE users
SET is_admin = true;
```

出力:

- probability: 0.0 - 1.0

---

### 7.4 Danger Level

SQL全体の運用上の危険度を分類する。

分類:

- SAFE
- CAUTION
- DANGEROUS
- CRITICAL

例:

```sql
SELECT *
FROM users
WHERE id = 123;
```

想定:

```text
SAFE
```

例:

```sql
DELETE FROM users;
```

想定:

```text
CRITICAL
```

---

## 8. Jevへの質問設計

巨大な1つの質問で「危険か」を判定せず、狭い質問へ分割する。

概念例:

```ts
questions: {
  fullScan: {
    instructions:
      "Could this SQL potentially scan or affect most or all rows of a table?"
  },

  destructive: {
    instructions:
      "Could executing this SQL cause destructive or difficult-to-recover data changes?"
  },

  reviewRequired: {
    instructions:
      "Should this SQL require human review before execution in a production database?"
  },

  dangerLevel: {
    instructions:
      "Classify the operational risk of executing this SQL in production."
  }
}
```

SDKの実際の型・API仕様に合わせて実装時に調整する。

---

## 9. 出力仕様

例:

入力:

```sql
DELETE FROM users;
```

出力イメージ:

```text
SQL:
DELETE FROM users;

Semantic full scan risk  ██████████ 98%
Destructive risk         ██████████ 99%
Review required          ██████████ 99%

Danger level: CRITICAL

YOU PROBABLY DON'T WANT TO RUN THIS.
```

初期バージョンではASCII表示でよい。

---

## 10. Danger Levelごとの表示

### SAFE

```text
Danger level: SAFE
```

### CAUTION

```text
Danger level: CAUTION
```

### DANGEROUS

```text
Danger level: DANGEROUS
```

### CRITICAL

```text
Danger level: CRITICAL

YOU PROBABLY DON'T WANT TO RUN THIS.
```

色付き表示は後から追加してよい。

---

## 11. テスト用SQL

READMEやテストケースとして以下を利用する。

### 安全寄り

```sql
SELECT *
FROM users
WHERE id = 123;
```

### 全件SELECT

```sql
SELECT * FROM users;
```

### 条件付きUPDATE

```sql
UPDATE users
SET name = 'Alice'
WHERE id = 123;
```

### 全件UPDATE

```sql
UPDATE users
SET is_admin = true;
```

### 条件付きDELETE

```sql
DELETE FROM users
WHERE id = 123;
```

### 全件DELETE

```sql
DELETE FROM users;
```

### WHERE 1 = 1

```sql
UPDATE accounts
SET balance = 0
WHERE 1 = 1;
```

### TRUNCATE

```sql
TRUNCATE TABLE transactions;
```

### DROP

```sql
DROP TABLE users;
```

---

## 12. エラーハンドリング

以下の場合は非0終了コードとする。

- SQLが空
- APIキーが存在しない
- Jev API呼び出しに失敗
- APIレスポンスが想定形式ではない

例:

```text
Error: TYPESAFE_API_KEY is not set.
```

---

## 13. セキュリティ上の注意

SQLには以下が含まれる可能性がある。

- 実テーブル名
- 顧客ID
- 個人情報
- 内部システム情報
- 機密情報

外部APIへ送信することになるため、実際の業務SQLをそのまま入力しないことをREADMEで注意喚起する。

サンプルでは `users`, `accounts`, `transactions` など架空のテーブル名を利用する。

---

## 14. 免責・README記載事項

READMEには以下を明示する。

> This is not a SQL static analyzer.

> This tool does not inspect execution plans, indexes, database statistics, or actual database contents.

> Results are semantic risk classifications produced by Jev and must not be treated as a guarantee of SQL safety.

本番DBでの実行可否をこのツールだけで判断しない。

---

## 15. 初期ディレクトリ構成案

```text
jev-sql-danger-checker/
├── src/
│   ├── cli.ts
│   ├── checkSql.ts
│   └── types.ts
├── test/
│   └── fixtures.ts
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── README.md
└── SPEC.md
```

---

## 16. MVP

MVPでは以下のみ実装する。

1. CLI引数からSQLを受け取る
2. JevへSQLを送信する
3. 以下4項目を取得する
   - semantic full scan risk
   - destructive risk
   - production review required
   - danger level
4. ターミナルへ結果を表示する
5. APIエラーを表示する

DB接続、SQLパーサー、Web UIはMVP対象外。

---

## 17. 将来拡張案

### SQLファイル入力

```bash
jev-sql-danger-checker --file query.sql
```

### stdin入力

```bash
echo "DELETE FROM users;" | jev-sql-danger-checker
```

### JSON出力

```bash
jev-sql-danger-checker --json "DELETE FROM users;"
```

例:

```json
{
  "semanticFullScanRisk": 0.98,
  "destructiveRisk": 0.99,
  "reviewRequired": 0.99,
  "dangerLevel": "CRITICAL"
}
```

### Git diff連携

MigrationやSQLファイルのdiffから危険なSQLを抽出して判定する。

### GitHub Actions

Pull Request内のSQL変更をチェックし、危険度が高い場合にレビューを促す。

### 静的解析とのハイブリッド

将来的にはSQL parserによる決定論的ルールとJevによる意味判定を組み合わせる。

例:

```text
Static Rules
     +
     |
     v
SQL ------> Jev
     |
     v
Combined Risk
```

ただし、本プロジェクトの初期目的はJev単体の意味判定を試すことであり、静的解析機能はMVPには含めない。

---

## 18. 成功条件

以下が確認できればMVP成功とする。

- `DELETE FROM users;` が高い危険度として判定される
- `DELETE FROM users WHERE id = 123;` と結果に差が出る
- `SELECT ... WHERE id = ...` が比較的低リスクになる
- 同じインターフェースで複数の観点を同時判定できる
- Jevを「生成AI」ではなく「アプリケーションの判定ロジック」として利用する感覚を確認できる
