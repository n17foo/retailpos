# Hardware — Rules

## R1 — Every peripheral is optional; No-Op drivers keep the app running

**Rule.** Each subsystem has a no-hardware fallback: `NoOpDisplayService`,
`NoOpKdsService`, scanner `mock` driver, drawer returns `false` when no
driver. The POS never hard-depends on a peripheral.

**Evidence.** `features/hardware/services/display/NoOpDisplayService.ts`,
`features/hardware/services/kds/NoOpKdsService.ts`, `features/hardware/services/scanner/mock/`,
`features/hardware/services/drawer/PrinterCashDrawerService.ts`.

🟢 **E1.1 — No printer**
`printReceipt` throws `'Not connected to a printer'` at the factory boundary —
the sale/order stays intact; reprint surfaces an alert (see orders-sync doc).

🟢 **E1.2 — No display**
`enabled:false` or `type:'none'` → `NoOpDisplayService` — pushes are free
no-ops.

## R2 — Printer connectivity is per-connection-type; Electron takes IPC

**Rule.** `PrinterConfig.connectionType ∈ {usb, bluetooth, network}` —
validated per type by `features/hardware/utils/printerSettings.utils.ts` (name required; BT⇒MAC,
network⇒IP+port 1–65535, USB⇒vendorId+productId). On Electron, discovery and
printing delegate to the main process; on mobile the RN printer SDKs are
lazy-loaded so unused transports aren't bundled.

**Evidence.** `features/hardware/services/printer/{UnifiedPrinterService,ElectronPrinterService
PrinterServiceFactory,MobilePrinterDiscovery}.ts`,
`features/hardware/utils/printerSettings.utils.ts`, misc.md X-R1.

🟢 **E2.1 — Network printer**
`192.168.1.50:9100` validates → `connect` → `printReceipt` emits ESC/POS.

🔴 **E2.2 — Bad config**
BT + malformed MAC → `'Invalid MAC address format'`; validation blocks connect.

🟠 **E2.3 — Unknown type**
Unrecognised connectionType passes validation (fail-open — X-R1/PG12) but
`mapConnectionTypeToPrinterType` throws `'Unsupported connection type'` at
connect.

🟠 **E2.4 — Unknown-type config**
Loose IP regex accepts `999.999.999.999` — validation is shape-only.

## R3 — Drawer prefers the printer kick; Electron gets its own driver

**Rule.** `CashDrawerServiceFactory`: printer connected →
`PrinterDrawerDriver` (ESC/POS kick on pin 2/5 via RJ-11); else Electron →
`ElectronDrawerDriver` (IPC); else no driver → `open()` returns false. Every
successful open is audit-logged (`drawer:opened`).

**Evidence.** `features/hardware/services/drawer/{CashDrawerServiceFactory
PrinterCashDrawerService,ElectronDrawerDriver}.ts`, AGENT.md rule 10.

🔴 **E3.1 — No printer connected**
`open()` logs a warning and returns `false` — UI decides feedback; services
set a flag, never drive hardware directly (drawer is UI-driven per AGENT.md).

🟠 **E3.2 — Audit on success**
`auditLogService.log('drawer:opened', {pin, method:'printer'})` — a drawer
that pops without an audit row means the driver path was bypassed.

## R4 — Scanners are driver-pluggable; the sale owns their input handling

**Rule.** `ScannerDriverType ∈ {bluetooth, usb, camera, qr_hardware, mock}`;
`ScannerServiceInterface` exposes connection + scan-callback; the sale screen
ref-counts the connection and feeds keys through `HidBurstDetector` — that
behaviour is documented in `scanning/rules.md`.

**Evidence.** `features/hardware/services/scanner/*`, `features/hardware/hooks/useScanner.ts`,
`features/scanning/hooks/useSaleScanner.ts`, `scanning/rules.md`.

🟢 **E4.1 — Electron**
`ElectronScannerService` gets scans via `electronAPI.onBarcodeScan` IPC.

📱 **E4.2 — Camera fallback**
No hardware driver configured → camera overlay scan (sale feature).

## R5 — Customer display mirrors basket state over a pluggable transport

**Rule.** `CustomerDisplayState` (items, subtotal, tax, total, currencyCode,
`screen: idle|basket|payment|thankyou`, message) is pushed over the websocket
transport; `none` → No-Op. Settings persist under `customerDisplaySettings`
(endpoint, idleMessage default `'Welcome!'`, thankYouMessage `'Thank you!'`).
`DisplayType` only lists shipped drivers — stale persisted values fall back
to No-Op with a warning.

**Evidence.** `features/hardware/services/display/{CustomerDisplayServiceInterface
CustomerDisplayServiceFactory,WebSocketDisplayService}.ts`.

🟢 **E5.1 — Sale lifecycle display**
Basket edit → `screen:'basket'`; checkout → `'payment'`; paid → `'thankyou'`;
clear → `'idle'`.

� **E5.2 — Only shipped drivers are selectable**
`DisplayDriverType`/`DisplayType` = `'websocket' | 'none'` — the unshipped
serial/Electron transports were removed from the interface rather than
advertised and silently no-opped.

## R6 — KDS receives a ticket per synced order

**Rule.** On successful order sync, `OrderSyncService.dispatchKdsTicket` POSTs
`KdsOrder{orderId, orderRef:last4, items[{id,name,quantity}], placedAt}` to the
configured endpoint; failure logs a warning and never fails the sale.
`KdsServiceFactory` wraps the HTTP driver in `RetryingKdsService`: a failed
send persists the ticket to `PendingKdsTicketStore` (KV `kds:pendingTickets`),
notifies the cashier once, and replays oldest-first on the next successful
send or reconnect. `KdsVendorPresets` hold vendor-specific endpoints; status
can flow back (`received|preparing|ready|recalled`).

**Evidence.** `features/orders-sync/services/sync/OrderSyncService.ts`,
`features/hardware/services/kds/{KdsServiceInterface,HttpKdsService,RetryingKdsService
PendingKdsTicketStore,KdsVendorPresets}.ts`.

🟢 **E6.1 — Synced order fires ticket**
Every `updateSyncSuccess` path (online + offline fast-path) dispatches.

🟠 **E6.2 — KDS down**
Send fails → ticket queued + cashier notified (`'KDS Unreachable'` toast);
replays when the endpoint answers again. Tickets coalesce per `orderId`;
at-least-once — a ticket sent-but-lost can re-display (duplicate on the KDS).

## R7 — Hardware status is polled, not evented

**Rule.** `HardwareStatusScreen` renders printer/scanner/drawer/KDS/display
state from `useHardwareStatus` polling; `useCashDrawerStatus` separately tracks
the drawer.

**Evidence.** `features/hardware/screens/HardwareStatusScreen.tsx`, `features/hardware/hooks/useHardwareStatus.ts`.

🟢 **E7.1 — Live panel**
Connected/paper_low/error states render with colour/icon per component.

🟠 **E7.2 — Stale between polls**
A printer that dies between polls shows Ready until the next refresh.

## ❓ Open Questions

- **Q1 — resolved** — `SerialDisplayService`/`ElectronDisplayService` removed
  from the interface: `DisplayType` now lists only shipped drivers
  (`websocket`, `none`).
- **Q2** — Does anything drive `KdsOrderStatus` back into the UI (bump-bar
  states), or is the callback type aspirational?
- **Q3** — Drawer pin (2 vs 5) — configurable in settings UI or compile-time?

## ⚠️ Potential Gaps

- **PG1** — `printReceipt` is synchronous-ish; a mid-print failure after
  partial output has no retry/queue — the receipt can be half-printed.
- **PG2 — resolved** — Unshipped serial/electron display transports removed
  from the type surface; `websocket` is the only real transport.
- **PG3 — resolved** — KDS failures persist to `PendingKdsTicketStore` and
  replay via `RetryingKdsService`; the cashier gets a one-shot warning toast.
- **PG4** — Scanner disconnect while sale is open depends on the ref-counted
  connection; a driver crash mid-sale has no auto-reconnect visible here.
- **PG5** — `HardwareStatusScreen` polls — long interval + fast hardware
  changes = stale statuses.

## Test Coverage Mapping

| Example                         | Coverage                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------- |
| R1/R2 printer config validation | `features/hardware/utils/printerSettings.utils.test.ts`                             |
| R2/E2.x connect paths           | Not found (needs hardware)                                                          |
| R6 KDS dispatch                 | Indirect via `OrderSyncService` tests                                               |
| R7 status                       | `features/hardware/services/printer/DailyReportService.test.ts` covers reports only |

## Feature Context Summary

**Feature**: Hardware peripherals
**Responsibility**: Printer/drawer/scanner/display/KDS drivers behind
factories with No-Op fallbacks; connect/configure/print/dispatch; live
status panel.

**Core rules**

- R1 Hardware optional — No-Op drivers everywhere.
- R2 Printer per-connection-type validation; Electron via IPC.
- R3 Drawer via printer kick or Electron driver; audited on open.
- R4 Scanner drivers pluggable; sale owns input handling.
- R5 Display mirrors basket state (idle/basket/payment/thankyou) — websocket
  only.
- R6 KDS ticket per synced order; failure queues + retries with a cashier
  toast.
- R7 Status polled.

**Primary happy path**: configured printer connects → checkout prints receipt

- kicks drawer → KDS ticket fires → display thanks customer.

**Critical unhappy paths**: no printer → receipt step errors but sale
persists; no driver → opens return false; KDS down → ticket queued for
replay, cashier warned.

**Offline**: everything local — printer/drawer/scanner work fully offline;
KDS/display need LAN only.

**Gaps**: half-printed receipts unhandled; KDS replay is at-least-once
(possible duplicate tickets); no scanner auto-reconnect.
