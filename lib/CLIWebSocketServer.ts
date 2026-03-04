import { WebSocketServer, WebSocket } from 'ws';
import {
  isPortManagerServerRunning,
  requestPorts,
} from '@hubspot/local-dev-lib/portManager';
import { uiLogger } from './ui/logger.js';
import { lib } from '../lang/en.js';
import { pkg } from './jsonLoader.js';

const DOMAINS = ['hubspot.com', 'hubspotqa.com'];
const SUBDOMAINS = ['local', 'app', 'app-na2', 'app-na3', 'app-ap1', 'app-eu1'];
const ALLOWED_ORIGIN_REGEX = new RegExp(
  `^https://(${SUBDOMAINS.join('|')})\\.(${DOMAINS.join('|')})$`
);
const CLI_METADATA_MESSAGE_TYPE = 'server:cliMetadata';

export type CLIWebSocketMessage = {
  type: string;
  data?: unknown;
};

class CLIWebSocketServer {
  private server?: WebSocketServer;
  private instanceId: string;
  private logPrefix?: string;
  private debug?: boolean;

  constructor({
    instanceId,
    logPrefix,
    debug,
  }: {
    instanceId: string;
    logPrefix?: string;
    debug?: boolean;
  }) {
    this.instanceId = instanceId;
    this.logPrefix = logPrefix;
    this.debug = debug;
  }

  private log(message: string): void {
    if (this.debug) {
      uiLogger.log(`${this.logPrefix} ${message}`);
    }
  }

  private logError(message: string): void {
    if (this.debug) {
      uiLogger.error(`${this.logPrefix} ${message}`);
    }
  }

  sendMessage(websocket: WebSocket, message: CLIWebSocketMessage): void {
    websocket.send(JSON.stringify(message));
  }

  private sendCliMetadata(
    websocket: WebSocket,
    metadata?: Record<string, unknown>
  ): void {
    this.sendMessage(websocket, {
      type: CLI_METADATA_MESSAGE_TYPE,
      data: {
        cliVersion: pkg.version,
        ...metadata,
      },
    });
  }

  async start({
    onConnection,
    onMessage,
    onClose,
    metadata,
  }: {
    onConnection?: (websocket: WebSocket) => void;
    onMessage?: (websocket: WebSocket, message: CLIWebSocketMessage) => boolean;
    onClose?: () => void;
    metadata?: Record<string, unknown>;
  }) {
    const portManagerIsRunning = await isPortManagerServerRunning();
    if (!portManagerIsRunning) {
      throw new Error(
        lib.CLIWebsocketServer.errors.portManagerNotRunning(this.logPrefix)
      );
    }

    const portData = await requestPorts([{ instanceId: this.instanceId }]);
    const port = portData[this.instanceId];

    this.server = new WebSocketServer({ port });

    this.log(lib.CLIWebsocketServer.logs.startup(port));

    this.server.on('connection', (ws, req) => {
      const origin = req.headers.origin;
      if (!origin || !ALLOWED_ORIGIN_REGEX.test(origin)) {
        ws.close(1008, lib.CLIWebsocketServer.errors.originNotAllowed(origin));
        return;
      }

      this.sendCliMetadata(ws, metadata);

      if (onConnection) {
        onConnection(ws);
      }

      ws.on('message', data => {
        try {
          const message: CLIWebSocketMessage = JSON.parse(data.toString());

          if (!message.type) {
            this.logError(
              lib.CLIWebsocketServer.errors.missingTypeField(data.toString())
            );
            return;
          }

          if (onMessage) {
            const messageHandled = onMessage(ws, message);
            if (!messageHandled) {
              this.logError(
                lib.CLIWebsocketServer.errors.unknownMessageType(message.type)
              );
            }
          }
        } catch (e) {
          this.logError(
            lib.CLIWebsocketServer.errors.invalidJSON(data.toString())
          );
        }
      });
    });

    this.server.on('close', () => {
      if (onClose) {
        onClose();
      }
    });
  }

  shutdown() {
    this.server?.close();
    this.server = undefined;
  }
}

export default CLIWebSocketServer;
