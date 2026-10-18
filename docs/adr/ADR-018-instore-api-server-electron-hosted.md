# ADR-018: Instore API Server Hosted in Electron Main Process

**Date**: 2026-10-18  
**Status**: Accepted  
**Deciders**: Engineering Team  
**Amends**: ADR-003 (hosting assumption only — repository injection is unchanged)

## Context

ADR-003 assumed any register could run `mode=server` and host the LAN HTTP
API on its own SQLite database. The original implementation used
`react-native-http-bridge` to run an HTTP listener inside the Android app.
That library is abandoned (unbuildable on modern AGP/RN), and running a
listening socket on a register tablet is a poor operational and security
posture — tablets sleep, lose power, and are harder to lock down.

What the system actually needs is: multiple POS devices all calling one
authoritative in-store server, which is a different deployment model than
"one of the registers doubles as the server".

## Decision

**`mode=server` is desktop-only.** The LAN HTTP listener lives in the
Electron main process (`electron/ipc/instoreServerBridge.js`); requests are
forwarded to the renderer over secure IPC where `InstoreApiServer` handles
routing, HMAC auth, and repository access against the shared SQLite
database.

- `InstoreApiTransport` (renderer) binds `InstoreApiServer` to the main
  process via `instore-server-start` / `instore-server-request` /
  `instore-server-respond` IPC channels. It throws on non-Electron
  platforms.
- Android/iOS registers offer only `standalone` and `client` modes — the
  settings UI does not show the `server` option on native platforms.
- `react-native-http-bridge` was removed entirely, along with its patch,
  Jest mocks, and Expo module scaffold.
- A dedicated store-api / integration-hub host remains a supported
  alternative for larger deployments (ADR-015), separate from the desktop
  app.

## Consequences

### Positive

- No abandoned native dependency; the HTTP server is Node's built-in
  `http` module — maintained, zero risk of AGP breakage.
- Registers are client-only: smaller attack surface, no listening socket on
  battery-powered devices, no per-tablet server lifecycle management.
- The authoritative SQLite database lives on a mains-powered, physically
  anchored host instead of a tablet.
- Web and mobile builds share identical code paths — nothing is lazily
  excluded per platform.

### Negative

- A store running multi-register must keep the desktop app (or a dedicated
  host) running; two mobile registers alone cannot form a cluster.
- Requests from the LAN traverse an extra IPC hop (main → renderer) before
  hitting route logic — bounded at ~a few milliseconds, irrelevant on LAN
  latency.

### Neutral

- Repository injection (ADR-003) and request signing/discovery/sync are
  unchanged — `InstoreApiServer` remains pure route logic; only the socket
  binding moved.
- Integration tests mock the IPC boundary rather than a real socket.
