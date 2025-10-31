import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import http from 'http';
import { AddressInfo } from 'net';
import { isServerRunningAtUrl } from '../http.js';

describe('isServerRunningAtUrl', () => {
  let server: http.Server;
  let serverPort: number;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      res.writeHead(200);
      res.end('OK');
    });

    await new Promise<void>(resolve => {
      server.listen(0, () => {
        serverPort = (server.address() as AddressInfo).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>(resolve => {
      server.close(() => resolve());
    });
  });

  it('should return true when a server is running', async () => {
    const result = await isServerRunningAtUrl(`http://localhost:${serverPort}`);
    expect(result).toBe(true);
  });

  it('should return false when connection is refused', async () => {
    const result = await isServerRunningAtUrl('http://localhost:59999');
    expect(result).toBe(false);
  });

  it('should return false for invalid URLs', async () => {
    const result = await isServerRunningAtUrl('not-a-valid-url');
    expect(result).toBe(false);
  });

  it('should handle different paths on the same server', async () => {
    const result = await isServerRunningAtUrl(
      `http://localhost:${serverPort}/some/path`
    );
    expect(result).toBe(true);
  });
});
