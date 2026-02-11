import { addRequestToQueue } from '../../hooks/useSyncStore';

/**
 * Service for making API calls through the persistent request queue
 * This ensures all write operations (POST, PUT, DELETE) are queued and retried on failure
 */
export class QueuedApiService {
  /**
   * Make a queued API request for write operations (POST, PUT, DELETE)
   * These operations will be queued and retried on network/server errors
   */
  static async queuedRequest(
    url: string,
    method: 'POST' | 'PUT' | 'DELETE',
    body?: any,
    headers?: Record<string, string>,
    requestId?: string
  ): Promise<void> {
    // Add to persistent queue instead of making direct request
    addRequestToQueue(url, method, body, headers, requestId);
  }

  /**
   * Make a direct API request for read operations (GET)
   * Read operations are not queued as they are typically safe to retry immediately
   */
  static async directRequest(url: string, method: 'GET' = 'GET', headers?: Record<string, string>): Promise<Response> {
    return fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
  }

  /**
   * Make a direct API request with body for read operations
   */
  static async directRequestWithBody(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    body?: any,
    headers?: Record<string, string>
  ): Promise<Response> {
    return fetch(url, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    });
  }
}
