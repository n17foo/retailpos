# Sale Scanning — Rules

**Parent:** [rules.md](rules.md)
**Files:** `hooks/useSaleScanner.ts`,
`services/scanner/ScannerServiceFactory.ts`, `services/scanner/{USBScannerService,
ElectronScannerService}.ts`, `components/{CameraScanOverlay,HidCaptureField}.tsx`,
`utils/hidBurst.ts` | **Tests:** `hidBurst.test.ts`

---

## R1 — The scanner connects once for the whole sale (ref-counted)

**Rule**
`ScannerServiceFactory.connectForSale(onScan)` → `saleRefCount++`, shared
connection promise, deduplicated service subscriptions; each consumer gets a
release — hardware disconnects only at `count === 0`. Modals/sheets opening
keep the connection alive so scans aren't lost.

**Evidence** — `services/scanner/ScannerServiceFactory.ts:123-150`.

🟢 **E1.1** — open basket sheet → scanner still connected (shared release).
🔴 **E1.2** — last release → USB/QR subscriptions torn down.

## R2 — HID keystrokes are swallowed as bursts, not typed into inputs

**Rule**
Shared `HidBurstDetector` (see shared-libs sale-domain R4): ≤`scanIntervalMs`
gap = burst; Enter/Tab closes a valid-length buffer → `onScan`; first
keystroke passes; ≥2-char Enter swallowed; 2×interval grace window swallows
the next burst's start. `USBScannerService` + `ElectronScannerService` both
use it; `HidCaptureField` filters buffered chars via `isBursting()`.

**Evidence** — `utils/hidBurst.ts`, both services, `HidCaptureField`;
spec §4.5.3.

🟢 **E2.1** — scanner burst → omnibar receives nothing; `onScan` gets code.
🔴 **E2.2** — human typing → untouched (gap > interval, Enter not swallowed).
🟠 **E2.3** — first scan char leaks unless caller uses `isBursting()`
(parent-map PG5).

## R3 — Scans deduplicate within `saleScanDedupMs`

**Rule**
Repeated scans of the same code inside `posConfig.values.saleScanDedupMs` are
dropped before resolution.

**Evidence** — `hooks/useSaleScanner.ts`, `posConfig.values.saleScanDedupMs`.

🟠 **E3.1** — same item scanned twice fast → added once; scan again after the
window → adds again (intended).

## R4 — A scan resolves product → variant → add, quietly

**Rule**
`handleScan` resolves by barcode/SKU → product → variant (variant scans map to
the specific variant) → `addUnit` (sellability still gates). Not found or
blocked → `ScanNoticeBar` notice, never an alert.

**Evidence** — `hooks/useSaleScanner.ts:146-166`; spec Phase 0.

🟢 **E4.1** — variant barcode → that variant's price/SKU/tax added.
🔴 **E4.2** — out-of-stock → notice, not added (no overselling).
🔴 **E4.3** — unknown code → notice; omnibar focus kept.

## R5 — Camera scanning is an overlay path on touch devices

**Rule**
`CameraScanOverlay` (expo-camera) feeds `handleBarCodeScanned` → same
`handleScan`; permission prompt if needed; side-sheet layout on wide screens.

**Evidence** — `components/CameraScanOverlay.tsx`,
`hooks/useSaleScanner.ts:166`.

🟠 **E5.1** — permission denied → in-overlay prompt to allow; close keeps
HID scanning working.

## ❓ Questions

- **Q1** — camera scans deduplicate through the same `saleScanDedupMs`
  window — confirmed by shared `handleScan` path?

## Coverage

`hidBurst` → dedicated tests; `useSaleScanner`/factory ref-count → not found.
