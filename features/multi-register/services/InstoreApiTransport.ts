/**
 * InstoreApiTransport
 *
 * HTTP transport layer for InstoreApiServer. The listening socket lives in
 * the Electron main process (Node `http`) and requests reach the renderer
 * over IPC — Android/iOS registers run as clients only and never host the
 * in-store API.
 */

import { getElectronAPI } from '../../../shared/utils/electron';
import type { ElectronAPI, ElectronInstoreServerRequest } from '../../../shared/utils/electron';
import { instoreApiConfig } from './InstoreApiConfig';
import { instoreApiServer } from './InstoreApiServer';
import { LoggerFactory } from '../../../shared/services/logger/LoggerFactory';

const MAX_REQUEST_BODY_LENGTH = 1024 * 1024;
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

const isHttpMethod = (method: string): method is HttpMethod => (HTTP_METHODS as readonly string[]).includes(method);

export class InstoreApiTransport {
  private static instance: InstoreApiTransport;
  private logger = LoggerFactory.getInstance().createLogger('InstoreApiTransport');
  private listening = false;
  private electronApi: ElectronAPI | null = null;
  private unsubscribeRequests: (() => void) | null = null;

  private constructor() {}

  static getInstance(): InstoreApiTransport {
    if (!InstoreApiTransport.instance) {
      InstoreApiTransport.instance = new InstoreApiTransport();
    }
    return InstoreApiTransport.instance;
  }

  get isListening(): boolean {
    return this.listening;
  }

  /**
   * Start the HTTP server transport
   */
  async start(): Promise<void> {
    if (this.listening) {
      this.logger.warn('HTTP transport already listening');
      return;
    }

    if (!instoreApiConfig.isServer) {
      this.logger.warn('Cannot start HTTP transport — not in server mode');
      return;
    }

    const api = getElectronAPI();
    if (!api) {
      const message = 'In-store server mode requires the RetailPOS desktop app';
      this.logger.error(message);
      throw new Error(message);
    }

    try {
      const port = instoreApiConfig.current.port;

      this.electronApi = api;
      this.unsubscribeRequests = api.onInstoreServerRequest(request => {
        void this.handleHttpRequest(request);
      });
      await api.instoreServerStart(port);

      this.listening = true;
      this.logger.info(`HTTP transport started on port ${port}`);
    } catch (error) {
      this.unsubscribeRequests?.();
      this.unsubscribeRequests = null;
      this.electronApi = null;
      this.logger.error('Failed to start HTTP transport:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Stop the HTTP server transport
   */
  async stop(): Promise<void> {
    this.unsubscribeRequests?.();
    this.unsubscribeRequests = null;

    if (!this.listening) {
      return;
    }

    const api = this.electronApi;
    this.electronApi = null;
    this.listening = false;

    if (!api) {
      return;
    }

    try {
      await api.instoreServerStop();
      this.logger.info('HTTP transport stopped');
    } catch (error) {
      this.logger.error('Failed to stop HTTP transport:', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  private respond(requestId: string, status: number, body: unknown): void {
    if (!this.electronApi) {
      this.logger.warn(`Cannot respond to ${requestId} — in-store server transport not running`);
      return;
    }
    this.electronApi.instoreServerRespond(requestId, status, 'application/json', JSON.stringify(body)).catch(() => {
      // Request already timed out or the server stopped — nothing to recover.
    });
  }

  /**
   * Handle an incoming HTTP request forwarded by the Electron main process.
   */
  private async handleHttpRequest(request: ElectronInstoreServerRequest): Promise<void> {
    try {
      const { requestId, method, url, headers, data } = request;

      // Parse URL and extract path. The query string stays part of the path
      // because it is covered by the request signature.
      const urlObj = new URL(url, 'http://localhost');
      const path = urlObj.pathname + urlObj.search;
      const rawBody = typeof data === 'string' ? data : '';

      if (!isHttpMethod(method)) {
        this.respond(requestId, 405, { error: 'Method not allowed' });
        return;
      }
      if (rawBody.length > MAX_REQUEST_BODY_LENGTH) {
        this.respond(requestId, 413, { error: 'Request body too large' });
        return;
      }

      // Parse request body
      let body: unknown = undefined;
      if (data && method !== 'GET') {
        if (path === '/api/webhooks/commercefull') {
          body = data;
        } else {
          try {
            body = JSON.parse(data);
          } catch {
            this.respond(requestId, 400, { error: 'Invalid JSON body' });
            return;
          }
        }
      }

      // Handle query parameters for GET requests
      if (method === 'GET' && urlObj.search) {
        const queryParams: Record<string, unknown> = {};
        urlObj.searchParams.forEach((value, key) => {
          queryParams[key] = value;
        });
        if (Object.keys(queryParams).length > 0) {
          body = queryParams;
        }
      }

      // Call the server logic — rawBody is passed so signature verification
      // covers the exact bytes on the wire, not a re-serialized object.
      const response = await instoreApiServer.handleRequest(method, path, body, headers, rawBody);

      // Send response back through the main-process server
      this.respond(requestId, response.status, response.body);

      this.logger.debug(`${method} ${path} → ${response.status}`);
    } catch (error) {
      this.logger.error('Error handling HTTP request:', error instanceof Error ? error : new Error(String(error)));

      // Send error response — don't leak internal error details to the LAN
      this.respond(request.requestId, 500, { error: 'Internal server error' });
    }
  }
}

export const instoreApiTransport = InstoreApiTransport.getInstance();
