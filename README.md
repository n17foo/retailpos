# RetailPOS - Point of Sale System for E-commerce Platforms

[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![CI](https://github.com/n17foo/retailpos/workflows/CI/badge.svg)](https://github.com/n17foo/retailpos/actions)

A modern, cross-platform Point of Sale (POS) system built with React Native and Expo. Supports multiple e-commerce platforms, offline operation, and hardware integration.

Website: [retailpos.org](https://retailpos.org)

## 🚀 Features

- **Multi-Platform Support**: Shopify, WooCommerce, BigCommerce, Magento, Wix, PrestaShop, Squarespace, Sylius
- **Offline Mode**: Full functionality without internet connection
- **Hardware Integration**: Receipt printers, barcode scanners, payment terminals
- **Cross-Platform**: iOS, Android, Web, Desktop (Electron)
- **Multi-Language**: English, Spanish, French, German
- **Real-time Sync**: Inventory and orders sync across channels
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
│   ├── config/       # Configuration and service bridging
│   ├── inventory/    # Inventory management
│   ├── order/        # Order processing
│   ├── product/      # Product management
│   ├── search/       # Product search
│   └── sync/         # Data synchronization
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

- **[ARCHITECTURE.md](ARCHITECTURE.md)**: Technical architecture and design decisions
- **[CONTRIBUTING.md](CONTRIBUTING.md)**: Contribution guidelines and development setup
- **[CHANGELOG.md](CHANGELOG.md)**: Version history and release notes
- **[SECURITY.md](SECURITY.md)**: Security policy and vulnerability reporting

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
