# Hardware

## User Story

**As a** retail cashier  
**I want to** use barcode scanners, QR code readers, receipt printers, and a cash drawer  
**So that** I can scan products, print receipts, and handle cash efficiently

## Rules

- **Barcode scanner**: Bluetooth, USB, or camera-based — connects via device discovery
- **QR code scanner**: video scanner (camera) on mobile/tablet; dedicated QR hardware scanner required for desktop apps (no camera access)
- **Receipt printer**: thermal printer with customizable branding, daily reports, QR codes on receipts
- **Cash drawer**: auto-opens on cash transactions when `drawerOpenOnCash` is enabled; every open is audit-logged
- All devices use event-driven callbacks and connection status monitoring
- Disconnect recovery attempts automatic reconnection

---

## Flow 1: Barcode Scanner Setup & Scanning

1. **Settings → Scanner tab** → cashier opens scanner configuration
2. **Select scanner type** → type picker: Camera, Bluetooth, USB, or QR Hardware
3. **discoverDevices()** → scans for available devices of selected type
4. **Device list shown** → array of {id, name} for each discovered device
5. **Cashier selects device** → connect(deviceId) called
6. **Connection established** → isConnected() returns true, UI shows green status
7. **startScanListener(callback)** → registers callback, returns subscriptionId
8. **Product scanned** → callback fires with barcode string
9. **Product lookup** → barcode matched to product in catalog → added to basket
10. **Multiple listeners** → different UI components can each register their own listener
11. **stopScanListener(subscriptionId)** → removes specific listener when component unmounts

## Flow 2: QR Code Scanning — Mobile / Tablet (Video Scanner)

1. **Device has camera** → video scanner available on mobile and tablet
2. **Open QR scanner** → camera activates with real-time video preview
3. **Point camera at QR code** → video processing detects and decodes QR data
4. **QR data extracted** → could be product ID, payment link, or digital coupon
5. **Action dispatched** → product added to basket, or payment flow triggered
6. **Camera released** → scanner closed when done

> **Note**: Video QR scanning does NOT work on desktop apps — desktop has no camera access.

## Flow 3: QR Code Scanning — Desktop (Hardware Scanner)

1. **Desktop POS needs QR scanning** → no camera available on desktop apps
2. **Settings → Scanner tab** → select **"QR Hardware"** from type picker (`ScannerType.QR_HARDWARE`)
3. **discoverDevices()** → enumerates USB HID / Bluetooth QR readers (e.g. Zebra DS9308, Honeywell YJ4600, Newland FR80)
4. **Select device** → device ID saved to scanner settings
5. **QRHardwareScannerService.connect(deviceId)** → establishes link (USB scanners act as HID keyboard input)
6. **startScanListener(callback)** → listens for QR data (terminated by Enter key, standard for handheld QR scanners)
7. **Customer presents QR code** → hardware scanner reads it, callback fires with decoded string
8. **Same processing** → product lookup, payment link, or coupon applied via same pipeline as barcode scans
9. **Always-on** → hardware scanner stays connected for continuous use
10. **Mock available** → `QRHardwareScannerMockService` simulates scans when `USE_MOCK_SCANNER=true`

> **Implementation**: `services/scanner/QRHardwareScannerService.ts` + `services/scanner/mock/QRHardwareScannerMockService.ts`, registered in `ScannerServiceFactory` as `ScannerType.QR_HARDWARE`.

## Flow 4: Receipt Printer Setup & Printing

1. **Settings → Printer tab** → cashier opens printer configuration
2. **Discover printers** → finds available thermal printers (USB, Bluetooth, network)
3. **Select and connect** → printer service establishes connection
4. **Configure receipt layout** → ReceiptConfigService stores logo, header, footer, paper size, fonts
5. **Transaction completed** → printReceipt(orderData) called
6. **Receipt formatted** → items, totals, tax, payment method, store branding
7. **QR code on receipt** → optional QR containing transaction details for digital receipt access
8. **Sent to printer** → thermal printer outputs formatted receipt

## Flow 5: Daily Report Printing

1. **End of day** → manager opens reporting or triggers daily close
2. **DailyReportService** → aggregates sales by hour, category, payment method
3. **Report formatted** → totals, taxes, cashier performance, transaction counts
4. **printDailyReport(dateRange)** → sends formatted report to printer
5. **Printed** → physical copy for store records

## Flow 6: Cash Drawer Operation

1. **Cash drawer connected** → via printer port or dedicated USB connection
2. **Cash payment completed** → checkout service checks `posConfig.drawerOpenOnCash`
3. **Enabled** → drawer open command sent automatically
4. **Drawer opens** → cashier accesses cash for change
5. **Audit logged** → `drawer:opened` event recorded with userId, registerId, timestamp
6. **Manual open** → manager can trigger drawer open from settings (also audit-logged)

## Flow 7: Hardware Status & Disconnect Recovery

1. **All devices monitored** → scanner, printer, drawer connection states tracked
2. **Periodic health check** → isConnected() polled for each device
3. **Unexpected disconnect** → onDisconnect callback fires with deviceId
4. **UI notification** → alert shown: "Scanner disconnected"
5. **Auto-reconnect attempt** → system tries to re-establish connection
6. **Manual reconnect** → cashier can tap "Reconnect" in settings if auto-reconnect fails

## Questions

- How does the system prioritize when both a hardware QR scanner and video scanner are available?
- What happens when the printer runs out of paper mid-receipt?
- How are different barcode formats (UPC, EAN, Code128) handled across scanner types?
- What security measures protect scanned QR payment data?
- How does the cash drawer integration handle different drawer models and connection types?
- What is the fallback when the receipt printer is offline?
