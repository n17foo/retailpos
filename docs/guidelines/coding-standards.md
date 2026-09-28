# Coding Standards — RetailPOS

> TypeScript, naming, file structure, and common patterns. Follow exactly.

---

## TypeScript

- Always TypeScript, no `.js` files
- No `any` — use `unknown` or proper typing
- Explicit interfaces for all data structures
- Prefer `import type` for type-only imports
- Explicit return types on public methods

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

---

## Naming Conventions

| Item         | Convention                | Example                     |
| ------------ | ------------------------- | --------------------------- |
| Components   | PascalCase `.tsx`         | `ProductCard.tsx`           |
| Screens      | PascalCase + `Screen`     | `OrderScreen.tsx`           |
| Hooks        | camelCase + `use` prefix  | `useProducts.ts`            |
| Services     | PascalCase                | `BasketService.ts`          |
| Interfaces   | PascalCase + `Interface`  | `BasketServiceInterface.ts` |
| Factories    | PascalCase + `Factory`    | `ProductServiceFactory.ts`  |
| Repositories | PascalCase + `Repository` | `OrderRepository.ts`        |
| Contexts     | PascalCase + `Provider`   | `BasketProvider.tsx`        |
| Constants    | SCREAMING_SNAKE_CASE      | `DEFAULT_PAGE_SIZE`         |
| Functions    | camelCase                 | `fetchProducts`             |

**Never prefix interfaces with `I`**. Interface is plain noun (`OrderRepository`); SQLite class is `Offline[Entity]Repository`; HTTP class is `InstoreApi[Entity]Repository`.

---

## File Organization

```typescript
// 1. Imports (external first, then internal)
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { useProducts } from '../hooks/useProducts';

// 2. Types/interfaces
interface ProductCardProps {
  product: UnifiedProduct;
  onPress: (id: string) => void;
}

// 3. Component
const ProductCard: React.FC<ProductCardProps> = ({ product, onPress }) => {
  // Hooks first
  const [isLoading, setIsLoading] = useState(false);

  // Callbacks
  const handlePress = useCallback(() => onPress(product.id), [product.id]);

  return <View><Text>{product.name}</Text></View>;
};

// 4. Styles
const styles = StyleSheet.create({ ... });

// 5. Export
export default ProductCard;
```

---

## Normalization Rules

- **Hooks**: `export const useX`, never default. State flag: `isLoading` (not `loading`)
- **Error handling**: Use `useLogger('hookName')` + `logger.error()`, never `console.error`
- **Contexts**: Named exports only: `export const XProvider` + `export const useX`
- **Components**: `export default ComponentName` is fine
- **No barrel files**: No `index.ts` re-exports. Import source files directly
- **Imports at top**: Never import inside function bodies

---

## 14 Non-Negotiable Rules

1. **Never hardcode API keys** — use env vars or `SecretsService`
2. **Always handle errors** — wrap async in try/catch, never swallow
3. **No `any` types** — use `unknown` or precise types
4. **Follow existing patterns** — check similar files first
5. **Single responsibility** — one concern per component/service
6. **Memoize expensive ops** — use `useMemo`/`useCallback`
7. **Clean up effects** — return cleanup from `useEffect` subscriptions
8. **Use theme constants** — never hardcode colors/spacing/typography
9. **No index re-exports** — import directly to avoid circular deps
10. **No hardcoded config** — use `posConfig.values`
11. **Logger over console** — use `LoggerInterface`, no `console.*` in services
12. **Drawer is UI-driven** — `CheckoutService` sets `openDrawer` flag; UI calls drawer service
13. **Role defaults to least privilege** — `canAccessTab` defaults to `'cashier'` when undefined
14. **Security gap — PIN plaintext** — Hash with bcrypt/Argon2 before production

---

## Money Arithmetic

**All money math uses `utils/money.ts`** — never raw float arithmetic (ADR-006).

```typescript
import { multiplyMoney, addMoney, calculateTax, formatMoney } from '../utils/money';

// ✅ Good
const lineTotal = multiplyMoney(9.99, 3); // 29.97
const tax = calculateTax(29.97, 0.2); // 5.99

// ❌ Bad
const bad = 9.99 * 3; // 29.970000000000002
```

**Functions**: `multiplyMoney`, `addMoney`, `subtractMoney`, `sumMoney`, `calculateTax`, `calculateLineTotal`, `roundMoney`, `formatMoney`

---

## Common Tasks

### Add Service Domain

1. Create `services/[domain]/[Domain]ServiceInterface.ts`
2. Create `services/[domain]/[domain]ServiceFactory.ts`
3. Create `services/[domain]/platforms/Base[Domain]Service.ts`
4. Add platform classes in `platforms/`
5. Create `hooks/use[Domain].ts`

### Add Screen

1. Create `screens/[Name]Screen.tsx`
2. Add to navigator in `navigation/`
3. Add param type to `navigation/types.ts`

### Add Repository

1. Create `repositories/[Entity]Repository.ts`
2. Export interface `[Entity]Repository`
3. Export class `Offline[Entity]Repository implements [Entity]Repository`
4. Export singleton `export const [entity]Repository = new Offline[Entity]Repository()`
5. Export factory `export function get[Entity]Repository(): [Entity]Repository`
6. If multi-register: create `InstoreApi[Entity]Repository`

### Add Platform

1. Create implementations in `services/[domain]/platforms/NewPlatform[Domain]Service.ts`
2. Register in factory `switch` blocks
3. Add enum to `ECommercePlatform` in `utils/platforms.ts`
4. Add capability profile to `PLATFORM_CAPABILITY_MATRIX`
