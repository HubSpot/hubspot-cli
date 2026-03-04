import { WebSocketServer, WebSocket } from 'ws';
import {
  isPortManagerServerRunning,
  requestPorts,
} from '@hubspot/local-dev-lib/portManager';
import {
  LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES,
  LOCAL_DEV_UI_MESSAGE_SEND_TYPES,
  LOCAL_DEV_SERVER_MESSAGE_TYPES,
} from '../../constants.js';
import LocalDevWebsocketServer from '../localDev/LocalDevWebsocketServer.js';
import LocalDevProcess from '../localDev/LocalDevProcess.js';
import { Mocked, Mock } from 'vitest';
import type { Dependencies } from '@hubspot/project-parsing-lib/transform';
import type { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib/translate';

vi.mock('ws');
vi.mock('@hubspot/local-dev-lib/portManager');

describe('LocalDevWebsocketServer', () => {
  let mockLocalDevProcess: Mocked<LocalDevProcess>;
  let mockWebSocket: Mocked<WebSocket>;
  let mockWebSocketServer: Mocked<WebSocketServer>;
  let server: LocalDevWebsocketServer;

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

    (WebSocketServer as unknown as Mock).mockImplementation(
      () => mockWebSocketServer
    );

    server = new LocalDevWebsocketServer(mockLocalDevProcess, true);
  });

  function startServerAndConnect(ws?: Mocked<WebSocket>) {
    const connectionCallback = mockWebSocketServer.on.mock.calls[0][1] as (
      ws: WebSocket,
      req: { headers: { origin?: string } }
    ) => void;
    connectionCallback(ws ?? mockWebSocket, {
      headers: { origin: 'https://app.hubspot.com' },
    });
  }

  describe('start()', () => {
    beforeEach(async () => {
      (isPortManagerServerRunning as Mock).mockResolvedValue(true);
      (requestPorts as Mock).mockResolvedValue({
        'local-dev-ui-websocket-server': 1234,
      });
      await server.start();
    });

    it('should send WEBSOCKET_SERVER_CONNECTED message when valid connection is established', () => {
      startServerAndConnect();

      expect(mockLocalDevProcess.sendDevServerMessage).toHaveBeenCalledWith(
        LOCAL_DEV_SERVER_MESSAGE_TYPES.WEBSOCKET_SERVER_CONNECTED
      );
    });

    it('should send project data on connection', () => {
      startServerAndConnect();

      expect(mockWebSocket.send).toHaveBeenCalledWith(
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

    it('should setup state listeners on connection', () => {
      startServerAndConnect();

      expect(mockLocalDevProcess.addStateListener).toHaveBeenCalledWith(
        'projectNodes',
        expect.any(Function)
      );
      expect(mockLocalDevProcess.addStateListener).toHaveBeenCalledWith(
        'appData',
        expect.any(Function)
      );
      expect(mockLocalDevProcess.addStateListener).toHaveBeenCalledWith(
        'uploadWarnings',
        expect.any(Function)
      );
      expect(mockLocalDevProcess.addStateListener).toHaveBeenCalledWith(
        'devServersStarted',
        expect.any(Function)
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
      startServerAndConnect();
    });

    it('should handle UPLOAD message type', () => {
      const messageCallback = mockWebSocket.on.mock.calls.find(
        call => call[0] === 'message'
      )![1] as (data: string) => void;

      messageCallback(
        JSON.stringify({ type: LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES.UPLOAD })
      );

      expect(mockLocalDevProcess.uploadProject).toHaveBeenCalled();
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

      (isPortManagerServerRunning as Mock).mockResolvedValue(true);
      (requestPorts as Mock).mockResolvedValue({
        'local-dev-ui-websocket-server': 1234,
      });
      await server.start();

      connectionCallback = mockWebSocketServer.on.mock.calls[0][1] as (
        ws: WebSocket,
        req: { headers: { origin?: string } }
      ) => void;
    });

    it('should handle multiple valid connections simultaneously', () => {
      connectionCallback(mockWebSocket1, {
        headers: { origin: 'https://app.hubspot.com' },
      });
      connectionCallback(mockWebSocket2, {
        headers: { origin: 'https://app-na2.hubspotqa.com' },
      });
      connectionCallback(mockWebSocket3, {
        headers: { origin: 'https://local.hubspot.com' },
      });

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

      expect(mockLocalDevProcess.addStateListener).toHaveBeenCalledTimes(12);
      expect(mockLocalDevProcess.sendDevServerMessage).toHaveBeenCalledTimes(3);
      expect(mockLocalDevProcess.sendDevServerMessage).toHaveBeenCalledWith(
        LOCAL_DEV_SERVER_MESSAGE_TYPES.WEBSOCKET_SERVER_CONNECTED
      );

      expect(mockWebSocket1.close).not.toHaveBeenCalled();
      expect(mockWebSocket2.close).not.toHaveBeenCalled();
      expect(mockWebSocket3.close).not.toHaveBeenCalled();
    });

    it('should send project data to each connection independently', () => {
      connectionCallback(mockWebSocket1, {
        headers: { origin: 'https://app.hubspot.com' },
      });
      connectionCallback(mockWebSocket2, {
        headers: { origin: 'https://app-eu1.hubspotqa.com' },
      });

      const expectedProjectData = JSON.stringify({
        type: LOCAL_DEV_UI_MESSAGE_SEND_TYPES.UPDATE_PROJECT_DATA,
        data: {
          projectName: 'test-project',
          projectId: 123,
          latestBuild: { id: 'build-1', status: 'SUCCESS' },
          deployedBuild: { id: 'build-1', status: 'SUCCESS' },
          targetProjectAccountId: 456,
          targetTestingAccountId: 789,
        },
      });

      expect(mockWebSocket1.send).toHaveBeenCalledWith(expectedProjectData);
      expect(mockWebSocket2.send).toHaveBeenCalledWith(expectedProjectData);
    });

    it('should properly cleanup listeners when connections close', () => {
      connectionCallback(mockWebSocket1, {
        headers: { origin: 'https://app.hubspot.com' },
      });
      connectionCallback(mockWebSocket2, {
        headers: { origin: 'https://app-ap1.hubspotqa.com' },
      });

      const closeCallbacks1 = mockWebSocket1.on.mock.calls
        .filter(call => call[0] === 'close')
        .map(call => call[1] as () => void);
      const closeCallbacks2 = mockWebSocket2.on.mock.calls
        .filter(call => call[0] === 'close')
        .map(call => call[1] as () => void);

      expect(closeCallbacks1).toHaveLength(4);
      expect(closeCallbacks2).toHaveLength(4);

      closeCallbacks1.forEach(callback => callback());
      expect(mockLocalDevProcess.removeStateListener).toHaveBeenCalledTimes(4);

      closeCallbacks2.forEach(callback => callback());
      expect(mockLocalDevProcess.removeStateListener).toHaveBeenCalledTimes(8);
    });

    it('should broadcast state changes to all connected clients', () => {
      connectionCallback(mockWebSocket1, {
        headers: { origin: 'https://app.hubspot.com' },
      });
      connectionCallback(mockWebSocket2, {
        headers: { origin: 'https://local.hubspotqa.com' },
      });

      const projectNodesListeners =
        mockLocalDevProcess.addStateListener.mock.calls
          .filter(call => call[0] === 'projectNodes')
          .map(call => call[1]);

      expect(projectNodesListeners).toHaveLength(2);

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

      const expectedMessage = JSON.stringify({
        type: LOCAL_DEV_UI_MESSAGE_SEND_TYPES.UPDATE_PROJECT_NODES,
        data: mockProjectNodes,
      });

      expect(mockWebSocket1.send).toHaveBeenCalledWith(expectedMessage);
      expect(mockWebSocket2.send).toHaveBeenCalledWith(expectedMessage);
    });
  });
});
