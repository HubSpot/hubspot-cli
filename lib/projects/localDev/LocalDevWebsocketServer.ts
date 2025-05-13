import { WebSocketServer, WebSocket } from 'ws';
import {
  isPortManagerServerRunning,
  requestPorts,
} from '@hubspot/local-dev-lib/portManager';
import { logger } from '@hubspot/local-dev-lib/logger';
import { LOCAL_DEV_UI_WEBSOCKET_MESSAGE_TYPES } from '../../constants';
import { LocalDevWebsocketMessage } from '../../../types/LocalDev';
import LocalDevProcess from './LocalDevProcess';
import { lib } from '../../../lang/en';

const SERVER_INSTANCE_ID = 'local-dev-ui-websocket-server';

const LOG_PREFIX = '[LocalDevWebsocketServer]';

class LocalDevWebsocketServer {
  private server?: WebSocketServer;
  private _websocket?: WebSocket;
  private debug?: boolean;
  private localDevProcess: LocalDevProcess;

  constructor(localDevProcess: LocalDevProcess, debug?: boolean) {
    this.localDevProcess = localDevProcess;
    this.debug = debug;
  }

  private websocket(): WebSocket {
    if (!this._websocket) {
      throw new Error(
        lib.LocalDevWebsocketServer.errors.notInitialized(LOG_PREFIX)
      );
    }
    return this._websocket;
  }

  private log(message: string) {
    if (this.debug) {
      logger.log(LOG_PREFIX, message);
    }
  }

  private logError(message: string) {
    if (this.debug) {
      logger.error(LOG_PREFIX, message);
    }
  }

  private setupMessageHandlers() {
    this.websocket().on('message', data => {
      try {
        const message: LocalDevWebsocketMessage = JSON.parse(data.toString());

        if (!message.type) {
          this.logError(
            lib.LocalDevWebsocketServer.errors.missingTypeField(data.toString())
          );
          return;
        }

        switch (message.type) {
          case LOCAL_DEV_UI_WEBSOCKET_MESSAGE_TYPES.UPLOAD:
            this.localDevProcess.uploadProject();
            break;
          case LOCAL_DEV_UI_WEBSOCKET_MESSAGE_TYPES.INSTALL_DEPS:
            break;
          case LOCAL_DEV_UI_WEBSOCKET_MESSAGE_TYPES.APP_INSTALLED:
            break;
          default:
            this.logError(
              lib.LocalDevWebsocketServer.errors.unknownMessageType(
                message.type
              )
            );
        }
      } catch (e) {
        this.logError(
          lib.LocalDevWebsocketServer.errors.invalidJSON(data.toString())
        );
      }
    });
  }

  async start() {
    const portManagerIsRunning = await isPortManagerServerRunning();
    if (!portManagerIsRunning) {
      throw new Error(
        lib.LocalDevWebsocketServer.errors.portManagerNotRunning(LOG_PREFIX)
      );
    }

    const portData = await requestPorts([{ instanceId: SERVER_INSTANCE_ID }]);
    const port = portData[SERVER_INSTANCE_ID];

    this.server = new WebSocketServer({ port });

    this.log(lib.LocalDevWebsocketServer.logs.startup(port));
    this.server.on('connection', ws => {
      this._websocket = ws;
      this.setupMessageHandlers();
    });
  }

  shutdown() {
    this.server?.close();
    this.server = undefined;
    this._websocket = undefined;
  }
}

export default LocalDevWebsocketServer;
