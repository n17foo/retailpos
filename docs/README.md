# RetailPOS Feature Documentation

Feature documentation for the RetailPOS application. Each document uses a **flow-based** format: User Story → Rules → step-by-step Flows → open Questions.

## Structure

```
docs/
├── features/
│   ├── onboarding.md      # First-time setup wizard (online & offline paths)
│   ├── login.md            # Authentication (PIN, biometric, password, card, RFID, platform)
│   ├── orders.md           # Browse products, build cart, checkout, sync to platform
│   ├── products.md         # Unified product catalog, variants, search, sync
│   ├── customer.md         # Platform customer search & order attachment
│   ├── payments.md         # Card terminals, Stripe NFC, refunds, voids
│   ├── hardware.md         # 4 scanner types (camera, BT, USB, QR hardware), printer, cash drawer
│   ├── refund.md           # Payment & e-commerce refunds, returns
│   ├── reporting.md        # Sales reports, cashier performance, CSV export
│   ├── settings.md         # 10-tab settings screen (auth, payment, hardware, etc.)
│   ├── setup.md            # Role-based More menu & lazy-loaded screens
│   ├── e-commerce.md       # Platform integration, tokens, data mapping, sync
│   ├── offline.md          # Standalone / server / client modes, multi-register sync
│   ├── sync.md             # Sync queue monitoring, retry, discard
│   └── system.md           # Audit log, notifications, logging, config persistence
└── README.md
```

## Document Format

Each feature doc follows this structure:

- **User Story** — As a [role], I want to [action], so that [benefit]
- **Rules** — Business rules, constraints, key technical facts
- **Flows** — Numbered step-by-step sequences describing how the feature works end-to-end
- **Questions** — Open items requiring clarification

## Features at a Glance

| Area       | Doc             | Key Flows                                                                   |
| ---------- | --------------- | --------------------------------------------------------------------------- |
| Setup      | `onboarding.md` | Online (10 steps) / Offline (11 steps) setup wizard                         |
| Auth       | `login.md`      | PIN, biometric, password, MagStripe, RFID/NFC, platform login               |
| Sales      | `orders.md`     | Browse → cart → checkout → sync to platform                                 |
| Catalog    | `products.md`   | Load, search, filter, variants, pagination, sync                            |
| Customers  | `customer.md`   | Search platform customers, attach to orders                                 |
| Payments   | `payments.md`   | Terminal connection, card payment, Stripe NFC, refund, void                 |
| Hardware   | `hardware.md`   | 4 scanner types (camera, Bluetooth, USB, QR hardware), printer, cash drawer |
| Returns    | `refund.md`     | Payment refund, e-commerce refund, return + refund orchestration            |
| Reports    | `reporting.md`  | Daily/weekly/monthly reports, charts, CSV export                            |
| Config     | `settings.md`   | 10-tab settings with responsive layout                                      |
| Setup      | `setup.md`      | Role-based More menu (cashier/manager/admin)                                |
| Platforms  | `e-commerce.md` | 8 platforms, token management, data mapping                                 |
| Offline    | `offline.md`    | Standalone/server/client modes, event sync, discovery                       |
| Sync Queue | `sync.md`       | Monitor, retry, discard failed order syncs                                  |
| System     | `system.md`     | Audit log, notifications, structured logging                                |

## Usage

These documents serve as:

- **Requirements clarification** for developers
- **Acceptance criteria** for testing
- **User story elaboration** for product owners
- **Onboarding material** for new team members

## Contributing

When adding new features:

1. Create a new lowercase `.md` file in `features/`
2. Follow the flow-based format: User Story → Rules → Flows → Questions
3. Write flows as numbered step-by-step sequences
4. Include error handling and edge cases within flows
5. Update this README with the new file
