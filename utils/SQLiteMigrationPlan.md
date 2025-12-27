# SQLite Storage Migration Plan for RetailPOS

## Current Storage Architecture

The RetailPOS application currently uses a hybrid storage approach:

1. **MMKV Storage**: Used in production builds for fast, encrypted key-value storage
2. **AsyncStorage**: Used as a fallback in Expo Go and development environments
3. **Keychain Services**: Used for secure credential storage

The current `Storage` class in `utils/storage.ts` provides a unified interface for data persistence regardless of the underlying implementation (MMKV or AsyncStorage).

## Current Usage Patterns

From analyzing the codebase, we've identified the following storage usage patterns:

### Configuration Settings

- E-commerce platform settings (platform selection, API endpoints)
- Payment provider configuration (Worldpay, Stripe, etc.)
- Printer settings (connection type, device address, etc.)
- Scanner settings (enabled state, device type, etc.)

### API Credentials & Tokens

- API keys for various services
- Access tokens
- Authentication state

### Feature Toggles & Preferences

- Enable/disable features (e.g., NFC payments)
- User preferences
- Application state (e.g., onboarding completed)

## Proposed Migration Strategy

We will introduce SQLite for persistent, structured data storage while maintaining the existing key-value storage for frequently accessed settings and state management. This approach allows us to take advantage of both storage paradigms where appropriate.

### What Should Stay in AsyncStorage/MMKV:

1. **Frequently Accessed Settings**
   - Feature flags and toggles
   - UI preferences
   - Current session information
   - Onboarding state
2. **Small Configuration Objects**
   - Simple key-value pairs
   - Non-relational configuration data
   - Settings that need fast access during app startup
3. **Temporary Data & Cache**
   - Ephemeral state
   - Short-lived data
   - Non-critical application state

### What Should Move to SQLite:

1. **Structured, Relational Data**
   - Order history
   - Product catalog
   - Customer information
   - Transaction records
2. **Historical & Analytical Data**
   - Sales history
   - Inventory changes
   - User activity logs
   - Performance metrics
3. **Large Datasets**
   - Product inventory with many items
   - Extended transaction history
   - Reporting data
4. **Data Requiring Complex Queries**
   - Filtered sales reports
   - Product searches with multiple criteria
   - Analytics data requiring aggregation

## Implementation Plan

### Phase 1: SQLite Service Creation

1. Create a new `SQLiteStorageService` class that encapsulates SQLite functionality:

   ```typescript
   // services/storage/SQLiteStorageService.ts
   import * as SQLite from 'expo-sqlite';
   import { LoggerFactory } from '../logger';

   export class SQLiteStorageService {
     private static instance: SQLiteStorageService;
     private db: SQLite.SQLiteDatabase;
     private logger = LoggerFactory.getInstance().createLogger('SQLiteStorageService');

     private constructor() {
       this.db = SQLite.openDatabase('retailPOS.db');
       this.initializeDatabase();
     }

     public static getInstance(): SQLiteStorageService {
       if (!SQLiteStorageService.instance) {
         SQLiteStorageService.instance = new SQLiteStorageService();
       }
       return SQLiteStorageService.instance;
     }

     private async initializeDatabase(): Promise<void> {
       // Create tables for various data models
       // ...
     }

     // Methods for CRUD operations
     // ...
   }

   export const sqliteStorage = SQLiteStorageService.getInstance();
   ```

2. Create specific repository classes for each data model:

   ```typescript
   // repositories/OrderRepository.ts
   import { sqliteStorage } from '../services/storage/SQLiteStorageService';

   export class OrderRepository {
     // CRUD methods for orders
     // ...
   }
   ```

### Phase 2: Data Model & Schema Creation

Define SQLite table schemas for each data model:

1. Orders Table

   ```sql
   CREATE TABLE IF NOT EXISTS orders (
     id TEXT PRIMARY KEY,
     customer_id TEXT,
     date INTEGER,
     total REAL,
     payment_method TEXT,
     status TEXT,
     created_at INTEGER,
     updated_at INTEGER
   );
   ```

2. Order Items Table

   ```sql
   CREATE TABLE IF NOT EXISTS order_items (
     id TEXT PRIMARY KEY,
     order_id TEXT,
     product_id TEXT,
     quantity INTEGER,
     price REAL,
     FOREIGN KEY (order_id) REFERENCES orders (id)
   );
   ```

3. Products Table

   ```sql
   CREATE TABLE IF NOT EXISTS products (
     id TEXT PRIMARY KEY,
     name TEXT,
     description TEXT,
     price REAL,
     sku TEXT,
     barcode TEXT,
     category_id TEXT,
     stock INTEGER,
     created_at INTEGER,
     updated_at INTEGER
   );
   ```

4. Additional tables for customers, categories, etc.

### Phase 3: Storage Factory & Strategy Pattern

Create a storage factory to abstract storage choice based on data type:

```typescript
// services/storage/StorageFactory.ts
import { storage } from '../../utils/storage';
import { sqliteStorage } from './SQLiteStorageService';

export enum StorageType {
  KEY_VALUE,
  RELATIONAL,
}

export class StorageFactory {
  private static instance: StorageFactory;

  private constructor() {}

  public static getInstance(): StorageFactory {
    if (!StorageFactory.instance) {
      StorageFactory.instance = new StorageFactory();
    }
    return StorageFactory.instance;
  }

  public getStorage(type: StorageType) {
    switch (type) {
      case StorageType.KEY_VALUE:
        return storage;
      case StorageType.RELATIONAL:
        return sqliteStorage;
      default:
        return storage;
    }
  }
}
```

### Phase 4: Hook Adaptation & Data Migration

1. Create new hooks for SQLite-based data:

   ```typescript
   // hooks/useSQLiteOrders.ts
   import { useState, useEffect } from 'react';
   import { OrderRepository } from '../repositories/OrderRepository';

   export const useSQLiteOrders = () => {
     const [orders, setOrders] = useState([]);
     const orderRepository = new OrderRepository();

     // Load and manipulate orders
     // ...

     return {
       orders,
       createOrder,
       updateOrder,
       deleteOrder,
       // ...
     };
   };
   ```

2. One-time migration scripts for moving data from AsyncStorage to SQLite:

   ```typescript
   // migrations/migrateOrdersToSQLite.ts
   import { storage } from '../utils/storage';
   import { OrderRepository } from '../repositories/OrderRepository';

   export async function migrateOrdersToSQLite() {
     // Get orders from AsyncStorage
     const oldOrders = await storage.getObject('orders');

     if (oldOrders && oldOrders.length > 0) {
       const orderRepository = new OrderRepository();

       // Insert into SQLite
       for (const order of oldOrders) {
         await orderRepository.createOrder(order);
       }

       // Mark migration as complete
       await storage.setItem('orders_migrated', 'true');
     }
   }
   ```

## Data Categories and Storage Assignment

### AsyncStorage/MMKV Data

- Onboarding completion state
- Current user session information
- UI preferences and settings
- Current device/hardware configurations (printer, scanner)
- Feature flags and toggles
- E-commerce platform credentials (API keys, tokens) - consider moving sensitive data to Keychain
- Payment provider configurations

### SQLite Data

- Orders and order history
- Products and inventory
- Customers
- Transaction records
- Sales reports and analytics data
- Historical configuration changes
- Audit logs

## Migration Timeline

1. **Sprint 1**: Set up SQLite infrastructure and create core schemas (2 weeks)
2. **Sprint 2**: Implement repository classes for products and orders (2 weeks)
3. **Sprint 3**: Create migration scripts and utilities (1 week)
4. **Sprint 4**: Update existing services to use appropriate storage (2 weeks)
5. **Sprint 5**: Testing and refinement (1 week)

## Implementation Considerations

1. **Performance Testing**: Compare performance between current storage and SQLite for various operations
2. **Error Handling**: Implement robust error handling for database operations
3. **Sync Mechanisms**: Consider sync strategies for offline-first functionality
4. **Migration Safeguards**: Ensure data integrity during migrations
5. **Backup Strategy**: Implement database backup functionality

## Conclusion

This migration plan provides a pathway to incorporate SQLite for structured data storage while maintaining the speed benefits of AsyncStorage/MMKV for frequently accessed settings. The approach preserves compatibility with existing code through abstraction layers and provides a clear separation of concerns between different types of data storage.

By implementing this plan, RetailPOS will gain improved data querying capabilities, better structure for complex data relationships, and more robust long-term data storage while maintaining the performance benefits of the current system where appropriate.
