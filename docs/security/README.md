# Security

> Deployment and operational security for RetailPOS. Feature-level behaviour
> rules live in `docs/features/*/rules.md`. This directory covers **how the
> system is secured and how to run it safely**.

## Documents

| Document                                                   | Covers                                                                                                                                        |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| [network-segmentation.md](network-segmentation.md)         | Dedicated POS network / VLAN design, firewall rule matrix, peripheral segmentation, remote access. **Start here.**                            |
| [instore-server-hardening.md](instore-server-hardening.md) | Checklist for operating the in-store server (register-as-server or dedicated store-api host): secrets, clock, upgrades, monitoring, failover. |
| [security-controls.md](security-controls.md)               | Implemented code-level controls (signed LAN requests, authz, auto-lock, CSV/SQL injection, redaction, Electron fuses) + residual risks.       |

## Threat model (short version)

Assets: order/customer data, platform credentials, payment operations, cash
drawer control, the register PINs.

| Threat                          | Primary defence                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| LAN eavesdropper / tampering    | HMAC-signed requests + **dedicated POS VLAN** (signing does not encrypt — isolation does)          |
| Stolen/lost register            | OS disk encryption, inactivity auto-lock, secrets in Keychain/safeStorage                          |
| Rogue device on the LAN         | Network isolation + 802.1X/port security; `/api/health` is unauthenticated by design               |
| PIN brute-force (local or LAN)  | `AuthAttemptLimiter` + server-side `/api/users/verify-pin` rate guard                              |
| Secret disclosure               | Secret never sent on the wire (signed requests); stored via `ProtectedValueStore`; manual rotation |
| Privilege escalation in-app     | `PermissionService` (deny-wins, admin ceiling), `PermissionGate`, admin-only settings tabs         |
| Financial tampering via LAN/API | `validateReturnRequest`, allowlisted order statuses, bounded payment fields, column allowlists     |
| Supply chain                    | Lockfile, `yarn audit`, Electron fuses                                                             |

## Trust boundaries

```
Internet (untrusted)
  │  outbound TCP 443 only — platform APIs, payment providers
  ▼
POS VLAN (trusted, dedicated — see network-segmentation.md)
  ├─ registers (client mode) ── signed HTTP+WS ──▶ in-store server :8787
  ├─ registers ──▶ receipt printers :9100-9109
  ├─ registers ──▶ payment terminals (provider-dependent)
  └─ inbound: Commercefull webhook POST /api/webhooks/commercefull (HMAC-verified)
Other VLANs (guest Wi-Fi, corporate, CCTV/IoT) — NO access to POS VLAN
```

## Non-negotiable deployment rules

1. **The POS LAN must be a dedicated network segment.** Signing protects
   integrity, not confidentiality — order data, PINs-in-transit and receipts
   cross the LAN in plaintext. See `network-segmentation.md`.
2. **Exactly one `mode=server` device per segment.** There is no election —
   two servers silently split the data (PG1 in `docs/features/multi-register/rules.md`).
3. **The shared secret is copied out-of-band**, never emailed/committed, and
   rotated when a register is decommissioned or staff change.
4. **Clocks must be within ±5 minutes** (signature window). All POS devices
   need working NTP.
5. **All registers run a signing-capable build** — mixed versions cannot
   authenticate (signed-requests-only rollout).
6. **Never expose port 8787 to the internet** except the pinned webhook path
   behind a reverse proxy — prefer terminating webhooks on the
   integration-hub instead of a register.
