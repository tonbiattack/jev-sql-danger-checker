# jev-sql-danger-checker

`jev-sql-danger-checker` is an experimental CLI that uses Jev to classify the semantic operational risk of a SQL statement.

It does not execute SQL, connect to a database, inspect a query plan, or parse SQL completely. It sends the supplied SQL text to Jev and reports four independent signals:

- Semantic full scan risk
- Destructive risk
- Production review required
- Danger level: `SAFE`, `CAUTION`, `DANGEROUS`, or `CRITICAL`

## Requirements

- Node.js 20 or later
- A TypeSafe API key available as `TYPESAFE_API_KEY`

## Setup

```sh
npm install
```

Set the API key in your shell:

```sh
export TYPESAFE_API_KEY="your-api-key"
```

On PowerShell:

```powershell
$env:TYPESAFE_API_KEY = "your-api-key"
```

You may also copy `.env.example` to `.env` for local reference, but the CLI itself reads `TYPESAFE_API_KEY` from its process environment.

## Usage

```sh
npm run check -- "DELETE FROM users;"
```

For a `CRITICAL` result, the report includes `YOU PROBABLY DON'T WANT TO RUN THIS.`

## Sample SQL

```sql
-- Narrow select
SELECT * FROM users WHERE id = 123;

-- Broad select
SELECT * FROM users;

-- Conditional update
UPDATE users SET name = 'Alice' WHERE id = 123;

-- Broad update
UPDATE users SET is_admin = true;

-- Conditional delete
DELETE FROM users WHERE id = 123;

-- Broad delete
DELETE FROM users;

-- Tautological condition
UPDATE accounts SET balance = 0 WHERE 1 = 1;

-- Truncate
TRUNCATE TABLE transactions;

-- Drop
DROP TABLE users;
```

## Safety and limitations

Do not submit real production SQL or sensitive data unless you accept that it will be sent to an external API.

This is not a SQL static analyzer.

This tool does not inspect execution plans, indexes, database statistics, or actual database contents.

Results are semantic risk classifications produced by Jev and must not be treated as a guarantee of SQL safety.

Do not use this tool alone to decide whether a statement is safe to run in production.
