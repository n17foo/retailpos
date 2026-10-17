# Credentials & Encoding

**Files:** `utils/crypto.ts`, `utils/userPin.utils.ts`, `utils/base64.ts`,
`utils/uuid.ts`
**Tests:** `utils/crypto.test.ts`, `utils/userPin.utils.test.ts`
**Parent:** [`rules.md`](rules.md)

---

## C-R1 — PINs/credentials are stored salted-hashed, verified constant-time

**Rule**
`hashPin(pin)` → `v1$<saltHex>$<sha256(salt+pin)>` (16-byte salt via
`crypto.getRandomValues`, polyfilled at import). `verifyPin` fails closed on
empty/malformed input, compares via `timingSafeEqual`. Legacy **plaintext**
rows still verify so callers can re-hash on success. The same format is reused
for passwords/magstripe/RFID via `hashCredential` aliases.

**Evidence** — `utils/crypto.ts:185-223`.

🟢 **E1.1** — `verifyPin('123456', hashPin('123456'))` → `true`; wrong PIN → `false`.

🔴 **E1.2 — Legacy plaintext** — `verifyPin('123456','123456')` → `true`
(intentional migration path — PG7).

🔴 **E1.3 — Malformed stored** — `'v1$garbage'` → `false` (fails hash regex);
empty → `false`.

🟠 **E1.4 — Constant-time is approximate** — acknowledged in-code; JS VMs
can't guarantee it (PG6).

## C-R2 — PIN format is exactly 6 digits

**Rule**
`validatePinFormat` → `/^\d{6}$/`; error string `'PIN must be exactly 6 digits'`
(hardcoded English — no locale key found; consistent with C2-style gap).

**Evidence** — `utils/userPin.utils.ts`; consumed by `UserRepository`
(create/update/verify paths) and `useUsers`.

🟠 **E2.1** — `UserRepository` rejects non-6-digit PINs at every entry
(create, change, verify) — `repositories/UserRepository.ts:63,91,138,174`.

## C-R3 — SHA-256/HMAC exist because Hermes lacks ambient crypto

**Rule**
Pure-TS SHA-256 and HMAC-SHA256 (FIPS 180-4) — explicitly _not_ a vetted
crypto stack; swap out if expo-crypto lands. UTF-8 encoded manually (no
TextEncoder guarantee).

**Evidence** — `utils/crypto.ts:1-17` header.

🟢 **E3.1** — `sha256Hex('abc')` → `ba7816bf…` (vector-tested in
`crypto.test.ts`).

🟠 **E3.2** — Hand-rolled crypto is a documented stop-gap; treat any new
security-critical use with review.

## C-R4 — UUID/randomness come from the RN polyfill

**Rule**
`generateUUID()` = `uuid` v4 over `react-native-get-random-values`; import
installs the global `crypto.getRandomValues` once (idempotent).

**Evidence** — `utils/uuid.ts`, `utils/crypto.ts` (`randomHex`).

## C-R5 — `decodeBase64` prefers `atob`, falls back to manual decode

**Rule**
Base64 decode only (no encoder); non-alphabet chars are stripped before the
manual path.

**Evidence** — `utils/base64.ts`.

🟠 **E5.1** — Asymmetric: there is no `encodeBase64` — encoders live
elsewhere; don't add a second decoder.

## ❓ Questions

- **C-Q1** — When does the plaintext-PIN rehash actually run, and is there a
  deadline after which plaintext rows should be rejected?
- **C-Q2** — Should `validatePinFormat`'s error string be localized (no key
  exists today)?

## Coverage

| Example             | Coverage                |
| ------------------- | ----------------------- |
| C-R1 hashing/verify | `crypto.test.ts`        |
| C-R2 PIN format     | `userPin.utils.test.ts` |
| C-R5 base64         | Not found               |
