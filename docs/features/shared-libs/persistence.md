# Persistence Backbone

**Files:** `utils/db.ts`, `utils/dbSchema.ts`, `utils/sql.ts`
**Consumers:** all ~23 `repositories/*.ts` (19 import `utils/db` directly)
**Tests:** none (schema is exercised indirectly via repository tests)
**Parent:** [`rules.md`](rules.md)

---

## DB-R1 — One lazily-proxied SQLite database backs every repository

**Rule**
`utils/db.ts` opens `retailPOS.db` **at module import** and exports a `Proxy`
that forwards method calls to the real `SQLiteDatabase` once ready; calls made
before readiness return promises chained on `dbPromise`. Outside test env the
open chain also runs `initializeSchema` (migrations).

**Evidence** — `utils/db.ts` (`dbInstance`, `dbPromise`, Proxy `get`).

🟢 **E1.1 — Early call** — a repository calling `db.runAsync` during startup
queues on `dbPromise` and executes after open+schema, transparently.

📱 **E1.2 — Restart** — the DB file persists across termination; migrations are
idempotent via `PRAGMA user_version`.

🔴 **E1.3 — Open failure is permanent** — `dbPromise` rejects once; every later
call through the Proxy re-throws the same rejection. No retry/recreate. PG2.

🟠 **E1.4 — Test env skips schema** — `NODE_ENV === 'test'` skips
`initializeSchema`, so unit tests never exercise migrations (usually mocked
anyway). Parent-map Q2.

## DB-R2 — Schema evolves by forward-only, transactional migrations

**Rule**
`LATEST_DB_VERSION` (currently **11**) gates `migrateDatabase`, which applies
each `v1…v11` block inside **one** `withTransactionAsync` and then stamps
`user_version`. v1 creates the full base schema; v2–v11 incrementally
merge/add (e.g. v8 `register_id`, v9 order-item snapshots, v10 webhook
delivery, v11 `sale_mode`).

**Evidence** — `utils/dbSchema.ts` (739 lines; `initializeSchema`,
`migrateDatabase`, `LATEST_DB_VERSION = 11`).

🟢 **E2.1 — Fresh install** — `user_version = 0` → all 11 blocks run inside one
transaction → `user_version = 11`.

🟠 **E2.2 — Migration failure** — a throw mid-migration rolls back the whole
transaction; `initializeSchema` rethrows → the startup bootstrap fails loudly
(logged via `LoggerFactory`).

🟠 **E2.3 — Adding a column** — bump `LATEST_DB_VERSION`, add an
`if (fromVersion < N)` block; v11 shows the pattern (`ALTER TABLE … ADD COLUMN
sale_mode` guarded by `pragma_table_info`).

## DB-R3 — Dynamic UPDATEs are column-allowlisted and fail closed

**Rule**
`buildUpdateAssignments(data, allowedColumns)` builds `col = ?` assignments:
`undefined` values and `id/created_at/updated_at` are skipped; a key outside
`allowedColumns` **throws** instead of being ignored; booleans become 0/1.

**Evidence** — `utils/sql.ts`.

🟢 **E3.1** — `buildUpdateAssignments({name:'x', price:1.5}, ['name','price'])`
→ `['name = ?','price = ?'], ['x',1.5]`.

🔴 **E3.2 — Smuggled column** — `{pin:'hacked'}` with `pin` not allowlisted →
throws `Column 'pin' cannot be updated` — SQL injection via column names is
impossible, but callers must tolerate the throw.

## ❓ Questions

- **DB-Q1** — `db.ts` uses `console.log/error` (eslint-disabled) instead of
  `LoggerFactory` — bootstrap ordering rationale is plausible but unwritten
  (Contradiction C1).
- **DB-Q2** — Should `dbPromise` failures mark the app state so repositories
  can surface "database unavailable" instead of hanging on a rejected promise?

## Coverage

| Example               | Coverage                            |
| --------------------- | ----------------------------------- |
| DB-R2 migration logic | Not found (indirect via repo tests) |
| DB-R3 allowlist       | Not found                           |
| DB-R1 proxy/failure   | Not found                           |
