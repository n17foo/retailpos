# System Services

## User Story

**As a** system administrator  
**I want to** monitor activity, receive alerts, and review audit trails  
**So that** I can track operations, troubleshoot issues, and meet compliance requirements

## Rules

- **Audit log**: KV-backed, rolling 2000 entries, CSV export, typed actions
- **Notifications**: in-memory singleton, listener pattern, severity levels, optional action buttons
- **Logger**: structured logging via LoggerFactory, contextual loggers per service
- **Config**: KeyValueRepository for persistent settings, POSConfigService for store config
- All services are singletons for global access

---

## Flow 1: Audit Logging

1. **Business event occurs** → e.g. order paid, refund processed, user login
2. **auditLogService.log(action, options)** → called by CheckoutService, ReturnService, AuthService, etc.
3. **Entry created** → { id, action, userId, userName, registerId, details, metadata, timestamp }
4. **Stored** → prepended to entries array, persisted to KV store as JSON
5. **Capped at 2000** → oldest entries dropped when limit exceeded
6. **Actions tracked** → order:created, order:paid, order:synced, order:cancelled, refund:processed, return:created, auth:login, auth:failed, settings:changed, drawer:opened, sync:started, sync:completed, sync:failed

## Flow 2: Audit Retrieval & Export

1. **Admin reviews activity** → getAll() returns all entries (newest first)
2. **Filter by action** → getByAction('order:paid') returns matching entries
3. **Filter by user** → getByUser(userId) returns user's activity
4. **Filter by date** → getByDateRange(from, to) returns entries in range
5. **CSV export** → exportCsv() generates CSV string with headers
6. **Share** → CSV opened in native share sheet for email/file save

## Flow 3: Notifications

1. **System event occurs** → e.g. sync failure, return processed, low stock
2. **notificationService.notify(title, message, severity, action?)** → creates notification
3. **Notification created** → { id, title, message, severity, timestamp, read: false }
4. **Listeners notified** → all registered listeners receive notification immediately
5. **NotificationProvider** → subscribes via addListener(), updates React context
6. **Toast shown** → auto-dismiss toast appears at top of screen
7. **Bell badge** → NotificationBell shows unread count
8. **Drawer** → NotificationDrawer lists all notifications with mark-read and clear options

## Flow 4: Notification Management

1. **Tap notification bell** → NotificationDrawer opens
2. **View notifications** → listed newest first with severity icons
3. **Tap notification** → markRead(id), action button triggers navigation if actionKey present
4. **Mark all read** → markAllRead() clears all unread indicators
5. **Clear all** → clearAll() removes all notifications from memory
6. **Max 100** → oldest notifications dropped when limit exceeded

## Flow 5: Structured Logging

1. **Service initializes** → LoggerFactory.getInstance().createLogger('ServiceName')
2. **Log events** → logger.info/warn/error/debug with structured context
3. **Error logging** → logger.error({ message }, Error) includes stack trace
4. **Used everywhere** → all services use Logger instead of console.log

## Flow 6: Configuration Persistence

1. **Settings changed** → POSConfigService.updateAll(values) or KeyValueRepository.setItem(key, value)
2. **Persisted to SQLite** → survives app restarts
3. **Read on startup** → posConfig.load() restores all settings
4. **Accessed globally** → posConfig.values provides current config

## Questions

- How are audit logs protected from tampering?
- What notification channels exist beyond in-app (push, email)?
- What data retention policies apply to audit history?
- How are configuration changes themselves audited?
