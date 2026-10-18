# In-Store Server Hardening Checklist

> Operating checklist for the multi-register `server` mode — the device that
> hosts port 8787 and owns the authoritative SQLite database. Applies equally
> to a register tablet running `mode=server` and to a dedicated
> store-api / integration-hub host (ADR-015). Network placement rules live in
> `network-segmentation.md` — this doc covers the device and the app.

---

## 1. Before enabling server mode

- [ ] The device sits on the **dedicated POS VLAN** and nothing else shares it.
- [ ] Exactly **one** device will run `mode=server`. A second one causes
      silent split-brain (no election exists — PG1 in
      `docs/features/multi-register/rules.md`).
- [ ] The server has a **static DHCP reservation**; clients need a stable
      `serverAddress`.
- [ ] Wired Ethernet preferred. A tablet server must have a permanent
      charging plan — the server dying stops all client registers.
- [ ] Device is enrolled in MDM / kiosk mode: no unrelated apps, screen-lock
      enforced, OS auto-updates scheduled off-hours.
- [ ] OS firewall allows only TCP 8787 inbound (plus VPN management).

## 2. Shared secret management

- [ ] On first `start()` with no secret, one is auto-generated
      (`instore-<32 hex chars>`) and persisted via `ProtectedValueStore`
      (`features/multi-register/services/InstoreApiServer.ts`). Surfaced in
      **Settings → Instore API**.
- [ ] Copy it to each client register **out-of-band** — hand-entry or a
      trusted channel. Never email, Slack, or commit it. There is no pairing
      flow (PG4): whoever holds the secret can call every route except
      health/webhook.
- [ ] Verify storage mode: `ProtectedValueStore` may keep it in secure
      storage (Keychain / safeStorage) rather than plain KV — confirm
      `instoreapi.settings.storageMode` on each device.
- [ ] **Rotate** the secret when a register is decommissioned, lost, or staff
      with access leave. Rotation = change on the server, then re-copy to
      every client (they all break simultaneously — plan for a maintenance
      window).
- [ ] If a secret may have leaked: rotate immediately, then check server logs
      for `401`/signature-failure patterns and unexpected `x-instore-register`
      values.

## 3. Version and clock consistency

- [ ] **All registers run a signing-capable build** — the server rejects the
      legacy `x-shared-secret` header. Mixed-version fleets cannot
      authenticate (signed-requests-only rollout decision).
- [ ] NTP on every device. The signature window is **±5 minutes**
      (`SIGNATURE_WINDOW_MS`); skewed clocks produce 401s that look like a
      wrong-secret outage.
- [ ] Upgrade order for breaking changes: server first, then clients (clients
      on old builds fail closed rather than corrupt data).

## 4. What the server exposes — and who guards it

| Surface                           | Auth                                  | Note                                                                                                                                   |
| --------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`                 | none (by design, for discovery)       | Reveals `registerId`/`registerName` only — acceptable on an isolated VLAN                                                              |
| `POST /api/webhooks/commercefull` | `x-webhook-signature` HMAC (receiver) | Pin this path behind a proxy if internet-facing — see §4 of the network doc                                                            |
| `POST /api/users/verify-pin`      | signed + server rate guard            | 10 failures/min → 429 for **all** registers. A secret-holding client can DoS PIN login globally — treat the secret as admin-equivalent |
| Everything else on 8787           | HMAC signature + nonce + timestamp    | Tamper/replay rejected; legacy header ignored                                                                                          |
| `/ws` (store-api deployments)     | HELLO handshake, unauthenticated      | External protocol — frames are validated/dropped defensively; messages are data events only                                            |

## 5. Day-2 operations

- [ ] **Backups:** the server's SQLite DB is the system of record — snapshot
      it daily (file copy while the app is quiescent, or platform backup).
      Client registers hold no authoritative data.
- [ ] **Health scan:** periodically run a subnet probe (or
      `InstoreApiDiscovery.scanSubnet`) — expect exactly **one** responder
      on 8787. Two = split-brain.
- [ ] **Log review:** watch for `PIN verify rate limit hit`, clusters of 401s,
      and repeated `Error handling …` entries — signs of a hostile or broken
      client.
- [ ] **Audit export:** schedule `AuditLogService` CSV export — the in-app
      log is a mutable KV array capped ~2000 entries (ADR-012), not a forensic record.
- [ ] **Failover plan:** server down ⇒ clients cannot transact (Q2 in the
      feature rules — no write queue). Define the manual procedure: designate
      a warm spare register, or temporarily switch critical lanes to
      `standalone` + reconcile later.
- [ ] **App config:** confirm `pos.autoLockMinutes` (default 5) is set on the
      server register too — it still has a POS UI with admin surfaces.

## 6. Decommissioning a server

1. Export audit log + final DB backup.
2. Promote replacement (configure `mode=server`, new secret) — or confirm the
   store moves to standalone.
3. Rotate the shared secret; wipe platform credentials via Settings.
4. Factory-reset the device; remove its DHCP reservation and MDM enrollment.

## Known residual risks (accepted — verify they remain acceptable)

- Plaintext LAN transport — mitigated by dedicated VLAN or a WireGuard/Tailscale
  overlay, **not** by signing.
- Global PIN-verify rate limit allows cross-register DoS by any secret holder.
- Manual secret distribution; no per-register credentials.
- Two-server split-brain has no technical guard — procedural + monitoring only.
- `PaymentIntentClient` still sends the legacy `x-shared-secret` header to the
  external store-api/integration-hub (it can't be changed from the POS side);
  keep that host on the same trusted segment.
- Mutable, capped audit log — export regularly.

Full inventory: `security-controls.md` → "Residual risks".
