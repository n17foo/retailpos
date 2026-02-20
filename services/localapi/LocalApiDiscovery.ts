import { localApiConfig } from './LocalApiConfig';
import { localApiClient } from './LocalApiClient';
import { LoggerFactory } from '../logger/LoggerFactory';

export interface DiscoveredServer {
  address: string;
  port: number;
  registerName: string;
  respondedAt: number;
}

/**
 * Discovery service for finding the Local API Server on the LAN.
 *
 * Strategy: scan a range of IPs on the local subnet for the server's
 * health endpoint. In a real deployment this could be replaced with
 * mDNS/Bonjour via a native module, but subnet scanning works without
 * native dependencies and is sufficient for small retail LANs.
 */
export class LocalApiDiscovery {
  private static instance: LocalApiDiscovery;
  private logger = LoggerFactory.getInstance().createLogger('LocalApiDiscovery');
  private scanning = false;

  private constructor() {}

  static getInstance(): LocalApiDiscovery {
    if (!LocalApiDiscovery.instance) {
      LocalApiDiscovery.instance = new LocalApiDiscovery();
    }
    return LocalApiDiscovery.instance;
  }

  get isScanning(): boolean {
    return this.scanning;
  }

  /**
   * Scan the local subnet for a running Local API Server.
   * Tries common private network ranges on the configured port.
   * Returns all discovered servers.
   */
  async scanSubnet(subnetPrefix?: string, onProgress?: (checked: number, total: number) => void): Promise<DiscoveredServer[]> {
    if (this.scanning) return [];
    this.scanning = true;

    const port = localApiConfig.current.port;
    const secret = localApiConfig.current.sharedSecret;
    const discovered: DiscoveredServer[] = [];

    // Determine subnet to scan
    const prefix = subnetPrefix || '192.168.1';
    const total = 254;
    let checked = 0;

    this.logger.info(`Scanning ${prefix}.1-254 on port ${port}…`);

    // Scan in batches of 20 for performance
    const BATCH_SIZE = 20;
    for (let start = 1; start <= 254; start += BATCH_SIZE) {
      const promises: Promise<void>[] = [];

      for (let i = start; i < Math.min(start + BATCH_SIZE, 255); i++) {
        const address = `${prefix}.${i}`;
        promises.push(
          this.probeAddress(address, port, secret)
            .then(result => {
              if (result) {
                discovered.push(result);
                this.logger.info(`Found server at ${address}:${port} (${result.registerName})`);
              }
            })
            .catch(() => {
              // Expected — most IPs won't respond
            })
            .finally(() => {
              checked++;
              onProgress?.(checked, total);
            })
        );
      }

      await Promise.all(promises);
    }

    this.scanning = false;
    this.logger.info(`Scan complete. Found ${discovered.length} server(s).`);
    return discovered;
  }

  /**
   * Probe a single address for the health endpoint.
   * Uses a short timeout to avoid blocking on unresponsive IPs.
   */
  async probeAddress(address: string, port: number, secret?: string): Promise<DiscoveredServer | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (secret) headers['x-shared-secret'] = secret;

      const response = await fetch(`http://${address}:${port}/api/health`, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      if (!response.ok) return null;

      const data = await response.json();
      if (data.ok !== true) return null;

      return {
        address,
        port,
        registerName: data.registerName || 'Unknown',
        respondedAt: Date.now(),
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Connect to a discovered server — saves the address in config
   * and tests the connection via the client.
   */
  async connectToServer(server: DiscoveredServer): Promise<boolean> {
    await localApiConfig.save({
      mode: 'client',
      serverAddress: server.address,
      port: server.port,
    });

    const result = await localApiClient.testConnection();
    if (result.ok) {
      this.logger.info(`Connected to server at ${server.address}:${server.port}`);
    } else {
      this.logger.warn(`Failed to connect to ${server.address}:${server.port}: ${result.error}`);
    }
    return result.ok;
  }
}

export const localApiDiscovery = LocalApiDiscovery.getInstance();
