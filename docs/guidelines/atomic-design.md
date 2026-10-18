# Atomic Design — RetailPOS

> **Use Atomic Design as a guideline, not a strict rule.** Over-splitting components makes codebases harder to navigate. This guide focuses on practical component organization.

---

## Philosophy

**Atomic Design is useful, but many teams over-split with it.**

For RetailPOS, we use a **hybrid approach**:

- **Shared design system** → `shared/components/` (atoms, molecules)
- **Feature-specific UI** → `features/<domain>/components/`
- **Screens** → `features/<domain>/screens/` — composition and data fetching

**Golden Rule**: Extract components when reused or when screens get hard to read. Keep it inline otherwise.

---

## Component Levels

### Atoms (Generic Reusable UI)

**What**: Single UI elements used across the app.  
**Where**: `shared/components/`  
**Examples**: `Button.tsx`, `Input.tsx`, `Card.tsx`, `StatusBadge.tsx`

```typescript
// ✅ Good: Generic, reusable
<Button title="Save" variant="primary" />

// ❌ Bad: Over-splitting
// shared/components/LoginSubmitButton.tsx (not reusable)
```

**Rules**:

- No business logic, no API calls, no navigation
- Accept props for customization
- Theme-aware styling

---

### Molecules (Reusable Combinations)

**What**: Small groups of atoms functioning together.  
**Where**: `shared/components/` (if reused across features)  
**Examples**: `SearchBar.tsx`, `PinKeypad.tsx`, `ProgressIndicator.tsx`

```typescript
// ✅ Good: Reusable pattern
<SearchBar value={query} onChangeText={setQuery} onClear={() => setQuery('')} />
```

**Rules**:

- Compose 2-5 atoms
- No API calls or navigation
- Simple internal state only (e.g., focus, expanded)

---

### Feature Components (Screen-Specific)

**What**: Components used by a single feature.  
**Where**: `features/<domain>/components/`  
**Examples**: `BasketPanel.tsx`, `OrderTimeline.tsx`, `StockAdjustmentForm.tsx`

```typescript
// ✅ Good: Feature-specific, lives with feature
// features/basket/components/BasketPanel.tsx
export const BasketPanel = ({ items, onRemove }) => { ... };
```

**Rules**:

- Can use hooks, context, business logic
- Keep close to the screen that uses them
- Move to `shared/components/` only when reused by 2+ features

---

### Screens (Composition + Data)

**What**: Complete screens that fetch data and compose components.  
**Where**: `features/<domain>/screens/`  
**Examples**: `SaleScreen.tsx`, `OrderHistoryScreen.tsx`

```typescript
// ✅ Good: Clean composition
export function SaleScreen() {
  const { products } = useProducts();
  const { basket } = useBasket();

  return (
    <View>
      <SaleHeader />
      <ProductGrid products={products} />
      <BasketPanel items={basket.items} />
    </View>
  );
}
```

**Rules**:

- Fetch data via hooks
- Handle navigation and screen lifecycle
- Minimal styling (delegate to components)

---

## File Structure

```
retailpos/
├── shared/
│   └── components/# Shared design system
│       ├── Button.tsx                # Atom
│       ├── Input.tsx                 # Atom
│       ├── Card.tsx                  # Atom
│       ├── ProgressIndicator.tsx     # Molecule
│       ├── BottomSheet.tsx           # Molecule
│       ├── RecoveryModal.tsx         # Shared across features
│       └── Toast.tsx                 # Shared across features
│
├── features/
│   ├── checkout/
│   │   ├── screens/
│   │   │   └── SaleScreen.tsx        # Screen
│   │   └── components/# Sale-specific components
│   │       ├── QuickAddPanel.tsx
│   │       └── ProductFilters.tsx
│   │
│   ├── orders-sync/
│   │   ├── screens/
│   │   │   └── OrderHistoryScreen.tsx
│   │   └── components/
│   │       ├── OrderTimeline.tsx
│   │       └── OrderActions.tsx
│   │
│   └── inventory/
│       ├── screens/
│       │   └── InventoryScreen.tsx
│       └── components/
│           └── StockAdjustmentForm.tsx
│
└── app/
    └── app/navigation/# Navigators compose feature screens
```

Each feature may also have `hooks/`, `contexts/`, `services/`, `repositories/`, `utils/` beside `screens/` and `components/`.

---

## When to Extract a Component

**Extract when**:

1. ✅ It's reused in 2+ places
2. ✅ The screen is getting hard to read (>200 lines)
3. ✅ The component has its own clear responsibility
4. ✅ The design should stay consistent across the app

**Keep inline when**:

1. ❌ It's only used once
2. ❌ It's less than 20–30 lines
3. ❌ Extracting would make code harder to follow

```typescript
// ✅ Good: Keep simple JSX inline
export function LoginScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome Back</Text>
      <LoginForm />
    </View>
  );
}

// ❌ Bad: Over-splitting
// shared/components/LoginTitleText.tsx (only used once, 5 lines)
// shared/components/LoginEmailInput.tsx (not reusable)
// shared/components/LoginPasswordInput.tsx (not reusable)
```

---

## Where Does This Component Go?

**Decision flow**:

1. **Is it a basic UI element (button, input)?** → `shared/components/` (atom)
2. **Is it used by 2+ features?** → `shared/components/` (shared)
3. **Is it used by 1 feature?** → `features/<domain>/components/` (feature-specific)
4. **Is it a complete screen?** → `features/<domain>/screens/` (screen)

**Rule of thumb**: Start in feature folder. Move to shared only when actually reused.

---

## Anti-Patterns

### ❌ Over-Splitting

```typescript
// ❌ Bad: Too granular
atoms / LoginEmailInput.tsx; // Not reusable
LoginPasswordInput.tsx; // Not reusable
ProfileUsernameText.tsx; // Not reusable
```

### ❌ Wrong Location

```typescript
// ❌ Bad: Feature-specific in shared
shared / components / BasketPanel.tsx; // Only used in SaleScreen

// ✅ Good: Feature-specific in feature folder
features / basket / components / BasketPanel.tsx;
```

### ❌ Premature Sharing

```typescript
// ❌ Bad: Moving to shared before reuse
shared / components / OrderTimeline.tsx; // Only used once

// ✅ Good: Keep in feature until actually reused
features / orders - sync / components / OrderTimeline.tsx;
```

---

## Quick Reference

**Atoms** = Generic reusable UI (Button, Input, Card)  
**Molecules** = Reusable combinations (SearchBar, Keypad)  
**Feature Components** = Screen-specific (BasketSummary, OrderTimeline)  
**Screens** = Data + composition

**Location**:

- Shared (2+ features) → `shared/components/`
- Feature-specific (1 feature) → `features/<domain>/components/`
- Screens → `features/<domain>/screens/`

**Extract when**: Reused, screen too long, clear responsibility  
**Keep inline when**: Used once, <30 lines, simple

---

**Remember**: Use Atomic Design lightly. Don't split components just because you can. Extract when it improves readability or enables reuse.
