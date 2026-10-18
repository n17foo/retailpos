# Testing Guidelines — RetailPOS

---

## File Location

Place tests adjacent to source, inside the feature slice:

```
features/basket/services/
├── BasketService.ts
├── BasketService.test.ts                    ← unit
├── BasketService.integration.test.ts        ← integration (optional)

shared/utils/
├── money.ts
├── money.test.ts
```

**Configs**:

- `tests/jest.config.js` — unit tests (`yarn test`)
- `tests/jest.integration.config.js` — integration tests (`yarn test:integration`)

---

## Required Mocks

Native modules unavailable in Jest. Always mock:

```typescript
// UUID (avoids react-native crypto)
let counter = 0;
jest.mock('../../shared/utils/uuid', () => ({
  generateUUID: () => `mock-uuid-${++counter}`,
}));

// POSConfigService (avoids expo-sqlite)
jest.mock('../../features/platform-clients/services/config/POSConfigService', () => ({
  DEFAULT_TAX_RATE: () => 0.2,
  posConfig: { values: { taxRate: 0.2 }, load: jest.fn() },
}));

// AuditLogService (avoids expo-sqlite)
jest.mock('../../shared/services/audit/AuditLogService');

// Database (for repository tests)
jest.mock('../../shared/utils/db', () => ({
  db: {
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
    runAsync: jest.fn(),
  },
}));
```

---

## Test Structure

### Component Test

```typescript
import { render, fireEvent } from '@testing-library/react-native';
import Button from './Button';

describe('Button', () => {
  beforeEach(() => jest.clearAllMocks());

  it('renders label', () => {
    const { getByText } = render(<Button title="Pay" />);
    expect(getByText('Pay')).toBeTruthy();
  });

  it('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button title="Pay" onPress={onPress} />);
    fireEvent.press(getByText('Pay'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
```

### Service Test

```typescript
describe('BasketService', () => {
  let service: BasketService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BasketService(mockRepository, mockLogger);
  });

  describe('addItem', () => {
    it('creates basket when none exists', async () => {
      (mockRepository.findActiveBasket as jest.Mock).mockResolvedValue(null);

      const basket = await service.addItem({
        productId: '1',
        name: 'Test',
        price: 9.99,
        quantity: 1,
      });

      expect(mockRepository.createBasket).toHaveBeenCalled();
      expect(basket.items).toHaveLength(1);
    });
  });
});
```

---

## Running Tests

```bash
yarn test                  # unit tests
yarn test:integration      # integration tests
yarn test:all              # unit + integration
yarn test:watch            # watch mode
yarn test:coverage         # coverage report

# Single file
npx jest features/basket/services/BasketService.test.ts

# Single test
npx jest -t "creates basket"
```

---

## Key Rules

- `jest.clearAllMocks()` in `beforeEach` — never share mock state
- Mock at module level for native deps; `jest.spyOn` for targeted mocking
- Never delete/weaken existing tests without instruction
- Integration tests may use in-memory SQLite; unit tests mock DB layer
