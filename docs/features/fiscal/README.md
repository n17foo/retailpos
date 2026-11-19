# Fiscal — Spec (DRAFT, pre-implementation)

> Status: **specification only** — no `features/fiscal/` code exists yet.
> Open product decisions are collected at the bottom; defaults marked
> **[proposed]** are the recommended path unless the decision changes.

## Purpose

Turn every finalized sale, return, and shift close into a **sequential,
tamper-evident fiscal record** so the app satisfies invoice/audit
requirements in fiscal jurisdictions — the supported set is **UK,
Ireland, Netherlands, Belgium (retail)** on the record-only tier, and
**Spain (Veri\*factu), Italy, Germany (KassenSichV/TSE), France
(NF525/ISCA)** as the certified/heavyweight tier — and so an auditor can
prove the sales ledger was never edited, renumbered, or deleted after
the fact.

Today the app has none of this: order ids are UUIDs, receipts print
`order.id.slice(-8)`, orders can be deleted, and the audit log is a KV
store with `clear()`. This feature replaces those gaps.

## Core concepts

- **Fiscal record** — the immutable legal artifact for one fiscal event
  (`sale` | `return` | `void` | `z_report`). Carries the sequential
  invoice number, the canonical payload hash, and a link to the previous
  record's hash.
- **Hash chain** — `hash_n = SHA-256(prev_hash ‖ canonical_payload_n)`.
  Breaking any record invalidates every later hash → tamper-evident.
- **Fiscalization point** — the moment an order becomes fiscal: when
  payment completes, not at draft/basket time. Drafts keep plain UUIDs
  and stay deletable; a finalized order can never be deleted, only
  voided or returned (both create _new_ fiscal records).
- **Chain scope** — which counter+chain a sequence belongs to:
  `store` (single sequence across registers) or `register` (per-till).

## Mode-aware architecture (same pattern as orders/catalogue/payments)

Follows the established selector pattern (`getOrderRepository()`):

```
CheckoutService.completePayment
        │
        ▼
getFiscalService()                    features/fiscal/services/FiscalServiceFactory.ts
        │
        ├─ instoreApiConfig.isClient ─► InstoreApiFiscalService
        │      HTTP via InstoreApiClient → Store API /api/fiscal/*
        │      (chain + sequence live in the server's database)
        │
        └─ standalone ────────────────► OfflineFiscalService
               SQLite fiscal_records + fiscal_chain_state
               (chain + sequence live in retailPOS.db)
```

| Mode                       | Numbering + chain authority               | Storage                                                        |
| -------------------------- | ----------------------------------------- | -------------------------------------------------------------- |
| `standalone`               | The register itself                       | `fiscal_records`, `fiscal_chain_state` in `retailPOS.db`       |
| `client` (multi-register)  | **Store API only**                        | same tables in the server DB; registers never allocate numbers |
| degraded client (LAN down) | **[proposed]** fail closed — see rules R7 | sales queue unpaid or cashier blocks at tender                 |

Same rule as every other shared resource (ledgers, order claims): there
is exactly **one** fiscal authority per store. In multi-register that is
the Store API; registers ask it for the next record instead of keeping
local counters. A local counter per register would produce interleaved
duplicates the moment two tills sell concurrently.

## Service surface (proposed)

```
features/fiscal/
  services/
    FiscalServiceInterface.ts     # the contract
    OfflineFiscalService.ts       # SQLite implementation
    InstoreApiFiscalService.ts    # Store API implementation
    FiscalServiceFactory.ts       # getFiscalService() mode selector
    FiscalCanonicalizer.ts        # stable JSON for hashing (shared both impls)
    authorities/
      FiscalAuthorityAdapter.ts   # per-jurisdiction transmit/report contract
      UkAuthorityAdapter.ts       # record-only (no per-sale transmission)
      EsVerifactuAdapter.ts       # AEAT registro de facturación + encadenamiento
      ItCorrispettiviAdapter.ts   # certified Soluzione Software / RT bridge
      DeTseAdapter.ts             # BSI-certified cloud TSE signing (fiskaly etc.)
      FrNf525Adapter.ts           # ISCA closures/archives — record-only, no transmission
      RecordOnlyAuthorityAdapter.ts # IE / NL / BE — general VAT record-keeping, no transmission
      NullAuthorityAdapter.ts     # 'generic' — performs no authority actions
  repositories/
    FiscalRecordRepository.ts     # fiscal_records read/write (offline impl)
    FiscalTransmissionRepository.ts  # authority-submission outbox + retry
```

### Jurisdiction matrix (default supported set)

|                       | UK                                                | Spain (Veri\*factu / RRSIF)                                                                                                  | Italy (corrispettivi)                                                                                                                    | Germany (KassenSichV)                                                                          | France (NF525/ISCA)                                                                             |
| --------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Sequential number     | Required on VAT invoice (VAT Regs 1995 r14(1)(a)) | Required (series + number per record)                                                                                        | Required (documento commerciale numbering)                                                                                               | Required (fortlaufende Transaktionsnummer via TSE)                                             | Required (inaltérabilité)                                                                       |
| Chain / signing       | Not required — ours exceeds it                    | **Required** — record includes prior record's hash (`encadenamiento`)                                                        | Not required at document level                                                                                                           | **Required** — every transaction signed by a **certified TSE** (BSI); cloud or hardware        | **Required in effect** — ISCA inalterability; chaining is the accepted mechanism                |
| Per-sale transmission | None (MTD is per-VAT-return, out of scope)        | Optional `VERI*FACTU` mode; otherwise records kept + **previous-hash verification at generate time** + `registros de evento` | Daily corrispettivi total via certified route                                                                                            | None — TSE signs per transaction; exports are audit-time (DSFinV-K)                            | None — record-only; periodic closures + frozen archives instead                                 |
| Receipt content       | VAT invoice fields when requested                 | **AEAT QR code mandatory**                                                                                                   | RT/documento commerciale format                                                                                                          | **QR with TSE signature data mandatory**                                                       | Certification mention + closure totals                                                          |
| Certification         | None                                              | Software self-declaration (`declaración responsable`)                                                                        | **Software must be an approved Soluzione Software (MF1/PEM) or pair with a certified RT device** — external certification, not just code | TSE vendor is BSI-certified — we integrate, we don't certify; **ELSTER register-registration** | **Our product must be certified** (LNE or Infocert/NF525) — self-attestation abolished Feb 2025 |
| Offline               | No issue                                          | Record-only mode legal by design                                                                                             | RT device is local                                                                                                                       | Cloud TSE unreachable → **BMF allows a fallback TSE** (second cloud or local USB TSE)          | No issue — nothing is transmitted                                                               |

**Implication.** `finalizeSale` produces the chain record uniformly; the
`FiscalAuthorityAdapter` for the active `fiscalJurisdiction` then runs
jurisdiction work — DE asks the TSE for a transaction signature and
stores it on the record, ES builds the XML registro (+ QR data for the
receipt), FR records closure/archive entries, UK does nothing extra.
IT is the one jurisdiction we cannot self-certify — see Q-IT below.
**`generic` performs no authority actions** — chain + numbering only.

### Record-only tier

IE, NL, and BE (retail) need nothing beyond the chain + sequential
numbers — general VAT record-keeping applies, exactly like UK:

|               | Ireland                                                                                  | Netherlands                                               | Belgium (retail)                                                                                        |
| ------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Fiscalization | None — no certified devices or software                                                  | None — voluntary industry "quality mark" only             | None for retail                                                                                         |
| Retention     | EPOS entries must carry a **sequential number** + timestamp, kept electronically 6 years | Reliable administration (kept inspectable for tax audits) | Normal VAT bookkeeping                                                                                  |
| Caveat        | —                                                                                        | —                                                         | **Horeca/catering >€25k needs GKS 2.0** (certified till + FDM black box) — out of scope; BE retail only |

These three map to `RecordOnlyAuthorityAdapter` — same as UK but
without the UK VAT-invoice field wording.

### Transmission outbox

ES/IT/DE submissions go through `fiscal_transmissions` — an outbox row
per (record, authority endpoint) with `attempts`/`last_error`/retry,
mirroring `pending_ops` semantics so a failed authority call never
blocks or loses the fiscal record itself:

```sql
CREATE TABLE fiscal_transmissions (
  id         TEXT PRIMARY KEY,
  record_id  TEXT NOT NULL,
  authority  TEXT NOT NULL,          -- 'aeat' | 'ade' | 'tse' | 'none'
  status     TEXT NOT NULL CHECK (status IN ('pending','sent','failed','dead')),
  response   TEXT,                   -- signature / receipt ids / error payload
  attempts   INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  sent_at    INTEGER
);
```

```ts
export interface FiscalService {
  /** Allocate the next number + chain a record for a paid order. Atomic. */
  finalizeSale(orderId: string): Promise<FiscalRecord>;
  /** Reverse a fiscalized order (same-day void) — new record, never a delete. */
  voidOrder(orderId: string, reason: string): Promise<FiscalRecord>;
  /** Fiscal record for a return/refund — links to the original sale record. */
  registerReturn(returnId: string): Promise<FiscalRecord>;
  /** Z-report record + optional shift lock. */
  closeShift(shiftId: string): Promise<FiscalRecord>;
  getRecord(orderId: string): Promise<FiscalRecord | null>;
  /** Walk the chain and verify hashes — used by audit/export tooling. */
  verifyChain(fromSeq?: number): Promise<ChainVerification>;
}
```

`finalizeSale` is invoked inside `CheckoutService.completePayment`'s
durable phase (the same transaction boundary that persists payment
state) — if fiscalization fails, the sale does **not** proceed to
`paid`; the order stays unfinalized and retryable, never half-fiscal.

## Data model

### Client (`retailPOS.db`, schema v15)

```sql
CREATE TABLE fiscal_records (
  id           TEXT PRIMARY KEY,          -- uuid
  chain_id     TEXT NOT NULL,             -- 'local' in standalone
  seq          INTEGER NOT NULL,          -- per-chain sequence
  number       TEXT NOT NULL UNIQUE,      -- 'N17-A-000123' (display/invoice no)
  type         TEXT NOT NULL CHECK (type IN ('sale','return','void','z_report')),
  order_id     TEXT,                      -- null for z_report
  return_id    TEXT,
  shift_id     TEXT,
  register_id  TEXT,                      -- device that originated the event
  payload_json TEXT NOT NULL,             -- canonical signed content
  prev_hash    TEXT NOT NULL,
  hash         TEXT NOT NULL,
  created_at   INTEGER NOT NULL,
  UNIQUE (chain_id, seq)
);

CREATE TABLE fiscal_chain_state (         -- one row per chain_id
  chain_id  TEXT PRIMARY KEY,
  last_seq  INTEGER NOT NULL,
  last_hash TEXT NOT NULL
);
```

`orders` gains appended columns (positional-scan rule):

```sql
ALTER TABLE orders ADD COLUMN fiscal_record_id TEXT;
ALTER TABLE orders ADD COLUMN fiscal_status TEXT
  CHECK (fiscal_status IN ('unfinalized','fiscalized','voided'));
ALTER TABLE orders ADD COLUMN fiscal_number TEXT;   -- denormalized for receipts
```

`shifts` gains `locked_at INTEGER` — once set, no edits inside the shift.

Allocation is `UPDATE fiscal_chain_state … RETURNING` +
`INSERT fiscal_records` in **one transaction** — same atomicity rule as
order+items. On SQLite the write is serialized anyway; the server uses
`SELECT … FOR UPDATE`-style locking under the same tx.

### Server (`integration-hub`, `pkg/store/fiscal.go` + `migrate.go`)

Identical tables in the server DB (shared migration block, appended
last). `POST /api/fiscal/finalize` runs the allocate+insert inside one
SQL transaction — atomic across concurrent registers, which is exactly
what makes a single store chain correct. New mux routes:

```
POST /api/fiscal/finalize          # order_id → {number, seq, hash}
POST /api/fiscal/void              # order_id, reason → record
POST /api/fiscal/returns           # return_id → record
POST /api/fiscal/shifts/:id/close  # → z_report record + shift locked
GET  /api/fiscal/records/:orderId
GET  /api/fiscal/verify?from_seq=
```

All HMAC-signed like every other route. The fiscal **chain key** and
authority credentials (TSE API key, AEAT certificate) live only on the
server via env — never shipped to registers.

## Config surface

### Register — `POSConfig` additions (`posConfig.values`, Settings-persisted)

| Key                             | Type                                                                        | Default        | Meaning                                                                                                   |
| ------------------------------- | --------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------- |
| `fiscalEnabled`                 | `boolean`                                                                   | `false`        | Master switch — off = current behavior (no numbers, drafts deletable)                                     |
| `fiscalJurisdiction`            | `'uk' \| 'ie' \| 'nl' \| 'be' \| 'es' \| 'it' \| 'de' \| 'fr' \| 'generic'` | `'generic'`    | UK/IE/NL/BE = record-only tier, ES/IT/DE/FR = certified tier; **`generic` performs no authority actions** |
| `fiscalBusinessTaxId`           | `string`                                                                    | —              | Seller VAT/NIF/Steuer-ID — required on invoices                                                           |
| `fiscalAuthorityMode`           | `'transmit' \| 'record'`                                                    | `'record'`     | ES: `transmit` = VERI\*FACTU, `record` = stored records + event log; ignored by UK/DE/FR/generic          |
| `fiscalChainScope`              | `'store' \| 'register'`                                                     | `'store'`      | Multi-register scope; standalone is always effectively `'register'`                                       |
| `fiscalInvoicePrefix`           | `string`                                                                    | store initials | Number prefix, e.g. `N17` → `N17-A-000123`                                                                |
| `fiscalSeries`                  | `string`                                                                    | `'A'`          | Series letter/segment in the invoice number                                                               |
| `fiscalStrictMode`              | `boolean`                                                                   | `true`         | `true` = LAN-down client cannot finalize a paid sale (fail closed); `false` = provisional numbers allowed |
| `fiscalShiftLock`               | `boolean`                                                                   | `true`         | Closing a shift locks its records (no edits; returns only)                                                |
| `fiscalRequireOriginalOnReturn` | `boolean`                                                                   | `true`         | Return must reference a fiscalized sale record                                                            |

Settings keys follow the existing namespace: `fiscal.enabled`,
`fiscal.jurisdiction`, … in `SETTINGS_KEYS`. `fiscalEnabled` is
admin-only in the Settings tab (permission-gated like payment config).
Authority credentials — cloud-TSE API key/secret, AEAT certificate —
go through `ProtectedValueStore` (never plain settings), and in
multi-register live on the **server** only, so a register rebuild never
needs the merchant's tax credentials re-entered.

### Server (`integration-hub` env, like `STORE_PORT`)

| Env                            | Meaning                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `FISCAL_ENABLED`               | Server enforces fiscalization on paid orders                                                                                               |
| `FISCAL_JURISDICTION`          | `uk` \| `ie` \| `nl` \| `be` \| `es` \| `it` \| `de` \| `fr` \| `generic` — drives the authority adapter; `generic` = no authority actions |
| `FISCAL_AUTHORITY_MODE`        | `transmit` \| `record`                                                                                                                     |
| `FISCAL_AUTHORITY_CREDENTIALS` | Path/JSON for merchant authority credentials (TSE API key, AEAT cert) — server only                                                        |
| `FISCAL_CHAIN_SCOPE`           | `store` \| `register` — must match register config                                                                                         |
| `FISCAL_SERIES`                | Series for server-issued numbers                                                                                                           |
| `FISCAL_SIGNING_KEY`           | Chain/payload signing key — server only                                                                                                    |
| `FISCAL_STRICT`                | Reject unfinalized paid-order writes when `true`                                                                                           |

## Flows

**Sale (standalone):** payment ok → `finalizeSale` in same tx as
`updatePayment` → order row gets `fiscal_status='fiscalized'` +
`fiscal_number` → receipt prints the fiscal number, not the UUID tail.

**Sale (client, LAN up):** payment ok → `POST /api/fiscal/finalize`
(server allocates+chains atomically) → server returns `number` →
register prints it. The `PUT /api/orders` sync then carries
`fiscal_record_id` so the server keeps the linkage.

**Sale (client, LAN down):** strict mode → cashier cannot complete a
paid sale; cash tender is refused with a banner reason (extends the
existing degraded banner). Non-strict → order finalizes locally with a
provisional `fiscal_status='unfinalized'`; on recovery the flush calls
`finalize` and the server backfills `fiscal_number` — the printed
receipt was provisional (jurisdiction-dependent whether this is legal;
that is why strict defaults to `true`).

**Sale (DE, TSE up):** `finalize` → chain record → `DeTseAdapter` opens a
TSE transaction for the sale → TSE returns signature + transaction
number → stored on the record, QR printed on the receipt. Cloud TSE
unreachable + `fiscalStrictMode=true` → sale can't finalize; the BMF
permits falling back to a second TSE (e.g. a local USB TSE) — that
fallback is the lenient path, spec'd as an adapter option rather than a
config fork.

**Sale (FR):** record-only — `FrNf525Adapter` adds closure totals at
shift/day/month/year close (`clôtures`) and the frozen archive records
the ISCA rules require; no per-sale call to anything.

**Void / return:** never an UPDATE of the original record — a new
`void`/`return` record chains on top (ES: a `registro de anulación`;
DE: a TSE reversal/storno transaction). `OfflineOrderRepository.delete`
becomes unreachable for fiscalized orders (guarded), same for
`cancelDraftOrder` on paid orders. `PendingOrderStore.flush`'s local
cleanup-delete is safe — it only runs after the server has the row.

**Shift close / Z-report:** `closeShift` chains a `z_report` record
(shift totals + order-count + first/last seq) → `shifts.locked_at` set →
the shift's orders are read-only from then on; a later sale goes in the
next open shift.

## Decisions — resolved

| #   | Decision                                             | Resolution                                                                                                                                                                                         |
| --- | ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Invoice authority for platform-synced in-store sales | **RetailPOS issues**; platform receives the order with `fiscal_number` as external reference and must not issue its own invoice (PrestaShop invoice-suppression check still open — Q1 in rules.md) |
| D2  | Jurisdiction set                                     | **UK/IE/NL/BE** record-only + **ES/IT/DE/FR** certified tier (FR deferred to certification); `generic` performs no authority actions                                                               |
| D3  | Chain scope                                          | **`store`** in multi-register, `register` in standalone                                                                                                                                            |
| D4  | Strict vs provisional on LAN outage                  | **`fiscalStrictMode=true`** — no provisional receipts by default                                                                                                                                   |
| D5  | Signed hash                                          | **HMAC over canonical payload** (`FISCAL_SIGNING_KEY`, server-held)                                                                                                                                |

## Decisions still open

| #    | Decision      | Notes                                                                                                                                                                                                                   |
| ---- | ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q-IT | Italy route   | The app can't self-certify — needs either an approved **Soluzione Software** partner (MF1/PEM spec v1.1), a certified **RT device** bridge, or the AdE web procedure. Recommend adapter-first, partner eval in parallel |
| Q-DE | TSE vendor    | Which BSI-certified cloud TSE (fiskaly SIGN DE, fiskaltrust, Swissbit…) — and whether a local USB TSE is stocked as the offline fallback                                                                                |
| Q-FR | Certification | LNE vs Infocert NF525 audit — mandatory since Feb 2025 (self-attestation abolished), annual follow-ups; schedule against the ES/DE build so the audit lands on finished code                                            |
| Q-ES | AEAT mode     | `VERI*FACTU` (transmit) vs record-only — record-only is lighter but obliges previous-hash verification per record + `registros de evento`; both spec'd, pick per merchant                                               |

## Implementation map

- `shared/utils/dbSchema.ts` — v15 migration (tables + appended columns)
- `features/fiscal/**` — service, repos, factory (this doc's tree)
- `features/checkout/services/CheckoutService.ts` — hook `finalizeSale`
  into the durable phase
- `features/orders-sync/**` — delete-guards, receipt prints
  `fiscal_number`, shift lock on close
- `shared/services/audit/AuditLogService.ts` — `fiscal:finalized`,
  `fiscal:voided`, `fiscal:return`, `fiscal:shift_closed` actions
- `integration-hub/pkg/store/fiscal.go` + `migrate.go` + `server.go`
  routes + repository ops (`AllocateFiscalRecord` under one tx) +
  server-side `authorities/` adapters (Go) for ES/IT/DE transmission
- `tests/` — real-SQLite chain tests (tamper → verify fails), concurrent
  allocation test on the server repo, outbox retry tests for
  `fiscal_transmissions`
