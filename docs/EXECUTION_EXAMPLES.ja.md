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

## 比較の進め方

1. 似た操作で条件の有無だけを変える（例: `DELETE ... WHERE id = 123` と `DELETE FROM users`）。
2. 読み取り、データ変更、スキーマ変更、権限変更をそれぞれ比較する。
3. 各入力の確率値と `Danger level` を記録し、分類の傾向を見る。
4. 実運用での可否は、必ず実行計画・バックアップ・ロック・権限・レビュー手順を含めて別途判断する。
