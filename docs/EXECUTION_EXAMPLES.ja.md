# 実行結果と評価用SQL例

この資料は `jev-sql-danger-checker` の手動評価用サンプルです。結果は Jev による意味的なリスク分類であり、実行計画、インデックス、テーブル統計、実データ量、DBMS固有の挙動を判定するものではありません。

SQL本文は外部APIへ送信されます。実テーブル名、個人情報、顧客ID、認証情報などを含む本番SQLは入力しないでください。

## 観測済みの実行結果

実行コマンド:

```powershell
npm run check -- "DELETE FROM users;"
```

観測結果:

```text
SQL:
DELETE FROM users;

Semantic full scan risk  [##########] 98%
Destructive risk         [##########] 98%
Review required          [##########] 98%

Danger level: CRITICAL

YOU PROBABLY DON'T WANT TO RUN THIS.
```

この結果は、条件のない `DELETE` を「多数または全行への影響があり、破壊的で、本番実行前のレビューが必要な操作」として高く評価した例です。値はモデル更新や質問文の変更により変わり得ます。

### 条件付きSELECT（入力どおりの空白なし表記）

実行コマンド:

```powershell
npm run check -- "SELECT id, emailFROM usersWHERE id = 123;"
```

観測結果:

```text
SQL:
SELECT id, emailFROM usersWHERE id = 123;

Semantic full scan risk  [##--------] 15%
Destructive risk         [----------] 2%
Review required          [#####-----] 52%

Danger level: SAFE
```

この入力には `emailFROM` と `usersWHERE` の間の空白がありません。それでも低いリスクとして分類された観測例です。本ツールは完全なSQL構文検証器ではないため、この結果をSQLが実行可能・安全である保証として扱ってはいけません。構文の妥当性は対象DBMSまたはSQLパーサーで別途検証してください。

### `--file` 指定時にファイル名が評価された観測

実行コマンド:

```powershell
npm run check -- --file query.sql
```

観測結果:

```text
SQL:
query.sql

Semantic full scan risk  [######----] 64%
Destructive risk         [####------] 38%
Review required          [########--] 79%

Danger level: CAUTION
```

このときの `query.sql` の内容:

```sql
SELECT id, email
FROM users
WHERE id = 123;
```

この観測では、出力の `SQL:` がファイル本文ではなく `query.sql` になっています。したがって、上記の確率と `CAUTION` はSQL本文ではなくファイル名を対象にした分類結果として記録します。ファイル本文の分類結果として解釈してはいけません。

## 追加の評価用SQL

以下の例はSQLを実行するためのものではなく、リスク分類の傾向を比べるための入力例です。各例は単独のSQL文として実行してください。

### 低リスク寄り: 主キーによる1件取得

```sql
SELECT id, email
FROM users
WHERE id = 123;
```

確認したい点: 読み取り専用で、明示的に1件を指定しているSQLを、全件SELECTと比べて低く評価できるか。

### 注意: 件数を制限した一覧取得

```sql
SELECT id, created_at
FROM orders
ORDER BY created_at DESC
LIMIT 100;
```

確認したい点: `LIMIT` がある一方で、並べ替えや対象範囲の広さは実行計画に依存するため、意味的な注意度をどう評価するか。

### 注意: 条件付きUPDATE

```sql
UPDATE users
SET display_name = 'Alice'
WHERE id = 123;
```

確認したい点: 対象を絞っていてもデータ変更であるため、破壊的リスクとレビュー要否が読み取り専用SQLより高くなるか。

### 危険: 広い条件での権限変更

```sql
UPDATE users
SET is_admin = true
WHERE role = 'staff';
```

確認したい点: 条件があっても、多数のアカウントの権限を変更し得る操作を高リスクとして扱えるか。

### 危険: 日付条件付きDELETE

```sql
DELETE FROM audit_logs
WHERE created_at < '2020-01-01';
```

確認したい点: 条件付きでも大量削除・復旧困難になり得る操作として、レビューを求めるか。

### 重大: 常に真となる条件でのUPDATE

```sql
UPDATE accounts
SET balance = 0
WHERE 1 = 1;
```

確認したい点: 見かけ上は `WHERE` 句があっても実質全件変更となるパターンを検出できるか。

### 重大: テーブルの即時消去

```sql
TRUNCATE TABLE transactions;
```

確認したい点: 大量データを短時間で失い得るDDL/DML操作を重大として分類できるか。

### 重大: スキーマ破壊

```sql
DROP TABLE users;
```

確認したい点: テーブル自体を削除する操作を、最も高い危険度として分類できるか。

### 重大: 列の削除

```sql
ALTER TABLE users
DROP COLUMN email;
```

確認したい点: 行を削除しなくても、復旧困難なスキーマ変更を破壊的と評価できるか。

### 危険: 広い権限付与

```sql
GRANT ALL PRIVILEGES ON DATABASE app_db TO reporting_user;
```

確認したい点: データ行を直接変更しない権限操作でも、本番レビューが必要な高リスク操作として扱えるか。DBMSによって構文は異なります。

## 追加評価用SQLの実測結果（2026-09-19）

上記の追加評価用SQL 10件を、各1回ずつ実測しました。測定には Node.js `v22.17.0` と、リポジトリにインストール済みの依存関係を使用しました。SQLはファイルへ書き戻さず、PowerShell から標準入力で `npx --no-install tsx src/cli.ts --stdin` に渡しています。

| 評価用SQL | Semantic full scan risk | Destructive risk | Review required | Danger level |
| --- | ---: | ---: | ---: | --- |
| 主キーによる1件取得 | 23% | 1% | 24% | SAFE |
| 件数を制限した一覧取得 | 75% | 1% | 31% | SAFE |
| 条件付きUPDATE | 10% | 62% | 71% | SAFE |
| 広い条件での権限変更 | 85% | 87% | 97% | CRITICAL |
| 日付条件付きDELETE | 86% | 94% | 96% | DANGEROUS |
| 常に真となる条件でのUPDATE | 98% | 96% | 98% | CRITICAL |
| テーブルの即時消去 | 97% | 98% | 98% | CRITICAL |
| スキーマ破壊 | 83% | 99% | 98% | CRITICAL |
| 列の削除 | 78% | 97% | 98% | CRITICAL |
| 広い権限付与 | 54% | 47% | 97% | DANGEROUS |

### 観測した傾向

- 主キーで絞った読み取りは3指標とも低く、`SAFE` になりました。
- `LIMIT` を付けた一覧取得は破壊的リスクが低い一方、並べ替えを伴うため意味的な全件走査リスクは75%でした。ただし `Danger level` は `SAFE` です。
- 主キーで絞った `UPDATE` は破壊的リスク62%、レビュー要否71%であっても、総合分類は `SAFE` でした。この分類だけで実行可否を決めないでください。
- 広い条件での権限変更、実質全件の更新、`TRUNCATE`、`DROP`、列削除は、いずれも高いレビュー要否と破壊的リスクを示し、`CRITICAL` でした。
- `GRANT ALL PRIVILEGES` はデータ変更ではないにもかかわらず、レビュー要否97%、総合分類`DANGEROUS` でした。

この表は単一回の観測値です。Jevのモデル更新、質問文、入力方法、サービス側の推論により確率値や `Danger level` は変動し得ます。実行計画、インデックス、統計情報、実データ量、DBMS固有の挙動を示すものではありません。

## 比較の進め方

1. 似た操作で条件の有無だけを変える（例: `DELETE ... WHERE id = 123` と `DELETE FROM users`）。
2. 読み取り、データ変更、スキーマ変更、権限変更をそれぞれ比較する。
3. 各入力の確率値と `Danger level` を記録し、分類の傾向を見る。
4. 実運用での可否は、必ず実行計画・バックアップ・ロック・権限・レビュー手順を含めて別途判断する。
