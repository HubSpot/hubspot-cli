import { WebSocketServer, WebSocket } from 'ws';
import {
  isPortManagerServerRunning,
  requestPorts,
} from '@hubspot/local-dev-lib/portManager';
import { uiLogger } from '../ui/logger.js';
import CLIWebSocketServer from '../CLIWebSocketServer.js';
import { lib } from '../../lang/en.js';
import { pkg } from '../jsonLoader.js';
import { Mocked, Mock } from 'vitest';

vi.mock('ws');
vi.mock('@hubspot/local-dev-lib/portManager');

const INSTANCE_ID = 'test-websocket-server';
const LOG_PREFIX = '[TestWebSocketServer]';
const PORT = 1234;

describe('CLIWebSocketServer', () => {
  let mockWebSocket: Mocked<WebSocket>;
  let mockWebSocketServer: Mocked<WebSocketServer>;
  let server: CLIWebSocketServer;

  beforeEach(() => {
    mockWebSocket = {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
    } as unknown as Mocked<WebSocket>;

    mockWebSocketServer = {
      on: vi.fn(),
      close: vi.fn(),
    } as unknown as Mocked<WebSocketServer>;

    (WebSocketServer as unknown as Mock).mockImplementation(
      () => mockWebSocketServer
    );

    server = new CLIWebSocketServer({
      instanceId: INSTANCE_ID,
      logPrefix: LOG_PREFIX,
      debug: true,
    });
  });

  describe('start()', () => {
    it('should throw error if port manager is not running', async () => {
      (isPortManagerServerRunning as Mock).mockResolvedValue(false);

      await expect(server.start({})).rejects.toThrow(
        lib.CLIWebsocketServer.errors.portManagerNotRunning(LOG_PREFIX)
      );
    });

    it('should start websocket server on the assigned port', async () => {
      (isPortManagerServerRunning as Mock).mockResolvedValue(true);
      (requestPorts as Mock).mockResolvedValue({
        [INSTANCE_ID]: PORT,
      });

      await server.start({});

      expect(WebSocketServer).toHaveBeenCalledWith({ port: PORT });
      expect(mockWebSocketServer.on).toHaveBeenCalledWith(
        'connection',
        expect.any(Function)
      );
    });

    it('should log startup message when debug is enabled', async () => {
      (isPortManagerServerRunning as Mock).mockResolvedValue(true);
      (requestPorts as Mock).mockResolvedValue({
        [INSTANCE_ID]: PORT,
      });

      await server.start({});

      expect(uiLogger.log).toHaveBeenCalledWith(
        expect.stringContaining(String(PORT))
      );
    });
  });

  describe('origin validation', () => {
    const validOrigins = [
      'https://app.hubspot.com',
      'https://app.hubspotqa.com',
      'https://local.hubspot.com',
      'https://local.hubspotqa.com',
      'https://app-na2.hubspot.com',
      'https://app-na2.hubspotqa.com',
      'https://app-na3.hubspot.com',
      'https://app-na3.hubspotqa.com',
      'https://app-ap1.hubspot.com',
      'https://app-ap1.hubspotqa.com',
      'https://app-eu1.hubspot.com',
      'https://app-eu1.hubspotqa.com',
    ];

    let connectionCallback: (
      ws: WebSocket,
      req: { headers: { origin?: string } }
    ) => void;

    beforeEach(async () => {
      (isPortManagerServerRunning as Mock).mockResolvedValue(true);
      (requestPorts as Mock).mockResolvedValue({
        [INSTANCE_ID]: PORT,
      });
      await server.start({});
      connectionCallback = mockWebSocketServer.on.mock
        .calls[0][1] as typeof connectionCallback;
    });

    validOrigins.forEach(origin => {
      it(`should accept connection from ${origin}`, () => {
        connectionCallback(mockWebSocket, { headers: { origin } });

        expect(mockWebSocket.close).not.toHaveBeenCalled();
        expect(mockWebSocket.on).toHaveBeenCalledWith(
          'message',
          expect.any(Function)
        );
      });
    });

    const invalidOrigins = [
      'https://malicious-site.com',
      'https://app.malicious-site.com',
      'https://app.hubspot.com.evil.com',
    ];

    invalidOrigins.forEach(origin => {
      it(`should reject connection from "${origin}"`, () => {
        connectionCallback(mockWebSocket, { headers: { origin } });

        expect(mockWebSocket.close).toHaveBeenCalledWith(
          1008,
          lib.CLIWebsocketServer.errors.originNotAllowed(origin)
        );
        expect(mockWebSocket.on).not.toHaveBeenCalled();
      });
    });

    it('should reject connection with no origin header', () => {
      connectionCallback(mockWebSocket, { headers: {} });

      expect(mockWebSocket.close).toHaveBeenCalledWith(
        1008,
        lib.CLIWebsocketServer.errors.originNotAllowed()
      );
      expect(mockWebSocket.on).not.toHaveBeenCalled();
    });
  });

  describe('sendCliMetadata', () => {
    let connectionCallback: (
      ws: WebSocket,
      req: { headers: { origin?: string } }
    ) => void;

    beforeEach(async () => {
      (isPortManagerServerRunning as Mock).mockResolvedValue(true);
      (requestPorts as Mock).mockResolvedValue({
        [INSTANCE_ID]: PORT,
      });
    });

    it('should send cliVersion on connection', async () => {
      await server.start({});
      connectionCallback = mockWebSocketServer.on.mock
        .calls[0][1] as typeof connectionCallback;

      connectionCallback(mockWebSocket, {
        headers: { origin: 'https://app.hubspot.com' },
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'server:cliMetadata',
          data: { cliVersion: pkg.version },
        })
      );
    });

    it('should merge additional metadata when provided', async () => {
      await server.start({
        metadata: { customField: 'customValue', version: 2 },
      });
      connectionCallback = mockWebSocketServer.on.mock
        .calls[0][1] as typeof connectionCallback;

      connectionCallback(mockWebSocket, {
        headers: { origin: 'https://app.hubspot.com' },
      });

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'server:cliMetadata',
          data: {
            cliVersion: pkg.version,
            customField: 'customValue',
            version: 2,
          },
        })
      );
    });
  });

  describe('callbacks', () => {
    let connectionCallback: (
      ws: WebSocket,
      req: { headers: { origin?: string } }
    ) => void;

    beforeEach(async () => {
      (isPortManagerServerRunning as Mock).mockResolvedValue(true);
      (requestPorts as Mock).mockResolvedValue({
        [INSTANCE_ID]: PORT,
      });
    });

    it('should call onConnection for valid connections', async () => {
      const onConnection = vi.fn();
      await server.start({ onConnection });
      connectionCallback = mockWebSocketServer.on.mock
        .calls[0][1] as typeof connectionCallback;

      connectionCallback(mockWebSocket, {
        headers: { origin: 'https://app.hubspot.com' },
      });

      expect(onConnection).toHaveBeenCalledWith(mockWebSocket);
    });

    it('should not call onConnection for rejected connections', async () => {
      const onConnection = vi.fn();
      await server.start({ onConnection });
      connectionCallback = mockWebSocketServer.on.mock
        .calls[0][1] as typeof connectionCallback;

      connectionCallback(mockWebSocket, {
        headers: { origin: 'https://malicious.com' },
      });

      expect(onConnection).not.toHaveBeenCalled();
    });

    it('should call onMessage when a valid message is received', async () => {
      const onMessage = vi.fn().mockReturnValue(true);
      await server.start({ onMessage });
      connectionCallback = mockWebSocketServer.on.mock
        .calls[0][1] as typeof connectionCallback;

      connectionCallback(mockWebSocket, {
        headers: { origin: 'https://app.hubspot.com' },
      });

      const messageCallback = mockWebSocket.on.mock.calls.find(
        call => call[0] === 'message'
      )![1] as (data: string) => void;

      messageCallback(
        JSON.stringify({ type: 'test:action', data: { key: 'value' } })
      );

      expect(onMessage).toHaveBeenCalledWith(mockWebSocket, {
        type: 'test:action',
        data: { key: 'value' },
      });
    });

    it('should log error when onMessage returns false', async () => {
      const onMessage = vi.fn().mockReturnValue(false);
      await server.start({ onMessage });
      connectionCallback = mockWebSocketServer.on.mock
        .calls[0][1] as typeof connectionCallback;

      connectionCallback(mockWebSocket, {
        headers: { origin: 'https://app.hubspot.com' },
      });

      const messageCallback = mockWebSocket.on.mock.calls.find(
        call => call[0] === 'message'
      )![1] as (data: string) => void;

      messageCallback(JSON.stringify({ type: 'UNKNOWN_TYPE' }));

      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('UNKNOWN_TYPE')
      );
    });

    it('should call onClose when server closes', async () => {
      const onClose = vi.fn();
      await server.start({ onClose });
      const closeCallback = mockWebSocketServer.on.mock.calls.find(
        call => call[0] === 'close'
      )![1] as () => void;

      closeCallback();

      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('message parsing', () => {
    let messageCallback: (data: string) => void;

    beforeEach(async () => {
      (isPortManagerServerRunning as Mock).mockResolvedValue(true);
      (requestPorts as Mock).mockResolvedValue({
        [INSTANCE_ID]: PORT,
      });
      await server.start({});
      const connectionCallback = mockWebSocketServer.on.mock.calls[0][1] as (
        ws: WebSocket,
        req: { headers: { origin?: string } }
      ) => void;
      connectionCallback(mockWebSocket, {
        headers: { origin: 'https://app.hubspot.com' },
      });
      messageCallback = mockWebSocket.on.mock.calls.find(
        call => call[0] === 'message'
      )![1] as (data: string) => void;
    });

    it('should log error for messages missing a type field', () => {
      messageCallback(JSON.stringify({}));

      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Missing type field')
      );
    });

    it('should log error for invalid JSON', () => {
      messageCallback('not valid json');

      expect(uiLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid JSON')
      );
    });
  });

  describe('sendMessage()', () => {
    it('should serialize and send a message to the websocket', () => {
      const message = { type: 'test:message', data: { foo: 'bar' } };

      server.sendMessage(mockWebSocket, message);

      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
    });
  });

  describe('shutdown()', () => {
    it('should close the websocket server', async () => {
      (isPortManagerServerRunning as Mock).mockResolvedValue(true);
      (requestPorts as Mock).mockResolvedValue({
        [INSTANCE_ID]: PORT,
      });

      await server.start({});
      server.shutdown();

      expect(mockWebSocketServer.close).toHaveBeenCalled();
    });

    it('should handle shutdown when server was never started', () => {
      expect(() => server.shutdown()).not.toThrow();
    });
  });
});
