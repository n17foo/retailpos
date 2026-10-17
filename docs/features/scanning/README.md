# Scanning

## Purpose

In-sale barcode and QR code scanning across USB/Bluetooth HID keyboard-wedge scanners and the device camera, with keystroke burst detection, scan de-duplication, product/variant resolution, and non-blocking inline feedback.

## Scope

### Included

- `HidCaptureField` — hidden native `TextInput` that captures USB/Bluetooth HID keystroke bursts without stealing focus from active inputs.
- `CameraScanOverlay` — continuous `expo-camera` barcode scanner overlay (full-screen on phone, side-sheet on tablet/desktop).
- `ScanNoticeBar` — non-blocking inline banner displaying scan outcomes (`added`, `out_of_stock`, `not_found`).
- `useSaleScanner` — ref-counted scanner subscription, de-duplication (`saleScanDedupMs`), barcode/SKU → product/variant resolution, and `addUnit` hand-off.
- `HidBurstDetector` (`hidBurst.ts`) — timing-based HID burst detector shared by `HidCaptureField`, `USBScannerService`, and `ElectronScannerService`.

### Excluded

- Low-level hardware scanner drivers (`USBScannerService`, `BluetoothScannerService`, `CameraScannerService`, `QRHardwareScannerService`, `ElectronScannerService`) and scanner settings — `hardware` and `settings` features.
- Inventory stock-count scanning (`useInventoryScanner`) — `inventory` feature.

## Entry Points

- `HidCaptureField`, `CameraScanOverlay`, and `ScanNoticeBar` mounted on `SaleScreen`.
- `useSaleScanner` composed inside `useSaleScreen`.

## Implementation Map

| Layer      | Responsibility                                                | Implementation                                                                       |
| ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Components | Camera overlay, HID capture input, inline scan notice banner  | `features/scanning/components/{CameraScanOverlay,HidCaptureField,ScanNoticeBar}.tsx` |
| Hooks      | Ref-counted sale scanner lifecycle, dedup, product resolution | `features/scanning/hooks/useSaleScanner.ts`                                          |
| Utils      | Keystroke timing burst detector                               | `features/scanning/utils/hidBurst.ts`                                                |

## State Ownership

| State                                 | Owner              | Persistence | Reset condition                       |
| ------------------------------------- | ------------------ | ----------- | ------------------------------------- |
| Active scan notice (`ScanNotice`)     | `useSaleScanner`   | Memory      | Auto-dismiss timer / next scan        |
| Camera overlay open state             | `useSaleScanner`   | Memory      | Close button / sale reset             |
| Last scanned code & timestamp (dedup) | `useSaleScanner`   | Memory      | `saleScanDedupMs` window expiry       |
| HID keystroke buffer                  | `HidBurstDetector` | Memory      | Suffix key (`Enter`/`Tab`) or timeout |
