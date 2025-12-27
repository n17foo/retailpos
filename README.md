# RetailPOS - Retail Point of Sale System

A comprehensive, cross-platform Point of Sale (POS) system built with React Native and Expo, designed for modern retail businesses. RetailPOS seamlessly integrates with major e-commerce platforms, supports multiple payment processors, and provides a unified interface across mobile, web, and desktop environments.

## 🚀 Features

### Core POS Functionality

- **Product Management**: Browse, search, and manage products with real-time inventory tracking
- **Category Navigation**: Hierarchical category system with intuitive navigation
- **Shopping Cart**: Smart cart management with quantity controls and item customization
- **Order Processing**: Streamlined checkout process with receipt generation
- **Inventory Management**: Real-time stock tracking and low-stock alerts
- **Search & Discovery**: Fast product search with advanced filtering options
- **Payment Processing**: Multiple payment methods with terminal integration
- **Refund Management**: Process returns and issue refunds
- **Barcode Scanning**: Camera and Bluetooth scanner support
- **Receipt Printing**: Thermal printer integration with customizable templates
- **User Management**: Multi-user support with role-based access
- **Settings Management**: Comprehensive configuration for all integrations

### E-commerce Integrations

RetailPOS integrates with leading e-commerce platforms, allowing you to manage products, inventory, and orders from a single interface:

- **Shopify** - Complete product catalog, inventory, and order synchronization
- **WooCommerce** - WordPress e-commerce integration with full API support
- **BigCommerce** - Enterprise-level e-commerce platform integration
- **Magento** - Adobe Commerce (formerly Magento) integration
- **Sylius** - Open-source e-commerce platform support
- **Wix** - Wix Stores integration
- **PrestaShop** - European e-commerce platform support
- **Squarespace** - Squarespace Commerce integration

### Payment Processing

Multiple payment processor integrations for secure, reliable transactions:

- **Worldpay** - Global payment processing with terminal support
- **Stripe** - Online payments with NFC/terminal support
- **Square** - In-app payments and terminal integration

### Hardware Integration

- **Barcode Scanners**: Bluetooth and camera-based scanning
- **Receipt Printers**: Thermal printer support with customizable receipts
- **Payment Terminals**: Integrated card reader support

### Multi-platform Support

- **iOS Mobile**: Native iOS app with tablet support
- **Android Mobile**: Native Android app with edge-to-edge display
- **Web Browser**: Responsive web application
- **Desktop (Electron)**: Cross-platform desktop application

## 🏗️ Architecture

### Technology Stack

- **Framework**: React Native with Expo
- **Language**: TypeScript for type safety
- **State Management**: React Context with custom hooks
- **Database**: SQLite for local data storage
- **Networking**: RESTful API integrations
- **Styling**: Theme-based component library

### Design Patterns

- **Factory Pattern**: Service factories for platform-specific implementations
- **Repository Pattern**: Data access layer abstraction
- **Observer Pattern**: Event-driven architecture
- **Strategy Pattern**: Payment processor abstraction

### Key Components

- **Unified Models**: Platform-agnostic data structures
- **Service Layer**: Platform-specific business logic
- **UI Components**: Reusable, themeable components
- **Hooks**: Custom React hooks for data fetching and state management

## 📱 Platform Support

### Mobile Applications

- **iOS 13+**: Native iOS app with iPad support
- **Android 8+**: Native Android app with modern UI

### Web Browser

- **Chrome 90+**: Full-featured web application
- **Safari 14+**: Optimized for iOS and macOS
- **Firefox 88+**: Cross-platform web support

### Desktop Applications

- **macOS**: Native .dmg installer
- **Windows**: Native .exe installer
- **Linux**: .AppImage distribution

## 🛠️ Installation & Setup

### Prerequisites

- **Node.js**: Version 20.19.4 or higher
- **Yarn**: Package manager
- **Expo CLI**: `npm install -g @expo/cli`

### Quick Start

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd RetailPOS
   ```

2. **Install dependencies**

   ```bash
   yarn install
   ```

3. **Configure environment**

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**
   ```bash
   yarn start
   ```

### Platform-Specific Setup

#### iOS Development

```bash
# Install iOS dependencies (macOS only)
yarn ios

# Or run directly with Expo
yarn start
# Then press 'i' in the terminal
```

#### Android Development

```bash
# Install Android dependencies
yarn android

# Or run directly with Expo
yarn start
# Then press 'a' in the terminal
```

#### Web Development

```bash
yarn web
```

#### Desktop Development

```bash
# Development with hot reload
yarn desktop

# Build for current platform
yarn desktop:build

# Build for specific platforms
yarn desktop:build-mac    # macOS
yarn desktop:build-win    # Windows
yarn desktop:build-linux  # Linux
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Application Environment
APP_ENV=development

# Mock Services (set to 'false' for production)
USE_MOCK_SCANNER=true
USE_MOCK_PAYMENT=true
USE_MOCK_ECOMMERCE=true
USE_MOCK_SECRETS=true
USE_MOCK_PRINTERS=true
USE_MOCK_PRODUCT=true
USE_MOCK_ORDER=true
USE_MOCK_INVENTORY=true
USE_MOCK_SYNC=true
USE_MOCK_SEARCH=true
```

### E-commerce Platform Configuration

#### Shopify

```bash
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
SHOPIFY_ACCESS_TOKEN=your_access_token
SHOPIFY_STORE_URL=https://your-store.myshopify.com
```

#### WooCommerce

```bash
WOOCOMMERCE_URL=https://your-wordpress-site.com
WOOCOMMERCE_CONSUMER_KEY=your_consumer_key
WOOCOMMERCE_CONSUMER_SECRET=your_consumer_secret
```

#### BigCommerce

```bash
BIGCOMMERCE_STORE_HASH=your_store_hash
BIGCOMMERCE_CLIENT_ID=your_client_id
BIGCOMMERCE_ACCESS_TOKEN=your_access_token
```

### Payment Processor Configuration

#### Worldpay

```bash
WORLDPAY_MERCHANT_ID=your_merchant_id
WORLDPAY_SITE_REFERENCE=your_site_reference
WORLDPAY_INSTALLATION_ID=your_installation_id
```

#### Stripe

```bash
STRIPE_PUBLISHABLE_KEY=your_publishable_key
STRIPE_SECRET_KEY=your_secret_key
```

#### Square

```bash
SQUARE_APP_ID=your_app_id
SQUARE_ACCESS_TOKEN=your_access_token
```

## 🧪 Development

### Available Scripts

```bash
# Development
yarn start              # Start Expo development server
yarn test               # Run Jest tests
yarn lint               # Run ESLint
yarn lint:fix           # Fix ESLint issues
yarn format             # Format code with Prettier

# Platform-specific
yarn ios                # iOS development
yarn android            # Android development
yarn web                # Web development
yarn desktop            # Desktop development

# Building
yarn desktop:build      # Build desktop app
yarn desktop:build-mac  # Build macOS app
yarn desktop:build-win  # Build Windows app
yarn desktop:build-linux # Build Linux app

# Maintenance
yarn latest             # Update dependencies
yarn doctor             # Run Expo diagnostics
```

### Mock vs Real Services

The application supports both mock and real service implementations. Use environment variables to toggle between them:

- **Development**: Use mocks for faster development and testing
- **Staging**: Mix of real and mock services for integration testing
- **Production**: Use real services for live operations

### Testing

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test --watch

# Run tests with coverage
yarn test --coverage
```

### Code Quality

```bash
# Lint code
yarn lint

# Auto-fix linting issues
yarn lint:fix

# Format code
yarn format
```

## 📁 Project Structure

```
RetailPOS/
├── assets/                 # Static assets (images, icons)
├── components/             # Reusable UI components
├── contexts/               # React Context providers
├── hooks/                  # Custom React hooks
├── locales/                # Internationalization files
├── models/                 # Data models and mappers
├── navigation/             # Navigation configuration
├── repositories/           # Data access layer
├── screens/                # Screen components
├── services/               # Business logic and API integrations
│   ├── basket/            # Shopping cart services
│   ├── category/          # Category management
│   ├── payment/           # Payment processing
│   ├── product/           # Product management
│   ├── printer/           # Receipt printing
│   ├── scanner/           # Barcode scanning
│   └── ...                # Other service modules
├── types/                 # TypeScript type definitions
└── utils/                 # Utility functions
```

## 🔒 Security

- **Secure Storage**: Sensitive data stored using react-native-keychain
- **Environment Variables**: Configuration separated by environment
- **API Security**: Secure API key management and token handling
- **Payment Security**: PCI-compliant payment processing

## 🌐 Internationalization

Support for multiple languages with react-i18next:

- English (default)
- Spanish
- French
- German

## 📊 Monitoring & Logging

Comprehensive logging system with Winston:

- Console logging for development
- File logging for production
- Structured logging with metadata
- Error tracking and reporting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add your feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Submit a pull request

### Development Guidelines

- Follow TypeScript best practices
- Write comprehensive tests
- Update documentation for new features
- Maintain consistent code style
- Use conventional commit messages

## 📄 License

Apache License 2.0 - see [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

- Create an issue on GitHub
- Check the documentation
- Review existing issues and solutions

---

**RetailPOS** - Modern retail POS for the digital age.
