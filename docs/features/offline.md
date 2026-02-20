# Offline & Multi-Register

## User Story

**As a** retail store with multiple POS registers  
**I want to** operate offline and sync data between registers over the local network  
**So that** sales continue even without internet and inventory stays consistent

## Rules

- 3 modes: **standalone** (single register, no networking), **server** (runs HTTP server), **client** (connects to server over LAN)
- Server discovery via subnet scanning (LocalApiDiscovery)
- Shared secret authenticates inter-register communication
- SyncEventBus: pub/sub with recent event buffer for real-time sync
- SyncPoller: client-side polling with exponential backoff
- All data stored locally in SQLite — works fully offline

---

## Flow 1: Standalone Mode (Default)

1. **Default after onboarding** → mode: 'standalone'
2. **No networking** → single register operates independently
3. **All data local** → products, orders, users in SQLite
4. **No sync needed** → orders sync to e-commerce platform only (if configured)

## Flow 2: Server Mode Setup

1. **Admin opens Settings → Multi-Register** → LocalApiSettingsTab loads
2. **Select "Server" mode** → configure port (default 8787), register name, shared secret
3. **Save** → LocalApiConfig persists to KeyValueRepository
4. **HTTP server starts** → LocalApiServer listens on configured port
5. **Routes available** → `/api/sync/events`, auth endpoints, data endpoints
6. **Server ready** → waiting for client connections

## Flow 3: Client Mode Setup & Discovery

1. **Admin selects "Client" mode** on second register
2. **Enter server address** manually, OR tap "Scan Network"
3. **LocalApiDiscovery.scanNetwork()** → scans subnet for running servers
4. **Discovered servers listed** → address, port, register name
5. **Select server** → address auto-filled
6. **Enter shared secret** → must match server's secret
7. **Test connection** → validates connectivity and authentication
8. **Save** → client mode active, sync begins

## Flow 4: Real-Time Event Sync

1. **Order created on client** → SyncEventBus publishes event
2. **Event sent to server** → via LocalApiClient HTTP POST
3. **Server receives** → stores in recent event buffer
4. **Server broadcasts** → other connected clients poll `/api/sync/events`
5. **SyncPoller on clients** → polls with exponential backoff (fast when active, slow when idle)
6. **Clients update** → local data updated from received events
7. **Event types** → order created, inventory updated, user changed, settings changed

## Flow 5: Offline Operation & Recovery

1. **Network drops** → client detects connection failure
2. **Continues operating** → all data in local SQLite, orders created locally
3. **Orders queued** → marked as pending sync
4. **Network restored** → SyncPoller reconnects automatically
5. **Queued events sent** → backlog of changes synced to server
6. **Conflicts resolved** → last-write-wins strategy for data conflicts

## Flow 6: Mode Switching

1. **Admin changes mode** → e.g. standalone → client
2. **New config saved** → LocalApiConfig updated
3. **Services restart** → old mode torn down, new mode initialized
4. **Data preserved** → local SQLite data remains intact
5. **Sync begins** → if switching to client/server, initial data exchange starts

## Questions

- How does the system handle network partitions between registers?
- What happens when the server register goes offline?
- How are conflicts resolved when multiple registers modify the same data simultaneously?
- What security measures protect data transmitted between registers?
