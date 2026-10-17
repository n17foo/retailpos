/**
 * KDS vendor-specific endpoint templates and configuration presets
 */

export interface KdsEndpoints {
  health: string;
  sendOrder: string;
  recallOrder: string;
  cancelOrder: string;
  getUpdates: string;
}

export interface KdsVendorPreset {
  name: string;
  endpoints: KdsEndpoints;
  requiresApiKey: boolean;
  supportsPolling: boolean;
  supportsWebSocket: boolean;
  defaultPollIntervalMs: number;
  description: string;
}

/**
 * Predefined KDS vendor configurations
 */
export const KDS_VENDOR_PRESETS: Record<string, KdsVendorPreset> = {
  custom: {
    name: 'Custom / Generic KDS',
    endpoints: {
      health: '/api/kds/health',
      sendOrder: '/api/kds/orders',
      recallOrder: '/api/kds/orders/{orderId}/recall',
      cancelOrder: '/api/kds/orders/{orderId}',
      getUpdates: '/api/kds/updates?since={timestamp}',
    },
    requiresApiKey: false,
    supportsPolling: true,
    supportsWebSocket: false,
    defaultPollIntervalMs: 3000,
    description: 'Generic REST API compatible with custom KDS implementations',
  },

  square: {
    name: 'Square KDS',
    endpoints: {
      health: '/v2/health',
      sendOrder: '/v2/orders',
      recallOrder: '/v2/orders/{orderId}/recall',
      cancelOrder: '/v2/orders/{orderId}',
      getUpdates: '/v2/orders/updates?cursor={timestamp}',
    },
    requiresApiKey: true,
    supportsPolling: true,
    supportsWebSocket: true,
    defaultPollIntervalMs: 5000,
    description: 'Square Kitchen Display System API',
  },

  toast: {
    name: 'Toast KDS',
    endpoints: {
      health: '/health',
      sendOrder: '/orders/create',
      recallOrder: '/orders/{orderId}/recall',
      cancelOrder: '/orders/{orderId}/cancel',
      getUpdates: '/orders/updates?lastSync={timestamp}',
    },
    requiresApiKey: true,
    supportsPolling: true,
    supportsWebSocket: false,
    defaultPollIntervalMs: 4000,
    description: 'Toast POS Kitchen Display System',
  },

  clover: {
    name: 'Clover KDS',
    endpoints: {
      health: '/v3/ping',
      sendOrder: '/v3/merchants/{merchantId}/orders',
      recallOrder: '/v3/merchants/{merchantId}/orders/{orderId}/fire',
      cancelOrder: '/v3/merchants/{merchantId}/orders/{orderId}',
      getUpdates: '/v3/merchants/{merchantId}/orders?filter=modifiedTime>{timestamp}',
    },
    requiresApiKey: true,
    supportsPolling: true,
    supportsWebSocket: false,
    defaultPollIntervalMs: 5000,
    description: 'Clover Kitchen Display System',
  },

  lightspeed: {
    name: 'Lightspeed KDS',
    endpoints: {
      health: '/api/status',
      sendOrder: '/api/orders',
      recallOrder: '/api/orders/{orderId}/bump',
      cancelOrder: '/api/orders/{orderId}/void',
      getUpdates: '/api/orders/changes?since={timestamp}',
    },
    requiresApiKey: true,
    supportsPolling: true,
    supportsWebSocket: false,
    defaultPollIntervalMs: 3000,
    description: 'Lightspeed Restaurant KDS',
  },

  fresh_kds: {
    name: 'Fresh KDS',
    endpoints: {
      health: '/health',
      sendOrder: '/api/v1/tickets',
      recallOrder: '/api/v1/tickets/{orderId}/recall',
      cancelOrder: '/api/v1/tickets/{orderId}',
      getUpdates: '/api/v1/tickets/updates?after={timestamp}',
    },
    requiresApiKey: false,
    supportsPolling: true,
    supportsWebSocket: true,
    defaultPollIntervalMs: 2000,
    description: 'Fresh KDS (open-source kitchen display)',
  },
};

export type KdsVendorType = keyof typeof KDS_VENDOR_PRESETS;

/**
 * Replace placeholders in endpoint templates
 */
export function formatEndpoint(template: string, params: { orderId?: string; timestamp?: number; merchantId?: string }): string {
  let result = template;

  if (params.orderId) {
    result = result.replace('{orderId}', params.orderId);
  }

  if (params.timestamp !== undefined) {
    result = result.replace('{timestamp}', params.timestamp.toString());
  }

  if (params.merchantId) {
    result = result.replace('{merchantId}', params.merchantId);
  }

  return result;
}
