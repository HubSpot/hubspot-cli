import { WebSocketServer, WebSocket } from 'ws';
import {
  isPortManagerServerRunning,
  requestPorts,
} from '@hubspot/local-dev-lib/portManager';
import { logger } from '@hubspot/local-dev-lib/logger';
import {
  LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES,
  LOCAL_DEV_UI_MESSAGE_SEND_TYPES,
  LOCAL_DEV_SERVER_MESSAGE_TYPES,
} from '../../constants.js';
import LocalDevWebsocketServer from '../localDev/LocalDevWebsocketServer.js';
import LocalDevProcess from '../localDev/LocalDevProcess.js';
import { lib } from '../../../lang/en.js';
import { Mocked, Mock } from 'vitest';
import { Dependencies } from '@hubspot/project-parsing-lib/src/lib/types.js';
import { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib';

vi.mock('ws');
vi.mock('@hubspot/local-dev-lib/portManager');
vi.mock('@hubspot/local-dev-lib/logger');

describe('LocalDevWebsocketServer', () => {
  let mockLocalDevProcess: Mocked<LocalDevProcess>;
  let mockWebSocket: Mocked<WebSocket>;
  let mockWebSocketServer: Mocked<WebSocketServer>;
  let server: LocalDevWebsocketServer;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Setup mock WebSocket
    mockWebSocket = {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn(),
    } as unknown as Mocked<WebSocket>;

    // Setup mock WebSocketServer
    mockWebSocketServer = {
      on: vi.fn(),
      close: vi.fn(),
    } as unknown as Mocked<WebSocketServer>;

    // Setup mock LocalDevProcess
    mockLocalDevProcess = {
      addStateListener: vi.fn(),
      removeStateListener: vi.fn(),
      uploadProject: vi.fn().mockResolvedValue({}),
      sendDevServerMessage: vi.fn(),
      projectData: {
        name: 'test-project',
        id: 123,
        latestBuild: { id: 'build-1', status: 'SUCCESS' },
        deployedBuild: { id: 'build-1', status: 'SUCCESS' },
      },
      targetProjectAccountId: 456,
      targetTestingAccountId: 789,
    } as unknown as Mocked<LocalDevProcess>;

    // Mock WebSocketServer constructor
    (WebSocketServer as unknown as Mock).mockImplementation(
      () => mockWebSocketServer
    );

    // Create server instance
    server = new LocalDevWebsocketServer(mockLocalDevProcess, true);
  });

  describe('start()', () => {
    it('should throw error if port manager is not running', async () => {
      (isPortManagerServerRunning as Mock).mockResolvedValue(false);

      await expect(server.start()).rejects.toThrow();
    });

    it('should start websocket server successfully', async () => {
      (isPortManagerServerRunning as Mock).mockResolvedValue(true);
      (requestPorts as Mock).mockResolvedValue({
        'local-dev-ui-websocket-server': 1234,
      });

      await server.start();

      expect(WebSocketServer).toHaveBeenCalledWith({ port: 1234 });
      expect(mockWebSocketServer.on).toHaveBeenCalledWith(
        'connection',
        expect.any(Function)
      );
      expect(logger.log).toHaveBeenCalled();
    });

    describe('valid origins', () => {
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

      validOrigins.forEach(origin => {
        it(`should accept connection from ${origin}`, async () => {
          (isPortManagerServerRunning as Mock).mockResolvedValue(true);
          (requestPorts as Mock).mockResolvedValue({
            'local-dev-ui-websocket-server': 1234,
          });

          await server.start();

          // Get the connection callback
          const connectionCallback = mockWebSocketServer.on.mock
            .calls[0][1] as (
            ws: WebSocket,
            req: { headers: { origin?: string } }
          ) => void;

          // Simulate connection from valid origin
          connectionCallback(mockWebSocket, {
            headers: { origin },
          });

          expect(mockWebSocket.on).toHaveBeenCalledWith(
            'message',
            expect.any(Function)
          );
          expect(mockLocalDevProcess.addStateListener).toHaveBeenCalledWith(
            'projectNodes',
            expect.any(Function)
          );
          expect(mockWebSocket.close).not.toHaveBeenCalled();
        });
      });
    });

    describe('invalid origins', () => {
      const invalidOrigins = [
        'https://malicious-site.com',
        'https://app.malicious-site.com',
        'https://app.hubspot.com.evil.com',
      ];

      invalidOrigins.forEach(origin => {
        it(`should reject connection from "${origin}"`, async () => {
          (isPortManagerServerRunning as Mock).mockResolvedValue(true);
          (requestPorts as Mock).mockResolvedValue({
            'local-dev-ui-websocket-server': 1234,
          });

          await server.start();

          // Get the connection callback
          const connectionCallback = mockWebSocketServer.on.mock
            .calls[0][1] as (
            ws: WebSocket,
            req: { headers: { origin?: string } }
          ) => void;

          // Simulate connection from invalid origin
          connectionCallback(mockWebSocket, {
            headers: { origin },
          });

          expect(mockWebSocket.close).toHaveBeenCalledWith(
            1008,
            lib.LocalDevWebsocketServer.errors.originNotAllowed(origin)
          );
          expect(mockWebSocket.on).not.toHaveBeenCalled();
          expect(mockLocalDevProcess.addStateListener).not.toHaveBeenCalled();
        });
      });
    });

    it('should reject connection with no origin header', async () => {
      (isPortManagerServerRunning as Mock).mockResolvedValue(true);
      (requestPorts as Mock).mockResolvedValue({
        'local-dev-ui-websocket-server': 1234,
      });

      await server.start();

      // Get the connection callback
      const connectionCallback = mockWebSocketServer.on.mock.calls[0][1] as (
        ws: WebSocket,
        req: { headers: { origin?: string } }
      ) => void;

      // Simulate connection with no origin header
      connectionCallback(mockWebSocket, {
        headers: {},
      });

      expect(mockWebSocket.close).toHaveBeenCalledWith(
        1008,
        lib.LocalDevWebsocketServer.errors.originNotAllowed()
      );
      expect(mockWebSocket.on).not.toHaveBeenCalled();
      expect(mockLocalDevProcess.addStateListener).not.toHaveBeenCalled();
    });

    it('should send WEBSOCKET_SERVER_CONNECTED message when valid connection is established', async () => {
      (isPortManagerServerRunning as Mock).mockResolvedValue(true);
      (requestPorts as Mock).mockResolvedValue({
        'local-dev-ui-websocket-server': 1234,
      });

      await server.start();

      // Get the connection callback
      const connectionCallback = mockWebSocketServer.on.mock.calls[0][1] as (
        ws: WebSocket,
        req: { headers: { origin?: string } }
      ) => void;

      // Simulate connection from valid origin
      connectionCallback(mockWebSocket, {
        headers: { origin: 'https://app-na3.hubspot.com' },
      });

      expect(mockLocalDevProcess.sendDevServerMessage).toHaveBeenCalledWith(
        LOCAL_DEV_SERVER_MESSAGE_TYPES.WEBSOCKET_SERVER_CONNECTED
      );
    });
  });

  describe('message handling', () => {
    beforeEach(async () => {
      (isPortManagerServerRunning as Mock).mockResolvedValue(true);
      (requestPorts as Mock).mockResolvedValue({
        'local-dev-ui-websocket-server': 1234,
      });
      await server.start();
      const connectionCallback = mockWebSocketServer.on.mock.calls[0][1] as (
        ws: WebSocket,
        req: { headers: { origin?: string } }
      ) => void;
      connectionCallback(mockWebSocket, {
        headers: { origin: 'https://app.hubspot.com' },
      });
    });

    it('should handle UPLOAD message type', () => {
      const messageCallback = mockWebSocket.on.mock.calls[0][1] as (
        data: string
      ) => void;
      const message = {
        type: LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES.UPLOAD,
      };

      messageCallback(JSON.stringify(message));

      expect(mockLocalDevProcess.uploadProject).toHaveBeenCalled();
    });

    it('should log error for missing message type', () => {
      const messageCallback = mockWebSocket.on.mock.calls[0][1] as (
        data: string
      ) => void;
      const message = {};

      messageCallback(JSON.stringify(message));

      expect(logger.error).toHaveBeenCalled();
    });

    it('should log error for unknown message type', () => {
      const messageCallback = mockWebSocket.on.mock.calls[0][1] as (
        data: string
      ) => void;
      const message = {
        type: 'UNKNOWN_TYPE',
      };

      messageCallback(JSON.stringify(message));

      expect(logger.error).toHaveBeenCalled();
    });

    it('should log error for invalid JSON', () => {
      const messageCallback = mockWebSocket.on.mock.calls[0][1] as (
        data: string
      ) => void;
      const invalidJson = 'invalid json';

      messageCallback(invalidJson);

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('shutdown()', () => {
    it('should close the websocket server', async () => {
      (isPortManagerServerRunning as Mock).mockResolvedValue(true);
      (requestPorts as Mock).mockResolvedValue({
        'local-dev-ui-websocket-server': 1234,
      });

      await server.start();
      server.shutdown();

      expect(mockWebSocketServer.close).toHaveBeenCalled();
    });
  });

  describe('multiple connections', () => {
    let mockWebSocket1: Mocked<WebSocket>;
    let mockWebSocket2: Mocked<WebSocket>;
    let mockWebSocket3: Mocked<WebSocket>;
    let connectionCallback: (
      ws: WebSocket,
      req: { headers: { origin?: string } }
    ) => void;

    beforeEach(async () => {
      // Setup multiple mock WebSockets
      mockWebSocket1 = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
      } as unknown as Mocked<WebSocket>;

      mockWebSocket2 = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
      } as unknown as Mocked<WebSocket>;

      mockWebSocket3 = {
        on: vi.fn(),
        send: vi.fn(),
        close: vi.fn(),
      } as unknown as Mocked<WebSocket>;

      // Start the server
      (isPortManagerServerRunning as Mock).mockResolvedValue(true);
      (requestPorts as Mock).mockResolvedValue({
        'local-dev-ui-websocket-server': 1234,
      });
      await server.start();

      // Get the connection callback
      connectionCallback = mockWebSocketServer.on.mock.calls[0][1] as (
        ws: WebSocket,
        req: { headers: { origin?: string } }
      ) => void;
    });

    it('should handle multiple valid connections simultaneously', () => {
      // Establish three connections from valid origins
      connectionCallback(mockWebSocket1, {
        headers: { origin: 'https://app.hubspot.com' },
      });
      connectionCallback(mockWebSocket2, {
        headers: { origin: 'https://app-na2.hubspotqa.com' },
      });
      connectionCallback(mockWebSocket3, {
        headers: { origin: 'https://local.hubspot.com' },
      });

      // All connections should be established with proper setup
      expect(mockWebSocket1.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
      expect(mockWebSocket2.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );
      expect(mockWebSocket3.on).toHaveBeenCalledWith(
        'message',
        expect.any(Function)
      );

      // Each connection should trigger state listener setup
      expect(mockLocalDevProcess.addStateListener).toHaveBeenCalledTimes(9); // 3 listeners per connection * 3 connections

      // Each connection should trigger dev server message
      expect(mockLocalDevProcess.sendDevServerMessage).toHaveBeenCalledTimes(3);
      expect(mockLocalDevProcess.sendDevServerMessage).toHaveBeenCalledWith(
        LOCAL_DEV_SERVER_MESSAGE_TYPES.WEBSOCKET_SERVER_CONNECTED
      );

      // No connections should be closed
      expect(mockWebSocket1.close).not.toHaveBeenCalled();
      expect(mockWebSocket2.close).not.toHaveBeenCalled();
      expect(mockWebSocket3.close).not.toHaveBeenCalled();
    });

    it('should send project data to each connection independently', () => {
      // Establish multiple connections
      connectionCallback(mockWebSocket1, {
        headers: { origin: 'https://app.hubspot.com' },
      });
      connectionCallback(mockWebSocket2, {
        headers: { origin: 'https://app-eu1.hubspotqa.com' },
      });

      // Each websocket should receive project data
      expect(mockWebSocket1.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: LOCAL_DEV_UI_MESSAGE_SEND_TYPES.UPDATE_PROJECT_DATA,
          data: {
            projectName: 'test-project',
            projectId: 123,
            latestBuild: { id: 'build-1', status: 'SUCCESS' },
            deployedBuild: { id: 'build-1', status: 'SUCCESS' },
            targetProjectAccountId: 456,
            targetTestingAccountId: 789,
          },
        })
      );

      expect(mockWebSocket2.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: LOCAL_DEV_UI_MESSAGE_SEND_TYPES.UPDATE_PROJECT_DATA,
          data: {
            projectName: 'test-project',
            projectId: 123,
            latestBuild: { id: 'build-1', status: 'SUCCESS' },
            deployedBuild: { id: 'build-1', status: 'SUCCESS' },
            targetProjectAccountId: 456,
            targetTestingAccountId: 789,
          },
        })
      );
    });

    it('should properly cleanup listeners when connections close', () => {
      // Establish connections
      connectionCallback(mockWebSocket1, {
        headers: { origin: 'https://app.hubspot.com' },
      });
      connectionCallback(mockWebSocket2, {
        headers: { origin: 'https://app-ap1.hubspotqa.com' },
      });

      // Get all the close callbacks for both connections (there should be 2 per connection)
      const closeCallbacks1 = mockWebSocket1.on.mock.calls
        .filter(call => call[0] === 'close')
        .map(call => call[1] as () => void);
      const closeCallbacks2 = mockWebSocket2.on.mock.calls
        .filter(call => call[0] === 'close')
        .map(call => call[1] as () => void);

      expect(closeCallbacks1).toHaveLength(3); // projectNodes, appData, and uploadWarnings listeners
      expect(closeCallbacks2).toHaveLength(3); // projectNodes, appData, and uploadWarnings listeners

      // Simulate first connection closing (call all close callbacks)
      closeCallbacks1.forEach(callback => callback());

      // Should have removed listeners for first connection (3 listeners: projectNodes, appData, and uploadWarnings)
      expect(mockLocalDevProcess.removeStateListener).toHaveBeenCalledTimes(3);

      // Simulate second connection closing
      closeCallbacks2.forEach(callback => callback());

      // Should have removed listeners for second connection as well
      expect(mockLocalDevProcess.removeStateListener).toHaveBeenCalledTimes(6);
    });

    it('should broadcast state changes to all connected clients', () => {
      // Establish connections
      connectionCallback(mockWebSocket1, {
        headers: { origin: 'https://app.hubspot.com' },
      });
      connectionCallback(mockWebSocket2, {
        headers: { origin: 'https://local.hubspotqa.com' },
      });

      // Get the projectNodes listeners that were registered
      const projectNodesListeners =
        mockLocalDevProcess.addStateListener.mock.calls
          .filter(call => call[0] === 'projectNodes')
          .map(call => call[1]);

      expect(projectNodesListeners).toHaveLength(2);

      // Simulate a project nodes update by calling the listeners
      const mockProjectNodes = {
        component1: {
          uid: 'component1',
          componentType: 'APP' as const,
          localDev: {
            componentRoot: '/test/path',
            componentConfigPath: '/test/path/config.json',
            configUpdatedSinceLastUpload: false,
            removed: false,
            parsingErrors: [],
          },
          componentDeps: {} as Dependencies,
          metaFilePath: '/test/path',
          config: {},
          files: [],
        },
      } as { [key: string]: IntermediateRepresentationNodeLocalDev };
      projectNodesListeners.forEach(listener => listener(mockProjectNodes));

      // Both websockets should receive the update
      expect(mockWebSocket1.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: LOCAL_DEV_UI_MESSAGE_SEND_TYPES.UPDATE_PROJECT_NODES,
          data: mockProjectNodes,
        })
      );

      expect(mockWebSocket2.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: LOCAL_DEV_UI_MESSAGE_SEND_TYPES.UPDATE_PROJECT_NODES,
          data: mockProjectNodes,
        })
      );
    });
  });
});
