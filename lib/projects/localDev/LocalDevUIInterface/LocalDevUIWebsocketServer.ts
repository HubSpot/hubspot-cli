import { WebSocketServer, WebSocket } from 'ws';
import {
  isPortManagerServerRunning,
  requestPorts,
} from '@hubspot/local-dev-lib/portManager';
import { handleWebsocketMessage } from './messageHandlers';
import { LocalDevUIWebsocketMessage } from '../../../../types/LocalDevUIInterface';
const SERVER_INSTANCE_ID = 'local-dev-ui-websocket-server';

class LocalDevUIWebsocketServer {
  private _server?: WebSocketServer;
  private _websocket?: WebSocket;

  constructor() {}

  private server(): WebSocketServer {
    if (!this._server) {
      throw new Error('LocalDevUIWebsocketServer not initialized');
    }
    return this._server;
  }

  private websocket(): WebSocket {
    if (!this._websocket) {
      throw new Error('LocalDevUIWebsocketServer not initialized');
    }
    return this._websocket;
  }

  private setupMessageHandlers() {
    this.websocket().on('message', data => {
      const message: LocalDevUIWebsocketMessage = JSON.parse(data.toString());

      handleWebsocketMessage(message);
    });
  }

  async init() {
    const portManagerIsRunning = await isPortManagerServerRunning();
    if (!portManagerIsRunning) {
      throw new Error(
        '@TODO: PortManagerServing must be running before starting LocalDevUIWebsocketServer.'
      );
    }

    const portData = await requestPorts([{ instanceId: SERVER_INSTANCE_ID }]);
    const port = portData[SERVER_INSTANCE_ID];

    this._server = new WebSocketServer({ port });

    this._server.on('connection', ws => {
      this._websocket = ws;
      this.setupMessageHandlers();
    });
  }

  shutdown() {
    this._server?.close();
    this._server = undefined;
    this._websocket = undefined;
  }
}

export default new LocalDevUIWebsocketServer();
