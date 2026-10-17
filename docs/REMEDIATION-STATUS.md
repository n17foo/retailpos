# Remediation Status

Tracking the resolution of issues surfaced during the `docs/features/`
documentation pass. Order: bugs first, then cleanup, then design/feature
work — one at a time.

Legend: ✅ done · 🔧 in progress · ⬜ pending

## Bugs

| #   | Issue                                                   | Status | Fix                                                                                                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Stripe NFC crashes Expo Go / provider commented out     | ✅     | `StripeTerminalBridge.tsx` is now a safe shell that lazily `require()`s `StripeTerminalBridgeImpl.tsx` only on real iOS/Android builds; provider restored in `App.tsx`. Expo Go → `MockPaymentService`; web/Electron → pass-through.                                                                                                      |
| 2   | `LoyaltyExpiryJob` never started                        | ✅     | `start()`/`stop()` wired into `App.tsx` startup/cleanup; no-ops when `expiryDays` unset.                                                                                                                                                                                                                                                  |
| 3   | Offline onboarding never seeded catalogue               | ✅     | `OnboardingScreen` seeds `OfflineCategoryService`/`OfflineProductService` on completion; idempotent on retry.                                                                                                                                                                                                                             |
| 4   | `commercefull` missing from onboarding picker           | ✅     | Picker entry, theme colour, `storeUrl`/`apiKey`/`apiSecret` form + validation, all four locales.                                                                                                                                                                                                                                          |
| 5   | Order-sync retry counts in memory                       | ✅     | Persisted in KV `sync:retries:<orderId>`; cleared on success; survives restart.                                                                                                                                                                                                                                                           |
| 6   | `SyncQueueScreen` shows "All synced!" on load failure   | ✅     | Load error renders a distinct error state.                                                                                                                                                                                                                                                                                                |
| 7   | `dbPromise` rejection permanent                         | ✅     | Failed open clears cached promise/instance → next call retries; `console.*` → `LoggerFactory`.                                                                                                                                                                                                                                            |
| 8   | `formatMoney` always 2 decimals                         | ✅     | ISO-4217 `decimals` per currency (JPY/KRW/VND/CLP/ISK=0, KWD/BHD=3); tests added.                                                                                                                                                                                                                                                         |
| 9   | Printer validation hardcoded English                    | ✅     | Util returns `settings.printer.validation.*` keys; `usePrinterSettings` translates. Unknown connection types now fail; IP octets range-checked; USB zero IDs preserved.                                                                                                                                                                   |
| 10  | Discount `usageCount` burned on validation              | ✅     | `validateDiscount` side-effect-free; optional `recordUsage(code)` called from `CheckoutService.completePayment` after successful payment only.                                                                                                                                                                                            |
| 11  | Inventory partial-update divergence                     | ✅     | `RetryingInventoryService` decorator (applied by `InventoryServiceFactory` to all non-offline services) persists failed writes to `PendingInventoryStore` (KV `inventory:pendingUpdates`) and replays oldest-first after a successful read/write. Absolute writes coalesce; deltas are at-least-once.                                     |
| 12  | Exchange confirm multi-write, no transaction boundary   | ✅     | Compensating saga — on new-order/payment failure the created return records are deleted; return→order link failure is non-fatal. `DELETE /api/returns/:id` + `InstoreApiReturnRepository.delete` wired so compensation also works from LAN client registers. Residual: mid-confirm crash can still orphan rows (no write-ahead recovery). |
| 13  | `receivePO` commits local before platform push          | ✅     | Local-first kept (goods physically arrived) — failed/partial pushes are persisted by `RetryingInventoryService` to the pending queue and replayed; `ReceiveResult.platformSyncPending` (and `FinaliseResult`) now surface the pending state + audit metadata instead of hiding it.                                                        |
| 14  | Pending returns don't reserve quantity                  | ✅     | `pending` added to `COUNTED_RETURN_STATUSES` (rejected rows release the reservation); validate-then-write serialised per order via `utils/keyedLock.withKeyedLock` in `ReturnService.processReturn` and `POST /api/returns`. `getReturnableItems` counts pending too.                                                                     |
| 15  | KDS dispatch loss silent (warn only)                    | ✅     | `RetryingKdsService` decorator (applied by `KdsServiceFactory` to the HTTP driver) persists failed tickets to `PendingKdsTicketStore` (KV `kds:pendingTickets`, coalesced per orderId), warns the cashier once, and replays oldest-first on the next successful send or reconnect.                                                        |
| 16  | `SerialDisplayService`/`ElectronDisplayService` missing | ✅     | Removed — `DisplayDriverType`/`DisplayType` narrowed to `'websocket'/'none'`; serial-only config fields (`baudRate`, `characterWidth`) dropped; stale persisted values fall back to No-Op with a warning.                                                                                                                                 |

## Cleanup

| #   | Issue                                                                                                                            | Status |
| --- | -------------------------------------------------------------------------------------------------------------------------------- | ------ |
| 17  | Dead code: `DataProvider` (no `useData` consumers), `useKeyboardShortcuts`, `screens/search/*`, dead sale states, stale comments | ⬜     |
| 18  | `orderStateMapper` hex → theme tokens; `isElectron` UA fallback; `getAppVersion` hardcode                                        | ⬜     |

## Design / Feature work

| #   | Issue                                                                                                              | Status |
| --- | ------------------------------------------------------------------------------------------------------------------ | ------ |
| 19  | Platform auth: silent re-auth on token expiry using stored credentials (no POS/biometric login)                    | ⬜     |
| 20  | Gift cards: service + tender UI + redemption (capability exists, implementation absent)                            | ⬜     |
| 21  | Multi-register: split-brain (two `mode=server`), secret distribution, clock skew                                   | ⬜     |
| 22  | Loyalty/coupon D11 redesign: platform-validated coupons; tenders (gift card/store credit/loyalty) don't reduce tax | ⬜     |
| 23  | Sweep remaining documented PGs/Qs                                                                                  | ⬜     |

## Verification notes

- `yarn lint` (tsc + eslint) clean after items 1–16.
- Focused tests green: `utils/money.test.ts` (24), printer settings (25),
  inventory suites (15), `taxQuote.test.ts`, `returnValidation.test.ts` +
  `ReturnService.test.ts` + `RefundService.integration.test.ts` (repaired —
  jest.mock factories referenced uninitialised consts; mocks now built inside
  the factories), `keyedLock.test.ts`, `RetryingKdsService.test.ts`.
- Pre-existing test-env failures unrelated to changes:
  `CheckoutService.tax.test.ts` (`__DEV__` undefined),
  `CheckoutService.test.ts` (jest mock factory scope).
