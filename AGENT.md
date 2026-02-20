# AGENT.md - RetailPOS Development Guidelines

This document provides coding standards, architectural patterns, and conventions for AI agents and developers working on the RetailPOS codebase.

## 📁 Project Structure

````
RetailPOS/
├── assets/                 # Static assets (images, icons, fonts)
├── components/             # Reusable UI components
├── contexts/               # React Context providers
├── docs/                   # Feature documentation (flow-based format)
│   ├── features/           # One .md per feature area
│   └── README.md           # Index of all feature docs
├── electron/               # Electron desktop app configuration
├── hooks/                  # Custom React hooks
├── locales/                # Internationalization (i18n) files
├── models/                 # Data models and mappers
├── navigation/             # React Navigation configuration
├── repositories/           # Data access layer (SQLite)
├── screens/                # Screen components
│   ├── settings/           # Settings tab screens
│   ├── order/              # Order-related screens
│   └── onboarding/         # Onboarding flow screens
├── services/               # Business logic and API integrations
│   ├── audit/              # AuditLogService — KV-backed event log + CSV export
│   ├── auth/               # Authentication service + pluggable providers
│   ├── basket/             # Shopping cart (BasketService — CRUD only)
│   ├── checkout/           # CheckoutService (payment, order queries)
│   ├── config/             # POSConfigService + ServiceConfigBridge
│   ├── customer/           # Platform customer lookup (8 platforms + factory)
│   ├── category/           # Category management
│   ├── discount/           # Platform discount/coupon validation (8 platforms + factory)
│   ├── drawer/             # Cash drawer peripheral (decoupled from printer)
│   ├── giftcard/           # Platform gift card services (8 platforms + factory)
│   ├── inventory/          # Inventory tracking
│   ├── localapi/           # Multi-register local API (server/client/discovery/sync)
│   ├── logger/             # LoggerFactory + pluggable LogTransport providers
│   ├── notifications/      # NotificationService (singleton, listener pattern)
│   ├── order/              # Order processing
│   ├── payment/            # Payment processing (disconnect is async-compatible)
│   ├── printer/            # Receipt printing + openDrawer() ESC/POS
│   ├── product/            # Product management
│   ├── refund/             # Refund service (8 platforms + factory)
│   ├── returns/            # ReturnService (process returns, optional refund orchestration)
│   ├── scanner/            # Barcode + QR scanning (4 types: camera, BT, USB, QR hardware)
│   ├── search/             # Search functionality
│   ├── storage/            # SQLite storage
│   ├── sync/               # OrderSyncService + BackgroundSyncService (exponential backoff)
│   ├── tax/                # TaxProfileService (CRUD, default rate, seed defaults)
│   └── [domain]/           # Other domain services
│       └── platforms/      # Platform-specific implementations
└── utils/                  # Utility functions and helpers
---

## 🛠️ Development Environment

### Package Manager
This project uses **Yarn 1** for package management. If packages fail to install, ensure you're using Node.js v22:

```bash
nvm use 22
yarn install
````

### Node Version

- **Required**: Node.js v22
- **Recommended**: Use `nvm` to manage Node versions
- **Why v22**: Required for Expo SDK 53 compatibility

### Lint & Format (Pre-Commit)

A **husky** pre-commit hook runs **lint-staged** automatically on every `git commit`:

- `*.{ts,tsx,js,jsx}` → `eslint --fix` + `prettier --write`
- `*.{json,md}` → `prettier --write`

This catches lint and formatting errors before they reach CI. To run manually:

```bash
yarn lint        # tsc --noEmit + eslint (check only)
yarn lint:fix    # tsc --noEmit + eslint --fix
yarn format      # prettier --write on all files
```

Configuration lives in:

- `eslint.config.js` — flat config with TypeScript, React, React Native, Prettier plugins
- `.prettierrc` or Prettier defaults — code formatting rules
- `package.json` → `"lint-staged"` — per-extension commands
- `.husky/pre-commit` → `npx lint-staged`

---

## 🏗️ Architecture Patterns

### Service Layer Pattern

Services are organized by domain with a consistent structure:

```
services/[domain]/
├── [Domain]ServiceInterface.ts    # Interface definition
├── [domain]ServiceFactory.ts      # Factory for creating instances
└── platforms/                     # Platform-specific implementations
    ├── Base[Domain]Service.ts     # Shared base class
    ├── Platform[Domain]ServiceInterface.ts  # Platform interface
    ├── Shopify[Domain]Service.ts
    ├── WooCommerce[Domain]Service.ts
    ├── Offline[Domain]Service.ts
    └── ...
```

**Example - Product Service:**

```typescript
// services/product/ProductServiceInterface.ts
export interface ProductServiceInterface {
  getProducts(options: ProductQueryOptions): Promise<ProductResult>;
  syncProducts(products: Product[]): Promise<SyncResult>;
}

// services/product/productServiceFactory.ts
export class ProductServiceFactory {
  private static instance: ProductServiceFactory;

  public static getInstance(): ProductServiceFactory {
    if (!ProductServiceFactory.instance) {
      ProductServiceFactory.instance = new ProductServiceFactory();
    }
    return ProductServiceFactory.instance;
  }

  public getService(platform?: ECommercePlatform): ProductServiceInterface {
    switch (platform) {
      case ECommercePlatform.SHOPIFY:
        return this.getShopifyService();
      case ECommercePlatform.WOOCOMMERCE:
        return this.getWooCommerceService();
      default:
        return this.getOfflineService();
    }
  }
}
```

### Repository Pattern

Repositories handle direct database access using SQLite:

```typescript
// repositories/UserRepository.ts
export class UserRepository {
  private db: SQLiteDatabase;

  constructor() {
    this.db = sqliteStorage.getDatabase();
  }

  async create(user: CreateUserInput): Promise<string> {
    const id = crypto.randomUUID();
    await this.db.runAsync(
      `INSERT INTO users (...) VALUES (?, ?, ...)`,
      [id, user.name, ...]
    );
    return id;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.getFirstAsync<UserRow>(
      'SELECT * FROM users WHERE id = ?',
      [id]
    );
    return result ? rowToUser(result) : null;
  }
}
```

### Context Provider Pattern

React Contexts provide global state and service access:

```typescript
// contexts/BasketProvider.tsx
export interface BasketContextType {
  basket: Basket | null;
  isLoading: boolean;
  error: string | null;
  addItem: (product: CartProduct) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  checkout: (options: CheckoutOptions) => Promise<CheckoutResult>;
}

const BasketContext = createContext<BasketContextType | undefined>(undefined);

export const BasketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // State and service initialization
  const [basket, setBasket] = useState<Basket | null>(null);

  // Memoized context value
  const value = useMemo(() => ({
    basket,
    isLoading,
    error,
    addItem,
    removeItem,
    checkout,
  }), [basket, isLoading, error]);

  return (
    <BasketContext.Provider value={value}>
      {children}
    </BasketContext.Provider>
  );
};

export const useBasketContext = () => {
  const context = useContext(BasketContext);
  if (!context) {
    throw new Error('useBasketContext must be used within BasketProvider');
  }
  return context;
};
```

### Custom Hooks Pattern

Hooks encapsulate data fetching and state management:

```typescript
// hooks/useProducts.ts
interface UseProductsReturn {
  products: UnifiedProduct[];
  isLoading: boolean;
  error: string | null;
  fetchProducts: (options?: QueryOptions) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useProducts = (platform?: ECommercePlatform): UseProductsReturn => {
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(
    async (options?: QueryOptions) => {
      setIsLoading(true);
      setError(null);
      try {
        const service = ProductServiceFactory.getInstance().getService(platform);
        const result = await service.getProducts(options);
        setProducts(mapToUnifiedProducts(result.products));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch products');
      } finally {
        setIsLoading(false);
      }
    },
    [platform]
  );

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, isLoading, error, fetchProducts, refresh: fetchProducts };
};
```

---

## 🏗️ Key Architectural Decisions

### Service Split: Basket → Checkout → Sync

The monolithic `BasketService` was split into three focused services:

- **BasketService** — cart CRUD only (add/remove/update items, totals)
- **CheckoutService** — start checkout, complete payment, order queries
- **OrderSyncService** — sync paid orders to e-commerce platforms

All use **constructor injection** with `LoggerInterface`. Wired by `basketServiceFactory.ts` into a `ServiceContainer`.

### POS Configuration (`services/config/POSConfigService.ts`)

`POSConfigService` — singleton backed by `SettingsRepository` (which delegates to `KeyValueRepository`):

- **No built-in defaults** — every value must be explicitly set during onboarding
- `posConfig.load()` at app startup, `posConfig.update(field, value)` persists immediately
- `posConfig.isConfigured` — false until all required fields are set
- `DEFAULT_TAX_RATE()` and `MAX_SYNC_RETRIES()` are **functions** (not constants)
- Config fields: `taxRate`, `maxSyncRetries`, `storeName`, `storeAddress`, `storePhone`, `currencySymbol`, `drawerOpenOnCash`

### Logger with Pluggable Transports

- `LogTransport` interface: `{ name, minLevel?, log(entry) }`
- Add Sentry/Datadog/NewRelic via `LoggerFactory.getInstance().addTransport(...)`
- Child loggers share parent's transports
- **ErrorReportingService was removed** — all services use `LoggerInterface` directly

### Cash Drawer (Decoupled from Printer)

- `CashDrawerServiceInterface` — standalone peripheral with `driverType`, `open()`, `isOpen()`
- `PrinterDrawerDriver` (ESC/POS via printer) and `NoOpDrawerDriver` (no hardware)
- `CheckoutResult.openDrawer?: boolean` — service decides _if_, UI _does_ the opening

### Authentication (`services/auth/`)

Pluggable multi-method authentication system with **platform-aware mode filtering**.

Auth methods are split into two modes based on the selected e-commerce platform:

- **Offline mode** (`ECommercePlatform.OFFLINE`) — all auth validates against local SQLite (`UserRepository` / `KeyValueRepository`)
- **Online mode** (Shopify, WooCommerce, etc.) — `platform_auth` validates via the platform’s API token; offline methods can be enabled as fallback

**Supported methods:**

| Method                | Type            | Provider                | Mode    | Hardware           |
| --------------------- | --------------- | ----------------------- | ------- | ------------------ |
| 6-Digit PIN           | `pin`           | `PinAuthProvider`       | offline | None               |
| Fingerprint / Face ID | `biometric`     | `BiometricAuthProvider` | offline | Device biometric   |
| Password              | `password`      | `PasswordAuthProvider`  | offline | None               |
| Magnetic Card Swipe   | `magstripe`     | `MagstripeAuthProvider` | offline | USB/BT card reader |
| RFID / NFC Badge      | `rfid_nfc`      | `RfidNfcAuthProvider`   | offline | USB/BT NFC reader  |
| Platform Login        | `platform_auth` | `PlatformAuthProvider`  | online  | None (internet)    |

**Key classes:**

- `AuthMethodInterface.ts` — `AuthMethodType`, `AuthMode`, `AuthMethodProvider` interface, `AUTH_METHOD_INFO` registry, `getAuthMethodsForMode(mode)`
- `AuthConfigService.ts` — persists primary method + allowed methods + `authMode` to `KeyValueRepository`
- `AuthService.ts` — central service, holds all providers, delegates `authenticate(method, credential)`
- `providers/` — one file per method, each implements `AuthMethodProvider`
- `PlatformAuthProvider` — uses `TokenService` to validate the e-commerce platform’s access token

**Rules:**

- PIN is always enabled in offline mode and cannot be disabled
- `platform_auth` is always enabled in online mode and cannot be disabled
- `authConfig.load()` called at app startup in `App.tsx`
- `authConfig.authMode` determines which methods are shown in UI
- `AuthMethodSetupStep` receives `selectedPlatform` prop to determine mode during onboarding
- `AuthMethodSettingsTab` reads `authConfig.authMode` to filter methods post-onboarding
- `LoginScreen` dynamically renders UI per active method and shows a method switcher when multiple are enabled
- Biometric uses dynamic `require('expo-local-authentication')` — safe if package is not installed
- Magstripe/RFID readers are USB HID devices that send keystrokes — captured via a hidden `TextInput`
- All offline providers store credentials in SQLite via `UserRepository` or `KeyValueRepository`

### Scanner Architecture (`services/scanner/`)

Four scanner types, each implementing `ScannerServiceInterface`:

| Type        | Enum                      | Service                    | Use Case                    |
| ----------- | ------------------------- | -------------------------- | --------------------------- |
| Camera      | `ScannerType.CAMERA`      | `CameraScannerService`     | Mobile/tablet (Expo Camera) |
| Bluetooth   | `ScannerType.BLUETOOTH`   | `BluetoothScannerService`  | BLE barcode scanners        |
| USB         | `ScannerType.USB`         | `USBScannerService`        | USB HID barcode scanners    |
| QR Hardware | `ScannerType.QR_HARDWARE` | `QRHardwareScannerService` | Desktop QR readers (USB/BT) |

**Key files:**

- `ScannerServiceInterface.ts` — common interface (`connect`, `disconnect`, `startScanListener`, `discoverDevices`)
- `scannerServiceFactory.ts` — singleton factory, maps `ScannerType` → service instance (real or mock via `USE_MOCK_SCANNER`)
- `mock/` — mock implementations for each type (simulated scan data)
- `QRHardwareScannerService.ts` — dedicated QR code reader for desktop; USB scanners act as HID keyboard input (data terminated by Enter key)

**Hooks:**

- `useScanner` — manages settings, connection, discovery, test; maps string type to `ScannerType` enum via `toFactoryType()`
- `useBarcodeScanner` — processes scanned data, product lookup, alerts
- `useScannerSettings` — persists `{ enabled, type, deviceId }` to `KeyValueRepository`

**UI:** Settings and onboarding both use a segmented type picker (Camera, Bluetooth, USB, QR Hardware) with contextual hints.

### Background Sync

- `OrderSyncService` — per-order retry count, `MAX_SYNC_RETRIES()` enforcement
- `BackgroundSyncService` — exponential backoff (`base × 2^failures`, capped 15 min), pauses when backgrounded

---

## 📝 Coding Conventions

### TypeScript Standards

1. **Always use TypeScript** - No `.js` files in the codebase
2. **Explicit types** - Define interfaces for all data structures
3. **No `any` type** - Use `unknown` or proper typing
4. **Export types** - Export interfaces and types for reuse

```typescript
// ✅ Good
export interface User {
  id: string;
  name: string;
  role: UserRole;
}

export type UserRole = 'admin' | 'manager' | 'cashier';

// ❌ Bad
const user: any = { ... };
```

### Naming Conventions

| Type               | Convention                  | Example                      |
| ------------------ | --------------------------- | ---------------------------- |
| Files (components) | PascalCase                  | `ProductCard.tsx`            |
| Files (hooks)      | camelCase with `use` prefix | `useProducts.ts`             |
| Files (services)   | PascalCase                  | `ProductService.ts`          |
| Files (interfaces) | PascalCase                  | `ProductServiceInterface.ts` |
| Files (factories)  | PascalCase                  | `ProductServiceFactory.ts`   |
| Files (mocks)      | PascalCase                  | `StripeMockService.ts`       |
| Files (data/types) | camelCase                   | `basket.ts`, `types.ts`      |
| Files (contexts)   | PascalCase                  | `BasketProvider.tsx`         |
| Files (repos)      | PascalCase                  | `OrderRepository.ts`         |
| Interfaces         | PascalCase                  | `ProductServiceInterface`    |
| Types              | PascalCase                  | `UserRole`                   |
| Functions          | camelCase                   | `fetchProducts`              |
| Constants          | SCREAMING_SNAKE_CASE        | `DEFAULT_PAGE_SIZE`          |
| React Components   | PascalCase                  | `ProductCard`                |
| Hooks              | camelCase with `use` prefix | `useProducts`                |

### Normalisation Rules

These conventions are enforced across the codebase:

- **Service files** — all PascalCase: `[Domain]Service.ts`, `[Domain]ServiceInterface.ts`, `[Domain]ServiceFactory.ts`
- **Hooks** — always `export const useX = ()`, never `export default`. State uses `isLoading` (not `loading`).
- **Error handling in hooks** — use `useLogger('hookName')` + `logger.error(...)`, never `console.error`
- **Components** — `export default ComponentName` is fine (standard React pattern)
- **Contexts** — named exports: `export const XProvider` + `export const useX`
- **Data/type files** — camelCase: `basket.ts`, `order.ts`, `types.ts`, `mappers.ts`

### File Organization

```typescript
// 1. Imports (external libraries first, then internal)
import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';

import { useProducts } from '../hooks/useProducts';
import { lightColors, spacing } from '../utils/theme';

// 2. Types and Interfaces
interface ProductCardProps {
  product: Product;
  onPress: (id: string) => void;
}

// 3. Component Definition
const ProductCard: React.FC<ProductCardProps> = ({ product, onPress }) => {
  // Hooks first
  const [isLoading, setIsLoading] = useState(false);

  // Callbacks
  const handlePress = useCallback(() => {
    onPress(product.id);
  }, [product.id, onPress]);

  // Render
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{product.title}</Text>
    </View>
  );
};

// 4. Styles
const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: lightColors.surface,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
});

// 5. Export
export default ProductCard;
```

---

## 🎨 Styling Guidelines

### Theme System

Always use the theme system from `utils/theme.ts`:

```typescript
import { lightColors, spacing, typography, borderRadius, elevation } from '../utils/theme';

const styles = StyleSheet.create({
  container: {
    padding: spacing.md, // Use spacing constants
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
    ...elevation.low, // Use elevation presets
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontWeight: '700',
    color: lightColors.textPrimary,
  },
});
```

### Theme Constants

```typescript
// Spacing
spacing.xs; // 4
spacing.sm; // 8
spacing.md; // 16
spacing.lg; // 24
spacing.xl; // 32

// Colors
lightColors.primary;
lightColors.secondary;
lightColors.success;
lightColors.warning;
lightColors.error;
lightColors.surface;
lightColors.background;
lightColors.textPrimary;
lightColors.textSecondary;
lightColors.border;
lightColors.divider;

// Typography
typography.fontSize.xs; // 12
typography.fontSize.sm; // 14
typography.fontSize.md; // 16
typography.fontSize.lg; // 18
typography.fontSize.xl; // 20

// Border Radius
borderRadius.sm; // 4
borderRadius.md; // 8
borderRadius.lg; // 12
borderRadius.round; // 9999
```

---

## 🔧 Component Guidelines

### Reusable Components

Export reusable components from `components/index.ts`:

```typescript
// components/index.ts
export { Button, type ButtonVariant, type ButtonSize } from './Button';
export { Input, type InputSize } from './Input';
export { SwipeablePanel } from './SwipeablePanel';
```

### Screen Components

Screens follow a consistent structure:

```typescript
// screens/[ScreenName]Screen.tsx
import React, { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import type { StackScreenProps } from '../navigation/types';

interface ScreenNameScreenProps extends StackScreenProps<'ScreenName'> {}

const ScreenNameScreen: React.FC<ScreenNameScreenProps> = ({ navigation }) => {
  // State and hooks

  // Handlers

  // Render helpers

  return (
    <View style={styles.container}>
      {/* Content */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: lightColors.background,
  },
});

export default ScreenNameScreen;
```

### Settings Tabs

Settings tabs are placed in `screens/settings/`:

```typescript
// screens/settings/[Feature]SettingsTab.tsx
const FeatureSettingsTab: React.FC = () => {
  const { settings, updateSettings, isLoading } = useFeatureSettings();

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Section Title</Text>
        {/* Settings controls */}
      </View>
    </ScrollView>
  );
};

export default FeatureSettingsTab;
```

---

## 💸 Money & Currency Calculations

**All monetary math MUST use `utils/money.ts`** to avoid IEEE 754 floating-point errors (e.g. `0.1 + 0.2 !== 0.3`).

```typescript
import { multiplyMoney, addMoney, sumMoney, calculateTax, calculateLineTotal, formatMoney, roundMoney } from '../utils/money';

// ✅ Correct — uses integer-cent math internally
const lineTotal = multiplyMoney(9.99, 3); // 29.97
const sum = addMoney(0.1, 0.2); // 0.3
const tax = calculateTax(29.97, 0.08); // 2.40
const display = formatMoney(29.97); // "$29.97"

// ❌ NEVER do raw float math on money
const bad = 9.99 * 3; // 29.970000000000002
const worse = 0.1 + 0.2; // 0.30000000000000004
```

### Available Functions

| Function                                        | Description                        |
| ----------------------------------------------- | ---------------------------------- |
| `multiplyMoney(price, qty)`                     | Price × quantity, returns dollars  |
| `addMoney(a, b)`                                | Add two dollar amounts             |
| `subtractMoney(a, b)`                           | Subtract dollar amounts            |
| `sumMoney(amounts[])`                           | Sum an array of dollar amounts     |
| `calculateTax(amount, rate)`                    | Tax at decimal rate (0.08 = 8%)    |
| `calculateLineTotal(price, qty, taxable, rate)` | Returns `{ lineTotal, taxAmount }` |
| `roundMoney(amount)`                            | Round to 2 decimal places          |
| `formatMoney(amount, symbol?)`                  | Display string e.g. `"$19.99"`     |

### Testing

Unit tests live at `utils/__tests__/money.test.ts`. Run with:

```bash
npx jest utils/__tests__/money.test.ts
```

---

## 🗄️ Data Layer

### SQLite Storage

Use `SQLiteStorageService` for persistent storage:

```typescript
import { sqliteStorage } from '../services/storage/SQLiteStorageService';

// Key-value storage
await sqliteStorage.setItem('key', value);
const value = await sqliteStorage.getItem('key');

// Object storage
await sqliteStorage.setObject('config', { setting: true });
const config = await sqliteStorage.getObject<Config>('config');

// Direct database access
const db = sqliteStorage.getDatabase();
await db.runAsync('INSERT INTO table ...', [params]);
```

### Repository Pattern

```typescript
export class EntityRepository {
  private db: SQLiteDatabase;

  constructor() {
    this.db = sqliteStorage.getDatabase();
  }

  async create(input: CreateInput): Promise<string> { ... }
  async findById(id: string): Promise<Entity | null> { ... }
  async findAll(): Promise<Entity[]> { ... }
  async update(id: string, data: Partial<Entity>): Promise<void> { ... }
  async delete(id: string): Promise<boolean> { ... }
}
```

---

## 🔌 Platform Integrations

### Supported E-commerce Platforms

```typescript
export enum ECommercePlatform {
  SHOPIFY = 'shopify',
  WOOCOMMERCE = 'woocommerce',
  BIGCOMMERCE = 'bigcommerce',
  MAGENTO = 'magento',
  SYLIUS = 'sylius',
  WIX = 'wix',
  PRESTASHOP = 'prestashop',
  SQUARESPACE = 'squarespace',
  OFFLINE = 'offline',
}
```

### Adding New Platform Support

1. Create platform service in `services/[domain]/platforms/`:

   ```typescript
   export class NewPlatformProductService
     extends BaseProductService
     implements PlatformProductServiceInterface {

     async initialize(): Promise<boolean> { ... }
     async getProducts(options: QueryOptions): Promise<ProductResult> { ... }
   }
   ```

2. Register in factory:
   ```typescript
   case ECommercePlatform.NEW_PLATFORM:
     return this.getNewPlatformService();
   ```

---

## 🧪 Testing Guidelines

### Test File Location

Place tests adjacent to source files:

```
services/basket/
├── BasketService.ts
├── BasketService.test.ts
config/
├── pos.ts
├── pos.test.ts
```

### Required Mocks for Service Tests

Native modules (expo-sqlite, react-native) are unavailable in Jest. Always mock:

```typescript
// Mock uuid to avoid react-native dependency
jest.mock('../../utils/uuid', () => ({
  generateUUID: () => `mock-uuid-${++counter}`,
}));

// Mock config/pos to avoid expo-sqlite dependency
jest.mock('../../config/pos', () => ({
  DEFAULT_TAX_RATE: () => 0.08,
  MAX_SYNC_RETRIES: () => 3,
  posConfig: { values: { taxRate: 0.08, maxSyncRetries: 3, drawerOpenOnCash: true }, load: jest.fn() },
}));

// Mock DB layer directly for config tests
jest.mock('../utils/db', () => ({
  db: { getFirstAsync: jest.fn(), getAllAsync: jest.fn(), runAsync: jest.fn() },
}));
```

### Test Structure

```typescript
import { render, fireEvent } from '@testing-library/react-native';
import Button from './Button';

describe('Button', () => {
  it('renders correctly', () => {
    const { getByText } = render(<Button title="Click me" />);
    expect(getByText('Click me')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button title="Click" onPress={onPress} />);
    fireEvent.press(getByText('Click'));
    expect(onPress).toHaveBeenCalled();
  });
});
```

---

## 🚀 Common Tasks

### Adding a New Service

1. Create interface in `services/[domain]/[Domain]ServiceInterface.ts`
2. Create factory in `services/[domain]/[domain]ServiceFactory.ts`
3. Create platform implementations in `services/[domain]/platforms/`
4. Create hook in `hooks/use[Domain].ts`

### Adding a New Screen

1. Create screen in `screens/[ScreenName]Screen.tsx`
2. Add to navigation in `navigation/[Navigator].tsx`
3. Add type to `navigation/types.ts`

### Adding a New Settings Tab

1. Create tab in `screens/settings/[Feature]SettingsTab.tsx`
2. Import in `screens/SettingsScreen.tsx`
3. Add tab type and render condition

### Adding a New Repository

1. Create repository in `repositories/[Entity]Repository.ts`
2. Define entity interface and row type
3. Implement CRUD methods
4. Create hook if needed in `hooks/use[Entity].ts`

---

## ⚠️ Important Notes

1. **Never hardcode API keys** - Use environment variables or secure storage
2. **Always handle errors** - Wrap async operations in try-catch
3. **Use TypeScript strictly** - No `any` types, explicit return types
4. **Follow existing patterns** - Check similar files before creating new ones
5. **Keep components focused** - Single responsibility principle
6. **Memoize expensive operations** - Use `useMemo` and `useCallback`
7. **Clean up effects** - Return cleanup functions from `useEffect`
8. **Use theme constants** - Never hardcode colors, spacing, or typography
9. **Avoid index files** - Do not create index.ts or index.tsx files solely for re-exporting multiple files in a folder. Import files directly to save time and avoid unnecessary indirection.
10. **No hardcoded config** - Use `posConfig.values` for tax rates, store info, currency, etc. Never hardcode business configuration values.
11. **Logger over console** - Use `LoggerInterface` (via constructor injection) for all service logging. Never use `console.log/error` in services.
12. **Drawer is UI-driven** - The `CheckoutService` sets `openDrawer` on `CheckoutResult`. The UI layer reads the flag and calls the drawer service. Services never open hardware directly.

---

## 📚 Key Dependencies

- **React Native** - Cross-platform mobile framework
- **Expo** - Development platform and build tools
- **TypeScript** - Type-safe JavaScript
- **React Navigation** - Navigation library
- **Expo SQLite** - Local database
- **React Context** - State management
- **i18next** - Internationalization

---

_Last updated: February 20, 2026_
