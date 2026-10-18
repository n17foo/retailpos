# System Infrastructure (Audit, Notifications, Queue, Secrets, Logger, Search)

## Purpose

Cross-cutting services every other feature leans on but users never see
directly: the append-only audit trail, toast notifications, the persisted
retry queue for failed API calls, pluggable secret storage, the logger
factory, and the platform product-search adapters that power omnibar search.

## Scope

### Included

- `AuditLogService` — KV-backed append-only audit log; ~45 `AuditAction`s;
  query by action/user/date; CSV export; `clear()`.
- `NotificationService` — `notify(title, body, severity)` singleton feeding
  toasts.
- `QueueManager` + `useSyncStore` — persisted queue of failed platform API
  requests (zustand + SQLite storage adapter); processes on network-restore,
  app-foreground, and a 30s poll; per-request `attempts` with 30s×2ⁿ backoff
  (5-min cap).
- `SecretsServiceFactory` — Keychain (native) / Electron safeStorage /
  Browser / Memory backends behind `SecretsServiceInterface`.
- `LoggerFactory` — `createLogger(context)` + pluggable `LogTransport`s.
- `SearchServiceFactory` + per-platform search adapters (consumed by the
  sale omnibar; see `catalogue/rules.md`).

### Excluded

- Order-sync retry — that's `OrderSyncService`/`BackgroundSyncService`
  (orders-sync feature); the request queue here is for _generic_ API calls.
- Customer-display service — hardware feature.
- In-sale search UX — `catalogue/rules.md`; this doc covers the adapters only.

## Entry Points

- `auditLogService.log(action, {userId?, details?, metadata?})` — called by
  ~45 event sites (orders, auth, drawer, permissions, procurement…).
- `notificationService.notify(...)` — sync results, hardware, warnings.
- `useSyncStore.addToQueue(request)` — failed platform calls.
- `secretsServiceFactory.getService()` — credential storage (platform API
  keys, shared secret via ProtectedValueStore).
- `LoggerFactory.getInstance().createLogger(tag)` — everywhere.

## Feature Flow

```
Feature code → auditLogService.log → KV append → persisted JSON
Failed API call → addToQueue → persisted QueuedRequest
   → processQueue on: connectivity restore | app active | 30s poll
   → retry → success: remove; failure: attempts++, backoff 30s·2ⁿ ≤5min
Secrets: factory picks backend by platform → Keychain/safeStorage/web/memory
Search: omnibar → SearchServiceFactory.getService(platform).search(query)
```

## Implementation Map

| Layer          | Responsibility          | Implementation                                                                                                                               |
| -------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Services       | Audit                   | `shared/services/audit/AuditLogService.ts`                                                                                                   |
| Services       | Toasts                  | `shared/services/notifications/{NotificationService,NotificationTypes}.ts`                                                                   |
| Services+Hooks | Request queue           | `shared/services/queue/{QueueManager,QueuedApiService}.ts`, `shared/hooks/useSyncStore.ts`                                                   |
| Services       | Secrets backends        | `shared/services/secrets/{SecretsService,SecretsServiceInterface,KeychainSecretsService,ElectronSecretsService,BrowserSecretsService,mock/}` |
| Services       | Logging                 | `shared/services/logger/` (LoggerFactory + transports)                                                                                       |
| Services       | Platform search         | `shared/services/search/{SearchServiceFactory,SearchServiceInterface,platforms/*}`                                                           |
| Repositories   | KV store (audit, queue) | `shared/repositories/KeyValueRepository.ts`                                                                                                  |
| Libs           | CSV export              | `shared/utils/csv.ts`                                                                                                                        |

## State Ownership

| State           | Owner                    | Persistence               | Reset condition  |
| --------------- | ------------------------ | ------------------------- | ---------------- |
| Audit entries   | `AuditLogService`        | KV (JSON)                 | `clear()`        |
| Queued requests | `useSyncStore` (zustand) | SQLite via custom adapter | success/remove   |
| Secrets         | backend store            | OS keychain/safeStorage   | user edit        |
| Toasts          | `NotificationService`    | Memory                    | display lifetime |

## Dependencies

- `KeyValueRepository` — audit + queue persistence.
- `shared/utils/csv.ts` — audit CSV export.
- NetInfo — queue's connectivity trigger.

## Side Effects

- Audit rows are append-only — disk grows until `clear()`.
- Queue retries mutate platform state on recovery — at-least-once delivery.
- Secret values never enter logs/conversation — backends are OS-secured.
