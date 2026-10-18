# In-Store Server Hardening Checklist

> Operating checklist for the in-store server — a **separate project** running
> on a dedicated always-on host that serves port 8787 and owns the
> authoritative store database (ADR-018). POS registers (Android, iOS,
> desktop) are client-only and never host. Network placement rules live in
> `network-segmentation.md` — this doc covers the server host and service.

---

## 1. Before deploying the server

- [ ] The host sits on the **dedicated POS VLAN** and nothing else shares it.
- [ ] Exactly **one** server instance runs per segment. A second one causes
      silent split-brain (no election exists — PG1 in
      `docs/features/multi-register/rules.md`).
- [ ] The server has a **static DHCP reservation**; clients need a stable
      `serverAddress`.
- [ ] Wired Ethernet, mains power, and a UPS — the server dying stops all
      client registers.
- [ ] The host runs only the server service: no unrelated apps, screen-lock
      enforced, OS auto-updates scheduled off-hours.
- [ ] OS firewall allows only TCP 8787 inbound (plus VPN management).

## 2. Shared secret management

- [ ] The server generates/owns the shared secret (`instore-<32 hex chars>`
      format) — the route/signing contract is defined by
      `features/multi-register/services/{InstoreApiServer,requestSigning}.ts`
      in this repo.
- [ ] Copy it to each client register **out-of-band** — hand-entry or a
      trusted channel, into **Settings → Instore API**. Never email, Slack,
      or commit it. There is no pairing flow (PG4): whoever holds the secret
      can call every route except health/webhook.
- [ ] Verify storage mode on each register: `ProtectedValueStore` may keep
      the secret in secure storage (Keychain / safeStorage) rather than
      plain KV — confirm `instoreapi.settings.storageMode` per device.
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

- [ ] **Backups:** the server's database is the system of record — snapshot
      it daily (file copy while the service is quiescent, or platform backup).
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
      feature rules — no write queue). Define the manual procedure: keep a
      warm spare host/image, or temporarily switch critical lanes to
      `standalone` + reconcile later.

## 6. Decommissioning a server

1. Export audit log + final DB backup.
2. Deploy the replacement server host (new secret) — or confirm the store
   moves to standalone.
3. Rotate the shared secret; wipe credentials on the old host.
4. Wipe the host; remove its DHCP reservation.

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
