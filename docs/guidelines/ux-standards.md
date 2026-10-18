# UX & UI Standards — RetailPOS

> Visual design and UX patterns. Never hardcode colors, spacing, or typography.

---

## Theme System

Import from `shared/utils/theme.ts`:

```typescript
import { lightColors, spacing, typography, borderRadius, elevation } from '../../shared/utils/theme';

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    backgroundColor: lightColors.surface,
    borderRadius: borderRadius.lg,
  },
});
```

**Key tokens**:

- **Spacing**: `xs` (4), `sm` (8), `md` (16), `lg` (24), `xl` (32)
- **Colors**: `primary`, `success`, `warning`, `error`, `surface`, `background`, `textPrimary`, `border`
- **Typography**: `fontSize.xs` (12), `sm` (14), `md` (16), `lg` (18), `xl` (20)
- **Border Radius**: `sm` (4), `md` (8), `lg` (12), `round` (9999)

---

## Accessibility

Every interactive element must include:

```typescript
<TouchableOpacity
  accessibilityLabel="Add to cart"
  accessibilityRole="button"
  accessibilityHint="Adds this product to your current order"
  accessibilityState={{ disabled: false }}
  onPress={handleAdd}
/>
```

**Required**: `accessibilityLabel`, `accessibilityRole`  
**Optional**: `accessibilityHint`, `accessibilityState`

Dynamic labels reflect state:

```typescript
accessibilityLabel={`Notifications, ${unreadCount} unread`}
```

---

## Responsive Layout

Use `useResponsive()` for layout branching:

- **Mobile**: Swipeable basket panel, single-column grid, `Alert` dialogs
- **Tablet**: Inline basket sidebar, 2-3 column grid
- **Desktop**: Full sidebar, keyboard-driven, IPC peripherals

Never hard-switch on platform — always use responsive hook.

---

## Feedback Patterns

### Scan Results

Inline colored banners (never blocking `Alert`):

- `searching` → Blue
- `found_*` → Green
- `not_found` → Red

### Toast Notifications

Use `NotificationService` for non-blocking feedback. Never use `Alert` for informational messages.

### Internationalization

All strings use `i18next`:

```typescript
const { t } = useTranslation();
<Text>{t('basket.emptyMessage')}</Text>
```

---

## Sales Screen Patterns

### Status Header

Always show persistent context:

```typescript
<SalesStatusHeader
  registerName="Register 2"
  cashierName="Alban"
  saleMode="counter"
  orderState={saleState}
  itemCount={itemCount}
  total={total}
/>
```

### User-Facing States

Map technical states via `features/checkout/utils/orderStateMapper.ts`:

```typescript
const saleState = getUserFacingSaleState({ basket, order, blockers, paymentLines });
const label = getSaleStateLabel(saleState);
const color = getSaleStateColor(saleState);
```

**States**: Empty, Building, Needs Attention, Ready, Preparing, Processing, Paid, Synced, Action Required

**Never expose technical states** (`draft`, `pending`) to users.

### Primary CTA

One dominant call-to-action per state:

```typescript
switch (saleState) {
  case 'building':
  case 'ready-for-checkout':
    return <Button type="primary" size="large">Complete Order</Button>;
  case 'needs-attention':
    return <Button type="warning" size="large">Fix {blockers.length} Issues</Button>;
  case 'paid':
    return <Button type="success" size="large">New Sale</Button>;
}
```

### Basket Validation

Surface blockers inline with `BasketBlockers`:

```typescript
const blockers = validateBasket(basket);
{blockers.length > 0 && <BasketBlockers blockers={blockers} />}
```

### Recovery Modals

Replace `Alert.alert` with `RecoveryModal` for errors:

```typescript
<RecoveryModal
  visible={showRecoveryModal}
  type="error"
  title="Card Payment Declined"
  message="The card was declined by the bank."
  actions={[
    { label: 'Try Again', type: 'primary', onPress: retryPayment },
    { label: 'Choose Another Method', type: 'secondary', onPress: changeMethod },
    { label: 'Cancel Order', type: 'tertiary', destructive: true, onPress: cancel }
  ]}
/>
```

**Use `RecoveryModal` for**: Payment errors, sync failures, terminal disconnections  
**Use `Alert.alert` for**: Destructive confirmations, manager approval, critical system errors

### Interruption Recovery

Detect interrupted operations on app open:

```typescript
const { interruptionState, resumeDraftSale, resumeCheckout, recoverPayment } = useInterruptionRecovery();

{interruptionState.type !== 'none' && (
  <InterruptionBanner type={interruptionState.type} onResume={handleResume} />
)}
```

**Types**: `draft-sale`, `interrupted-checkout`, `interrupted-payment`, `unsynced`

### Sync Language

Use reassuring operational language:

**Good**: "Order saved locally. Sync pending.", "Syncing to Shopify..."  
**Bad**: "Sync failed", "Error syncing order"

### Payment Method Availability

Group by availability in `CheckoutModal`:

```typescript
const availability = getPaymentMethodAvailability(method, context);
// States: recommended, available, requires-customer, requires-setup, unavailable
```

**Sections**: Recommended → Other Methods → Requires Customer → Unavailable

---

## Analytics

Track key UX events:

```typescript
analyticsService.track('sale_started', { cashierId, timestamp });
analyticsService.track('item_added', { productId, method: 'scan' | 'search' | 'browse' });
analyticsService.track('checkout_started', { itemCount, total });
analyticsService.track('payment_completed', { method, duration });
analyticsService.track('payment_failed', { method, reason });
```

**Key metrics**: Time to payment, taps per sale, payment failure rate, recovery time, blocker frequency

---

## Component Reference

**New Components**: `SalesStatusHeader`, `BasketBlockers`, `RecoveryModal`, `InterruptionBanner`, `SyncStatusBanner`

**New Hooks**: `useInterruptionRecovery`, `useRecentItems`, `useBestSellers`

**New Utils**: `orderStateMapper`, `getUserFacingSaleState()`, `getSaleStateLabel()`, `getSaleStateColor()`
