/**
 * InstoreApiTransport Integration Test
 *
 * Tests the HTTP transport layer for multi-register functionality.
 * The listening socket lives in the Electron main process; these tests mock
 * the `electronAPI` IPC surface the renderer-side transport binds to.
 */

import type { ElectronInstoreServerRequest } from '../../shared/utils/electron';
import { instoreApiConfig } from '../../features/multi-register/services/InstoreApiConfig';
import { instoreApiServer } from '../../features/multi-register/services/InstoreApiServer';
import { instoreApiTransport } from '../../features/multi-register/services/InstoreApiTransport';
import { CommercefullWebhookReceiver } from '../../features/platform-clients/services/clients/commercefull/CommercefullWebhookReceiver';
import { SIGNATURE_HEADERS, signRequest } from '../../features/multi-register/services/requestSigning';

const TEST_SECRET = 'test-secret';

// Mock the Electron IPC surface — the transport's only platform dependency.
const mockElectronApi = {
  instoreServerStart: jest.fn(async (_port: number) => true),
  instoreServerStop: jest.fn(async () => true),
  instoreServerRespond: jest.fn(async (_requestId: string, _status: number, _mimeType: string, _body: string) => true),
  onInstoreServerRequest: jest.fn((_callback: (request: ElectronInstoreServerRequest) => void) => () => {}),
};
let mockElectronAvailable = true;

jest.mock('../../shared/utils/electron', () => ({
  ...jest.requireActual('../../shared/utils/electron'),
  getElectronAPI: () => (mockElectronAvailable ? mockElectronApi : null),
}));

/** The request listener the transport registered via onInstoreServerRequest. */
function requestListener(): (request: ElectronInstoreServerRequest) => void {
  const callback = mockElectronApi.onInstoreServerRequest.mock.calls[0]?.[0];
  if (!callback) throw new Error('No in-store request listener registered');
  return callback;
}

/** Build the HMAC signature headers a real client would send. */
function signedHeaders(method: string, pathWithQuery: string, rawBody = '', secret = TEST_SECRET): Record<string, string> {
  const { timestamp, nonce, signature } = signRequest(secret, method, pathWithQuery, rawBody);
  return {
    [SIGNATURE_HEADERS.register]: 'test-register',
    [SIGNATURE_HEADERS.timestamp]: timestamp,
    [SIGNATURE_HEADERS.nonce]: nonce,
    [SIGNATURE_HEADERS.signature]: signature,
  };
}

describe('InstoreApiTransport', () => {
  beforeEach(async () => {
    mockElectronAvailable = true;
    jest.clearAllMocks();

    // Reset to server mode for testing
    await instoreApiConfig.save({
      mode: 'server',
      port: 8787,
      sharedSecret: 'test-secret',
      registerId: 'test-register',
      registerName: 'Test Register',
      serverAddress: '',
    });
  });

  afterEach(async () => {
    // Clean up
    await instoreApiTransport.stop();
    await instoreApiServer.stop();
  });

  describe('Transport Lifecycle', () => {
    it('should start and stop HTTP transport in server mode', async () => {
      expect(instoreApiTransport.isListening).toBe(false);

      // Start transport
      await instoreApiTransport.start();
      expect(instoreApiTransport.isListening).toBe(true);

      // Stop transport
      await instoreApiTransport.stop();
      expect(instoreApiTransport.isListening).toBe(false);
    });

    it('should not start transport in non-server mode', async () => {
      await instoreApiConfig.save({ mode: 'standalone' });

      await instoreApiTransport.start();
      expect(instoreApiTransport.isListening).toBe(false);
    });

    it('should handle multiple start calls gracefully', async () => {
      await instoreApiTransport.start();
      expect(instoreApiTransport.isListening).toBe(true);

      // Second start should not throw
      await instoreApiTransport.start();
      expect(instoreApiTransport.isListening).toBe(true);
    });
  });

  describe('Server Integration', () => {
    it('should start server with transport', async () => {
      expect(instoreApiServer.isRunning).toBe(false);

      await instoreApiServer.start();

      expect(instoreApiServer.isRunning).toBe(true);
      expect(instoreApiTransport.isListening).toBe(true);
    });

    it('should stop server with transport', async () => {
      await instoreApiServer.start();
      expect(instoreApiServer.isRunning).toBe(true);

      await instoreApiServer.stop();

      expect(instoreApiServer.isRunning).toBe(false);
      expect(instoreApiTransport.isListening).toBe(false);
    });
  });

  describe('Platform Support', () => {
    it('should refuse server mode outside the desktop app', async () => {
      mockElectronAvailable = false;

      await expect(instoreApiTransport.start()).rejects.toThrow('desktop app');
      expect(instoreApiTransport.isListening).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle transport start failure', async () => {
      mockElectronApi.instoreServerStart.mockRejectedValueOnce(new Error('Port already in use'));

      await expect(instoreApiTransport.start()).rejects.toThrow('Port already in use');
      expect(instoreApiTransport.isListening).toBe(false);
    });

    it('should unsubscribe request listener when start fails', async () => {
      const unsubscribe = jest.fn();
      mockElectronApi.onInstoreServerRequest.mockReturnValueOnce(unsubscribe);
      mockElectronApi.instoreServerStart.mockRejectedValueOnce(new Error('Port already in use'));

      await expect(instoreApiTransport.start()).rejects.toThrow('Port already in use');
      expect(unsubscribe).toHaveBeenCalled();
    });
  });
});

describe('HTTP Request Handling', () => {
  let mockRequest: ElectronInstoreServerRequest;

  beforeEach(async () => {
    mockElectronAvailable = true;
    jest.clearAllMocks();

    // Reset to server mode for testing
    await instoreApiConfig.save({
      mode: 'server',
      port: 8787,
      sharedSecret: 'test-secret',
      registerId: 'test-register',
      registerName: 'Test Register',
      serverAddress: '',
    });

    mockRequest = {
      requestId: 'test-123',
      method: 'GET',
      url: 'http://localhost:8787/api/health',
      headers: {},
      data: '',
    };
  });

  afterEach(async () => {
    // Clean up
    await instoreApiTransport.stop();
    await instoreApiServer.stop();
  });

  it('should handle GET /api/health request', async () => {
    // Start the server (which starts the transport)
    await instoreApiServer.start();

    // Get the callback function registered via onInstoreServerRequest
    const callback = requestListener();

    // Simulate an incoming request
    await callback(mockRequest);

    // Wait for async operations to complete
    await new Promise(resolve => setImmediate(resolve));

    // Verify response was sent
    expect(mockElectronApi.instoreServerRespond).toHaveBeenCalledWith(
      'test-123',
      200,
      'application/json',
      expect.stringContaining('"ok":true')
    );
  });

  it('should reject the legacy shared-secret header', async () => {
    await instoreApiServer.start();
    const callback = requestListener();

    // Legacy auth is gone — a correct secret in the old header must still 401
    const unauthRequest = {
      ...mockRequest,
      url: 'http://localhost:8787/api/users',
      headers: { 'x-shared-secret': TEST_SECRET },
    };

    await callback(unauthRequest);
    await new Promise(resolve => setImmediate(resolve));

    expect(mockElectronApi.instoreServerRespond).toHaveBeenCalledWith(
      'test-123',
      401,
      'application/json',
      expect.stringContaining('"error":"Unauthorized"')
    );
  });

  it('should accept a validly signed request', async () => {
    await instoreApiServer.start();
    const callback = requestListener();

    await callback({
      ...mockRequest,
      url: 'http://localhost:8787/api/session',
      headers: signedHeaders('GET', '/api/session'),
    });
    await new Promise(resolve => setImmediate(resolve));

    expect(mockElectronApi.instoreServerRespond).toHaveBeenCalledWith(
      'test-123',
      200,
      'application/json',
      expect.stringContaining('"ok":true')
    );
  });

  it('should reject a signature computed with the wrong secret', async () => {
    await instoreApiServer.start();
    const callback = requestListener();

    await callback({
      ...mockRequest,
      url: 'http://localhost:8787/api/session',
      headers: signedHeaders('GET', '/api/session', '', 'wrong-secret'),
    });
    await new Promise(resolve => setImmediate(resolve));

    expect(mockElectronApi.instoreServerRespond).toHaveBeenCalledWith(
      'test-123',
      401,
      'application/json',
      expect.stringContaining('"error":"Unauthorized"')
    );
  });

  it('should reject a replayed nonce', async () => {
    await instoreApiServer.start();
    const callback = requestListener();

    const request = {
      ...mockRequest,
      url: 'http://localhost:8787/api/session',
      headers: signedHeaders('GET', '/api/session'),
    };

    await callback({ ...request, requestId: 'first' });
    await new Promise(resolve => setImmediate(resolve));
    expect(mockElectronApi.instoreServerRespond).toHaveBeenCalledWith(
      'first',
      200,
      'application/json',
      expect.stringContaining('"ok":true')
    );

    // Same signature headers — identical nonce must be rejected as replay
    await callback({ ...request, requestId: 'second' });
    await new Promise(resolve => setImmediate(resolve));
    expect(mockElectronApi.instoreServerRespond).toHaveBeenCalledWith(
      'second',
      401,
      'application/json',
      expect.stringContaining('"error":"Unauthorized"')
    );
  });

  it('should handle JSON parsing for POST requests', async () => {
    await instoreApiServer.start();
    const callback = requestListener();

    const rawBody = JSON.stringify({
      order: { id: 'test-order', subtotal: 10.0, tax: 0, total: 10.0 },
      items: [],
    });
    const postRequest = {
      ...mockRequest,
      method: 'POST',
      url: 'http://localhost:8787/api/orders',
      headers: signedHeaders('POST', '/api/orders', rawBody),
      data: rawBody,
    };

    await callback(postRequest);

    // Wait for async operations to complete
    await new Promise(resolve => setImmediate(resolve));

    // Should attempt to handle the request (may fail due to missing data, but should parse JSON)
    expect(mockElectronApi.instoreServerRespond).toHaveBeenCalled();
  });

  it('should reject an order with invalid fields', async () => {
    await instoreApiServer.start();
    const callback = requestListener();

    const rawBody = JSON.stringify({ order: { id: 'x' }, items: [] });
    await callback({
      ...mockRequest,
      method: 'POST',
      url: 'http://localhost:8787/api/orders',
      headers: signedHeaders('POST', '/api/orders', rawBody),
      data: rawBody,
    });
    await new Promise(resolve => setImmediate(resolve));

    expect(mockElectronApi.instoreServerRespond).toHaveBeenCalledWith(
      'test-123',
      400,
      'application/json',
      expect.stringContaining('error')
    );
  });

  it('should reject a tampered signed body', async () => {
    await instoreApiServer.start();
    const callback = requestListener();

    const signed = signedHeaders('POST', '/api/orders', '{"order":{"id":"a"},"items":[]}');
    await callback({
      ...mockRequest,
      method: 'POST',
      url: 'http://localhost:8787/api/orders',
      headers: signed,
      data: '{"order":{"id":"b"},"items":[]}',
    });
    await new Promise(resolve => setImmediate(resolve));

    expect(mockElectronApi.instoreServerRespond).toHaveBeenCalledWith(
      'test-123',
      401,
      'application/json',
      expect.stringContaining('"error":"Unauthorized"')
    );
  });

  it('should preserve the exact signed webhook body', async () => {
    await instoreApiServer.start();
    const callback = requestListener();
    const rawBody = '{ "event": "product.updated", "data": { "id": "p1" } }';
    const receiver = CommercefullWebhookReceiver.getInstance();
    const handler = jest.spyOn(receiver, 'handleRequest').mockResolvedValue({ status: 200, body: { success: true } });

    await callback({
      ...mockRequest,
      method: 'POST',
      url: 'http://localhost:8787/api/webhooks/commercefull',
      headers: { 'X-Webhook-Signature': 'signature' },
      data: rawBody,
    });
    await new Promise(resolve => setImmediate(resolve));

    expect(handler).toHaveBeenCalledWith(rawBody, { 'x-webhook-signature': 'signature' });
    handler.mockRestore();
  });

  it('should reject oversized request bodies', async () => {
    await instoreApiServer.start();
    const callback = requestListener();

    await callback({ ...mockRequest, method: 'POST', url: 'http://localhost:8787/api/orders', data: 'x'.repeat(1024 * 1024 + 1) });
    await new Promise(resolve => setImmediate(resolve));

    expect(mockElectronApi.instoreServerRespond).toHaveBeenCalledWith(
      'test-123',
      413,
      'application/json',
      expect.stringContaining('too large')
    );
  });

  it('should handle query parameters for GET requests', async () => {
    await instoreApiServer.start();
    const callback = requestListener();

    const getWithQuery = {
      ...mockRequest,
      url: 'http://localhost:8787/api/sync/events?since=1234567890',
      headers: signedHeaders('GET', '/api/sync/events?since=1234567890'),
    };

    await callback(getWithQuery);

    // Wait for async operations to complete
    await new Promise(resolve => setImmediate(resolve));

    expect(mockElectronApi.instoreServerRespond).toHaveBeenCalledWith(
      'test-123',
      200,
      'application/json',
      expect.stringContaining('"events"')
    );
  });

  it('should route /api/orders/unsynced to the literal route', async () => {
    await instoreApiServer.start();
    const callback = requestListener();

    await callback({
      ...mockRequest,
      url: 'http://localhost:8787/api/orders/unsynced',
      headers: signedHeaders('GET', '/api/orders/unsynced'),
    });
    await new Promise(resolve => setImmediate(resolve));

    // Must reach findUnsynced (200 + orders array), not /api/orders/:id (404)
    expect(mockElectronApi.instoreServerRespond).toHaveBeenCalledWith(
      'test-123',
      200,
      'application/json',
      expect.stringContaining('"orders"')
    );
  });
});
