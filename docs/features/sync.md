# Sync Queue

## User Story

**As a** retail manager  
**I want to** monitor and manage offline order synchronization  
**So that** all orders reach the e-commerce platform even when the network is unreliable

## Rules

- Summary bar: total, pending, failed order counts
- Order cards: status (color-coded), amount, cashier, timestamps, error details
- Status colors: green (synced), yellow (pending), red (failed)
- Individual retry and discard per order; bulk "Retry All" for batch
- Discard is destructive — confirmation required, audit-logged
- Pull-to-refresh updates queue from database
- Empty state: "All synced!" with checkmark

---

## Flow 1: Monitor Sync Queue

1. **Manager opens More → Sync Queue** → SyncQueueScreen loads
2. **useSyncQueue hook** → fetches pending/failed orders from SQLite
3. **Summary bar renders** → total: 12, pending: 3, failed: 2
4. **Order cards listed** → each shows status badge, amount, cashier name, created/updated timestamps
5. **Failed orders** → red badge, error message shown, "Retry" and "Discard" buttons visible
6. **Pull-to-refresh** → swipe down refreshes queue from database

## Flow 2: Retry Single Failed Order

1. **Manager taps "Retry"** on a failed order card
2. **retrySingleOrder(orderId)** → BackgroundSyncService attempts sync
3. **Order mapped** → local data converted to platform format
4. **API call** → createOrder sent to platform
5. **Success** → order status updated to "synced", success alert shown
6. **Failure** → error updated on card, failure alert shown
7. **Queue refreshes** → counts updated

## Flow 3: Retry All Orders

1. **Manager taps "Retry All"** → confirmation dialog: "Retry syncing X order(s)?"
2. **Confirm** → all pending + failed orders processed in background
3. **Each order attempted** → sync service processes sequentially
4. **Completion alert** → "Synced: X, Failed: Y"
5. **Queue refreshes** → updated statuses and counts
6. **Notification** → sync success/failure pushed via NotificationService

## Flow 4: Discard Failed Order

1. **Manager taps "Discard"** on failed order
2. **Destructive confirmation** → "This cannot be undone" warning
3. **Confirm** → discardFailedOrder(orderId) called
4. **Order marked cancelled** → removed from sync queue
5. **Audit logged** → order:discarded event with userId, orderId
6. **Queue refreshes** → order removed from list

## Flow 5: Empty Queue State

1. **All orders synced or discarded** → queue is empty
2. **Success illustration** → checkmark icon displayed
3. **"All synced!" title** → encouraging message shown
4. **No action buttons** → Retry All hidden

## Questions

- What happens to orders that repeatedly fail after N retries?
- What data is preserved when orders are discarded?
- How does the system handle concurrent sync operations across registers?
- How are sync conflicts resolved when platform data differs from local?
