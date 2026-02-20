# RetailPOS - Point of Sale System for E-commerce Platforms

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/n17foo/retailpos/workflows/CI/badge.svg)](https://github.com/n17foo/retailpos/actions)

A modern, cross-platform Point of Sale (POS) system built with React Native and Expo. Supports multiple e-commerce platforms, offline operation, and hardware integration.

Website: [retailpos.org](https://retailpos.org)

## 🚀 Features

✅ **All Planned Features Complete** — Clean TypeScript compile, 55/55 tests pass

- **Multi-Platform Support**: Shopify, WooCommerce, BigCommerce, Magento, Sylius, Wix, PrestaShop, Squarespace, Offline
- **Customer Management**: Search, attach customers from platform APIs during checkout
- **Discounts & Coupons**: Validate platform coupons, apply percentage/fixed discounts
- **Gift Cards**: Check balances, redeem via platform APIs
- **Offline Operation**: Full POS functionality without internet, with background sync
- **Multi-Register Sync**: Shared offline API with event-driven sync across devices
- **Product Variants**: Option-based variants with inventory tracking
- **Tax Profiles**: Configurable tax rates and rules
- **Returns Processing**: Stock adjustments with optional platform refunds
- **Reporting Dashboard**: Sales analytics, cashier performance, CSV export
- **Sync Queue Management**: Retry/cancel failed orders with detailed error tracking
- **Notifications System**: Real-time alerts for sync events, inventory, returns
- **Audit Logging**: Complete audit trail for all user actions and system events
- **Error Boundary**: Crash recovery with retry UI and basket persistence
- **Accessibility**: Full screen reader support with a11y labels and hints
- **Hardware Integration**: Receipt printers, barcode scanners, payment terminals, cash drawers
- **Cross-Platform**: iOS, Android, Web, Desktop (Electron)
- **Multi-Language**: English, Spanish, French, German
- **Role-Based Access**: Admin, Manager, Cashier permissions

## 🏗️ Architecture

RetailPOS follows a clean architecture pattern with separation of concerns:

- **Presentation Layer**: React Native components with Expo
- **Business Logic**: Service layer with platform abstractions
- **Data Layer**: SQLite repositories with TypeORM-like patterns
- **Infrastructure**: Hardware integrations and external APIs

See [ARCHITECTURE.md](ARCHITECTURE.md) for detailed technical documentation.

## 🛠️ Tech Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript
- **State Management**: Zustand + React Context
- **Database**: SQLite (expo-sqlite)
- **Styling**: Custom theme system
- **Internationalization**: react-i18next
- **Testing**: Jest
- **Linting**: ESLint + Prettier

## 📋 Prerequisites

- Node.js 22.x or later
- Yarn package manager
- Expo CLI (`npm install -g @expo/cli`)

## 🚀 Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/n17foo/retailpos.git
   cd retailpos
   ```

2. **Install dependencies**

   ```bash
   yarn install
   ```

3. **Setup environment**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**

   ```bash
   yarn ios        # iOS simulator
   yarn android    # Android emulator
   yarn web        # Web browser
   yarn desktop    # Electron desktop app
   ```

5. **Run the onboarding**
   - Open the app and follow the setup wizard
   - Choose your e-commerce platform or offline mode
   - Create admin account and configure hardware

## 🧪 Testing

```bash
# Run tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:coverage
```

## 📁 Project Structure

```
retailpos/
├── components/        # Reusable UI components
├── contexts/          # React contexts for global state
├── hooks/            # Custom React hooks
├── repositories/     # Data access layer (SQLite)
├── screens/          # Screen components
├── services/         # Business logic and external APIs
│   ├── audit/        # Audit logging service
│   ├── auth/         # Authentication providers
│   ├── basket/       # Shopping basket management
│   ├── checkout/     # Order checkout flow
│   ├── config/       # Configuration and service bridging
│   ├── customer/     # Platform customer services (8 platforms)
│   ├── discount/     # Platform discount/coupon services (8 platforms)
│   ├── giftcard/     # Platform gift card services (8 platforms)
│   ├── inventory/    # Inventory management
│   ├── localapi/     # Multi-register offline API
│   ├── logger/       # Logging infrastructure
│   ├── notifications/# Real-time notification system
│   ├── order/        # Order processing and sync
│   ├── product/      # Product management and variants
│   ├── refund/       # Platform refund services
│   ├── reporting/    # Analytics and reporting
│   ├── returns/      # Return processing with refunds
│   ├── search/       # Product search functionality
│   ├── sync/         # Data synchronization
│   ├── tax/          # Tax profile management
│   └── token/        # Platform API token management
├── utils/            # Utility functions and helpers
├── locales/          # Internationalization files
└── types/            # TypeScript type definitions
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Development mode
APP_ENV=development

# Mock services for development
USE_MOCK_SCANNER=true
USE_MOCK_PAYMENT=true
USE_MOCK_PRINTERS=true

# Platform-specific settings
SHOPIFY_STORE_URL=your-shop.myshopify.com
SHOPIFY_API_VERSION=2024-01
WOOCOMMERCE_URL=https://yourstore.com
# ... other platform configs
```

### Platform Configuration

RetailPOS supports multiple e-commerce platforms. Each platform has its own service implementation with consistent interfaces.

For platform-specific setup instructions, see [ARCHITECTURE.md](ARCHITECTURE.md).

## 🚀 Builds

Electron desktop installers are built automatically for Windows, macOS, and Linux on every push to the main branch. Download the latest builds from the [GitHub Actions](https://github.com/n17foo/retailpos/actions) page.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes following our coding standards
4. Add tests for new functionality
5. Ensure all tests pass: `yarn test`
6. Submit a pull request

### Code Standards

- **TypeScript**: Strict type checking enabled
- **Linting**: ESLint with React Native rules
- **Formatting**: Prettier with custom configuration
- **Commits**: Conventional commit format
- **Testing**: Jest with React Native testing library

## 📚 Documentation

- **[FEATURES.md](FEATURES.md)**: Complete feature roadmap with implementation details — all phases now complete ✅
- **[ARCHITECTURE.md](ARCHITECTURE.md)**: Technical architecture and design decisions
- **[CONTRIBUTING.md](CONTRIBUTING.md)**: Contribution guidelines and development setup
- **[CHANGELOG.md](CHANGELOG.md)**: Version history and release notes
- **[SECURITY.md](SECURITY.md)**: Security policy and vulnerability reporting

## 📈 Recent Updates

**All Planned Features Complete** (Latest Integration Session):

- ✅ Platform service extensions: Added BigCommerce, Magento, Sylius, Wix, PrestaShop, Squarespace support (24 new service implementations)
- ✅ UI integrations: Customer search modal, notification system, error boundary
- ✅ Service wiring: Audit logging, notifications, refund + returns merge
- ✅ Accessibility audit: Full screen reader support across all components
- ✅ Clean compile + 55/55 tests passing

## 🔒 Security

See [SECURITY.md](SECURITY.md) for our security policy and how to report vulnerabilities.

## 📄 License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- Built with [Expo](https://expo.dev/) and [React Native](https://reactnative.dev/)
- Icons from [Lucide React](https://lucide.dev/)
- UI components inspired by modern design systems

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/n17foo/retailpos/issues)
- **Discussions**: [GitHub Discussions](https://github.com/n17foo/retailpos/discussions)
- **Documentation**: [ARCHITECTURE.md](ARCHITECTURE.md)

---

**RetailPOS** - Bridging the gap between physical and digital retail experiences.
