# Network Segmentation — Dedicated POS Network

> **Requirement:** RetailPOS must run on its own network segment, physically
> or logically separate from guest Wi-Fi, staff/corporate LANs, CCTV/IoT, and
> any other network in the building.
>
> **Why:** the register↔server LAN protocol is plaintext HTTP. HMAC request
> signing (see `features/multi-register/services/requestSigning.ts`) proves a
> request came from a secret-holder and wasn't tampered with or replayed — it
> does **not** encrypt the payload. Order contents, customer data, user lists,
> and PIN-verify responses are readable by anything on the same segment.
> Segmentation _is_ the confidentiality layer.

---

## 1. Reference architecture

```
                    ┌──────────── Internet ────────────┐
                    │  platforms (HTTPS 443 only)       │
                    │  payment providers (HTTPS 443)    │
                    └──────────────▲────────────────────┘
                                   │ egress-filtered
                        ┌──────────┴──────────┐
                        │  Router / Firewall  │
                        └──┬───────┬───────┬──┘
              ┌────────────┘       │       └─────────────┐
              ▼                    ▼                     ▼
      VLAN 10: POS         VLAN 20: Staff/Office   VLAN 30: Guest/IoT/CCTV
      ┌─────────────┐      (no route to POS VLAN)  (no route to anything
      │ registers   │                                except internet)
      │ in-store    │
      │ server :8787│
      │ printers    │
      │ :9100-9109  │
      │ PED/KDS     │
      └─────────────┘
```

- **VLAN 10 (POS)** — registers (tablets/desktops), the in-store server,
  receipt printers, payment terminals, KDS endpoints. Nothing else.
- **Dedicated SSID** for wireless registers, mapped to VLAN 10,
  WPA3-Enterprise (or WPA2-AES with a strong per-site PSK). Never bridge it
  to a general-purpose SSID.
- **No inter-VLAN routing** except the explicit flows in the firewall matrix
  below. Guest/corporate/CCTV must not be able to open a TCP connection to
  any POS device.

If the site cannot do VLANs, a physically separate switch + router for POS
equipment is the equivalent minimum. A shared flat LAN is **not** acceptable.

## 2. Firewall / ACL rule matrix

Apply as inter-VLAN ACLs plus WAN egress policy. Default posture: **deny
all**, then permit the following.

### Inbound to the POS VLAN

| Source           | Destination      | Port / Proto                                 | Purpose                        | Notes                                                                       |
| ---------------- | ---------------- | -------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------- |
| POS VLAN         | in-store server  | TCP 8787                                     | Signed REST API + `/ws` events | Only device that may listen; pin by DHCP reservation (§3)                   |
| POS VLAN         | receipt printers | TCP 9100–9109                                | Raw ESC/POS printing           | Electron build already refuses ports outside 9100–9109 (`electron/main.js`) |
| POS VLAN         | KDS endpoint     | configured port (e.g. 8080)                  | Kitchen display, optional      | `KdsConnectionConfig.baseUrl`                                               |
| Management host  | POS devices      | WireGuard UDP 51820                          | Remote admin **via VPN only**  | Never expose SSH/RDP/VNC flat on the VLAN (§5)                              |
| Platform webhook | in-store server  | TCP 8787 → `/api/webhooks/commercefull` only | Commercefull push              | HMAC-verified by `CommercefullWebhookReceiver`; see §4                      |

### Outbound from the POS VLAN (egress)

| Destination              | Port / Proto | Purpose                                                                           |
| ------------------------ | ------------ | --------------------------------------------------------------------------------- |
| E-commerce platform APIs | TCP 443      | Shopify, WooCommerce, Magento, BigCommerce, Sylius, Wix, PrestaShop, Commercefull |
| Payment provider APIs    | TCP 443      | Stripe, Square, Adyen, Tap Payments                                               |
| NTP servers              | UDP 123      | Clock sync — **required**, ±5 min signature window (§6)                           |
| DNS resolver             | UDP/TCP 53   | Name resolution                                                                   |
| OS/app update services   | TCP 443      | App Store / Play / OS updates — schedule off-hours                                |
| Everything else          | —            | **DENY**                                                                          |

If your firewall supports FQDN rules, restrict TCP 443 egress to the
platform domains actually in use. If not, allow TCP 443 broadly but keep
non-443 egress denied.

### Denied by default

- Any device outside VLAN 10 → any POS device, any port.
- POS devices → staff/guest/CCTV VLANs.
- Inbound WAN → port 8787 directly (webhook goes through §4's pinned path).
- Peer-to-peer between client registers — nothing in the design needs it;
  client↔server only. (Optional enforcement: private VLAN / AP client
  isolation on the register SSID — this also blocks register-to-register
  lateral movement at the cost of blocking discovery scans between clients,
  which is fine because clients only scan for the server.)

## 3. Placing the in-store server

The in-store server is a **separate project** deployed on a dedicated
always-on host (ADR-018). Registers — Android, iOS, and desktop — are
client-only and never listen on 8787.

| Option                                                   | When to use                                                    | Network notes                                                                                                                                             |
| -------------------------------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Dedicated in-store server host**                       | Every multi-register deployment                                | Small always-on box/VM inside VLAN 10 with a **DHCP reservation / static IP** — clients point at `serverAddress` and discovery probes it. Wired Ethernet. |
| **Store-api / integration-hub variant of the same host** | Larger sites, PED orchestration (ADR-015), webhook termination | Same host shape; the right place to terminate Commercefull webhooks (§4).                                                                                 |

Rules that apply:

- **Exactly one listener on 8787 per segment.** Two server instances cause
  silent split-brain (documented gap PG1). Enforce by procedure +
  monitoring (§7), since nothing in code prevents it.
- The server owns the authoritative store DB — treat it as the system of
  record: mains power + UPS, no sleep.
- Keep the server's OS firewalled so only 8787 (and VPN management) is open.

## 4. The Commercefull webhook — the only inbound internet flow

`POST /api/webhooks/commercefull` is deliberately unauthenticated at the LAN
signature layer because the platform can't hold the LAN secret; it is instead
verified by `x-webhook-signature` HMAC inside `CommercefullWebhookReceiver`.

Expose it safely:

1. **Preferred:** terminate webhooks on the dedicated store-api /
   integration-hub, not on a register tablet.
2. If it must reach the in-store server, put a **reverse proxy or pinned
   port-forward** in front that forwards _only_ the path
   `/api/webhooks/commercefull` (reject everything else, including
   `/api/health`), adds no other ports, and ideally source-restricts to the
   platform's published egress IPs.
3. Never port-forward all of 8787: that would expose every signed route to
   the internet for probing, and `/api/health` to the world.
4. Configure a webhook secret on the sync service — without it the receiver
   fails closed (returns 401/500), but set it deliberately.

## 5. Remote access and administration

- No inbound admin ports on the POS VLAN. Manage devices through
  **WireGuard or Tailscale** with ACLs that admit only the admin nodes.
- Tailscale/WireGuard overlay also gives you an _encrypted_ path between
  registers and the server — running the plaintext API inside a WireGuard
  tunnel is the supported way to add confidentiality where VLAN-only
  isolation isn't enough (e.g. multi-site store-api, managed service
  provider reaching in).
- Alternatively: MDM for the tablets (kiosk mode, OS patching, remote wipe).

## 6. Supporting services the POS depends on

| Service | Why it matters                                                                                                                                                                                              |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NTP     | Signatures enforce a ±5-minute timestamp window — clock skew rejects every request and looks like an auth outage. Point all POS devices at the same reliable NTP source (the firewall/router can serve it). |
| DNS     | Needed for platform/provider APIs. A filtered resolver on the POS VLAN is fine; do not allow POS devices to use arbitrary external resolvers if your egress policy relies on FQDNs.                         |
| DHCP    | Reserve fixed IPs for the server and printers; keep the POS subnet small (a /24 is plenty) so discovery scans are fast and bounded.                                                                         |

## 7. Monitoring & drift detection

- Periodically scan the POS subnet for `/api/health` responders on 8787 —
  **more than one responder = two servers = split-brain in progress.**
  `InstoreApiDiscovery.scanSubnet` does exactly this probe.
- Alert on new MACs joining the POS VLAN/SSID (port security or NAC).
- Watch for `PIN verify rate limit hit` and repeated `401` log entries on the
  server — indicates a hostile or misconfigured client on the segment.
- Export the audit log (`AuditLogService` CSV) on a schedule; the in-app log
  is capped at ~2000 entries and is not tamper-evident (ADR-012).

## 8. Discovery and the unauthenticated health endpoint

Client registers find the server by probing every address in the subnet on
port 8787 (`InstoreApiDiscovery`). `GET /api/health` deliberately answers
without a signature and returns `registerId` + `registerName` — presence
information only, but it tells a LAN observer where the server is and what
it's called. On a dedicated, small VLAN this trade-off is acceptable; it is
the primary reason the "nothing else on the network" rule exists.

Mitigations if you want tighter:

- Configure `serverAddress` statically on clients so no scan is needed.
- Use AP client isolation so only the server address is reachable from
  wireless clients.

## 9. Checklist

- [ ] POS VLAN exists; registers, server, printers, PEDs, KDS are on it; nothing else is.
- [ ] Separate WPA3/WPA2 SSID mapped to the POS VLAN; no corporate/guest bridging.
- [ ] Inter-VLAN ACLs deny all except the §2 matrix; egress restricted to 443/123/53.
- [ ] Exactly one in-store server instance; static DHCP reservation; wired.
- [ ] Port 8787 unreachable from internet except pinned webhook path via proxy — or webhooks terminated on the hub.
- [ ] Printers reachable only on 9100–9109 from POS devices.
- [ ] Admin access only via WireGuard/Tailscale; no flat SSH/RDP/VNC.
- [ ] NTP and DNS allowed and working on every register and the server.
- [ ] Periodic `/api/health` scan confirms one server; MAC alerting enabled.
- [ ] Audit log exports scheduled.
