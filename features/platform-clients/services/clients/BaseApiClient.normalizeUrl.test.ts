import { BaseApiClient, AuthStrategy } from './BaseApiClient';

class TestClient extends BaseApiClient {
  protected getAuthStrategy(): AuthStrategy {
    return { type: 'none' };
  }

  protected buildApiUrl(path: string): string {
    return path;
  }

  public normalize(url: string): string {
    return this.normalizeUrl(url);
  }
}

describe('BaseApiClient.normalizeUrl (PLT-01)', () => {
  const client = new TestClient('test');

  it('adds https:// to bare hostnames', () => {
    expect(client.normalize('store.example.com')).toBe('https://store.example.com');
  });

  it('keeps https:// URLs unchanged', () => {
    expect(client.normalize('https://store.example.com/')).toBe('https://store.example.com');
  });

  it('upgrades explicit http:// remote URLs to https so credentials never cross plaintext', () => {
    expect(client.normalize('http://store.example.com')).toBe('https://store.example.com');
    expect(client.normalize('http://staging.merchant.io:8080')).toBe('https://staging.merchant.io:8080');
  });

  it('keeps http:// for loopback development targets', () => {
    expect(client.normalize('http://localhost:8080')).toBe('http://localhost:8080');
    expect(client.normalize('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000');
    expect(client.normalize('http://[::1]:8080')).toBe('http://[::1]:8080');
  });

  it('keeps http:// for private-LAN hosts (in-store servers without TLS)', () => {
    expect(client.normalize('http://192.168.1.50')).toBe('http://192.168.1.50');
    expect(client.normalize('http://10.0.0.4')).toBe('http://10.0.0.4');
    expect(client.normalize('http://172.16.5.9')).toBe('http://172.16.5.9');
    expect(client.normalize('http://register-2.local')).toBe('http://register-2.local');
  });

  it('upgrades http:// for public IPs and non-private ranges', () => {
    expect(client.normalize('http://8.8.8.8')).toBe('https://8.8.8.8');
    expect(client.normalize('http://172.32.0.1')).toBe('https://172.32.0.1');
  });

  it('returns empty string for empty input', () => {
    expect(client.normalize('')).toBe('');
  });
});
