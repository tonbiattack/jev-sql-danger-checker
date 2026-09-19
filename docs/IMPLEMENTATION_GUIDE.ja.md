# 実装解説

この資料は `jev-sql-danger-checker` のコードを読むための案内です。ツールはSQLを実行したりDBへ接続したりせず、SQL本文をJevへ渡して意味的なリスクを分類します。

## 処理の全体像

```text
CLI引数・SQLファイル・標準入力
            |
            v
       src/cli.ts
  入力検証・APIキー確認・終了コード
            |
            v
     src/checkSql.ts
  Jevへ4つの質問を送信・応答を検証
            |
            v
  src/formatResult.ts
  ASCIIバーと危険度を文字列に整形
            |
            v
          ターミナル
```

## ファイルごとの役割

| ファイル | 役割 |
| --- | --- |
| `src/types.ts` | CLI内で使う危険度と判定結果の型を定義します。 |
| `src/cli.ts` | 入力方法の選択、`TYPESAFE_API_KEY` の確認、標準出力・標準エラー・終了コードを扱います。 |
| `src/checkSql.ts` | Jevへ質問を送り、外部APIの応答を安全な内部型へ変換します。 |
| `src/formatResult.ts` | 数値の確率をバーと百分率へ整形し、ターミナル表示用の文字列を作ります。 |
| `test/*.test.ts` | APIを実際に呼ばずに、入力・応答変換・表示・エラー処理を確認します。 |

## 1. 入力の受け取り

`src/cli.ts` の `readSql` は、次の3種類の入力を一つのSQL文字列に統一します。

```sh
# 1行のSQLを引数で渡す
npm run check -- "DELETE FROM users;"

# 複数行SQLをファイルから渡す（推奨）
npm run check:file -- query.sql

# 標準入力から渡す
cat query.sql | npx --no-install tsx src/cli.ts --stdin
```

ファイルと標準入力では文字列をそのまま読み込むため、改行は保持されます。空のSQL、存在しないファイル、入力方法の混在はAPIを呼ぶ前にエラーにします。

その後 `main` は `TYPESAFE_API_KEY` を確認します。キーがなければJevへ通信せず、終了コード `1` を返します。

## 2. Jevへの質問

`checkSql(sql, client)` は、SQLを `state: { sql }` としてJevへ渡します。同じSQLに対して、次の4質問を1回の `systemOne` 呼び出しにまとめます。

| 質問 | Jevの回答形式 | 意味 |
| --- | --- | --- |
| `semanticFullScanRisk` | `noul`（0〜1） | 多数または全行を走査・対象にする可能性 |
| `destructiveRisk` | `noul`（0〜1） | 破壊的または復旧困難な変更の可能性 |
| `reviewRequired` | `noul`（0〜1） | 本番実行前に人間のレビューが必要か |
| `dangerLevel` | `choice` | `SAFE` / `CAUTION` / `DANGEROUS` / `CRITICAL` |

`noul` は yes の確率を返す質問です。たとえば `0.98` は「その質問にyesと答える確率が高い」ことを示します。`choice` はあらかじめ定めた4つのラベルのどれかを返すため、自由文を解釈する必要がありません。

## 3. 外部API応答の検証

Jevの応答は外部から来るため、そのまま表示しません。`readProbability` は有限の数値かつ `0` から `1` の範囲であることを確認します。`readDangerLevel` は4つの許可済みラベル以外を拒否します。

検証に失敗した場合は `Jev returned an invalid response.` として処理を止めます。未知の値を安全そうな結果として表示しないためです。

## 4. 表示の作り方

`formatProbability` は確率を10文字のバーと百分率に変換します。

```text
0.00 -> [----------] 0%
0.50 -> [#####-----] 50%
0.98 -> [##########] 98%
```

`formatResult` はSQL本文、3つの確率、`Danger level` をこの順序で連結します。`CRITICAL` だけは `YOU PROBABLY DON'T WANT TO RUN THIS.` も追加します。

## 5. エラー出力と情報保護

SQLには機密情報が含まれ得るため、エラーにはSQL本文やAPIキーを含めません。SDKのログレベルも `off` に固定し、debugログがSQL本文やAPI応答を出力しないようにしています。

## 6. テストの読み方

```sh
npm test
npm run typecheck
```

テストでは実際のJev APIを呼びません。代わりにテスト用のクライアントを渡し、次を確認します。

- 空SQL・空APIキーで失敗すること
- ファイル入力と標準入力で改行が保たれること
- 不正な確率や未知の危険度ラベルを拒否すること
- `CRITICAL` の警告とASCIIバーが正しく表示されること
- エラーにSQL本文やAPIキーが出ないこと

実際の危険度の精度は、代表的なSQLを用いた別途の評価で確認してください。
