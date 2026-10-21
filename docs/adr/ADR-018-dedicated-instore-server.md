# ADR-018: In-Store API Server Is a Separate Project on a Dedicated Host

**Date**: 2026-10-18  
**Status**: Accepted  
**Deciders**: Engineering Team  
**Amends**: ADR-003 (hosting assumption only — repository injection is unchanged)

## Context

ADR-003 assumed a register could run `mode=server` and host the LAN HTTP
API on its own SQLite database. The original implementation used
`react-native-http-bridge` to run an HTTP listener inside the Android app;
that library is abandoned (unbuildable on modern AGP/RN). An interim step
moved the listener into the Electron main process, but hosting the server
inside any POS application is still the wrong boundary — the server's
availability should never be coupled to a register app's lifecycle, uptime,
or hardware.

What the system actually needs is: multiple POS registers all calling one
authoritative in-store server. That server is a standalone service with its
own release cycle, its own host, and its own operational runbook — not a
mode of the POS app.

## Decision

**The in-store API server is a separate project, deployed on a dedicated
always-on PC inside the store's POS VLAN.** RetailPOS — on every platform
(Android, iOS, desktop/Electron, web) — is always a **client** or
**standalone**; it never binds a listening socket for the API.

- Register modes in the POS reduce to `standalone` (local SQLite, no
  networking) and `client` (signed HTTP + WebSocket to the server). The
  `server` mode is removed from the app, together with the Electron IPC
  HTTP bridge (`electron/ipc/instoreServerBridge.js`) and
  `react-native-http-bridge`.
- The server service owns the authoritative store database, exposes the
  HTTP API on port 8080, terminates the Commercefull webhook, and
  orchestrates PED devices (ADR-015).
- The route surface, HMAC signing scheme (`x-instore-signature`), nonce
  replay protection, and `/api/health` discovery contract defined by
  `InstoreApiServer`/`requestSigning` in this repo are the **protocol
  contract** the external server implements — the client side of that
  contract lives here unchanged.
- A dedicated store-api / integration-hub host remains the same deployment
  shape for larger sites (ADR-015) — there is no longer a difference
  between "dedicated host" and "server mode"; there is only the dedicated
  server.

## Consequences

### Positive

- No abandoned native dependency and no HTTP listener shipped inside the
  POS app — smaller attack surface on every register.
- The authoritative database lives on a mains-powered, physically anchored,
  always-on host — no tablet battery/sleep failure modes.
- The server can evolve independently (Node.js stack, real DB choice,
  monitoring, horizontal concerns) without POS releases.
- All registers — mobile and desktop — share one identical client code
  path; nothing is lazily excluded per platform.

### Negative

- A store running multi-register must provision and operate a separate
  server host; two POS devices alone cannot form a cluster.
- Multi-register development/testing requires the server project running
  locally — the POS alone can no longer self-host a test cluster.

### Neutral

- Repository injection (ADR-003) and the client protocol (signing,
  discovery, websocket + poller sync) are unchanged — only which side of
  the wire each component lives on moved.
