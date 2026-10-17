/**
 * Order State Mapper
 *
 * Maps technical order states to user-facing sale states.
 * Implements Sales UX spec §2.2 (User-Facing Sale States).
 */

import type { BasketItem } from '../../basket/services/basket';
import type { LocalOrder } from '../../orders-sync/services/order/order';

export type UserFacingSaleState =
  | 'empty'
  | 'building'
  | 'needs-attention'
  | 'preparing-checkout'
  | 'ready-for-payment'
  | 'processing-payment'
  | 'paid'
  | 'sync-pending'
  | 'synced'
  | 'payment-failed'
  | 'action-required';

export interface SaleStateInfo {
  state: UserFacingSaleState;
  label: string;
  color: string;
  bgColor: string;
  description?: string;
}

/**
 * Get user-facing sale state from basket and order state.
 * Implements spec §2.2.1–2.2.9.
 */
export function getUserFacingSaleState(
  basketItems: BasketItem[],
  currentOrder: LocalOrder | null,
  blockers: unknown[],
  isProcessing: boolean
): UserFacingSaleState {
  // Empty basket
  if (basketItems.length === 0 && !currentOrder) {
    return 'empty';
  }

  // Has order - check order state
  if (currentOrder) {
    // Payment failed
    if (currentOrder.status === 'failed') {
      return 'payment-failed';
    }

    // Processing payment
    if (currentOrder.status === 'processing' || isProcessing) {
      return 'processing-payment';
    }

    // Paid - check sync status
    if (currentOrder.status === 'paid') {
      if (currentOrder.syncStatus === 'synced') {
        return 'synced';
      }
      if (currentOrder.syncStatus === 'failed') {
        return 'action-required';
      }
      return 'sync-pending';
    }

    // Draft or pending - ready for payment
    if (currentOrder.status === 'draft' || currentOrder.status === 'pending') {
      return 'ready-for-payment';
    }
  }

  // Building basket - check for blockers
  if (basketItems.length > 0) {
    if (blockers.length > 0) {
      return 'needs-attention';
    }
    return 'building';
  }

  return 'empty';
}

/**
 * Get display information for a sale state.
 */
export function getSaleStateInfo(state: UserFacingSaleState): SaleStateInfo {
  const stateMap: Record<UserFacingSaleState, SaleStateInfo> = {
    empty: {
      state: 'empty',
      label: 'Empty',
      color: '#9e9e9e',
      bgColor: '#f5f5f5',
      description: 'No items in cart',
    },
    building: {
      state: 'building',
      label: 'Building',
      color: '#2196f3',
      bgColor: '#e3f2fd',
      description: 'Adding items to cart',
    },
    'needs-attention': {
      state: 'needs-attention',
      label: 'Needs Attention',
      color: '#ff9800',
      bgColor: '#fff3e0',
      description: 'Issues need to be resolved',
    },
    'preparing-checkout': {
      state: 'preparing-checkout',
      label: 'Preparing',
      color: '#2196f3',
      bgColor: '#e3f2fd',
      description: 'Preparing checkout',
    },
    'ready-for-payment': {
      state: 'ready-for-payment',
      label: 'Ready',
      color: '#4caf50',
      bgColor: '#e8f5e9',
      description: 'Ready for payment',
    },
    'processing-payment': {
      state: 'processing-payment',
      label: 'Processing',
      color: '#2196f3',
      bgColor: '#e3f2fd',
      description: 'Processing payment',
    },
    paid: {
      state: 'paid',
      label: 'Paid',
      color: '#4caf50',
      bgColor: '#e8f5e9',
      description: 'Payment completed',
    },
    'sync-pending': {
      state: 'sync-pending',
      label: 'Sync Pending',
      color: '#ff9800',
      bgColor: '#fff3e0',
      description: 'Syncing to platform',
    },
    synced: {
      state: 'synced',
      label: 'Synced',
      color: '#4caf50',
      bgColor: '#e8f5e9',
      description: 'Synced to platform',
    },
    'payment-failed': {
      state: 'payment-failed',
      label: 'Failed',
      color: '#f44336',
      bgColor: '#ffebee',
      description: 'Payment failed',
    },
    'action-required': {
      state: 'action-required',
      label: 'Action Required',
      color: '#f44336',
      bgColor: '#ffebee',
      description: 'Manual action needed',
    },
  };

  return stateMap[state];
}

/**
 * Get the label for a sale state.
 */
export function getSaleStateLabel(state: UserFacingSaleState): string {
  return getSaleStateInfo(state).label;
}

/**
 * Get the color for a sale state.
 */
export function getSaleStateColor(state: UserFacingSaleState): string {
  return getSaleStateInfo(state).color;
}

/**
 * Get the background color for a sale state.
 */
export function getSaleStateBgColor(state: UserFacingSaleState): string {
  return getSaleStateInfo(state).bgColor;
}

/**
 * Get the icon for a sale state.
 */
export function getSaleStateIcon(state: UserFacingSaleState): string {
  const iconMap: Record<UserFacingSaleState, string> = {
    empty: '🛒',
    building: '📝',
    'needs-attention': '⚠️',
    'preparing-checkout': '⏳',
    'ready-for-payment': '💳',
    'processing-payment': '⚡',
    paid: '✅',
    'sync-pending': '📤',
    synced: '✓',
    'payment-failed': '❌',
    'action-required': '🔔',
  };
  return iconMap[state];
}
