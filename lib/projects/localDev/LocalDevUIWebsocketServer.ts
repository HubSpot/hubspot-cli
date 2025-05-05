import { WebSocketServer, WebSocket } from 'ws';
import {
  isPortManagerServerRunning,
  requestPorts,
} from '@hubspot/local-dev-lib/portManager';
import { logger } from '@hubspot/local-dev-lib/logger';
import { LOCAL_DEV_UI_WEBSOCKET_MESSAGE_TYPES } from '../../constants';
import { LocalDevUIWebsocketMessage } from '../../../types/LocalDev';
import { ProjectConfig } from '../../../types/Projects';
const SERVER_INSTANCE_ID = 'local-dev-ui-websocket-server';

const LOG_PREFIX = '[LocalDevUIWebsocketServer] ';

class LocalDevUIWebsocketServer {
  private _server?: WebSocketServer;
  private _websocket?: WebSocket;
  private debug?: boolean;
  private accountId?: number;
  private projectConfig?: ProjectConfig;
  private projectDir?: string;

  constructor() {}

  // private server(): WebSocketServer {
  //   if (!this._server) {
  //     throw new Error('@TODO LocalDevUIWebsocketServer not initialized');
  //   }
  //   return this._server;
  // }

  private websocket(): WebSocket {
    if (!this._websocket) {
      throw new Error('@TODO LocalDevUIWebsocketServer not initialized');
    }
    return this._websocket;
  }

  private log(...args: string[]) {
    if (this.debug) {
      logger.log(LOG_PREFIX, args);
    }
  }

  private logError(...args: unknown[]) {
    if (this.debug) {
      logger.error(LOG_PREFIX, ...args);
    }
  }

  private setupMessageHandlers() {
    this.websocket().on('message', data => {
      try {
        const message: LocalDevUIWebsocketMessage = JSON.parse(data.toString());

        if (!message.type) {
          this.logError(
            '@TODO Unsupported message received. Missing type field:',
            data.toString()
          );
          return;
        }

        switch (message.type) {
          case LOCAL_DEV_UI_WEBSOCKET_MESSAGE_TYPES.UPLOAD:
            console.log('run upload');
            break;
          case LOCAL_DEV_UI_WEBSOCKET_MESSAGE_TYPES.INSTALL_DEPS:
            console.log('run install deps');
            break;
          case LOCAL_DEV_UI_WEBSOCKET_MESSAGE_TYPES.APP_INSTALLED:
            console.log('app installed');
            break;
          default:
            console.log(
              '@TODO Unsupported message received. Unknown message type:',
              message.type
            );
        }
      } catch (e) {
        this.logError(
          '@TODO Unsupported message received. Invalid JSON:',
          data.toString()
        );
      }
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

    this.log(`LocalDevUIWebsocketServer running on port ${port}`);
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
