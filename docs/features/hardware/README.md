# Hardware (Printer, Drawer, Scanner, Displays, KDS)

## Purpose

All physical-register peripherals behind factory-selected drivers: receipt
printer (USB/BT/LAN via ESC/POS, or Electron IPC), cash drawer (printer
RJ-11 kick or Electron driver), barcode scanners (USB/Bluetooth/camera/QR/
Electron), customer-facing display (websocket/serial/Electron/none), and
kitchen display system (KDS ticket dispatch). Each subsystem has a
`ServiceInterface` + `ServiceFactory` + No-Op fallback, so the app runs
with zero hardware configured.

## Scope

### Included

- Printer: connection lifecycle, `printReceipt`, test print, discovery,
  per-connection-type config, daily-report printing.
- Cash drawer: driver selection (printer-connected vs Electron), `open()`,
  audit event per open.
- Scanner drivers: type + connection lifecycle (in-sale behaviour documented
  in `scanning/rules.md`).
- Customer display: `CustomerDisplayState` push (idle/basket/payment/thankyou).
- KDS: `KdsOrder` ticket dispatch + status callback (`received|preparing|
ready|recalled`); vendor presets.
- `HardwareStatusScreen` — live status panel (printer/scanner/drawer/KDS/
  display) with polling via `useHardwareStatus`.
- `PrinterScreen`, `HardwareSettingsScreen`, scanner settings
  (`useScannerSettings`), printer settings (`usePrinterSettings`).

### Excluded

- In-sale scan behaviour (omnibar, burst detection, dedup) —
  `docs/features/scanning/rules.md`.
- Payment terminals — `docs/features/payments/`.
- Receipt _data assembly_ (totals, tax, sale_mode) — checkout;
  hardware layer only transports/renders it.

## Entry Points

- **Automatic** — printer connect during startup/onboarding; scanner connects
  when the sale screen mounts; display pushes on basket change; KDS dispatch
  on order sync success.
- **More → Printer** — `PrinterScreen` (connect, test print, settings).
- **More → Hardware Status** — `HardwareStatusScreen` live polling panel.
- **Settings → Hardware / Receipt / Payment tabs** — driver config.
- **Checkout completion** — receipt print + drawer open.

## Feature Flow

```
Settings / onboarding → persist PrinterConfig, display settings, KDS endpoint
        │
        ▼
Startup / PrinterScreen → PrinterServiceFactory.connect(config)
        │   ├─ Electron → ElectronPrinterService (IPC → main process)
        │   └─ Native   → UnifiedPrinterService (USB/BT/Net SDKs, lazy-loaded)
        ▼
CashDrawerServiceFactory picks driver:
        ├─ printer connected → PrinterDrawerDriver (ESC/POS kick, audit log)
        └─ Electron          → ElectronDrawerDriver (IPC)
        ▼
Checkout success → printReceipt(ReceiptData) + drawer.open()
Sync success   → kdsServiceFactory.getService().sendOrder(KdsOrder)
Basket change  → CustomerDisplayService.push(state) (screen: basket/payment/…)
HardwareStatusScreen → useHardwareStatus polls all five drivers → status UI
```

## Implementation Map

| Layer    | Responsibility                                 | Implementation                                                                                                                                                                                                    |
| -------- | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Screens  | Printer mgmt, status panel, hardware settings  | `features/hardware/screens/{PrinterScreen,HardwareStatusScreen}.tsx`, `features/settings/screens/HardwareSettingsScreen.tsx`                                                                                      |
| Hooks    | Status polling, printer/scanner settings       | `features/hardware/hooks/{useHardwareStatus,usePrinterSettings,useScannerSettings,useCashDrawerStatus}.ts`, `features/inventory/hooks/useInventoryScanner.ts`                                                     |
| Services | Printer                                        | `features/hardware/services/printer/{PrinterServiceFactory,UnifiedPrinterService,ElectronPrinterService,MobilePrinterDiscovery,BasePrinterService,PrinterCommandSets,DailyReportService,ReceiptConfigService}.ts` |
| Services | Drawer                                         | `features/hardware/services/drawer/{CashDrawerServiceFactory,PrinterCashDrawerService,ElectronDrawerDriver}.ts`                                                                                                   |
| Services | Scanner                                        | `features/hardware/services/scanner/{ScannerServiceFactory,USBScannerService,BluetoothScannerService,CameraScannerService,QRHardwareScannerService,ElectronScannerService,ScannerSettingsService}.ts`             |
| Services | Customer display                               | `features/hardware/services/display/{CustomerDisplayServiceFactory,WebSocketDisplayService,NoOpDisplayService}.ts`                                                                                                |
| Services | KDS                                            | `features/hardware/services/kds/{KdsServiceFactory,HttpKdsService,NoOpKdsService,KdsVendorPresets}.ts`                                                                                                            |
| Libs     | Printer validation, Electron bridge, HID burst | `features/hardware/utils/printerSettings.utils.ts`, `shared/utils/electron.ts`, `features/scanning/utils/hidBurst.ts`                                                                                             |
| Locales  | Printer settings validation keys (dead — C2)   | `shared/locales/*/common.json`                                                                                                                                                                                    |

## State Ownership

| State                       | Owner                                           | Persistence                      | Reset condition      |
| --------------------------- | ----------------------------------------------- | -------------------------------- | -------------------- |
| Active printer connection   | `PrinterServiceFactory`/`UnifiedPrinterService` | Config persisted; connection not | Disconnect / restart |
| Drawer driver               | `CashDrawerServiceFactory`                      | Derived from printer state       | Printer disconnect   |
| Scanner driver + connection | `ScannerServiceFactory`                         | Settings persisted               | Ref-count drops to 0 |
| Display settings            | `CustomerDisplayServiceFactory`                 | `customerDisplaySettings` key    | User edit            |
| KDS endpoint/vendor         | `KdsServiceFactory`                             | Settings                         | User edit            |
| Hardware status snapshot    | `useHardwareStatus`                             | None (polled)                    | Screen unmount       |

## Dependencies

- `shared/utils/electron.ts` — Electron builds take the IPC driver path for
  printer/drawer/scanner/display.
- `features/hardware/utils/printerSettings.utils.ts` — per-connection-type validation.
- `shared/services/audit` — drawer-open events audited.
- `shared/services/logger` — every driver logs through LoggerFactory.
- Order sync path — KDS dispatch happens in `OrderSyncService`.

## Side Effects

- Hardware sessions: USB/BT/network sockets, Electron IPC, serial display.
- ESC/POS bytes written to printer; drawer-kick command.
- HTTP POST of `KdsOrder` to configured KDS endpoint.
- WebSocket push to customer-display device.
- Audit log entries on drawer opens; toasts on connection failures.
